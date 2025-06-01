/**
 * CLI-based guard processor that replaces local parsing with CLI worker
 */

import type * as vscode from 'vscode';
import type { GuardTag, LinePermission } from '../types/guardTypes';
import { CLIWorker } from './cliWorker';
import { DocumentStateManager } from './documentStateManager';
import { errorHandler } from './errorHandler';
import { updateStatusBarForWorkerStatus } from './statusBar';
import { configManager } from './configurationManager';
import { EventEmitter } from 'events';

/**
 * Global CLI worker instance
 */
let cliWorker: CLIWorker | undefined;
let documentStateManager: DocumentStateManager;
let debounceTimer: NodeJS.Timeout | undefined;

// Event emitter for parse completion events
const parseEventEmitter = new EventEmitter();

// Configuration getters
function getDebounceDelay(): number {
  return configManager().get('decorationUpdateDelay', 300); // Use existing config
}

function getWorkerTimeout(): number {
  return configManager().get('cliWorkerTimeout', 10000);
}

function getWorkerStartupTimeout(): number {
  return configManager().get('cliWorkerStartupTimeout', 5000);
}

function getAutoRestart(): boolean {
  return configManager().get('cliWorkerAutoRestart', true);
}

const WORKER_RESTART_DELAY = 1000; // ms - fixed delay

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

  cliWorker = new CLIWorker();

  // Set up event handlers
  cliWorker.on('exit', handleWorkerExit);
  cliWorker.on('error', handleWorkerError);

  try {
    const startupInfo = await cliWorker.start();
    
    // Check version compatibility
    const versionInfo = await cliWorker.checkVersion();
    if (!versionInfo.compatible) {
      errorHandler.handleError(
        new Error(`CLI version ${versionInfo.version} is not compatible (requires ${versionInfo.minCompatible}+)`),
        { operation: 'cliWorker.versionCheck' }
      );
    }

    updateStatusBarForWorkerStatus('ready');
    
  } catch (error) {
    updateStatusBarForWorkerStatus('error');
    throw error;
  }
}

/**
 * Handle CLI worker exit
 */
function handleWorkerExit(info: { code: number | null; signal: string | null; message: string }): void {
  updateStatusBarForWorkerStatus('crashed');
  
  // Attempt to restart worker after delay if auto-restart is enabled
  if (getAutoRestart()) {
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
 * Restart the CLI worker
 */
async function restartCliWorker(): Promise<void> {
  try {
    await startCliWorker();
  } catch (error) {
    errorHandler.handleError(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'restartCliWorker',
        userFriendlyMessage: 'Failed to restart CodeGuard CLI worker'
      }
    );
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
}

/**
 * Parse guard tags from document - CLI replacement for parseGuardTags
 */
export async function parseGuardTags(
  document: vscode.TextDocument,
  lines: string[]
): Promise<GuardTag[]> {
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
    errorHandler.handleError(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'parseGuardTags.cli',
        details: { document: document.fileName }
      }
    );
    throw error;
  }
}

/**
 * Get line permissions - CLI replacement for getLinePermissions
 */
export function getLinePermissions(
  document: vscode.TextDocument,
  guardTags: GuardTag[]
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
    errorHandler.handleError(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'processDocumentChange',
        details: { document: event.document.fileName }
      }
    );

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
 * Get the parse event emitter for external listeners
 */
export function getParseEventEmitter(): EventEmitter {
  return parseEventEmitter;
}

/**
 * Clear scope cache - compatibility function
 */
export function clearScopeCache(document: vscode.TextDocument): void {
  // CLI worker maintains its own state, no manual cache clearing needed
  // This is a no-op for compatibility with existing code
}

/**
 * Mark lines as modified - compatibility function
 */
export function markLinesModified(
  document: vscode.TextDocument,
  startLine: number,
  endLine: number
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

/**
 * Check if CLI processor is ready
 */
export function isCliProcessorReady(): boolean {
  return cliWorker?.isWorkerReady() ?? false;
}

/**
 * Force refresh current document
 */
export async function refreshCurrentDocument(document: vscode.TextDocument): Promise<void> {
  if (!cliWorker || !cliWorker.isWorkerReady()) {
    throw new Error('CLI worker is not available');
  }

  // Force document refresh by setting it again
  documentStateManager.setDocument(document);
  const docInfo = documentStateManager.getDocumentInfo();
  
  if (docInfo) {
    const result = await cliWorker.setDocument(
      docInfo.fileName,
      docInfo.languageId,
      docInfo.content
    );
    documentStateManager.updateParseResult(result);
    triggerDecorationUpdate(document);
  }
}