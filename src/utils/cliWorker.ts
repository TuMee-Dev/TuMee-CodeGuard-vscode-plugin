import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { GuardTag, LinePermission } from '@/types/guardTypes';
import { errorHandler } from './errorHandler';
import { getAclCliPath } from './acl';
import { configManager } from './configurationManager';

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

/**
 * CLI Worker class that manages persistent connection to CodeGuard CLI
 */
export class CLIWorker extends EventEmitter {
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

  private readonly MIN_CLI_VERSION = '1.2.0';

  private get REQUEST_TIMEOUT(): number {
    return configManager().get('cliWorkerTimeout', 10000);
  }

  private get STARTUP_TIMEOUT(): number {
    return configManager().get('cliWorkerStartupTimeout', 5000);
  }

  constructor() {
    super();
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

    return response.result as CLIVersionInfo;
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
  private async sendRequest(command: string, payload?: object): Promise<CLIResponse> {
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

      const message = JSON.stringify(request) + '\n\n';
      
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
      errorHandler.handleError(
        new Error(`CLI worker stderr: ${data}`),
        { operation: 'cliWorker.stderr' }
      );
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
      const data = JSON.parse(message);

      // Handle startup handshake
      if (data.type === 'startup') {
        this.emit('startup', data as CLIStartupInfo);
        return;
      }

      // Handle request responses
      if (data.id && this.pendingRequests.has(data.id)) {
        const pending = this.pendingRequests.get(data.id)!;
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
    
    errorHandler.handleError(
      new Error(message),
      { operation: 'cliWorker.exit', details: { code, signal } }
    );
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
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('CLI worker stopped'));
    }
    this.pendingRequests.clear();
  }
}