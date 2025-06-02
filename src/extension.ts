// The final extension.ts file with thoroughly verified line count handling

import type * as vscode from 'vscode';
import { type Disposable, type ExtensionContext, window, workspace, commands } from 'vscode';
import type { FileCustomizationProvider } from '@/tools/file-customization-provider';
import { registerFileDecorationProvider } from '@/tools/file-customization-provider';
import { registerContextMenu } from '@/tools/register-context-menu';
import { registerGuardTagCommands } from '@/tools/contextMenu/setGuardTags';
import { firstTimeRun } from '@/utils';
import {
  markLinesModified,
  initializeCliProcessor,
  shutdownCliProcessor,
  getCliWorker,
  handleDocumentChange as handleCliDocumentChange,
  errorHandler,
  disposeACLCache,
  performanceMonitor,
  configValidator,
  backgroundProcessor,
  createStatusBarItem,
  updateStatusBarItem,
  updateCliWorkerReference
} from '@/utils';
import { registerColorCustomizerCommand } from '@/tools/colorCustomizer';
import { DocumentDecorationManager } from './extension/DocumentDecorationManager';

let disposables: Disposable[] = [];
// Global decoration manager instance
let decorationManager: DocumentDecorationManager;

/**
 * Initialize the extension core components
 */
function initializeExtension(context: ExtensionContext): void {
  disposables = [];

  // Initialize decoration manager
  decorationManager = new DocumentDecorationManager();

  // CLI worker handles all parsing - no local scope resolver needed

  // Run first-time setup if needed
  firstTimeRun(context);
}

/**
 * Register all extension commands
 */
function registerCommands(context: ExtensionContext, provider: FileCustomizationProvider): void {
  // Register file and folder decoration provider
  const { disposable } = registerFileDecorationProvider(context);
  disposables.push(disposable);

  // Register context menu commands
  const contextMenuDisposables = registerContextMenu(context, provider);
  disposables.push(...contextMenuDisposables);

  // Register guard tag commands for editor context menu
  const guardDisposables = registerGuardTagCommands(context);
  disposables.push(...guardDisposables);

  // Register color customizer command
  disposables.push(registerColorCustomizerCommand(context));

  // Register refresh decorations command
  disposables.push(
    commands.registerCommand('tumee-vscode-plugin.refreshDecorations', () => {
      // Dispose old decorations
      const decorationTypes = decorationManager.getDecorationTypes();
      decorationTypes.forEach(decoration => decoration.dispose());
      decorationTypes.clear();

      // Reinitialize with new colors
      decorationManager.initializeDecorations(context);

      // Update current editor
      const activeEditor = window.activeTextEditor;
      if (activeEditor) {
        decorationManager.triggerUpdateDecorations(activeEditor.document);
      }
    })
  );

  // Register performance report command
  disposables.push(
    commands.registerCommand('tumee-vscode-plugin.showPerformanceReport', () => {
      performanceMonitor.showReport();
    })
  );

}

/**
 * Set up event handlers for editor and document events
 */
function setupEventHandlers(context: ExtensionContext): void {
  // Watch for configuration changes
  disposables.push(
    workspace.onDidChangeConfiguration(event => {
      configValidator.handleConfigurationChange(event);

      // If guard colors changed, recreate decoration types and refresh all decorations
      if (event.affectsConfiguration('tumee-vscode-plugin.guardColors') ||
          event.affectsConfiguration('tumee-vscode-plugin.guardColorsComplete')) {
        decorationManager.handleColorConfigurationChange(context);
      }
    })
  );

  // Update decorations when document changes
  disposables.push(
    workspace.onDidChangeTextDocument(event => {
      const activeEditor = window.activeTextEditor;
      if (activeEditor && event.document === activeEditor.document) {
        // Use CLI document change handler
        handleCliDocumentChange(event);
        // Also trigger decoration update
        handleDocumentChange(event);
      }
    })
  );

  // Update decorations when editor changes
  disposables.push(
    window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        handleActiveEditorChange(editor);
      }
    })
  );

  // Clear caches when documents are closed
  disposables.push(
    workspace.onDidCloseTextDocument(document => {
      decorationManager.clearDocumentCache(document);
    })
  );

  // Update decorations when visible ranges change (scrolling)
  disposables.push(
    window.onDidChangeTextEditorVisibleRanges(event => {
      if (event.textEditor === window.activeTextEditor) {
        decorationManager.triggerUpdateDecorations(event.textEditor.document);
      }
    })
  );
}

