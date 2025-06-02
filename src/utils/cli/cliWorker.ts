import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { GuardTag, LinePermission } from '@/types/guardTypes';
import type { GuardColors } from '../../tools/colorCustomizer/ColorConfigTypes';
import { errorHandler } from '../error/errorHandler';
import { getAclCliPath } from '../config/acl';
import { configManager } from '../config/configurationManager';

/**
 * CLI protocol interfaces matching the specification
 */
export interface CLIRequest {
  id: string;
  command: string;
  payload?: object;
}

export interface CLIResponse {
  id: string;
  status: 'success' | 'error';
  result?: object;
  error?: string;
  timing?: number;
}

export interface CLIStartupInfo {
  type: 'startup';
  version: string;
  capabilities: string[];
  ready: boolean;
}

export interface CLIVersionInfo {
  version: string;
  minCompatible: string;
  compatible: boolean;
}

export interface TextChange {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
  newText: string;
}

export interface ParseResult {
  guardTags: GuardTag[];
  linePermissions: LinePermission[];
  documentVersion: number;
}

export interface ThemeResponse {
  builtIn: Record<string, { name: string; colors: GuardColors }>;
  custom: Record<string, { name: string; colors: GuardColors }>;
}

export interface CreateThemeResponse {
  themeId: string;
  message: string;
}

export interface ExportThemeResponse {
  name: string;
  exportData: {
    name: string;
    colors: GuardColors;
    exportedAt: string;
    version: string;
  };
}

export interface ImportThemeResponse {
  themeId: string;
  message: string;
}

export interface SetThemeResponse {
  message: string;
  colors: GuardColors;
}

/**
 * CLI Worker class that manages persistent connection to CodeGuard CLI
 */
