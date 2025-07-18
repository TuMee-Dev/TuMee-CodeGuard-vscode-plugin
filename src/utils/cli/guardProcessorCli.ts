/**
 * CLI-based guard processor that replaces local parsing with CLI worker
 */

import * as vscode from 'vscode';
import type { GuardTag, LinePermission } from '../../types/guardTypes';
import { CLIWorker } from './cliWorker';
import { DocumentStateManager } from './documentStateManager';
import { errorHandler } from '../error/errorHandler';
import { updateStatusBarForWorkerStatus } from '../ui/statusBar';
import { configManager } from '../config/configurationManager';
import { EventEmitter } from 'events';

/**
 * Global CLI worker instance
 */
let cliWorker: CLIWorker | undefined;
let documentStateManager: DocumentStateManager;
let debounceTimer: NodeJS.Timeout | undefined;
let lastRestartAttempt = 0;
let incompatibleVersionDetected = false;
let lastVersionErrorShown = 0;

// Event emitter for parse completion events
const parseEventEmitter = new EventEmitter();

// Configuration getters
function getDebounceDelay(): number {
  return configManager().get('decorationUpdateDelay', 300); // Use existing config
}

// Configuration getters - keeping for potential future use
// function getWorkerTimeout(): number {
//   return configManager().get('cliWorkerTimeout', 10000);
// }

// function getWorkerStartupTimeout(): number {
//   return configManager().get('cliWorkerStartupTimeout', 5000);
// }

function getAutoRestart(): boolean {
  return configManager().get('cliWorkerAutoRestart', true);
}

const WORKER_RESTART_DELAY = 10000; // ms - 10 second delay
const VERSION_ERROR_COOLDOWN = 3600000; // ms - 1 hour between version error messages

/**
 * Initialize the CLI-based guard processor
 */
export async function initializeCliProcessor(): Promise<boolean> {
  try {
    documentStateManager = new DocumentStateManager();

    // Try to start CLI worker
    await startCliWorker();
    return true;
  } catch (error) {
    errorHandler.handleError(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'initializeCliProcessor',
        userFriendlyMessage: 'Failed to initialize CodeGuard CLI worker'
      }
    );
    return false;
  }
}

/**
 * Start the CLI worker
 */
async function startCliWorker(): Promise<void> {
  if (cliWorker) {
    await cliWorker.stop();
  }

  updateStatusBarForWorkerStatus('starting');

  cliWorker = CLIWorker.getInstance();

  // Set up event handlers
  cliWorker.on('exit', handleWorkerExit);
  cliWorker.on('error', handleWorkerError);
  cliWorker.on('command-error', handleCommandError);

  try {
    await cliWorker.start();

    // Check version compatibility
    const versionInfo = await cliWorker.checkVersion();
    if (!versionInfo.compatible) {
      // CLI is present but incompatible - shut down worker and show yellow
      updateStatusBarForWorkerStatus('incompatible');

      // Mark as incompatible to prevent restart loops
      incompatibleVersionDetected = true;

      // Show user notification about version issue (with cooldown)
      const now = Date.now();
      if (now - lastVersionErrorShown > VERSION_ERROR_COOLDOWN) {
        lastVersionErrorShown = now;
        void vscode.window.showErrorMessage(
          `CodeGuard CLI version ${versionInfo.version} is outdated. Please update to v${versionInfo.minCompatible} or higher.`,
          'How to Update'
        ).then(selection => {
          if (selection === 'How to Update') {
            void vscode.env.openExternal(vscode.Uri.parse('https://github.com/TuMee-Dev/TuMee-Code-Validator'));
          }
        });
      }

      // Shut down the incompatible worker
      await cliWorker.stop();
      cliWorker = undefined;

      return; // Don't set to 'ready' status
    }

    updateStatusBarForWorkerStatus('ready');

  } catch (error) {
    // CLI is missing or failed to start - this should show red
    updateStatusBarForWorkerStatus('error');
    throw error;
  }
}

/**
 * Handle CLI worker exit
 */
function handleWorkerExit(_info: { code: number | null; signal: string | null; message: string }): void {
  updateStatusBarForWorkerStatus('crashed');

  // Don't restart if we detected an incompatible version
  if (incompatibleVersionDetected) {
    updateStatusBarForWorkerStatus('incompatible');
    return;
  }

  // Rate limit restart attempts
  const now = Date.now();
  if (now - lastRestartAttempt < WORKER_RESTART_DELAY) {
    return; // Too soon to restart
  }

  // Attempt to restart worker after delay if auto-restart is enabled
  if (getAutoRestart()) {
    lastRestartAttempt = now;
    setTimeout(() => {
      void restartCliWorker();
    }, WORKER_RESTART_DELAY);
  }
}