// handleColorConfigurationChange function moved to DocumentDecorationManager

/**
 * Handle document text changes
 */
function handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
  // Track modified lines for partial cache invalidation
  for (const change of event.contentChanges) {
    const startLine = change.range.start.line;
    const endLine = change.range.end.line;
    const linesAdded = change.text.split('\n').length - 1;

    // Mark affected lines as modified
    markLinesModified(event.document, startLine, Math.max(endLine, startLine + linesAdded));
  }

  decorationManager.triggerUpdateDecorations(event.document);
  void updateStatusBarItem(event.document);
}

/**
 * Handle active editor changes
 */
function handleActiveEditorChange(editor: vscode.TextEditor): void {
  // Apply cached decorations immediately to prevent flashing
  decorationManager.applyCachedDecorations(editor.document);

  // Then trigger a proper update (no debounce for tab switches)
  void decorationManager.updateCodeDecorations(editor.document);
  void updateStatusBarItem(editor.document);
}

/**
 * Initialize the current active editor
 */
function initializeActiveEditor(): void {
  const activeEditor = window.activeTextEditor;
  if (activeEditor) {
    // Update immediately without debounce for initial load
    void decorationManager.updateCodeDecorations(activeEditor.document);
    void updateStatusBarItem(activeEditor.document);
  }
}

/**
 * Validate and fix configuration if needed
 */
function validateConfiguration(): void {
  const validationResult = configValidator.validateConfiguration();
  if (!validationResult.valid) {
    configValidator.showValidationErrors(validationResult);
    // Auto-fix if possible
    void configValidator.autoFixConfiguration();
  }
}

export function activate(context: ExtensionContext): void {
  try {
    initializeExtension(context);

    const isEnabled = context.globalState.get('isEnabled');
    if (isEnabled !== false) {
      const { provider } = registerFileDecorationProvider(context);

      registerCommands(context, provider);

      // Start CLI initialization EARLY but don't wait for it - let it run in background
      const cliInitPromise = initializeCliProcessor();

      // Continue with other initialization immediately (non-blocking)
      decorationManager.initializeDecorations(context);

      // Create status bar item (it will update when CLI is ready)
      const statusBarDisposables = createStatusBarItem(context, undefined); // Start with undefined worker
      disposables.push(...statusBarDisposables);

      // Validate configuration on startup
      validateConfiguration();

      // Set up event handlers (includes CLI document change handling)
      setupEventHandlers(context);

      // Check CLI status and initialize editor accordingly
      cliInitPromise.then(cliInitialized => {
        // Update status bar with actual CLI worker reference now that it's ready
        const cliWorker = getCliWorker();
        updateCliWorkerReference(cliWorker);

        // Initialize current editor if CLI is ready
        if (cliInitialized) {
          initializeActiveEditor();
        }
      }).catch(error => {
        // CLI failed to start - that's fine, extension still works without it
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('CLI initialization failed:', errorMessage);
      });
    }
  } catch (error) {
    errorHandler.handleError(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'extension.activate',
        userFriendlyMessage: 'Failed to activate CodeGuard extension'
      }
    );
    throw error;
  }
}

// All decoration functions moved to DocumentDecorationManager

// All decoration implementation functions moved to DocumentDecorationManager

export function deactivate(): void {
  // Shutdown CLI processor FIRST
  void shutdownCliProcessor();

  // Dispose decoration manager
  if (decorationManager) {
    decorationManager.dispose();
  }

  for (const disposable of disposables) {
    disposable.dispose();
  }
  disposables = [];

  // Dispose ACL cache
  disposeACLCache();

  // Dispose performance monitor
  performanceMonitor.dispose();

  // Clear background processor queue
  backgroundProcessor.clearQueue();
}