export class CLIWorker extends EventEmitter {
  private static instance?: CLIWorker;
  private process?: ChildProcess;
  private buffer = '';
  private pendingRequests = new Map<string, {
    resolve: (response: CLIResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private requestIdCounter = 0;
  private currentDocumentVersion = 0;
  private isReady = false;
  private startupInfo?: CLIStartupInfo;

  private readonly MIN_CLI_VERSION = '0.3.0';

  private get REQUEST_TIMEOUT(): number {
    return configManager().get('cliWorkerTimeout', 10000);
  }

  private get STARTUP_TIMEOUT(): number {
    return configManager().get('cliWorkerStartupTimeout', 5000);
  }

  private constructor() {
    super();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CLIWorker {
    if (!CLIWorker.instance) {
      CLIWorker.instance = new CLIWorker();
    }
    return CLIWorker.instance;
  }

  /**
   * Start the CLI worker process
   */
  async start(): Promise<CLIStartupInfo> {
    if (this.process) {
      throw new Error('CLI worker is already running');
    }

    return new Promise((resolve, reject) => {
      const cliPath = getAclCliPath();

      try {
        this.process = spawn(cliPath, ['--worker-mode'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false
        });

        this.setupProcessHandlers();

        // Wait for startup handshake
        const startupTimeout = setTimeout(() => {
          reject(new Error('CLI worker startup timeout'));
        }, this.STARTUP_TIMEOUT);

        this.once('startup', (info: CLIStartupInfo) => {
          clearTimeout(startupTimeout);
          this.startupInfo = info;
          this.isReady = true;
          resolve(info);
        });

        this.once('error', (error: Error) => {
          clearTimeout(startupTimeout);
          reject(error);
        });

      } catch (error) {
        reject(new Error(`Failed to start CLI worker: ${String(error)}`));
      }
    });
  }

  /**
   * Stop the CLI worker process
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    try {
      // Try graceful shutdown first
      if (this.isReady) {
        await this.sendShutdownCommand();
      }
    } catch (error) {
      // Ignore errors during shutdown
    }

    // Force kill if still running
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');

      // Force kill after 2 seconds
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 2000);
    }

    this.cleanup();
  }

  /**
   * Check if worker is ready to receive commands
   */
  isWorkerReady(): boolean {
    return this.isReady && !!this.process && !this.process.killed;
  }

  /**
   * Wait for the CLI worker to be ready (if it's starting up)
   * Returns immediately if already ready, or waits for startup event
   */
  async waitForReady(timeoutMs: number = 10000): Promise<void> {
    if (this.isWorkerReady()) {
      return; // Already ready
    }

    if (!this.process) {
      throw new Error('CLI worker is not started. Call start() first.');
    }

    // Wait for the startup event
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for CLI worker to be ready'));
      }, timeoutMs);

      const onStartup = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.once('startup', onStartup);
    });
  }

  /**
   * Get startup information
   */
  getStartupInfo(): CLIStartupInfo | undefined {
    return this.startupInfo;
  }

  /**
   * Set document content (initial load or document switch)
   */
  async setDocument(
    fileName: string,
    languageId: string,
    content: string
  ): Promise<ParseResult> {
    this.currentDocumentVersion++;

    const response = await this.sendRequest('setDocument', {
      fileName,
      languageId,
      content,
      version: this.currentDocumentVersion
    });

    if (response.status === 'error') {
      throw new Error(`CLI setDocument failed: ${response.error}`);
    }

    const result = response.result as ParseResult;
    result.documentVersion = this.currentDocumentVersion;
    return result;
  }

  /**
   * Apply delta changes to current document
   */
  async applyDelta(changes: TextChange[]): Promise<ParseResult> {
    this.currentDocumentVersion++;

    const response = await this.sendRequest('applyDelta', {
      version: this.currentDocumentVersion,
      changes
    });

    if (response.status === 'error') {
      throw new Error(`CLI applyDelta failed: ${response.error}`);
    }

    const result = response.result as ParseResult;
    result.documentVersion = this.currentDocumentVersion;
    return result;
  }

  /**
   * Check CLI version compatibility
   */
  async checkVersion(): Promise<CLIVersionInfo> {
    const response = await this.sendRequest('version');

    if (response.status === 'error') {
      throw new Error(`CLI version check failed: ${response.error}`);
    }

    const versionInfo = response.result as CLIVersionInfo;

    // Check compatibility and add to the response
    const isCompatible = this.isVersionCompatible(versionInfo.version, this.MIN_CLI_VERSION);

    return {
      ...versionInfo,
      compatible: isCompatible,
      minCompatible: this.MIN_CLI_VERSION
    };
  }

  /**
   * Check if CLI version meets minimum requirements
   */
  private isVersionCompatible(currentVersion: string, minVersion: string): boolean {
    const current = currentVersion.split('.').map(Number);
    const min = minVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(current.length, min.length); i++) {
      const currentPart = current[i] || 0;
      const minPart = min[i] || 0;

      if (currentPart > minPart) return true;
      if (currentPart < minPart) return false;
    }

    return true; // Equal versions are compatible
  }

  /**
   * Ping the CLI worker (health check)
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.sendRequest('ping');
      return response.status === 'success';
    } catch {
      return false;
    }
  }

  /**
   * Send a request to the CLI worker
   */
  async sendRequest(command: string, payload?: object): Promise<CLIResponse> {
    if (!this.isWorkerReady()) {
      throw new Error('CLI worker is not ready');
    }

    const id = `req-${++this.requestIdCounter}`;
    const request: CLIRequest = { id, command, payload };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`CLI request timeout: ${command}`));
      }, this.REQUEST_TIMEOUT);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const message = `${JSON.stringify(request)  }\n\n`;

      if (!this.process?.stdin?.write(message)) {
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(new Error('Failed to write to CLI process'));
      }
    });
  }

  /**
   * Send shutdown command to CLI
   */
  private async sendShutdownCommand(): Promise<void> {
    try {
      await this.sendRequest('shutdown');
    } catch (error) {
      // Ignore shutdown errors
    }
  }

  /**
   * Setup process event handlers
   */
  private setupProcessHandlers(): void {
    if (!this.process) return;

    this.process.stdout?.setEncoding('utf8');
    this.process.stderr?.setEncoding('utf8');

    this.process.stdout?.on('data', (data: string) => {
      this.handleStdoutData(data);
    });

    this.process.stderr?.on('data', (data: string) => {
      // CLI stderr is diagnostic output, not necessarily an error - don't log as error
      // Only log if it appears to be an actual error message
      if (data.toLowerCase().includes('error') || data.toLowerCase().includes('fatal')) {
        errorHandler.handleError(
          new Error(`CLI worker stderr: ${data}`),
          { operation: 'cliWorker.stderr' }
        );
      }
    });

    this.process.on('exit', (code, signal) => {
      this.handleProcessExit(code, signal);
    });

    this.process.on('error', (error) => {
      this.handleProcessError(error);
    });
  }

  /**
   * Handle stdout data from CLI process
   */
  private handleStdoutData(data: string): void {
    this.buffer += data;

    // Process complete messages (terminated by \n\n)
    const messages = this.buffer.split('\n\n');
    this.buffer = messages.pop() || ''; // Keep incomplete message in buffer

    for (const message of messages) {
      if (message.trim()) {
        this.processMessage(message.trim());
      }
    }
  }

  /**
   * Process a complete JSON message from CLI
   */
  private processMessage(message: string): void {
    try {
      const data = JSON.parse(message) as { type?: string; id?: string };

      // Handle startup handshake
      if (data.type === 'startup') {
        this.emit('startup', data as CLIStartupInfo);
        return;
      }

      // Handle request responses
      if (data.id && this.pendingRequests.has(data.id)) {
        const pending = this.pendingRequests.get(data.id);
        if (!pending) return; // TypeScript flow analysis
        this.pendingRequests.delete(data.id);
        clearTimeout(pending.timeout);
        pending.resolve(data as CLIResponse);
        return;
      }

      // Unknown message
      errorHandler.handleError(
        new Error(`Unknown CLI message: ${message}`),
        { operation: 'cliWorker.processMessage' }
      );

    } catch (error) {
      errorHandler.handleError(
        new Error(`Failed to parse CLI message: ${message}`),
        { operation: 'cliWorker.parseMessage', details: { error: String(error) } }
      );
    }
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(code: number | null, signal: string | null): void {
    this.cleanup();

    const message = signal
      ? `CLI worker killed by signal: ${signal}`
      : `CLI worker exited with code: ${code}`;

    this.emit('exit', { code, signal, message });

    // Only log unexpected exits (non-zero codes, signals other than SIGTERM)
    if (code !== 0 && signal !== 'SIGTERM') {
      errorHandler.handleError(
        new Error(message),
        { operation: 'cliWorker.exit', details: { code, signal } }
      );
    }
  }

  /**
   * Handle process error
   */
  private handleProcessError(error: Error): void {
    this.cleanup();
    this.emit('error', error);

    errorHandler.handleError(
      error,
      { operation: 'cliWorker.processError' }
    );
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.isReady = false;
    this.process = undefined;
    this.buffer = '';
    this.currentDocumentVersion = 0;

    // Reject all pending requests
    for (const [_id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('CLI worker stopped'));
    }
    this.pendingRequests.clear();
  }
}