/**
 * Handle CLI worker error
 */
function handleWorkerError(error: Error): void {
  updateStatusBarForWorkerStatus('error');

  errorHandler.handleError(error, {
    operation: 'cliWorker.error',
    userFriendlyMessage: 'CodeGuard CLI worker encountered an error'
  });
}

/**
 * Handle CLI command errors
 */
function handleCommandError(info: { command: string; error: string; count: number }): void {
  // Update status bar to yellow to indicate issues
  updateStatusBarForWorkerStatus('command-error');

  // Log the error for debugging
  console.warn(`CodeGuard CLI command '${info.command}' failed: ${info.error} (error count: ${info.count})`);

  // If we get too many errors, show a notification
  if (info.count >= 3) {
    void vscode.window.showWarningMessage(
      `CodeGuard CLI is experiencing errors: ${info.error}. The CLI may need updating.`,
      'Check CLI Version'
    ).then(selection => {
      if (selection === 'Check CLI Version') {
        void vscode.commands.executeCommand('tumee-vscode-plugin.showGuardInfo');
      }
    });
  }
}

/**
 * Restart the CLI worker
 */
async function restartCliWorker(): Promise<void> {
  // Don't restart if we detected an incompatible version
  if (incompatibleVersionDetected) {
    return;
  }

  try {
    await startCliWorker();
  } catch (error) {
    // Restart failures are expected during recovery - don't log as errors
    // Only log truly unexpected issues (not CLI worker availability)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('CLI worker is not available') &&
        !errorMessage.includes('CLI worker is not ready') &&
        !errorMessage.includes('is not compatible')) {
      errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'restartCliWorker'
        }
      );
    }
  }
}

/**
 * Shutdown the CLI processor
 */
export async function shutdownCliProcessor(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }

  if (cliWorker) {
    await cliWorker.stop();
    cliWorker = undefined;
  }

  // Reset state
  incompatibleVersionDetected = false;
  lastRestartAttempt = 0;
  lastVersionErrorShown = 0;
}

/**
 * Parse guard tags from document - CLI replacement for parseGuardTags
 */
export async function parseGuardTags(
  document: vscode.TextDocument,
  _lines: string[]
): Promise<GuardTag[]> {
  // Skip non-file documents
  if (document.uri.scheme !== 'file') {
    return [];
  }

  // Validate document has required properties
  if (!document.fileName && !document.uri.fsPath) {
    console.warn('Document missing fileName:', { uri: document.uri.toString(), scheme: document.uri.scheme });
    return [];
  }

  if (!cliWorker || !cliWorker.isWorkerReady()) {
    throw new Error('CLI worker is not available');
  }

  try {
    // Check if this is a new document or document switch
    const isNewDocument = documentStateManager.setDocument(document);

    let result;
    if (isNewDocument) {
      // New document - send full content
      const docInfo = documentStateManager.getDocumentInfo();
      if (!docInfo) {
        throw new Error('Failed to get document info');
      }

      // Validate required fields
      if (!docInfo.fileName || !docInfo.languageId) {
        console.error('Missing required fields:', {
          fileName: docInfo.fileName,
          languageId: docInfo.languageId,
          hasContent: !!docInfo.content
        });
        throw new Error(`Missing required fields: fileName=${docInfo.fileName}, languageId=${docInfo.languageId}`);
      }

      result = await cliWorker.setDocument(
        docInfo.fileName,
        docInfo.languageId,
        docInfo.content
      );
    } else {
      // Same document - use cached result if available
      const cachedResult = documentStateManager.getLastParseResult();
      if (cachedResult) {
        return cachedResult.guardTags;
      }

      // No cached result, send full document
      const docInfo = documentStateManager.getDocumentInfo();
      if (!docInfo) {
        throw new Error('Failed to get document info');
      }

      // Validate required fields
      if (!docInfo.fileName || !docInfo.languageId) {
        console.error('Missing required fields:', {
          fileName: docInfo.fileName,
          languageId: docInfo.languageId,
          hasContent: !!docInfo.content
        });
        throw new Error(`Missing required fields: fileName=${docInfo.fileName}, languageId=${docInfo.languageId}`);
      }

      result = await cliWorker.setDocument(
        docInfo.fileName,
        docInfo.languageId,
        docInfo.content
      );
    }

    // Update cached result
    documentStateManager.updateParseResult(result);

    return result.guardTags;

  } catch (error) {
    // Only log unexpected errors, not "CLI worker is not available" which is expected
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('CLI worker is not available') && !errorMessage.includes('CLI worker is not ready')) {
      errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'parseGuardTags.cli',
          details: { document: document.fileName }
        }
      );
    }
    throw error;
  }
}

/**
 * Get line permissions - CLI replacement for getLinePermissions
 */
export function getLinePermissions(
  _document: vscode.TextDocument,
  _guardTags: GuardTag[]
): Map<number, LinePermission> {
  // Use cached result from last parse
  const cachedResult = documentStateManager.getLastParseResult();
  if (cachedResult) {
    const legacy = documentStateManager.convertToLegacyFormat(cachedResult);
    return legacy.linePermissions;
  }

  // Fallback - create empty permissions map
  return new Map<number, LinePermission>();
}

/**
 * Handle document content changes with debouncing
 */
export function handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
  if (!cliWorker || !cliWorker.isWorkerReady()) {
    return;
  }

  // Skip non-file documents (output channels, debug consoles, etc.)
  if (event.document.uri.scheme !== 'file') {
    return;
  }

  // Clear existing timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Set new timer
  debounceTimer = setTimeout(() => {
    void processDocumentChange(event);
  }, getDebounceDelay());
}

/**
 * Process document changes by sending deltas to CLI worker
 */
async function processDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
  if (!cliWorker || !cliWorker.isWorkerReady()) {
    return;
  }

  // Skip non-file documents
  if (event.document.uri.scheme !== 'file') {
    return;
  }

  try {
    const changes = documentStateManager.updateDocument(event);

    if (changes === null) {
      // Document switch or other scenario requiring full document resend
      const docInfo = documentStateManager.getDocumentInfo();
      if (docInfo) {
        const result = await cliWorker.setDocument(
          docInfo.fileName,
          docInfo.languageId,
          docInfo.content
        );
        documentStateManager.updateParseResult(result);

        // Trigger decoration update
        triggerDecorationUpdate(event.document);
      }
      return;
    }

    if (changes.length === 0) {
      // No actual changes
      return;
    }

    // Validate delta before sending
    if (!documentStateManager.validateDelta(changes)) {
      // Invalid delta, fall back to full document
      const docInfo = documentStateManager.getDocumentInfo();
      if (docInfo) {
        const result = await cliWorker.setDocument(
          docInfo.fileName,
          docInfo.languageId,
          docInfo.content
        );
        documentStateManager.updateParseResult(result);
        triggerDecorationUpdate(event.document);
      }
      return;
    }

    // Send delta to CLI worker
    const result = await cliWorker.applyDelta(changes);
    documentStateManager.updateParseResult(result);

    // Trigger decoration update
    triggerDecorationUpdate(event.document);

  } catch (error) {
    // Only log unexpected errors, not CLI worker availability issues
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('CLI worker is not available') && !errorMessage.includes('CLI worker is not ready')) {
      errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'processDocumentChange',
          details: { document: event.document.fileName }
        }
      );
    }

    // On error, try to resend full document
    try {
      const docInfo = documentStateManager.getDocumentInfo();
      if (docInfo && cliWorker) {
        const result = await cliWorker.setDocument(
          docInfo.fileName,
          docInfo.languageId,
          docInfo.content
        );
        documentStateManager.updateParseResult(result);
        triggerDecorationUpdate(event.document);
      }
    } catch {
      // Ignore error recovery failures
    }
  }
}

/**
 * Trigger decoration update in the main extension
 */
function triggerDecorationUpdate(document: vscode.TextDocument): void {
  // Emit parse completion event
  parseEventEmitter.emit('parseComplete', document);
}

/**
 * Mark lines as modified - compatibility function
 */
export function markLinesModified(
  _document: vscode.TextDocument,
  _startLine: number,
  _endLine: number
): void {
  // CLI worker handles incremental changes automatically
  // This is a no-op for compatibility with existing code
}

/**
 * Get CLI worker instance (for status bar and other components)
 */
export function getCliWorker(): CLIWorker | undefined {
  return cliWorker;
}
