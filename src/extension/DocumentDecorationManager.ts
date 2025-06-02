import { type ExtensionContext, type TextEditorDecorationType, type TextDocument, type Disposable, window, Position, Range } from 'vscode';
import {
  parseGuardTags,
  getLinePermissions,
  getDefaultPermissions,
  errorHandler,
  UTILITY_PATTERNS,
  performanceMonitor,
  configManager,
  CONFIG_KEYS,
  DebugLogger,
  backgroundProcessor,
  DecorationTypeFactory,
  getCliWorker
} from '@/utils';
import type { GuardTag, LinePermission, DecorationRanges } from '@/types/guardTypes';

/**
 * DocumentDecorationManager handles all decoration-related functionality
 * Extracted from extension.ts for better organization
 */
export class DocumentDecorationManager {
  // Map of decoration types for all permission combinations
  private readonly decorationTypes: Map<string, TextEditorDecorationType> = new Map();

  // Debounce timer for decoration updates
  private decorationUpdateTimer: NodeJS.Timeout | undefined;

  // Performance optimization: track document versions to avoid redundant processing
  private readonly processedDocumentVersions = new WeakMap<TextDocument, number>();

  // Cache decoration ranges to prevent flashing when switching tabs
  private readonly decorationCache = new WeakMap<TextDocument, DecorationRanges>();

  private disposables: Disposable[] = [];

  /**
   * Initialize decoration system
   */
  initializeDecorations(_context: ExtensionContext): void {
    const factory = new DecorationTypeFactory();
    const newDecorationTypes = factory.createDecorationTypes();

    // Clear existing decorations
    this.decorationTypes.forEach(decoration => decoration.dispose());
    this.decorationTypes.clear();

    // Copy the new decoration types
    newDecorationTypes.forEach((decoration, key) => {
      this.decorationTypes.set(key, decoration);
      this.disposables.push(decoration);
    });
  }

  /**
   * Handle color configuration changes
   */
  handleColorConfigurationChange(context: ExtensionContext): void {
    // Get current decorations from cache to reapply immediately
    const cachedDecorations = new Map<TextDocument, DecorationRanges>();
    for (const editor of window.visibleTextEditors) {
      const cached = this.decorationCache.get(editor.document);
      if (cached) {
        cachedDecorations.set(editor.document, cached);
      }
    }

    // Recreate decoration types with new colors
    this.initializeDecorations(context);

    // Immediately reapply cached decorations to prevent flash
    for (const editor of window.visibleTextEditors) {
      const cached = cachedDecorations.get(editor.document);
      if (cached) {
        this.decorationTypes.forEach((decoration, key) => {
          const ranges = cached[key as keyof DecorationRanges] || [];
          editor.setDecorations(decoration, ranges);
        });
      }
    }
  }

  /**
   * Trigger decoration update with debouncing
   */
  triggerUpdateDecorations(document: TextDocument): void {
    if (!document) return;

    // Skip non-text files
    if (document.uri.scheme !== 'file') return;

    // Clear any pending update
    if (this.decorationUpdateTimer) {
      clearTimeout(this.decorationUpdateTimer);
    }

    // Get debounce delay from configuration
    const cm = configManager();
    const delay = cm.get(CONFIG_KEYS.DECORATION_UPDATE_DELAY, 300);

    // Debounce the update
    this.decorationUpdateTimer = setTimeout(() => {
      // For large files, queue as background task
      const text = document.getText();
      const isLargeFile = text.length > 100000; // 100KB

      if (isLargeFile) {
        void backgroundProcessor.queueTask({
          id: `updateDecorations-${document.fileName}`,
          execute: async () => {
            await this.updateCodeDecorations(document);
          },
          priority: 1,
          showProgress: false
        });
      } else {
        void this.updateCodeDecorations(document);
      }
    }, delay);
  }

  /**
   * Update code decorations for a document
   */
  async updateCodeDecorations(document: TextDocument): Promise<void> {
    // Check if we've already processed this document version
    const currentVersion = document.version;
    const lastProcessedVersion = this.processedDocumentVersions.get(document);

    if (lastProcessedVersion === currentVersion) {
      return; // Skip if already processed
    }

    const text = document.getText();
    if (!text) return;

    // Performance optimization - skip large files over threshold
    const cm = configManager();
    const maxFileSize = cm.get(CONFIG_KEYS.MAX_FILE_SIZE, 1000000);

    if (text.length > maxFileSize) {
      console.warn(`File too large for decoration (${text.length} bytes, max: ${maxFileSize}). Skipping.`);
      // Show warning to user
      void window.showWarningMessage(
        `File "${document.fileName}" too large for guard tag decorations (${Math.round(text.length / 1024)}KB). Increase max file size in settings if needed.`
      );
      return;
    }

    // Mark this version as being processed
    this.processedDocumentVersions.set(document, currentVersion);

    // Process the document to apply decorations
    await this.updateCodeDecorationsImpl(document);
  }

  /**
   * Apply cached decorations to editor immediately (prevents flashing)
   */
  applyCachedDecorations(document: TextDocument): void {
    const activeEditor = window.activeTextEditor;
    if (!activeEditor || activeEditor.document !== document) return;

    const cachedDecorations = this.decorationCache.get(document);
    if (cachedDecorations) {
      this.decorationTypes.forEach((decoration, key) => {
        const ranges = cachedDecorations[key as keyof DecorationRanges] || [];
        activeEditor.setDecorations(decoration, ranges);
      });
    }
  }

  /**
   * Clear all decorations
   */
  clearDecorations(): void {
    const activeEditor = window.activeTextEditor;
    if (!activeEditor) return;

    // Clear all decoration types
    this.decorationTypes.forEach(decoration => {
      activeEditor.setDecorations(decoration, []);
    });

    // Also clear the cache for this document
    if (activeEditor.document) {
      this.decorationCache.delete(activeEditor.document);
    }
  }

  /**
   * Clear document from caches when closed
   */
  clearDocumentCache(document: TextDocument): void {
    this.processedDocumentVersions.delete(document);
    this.decorationCache.delete(document);
  }

  /**
   * Helper function to determine decoration type based on permission combination
   */
  private getDecorationType(aiPerm: string, humanPerm: string, aiContext: boolean, _humanContext: boolean): keyof DecorationRanges | null {
    // Context is now properly tracked as a modifier
    if (aiContext) {
      // AI has context modifier
      if (aiPerm === 'r') {
        if (humanPerm === 'r') return 'aiReadContext_humanRead';
        if (humanPerm === 'w') return 'aiReadContext_humanWrite';
        if (humanPerm === 'n') return 'aiReadContext_humanNoAccess';
      } else if (aiPerm === 'w') {
        if (humanPerm === 'r') return 'aiWriteContext_humanRead';
        if (humanPerm === 'w') return 'aiWriteContext_humanWrite';
        if (humanPerm === 'n') return 'aiWriteContext_humanNoAccess';
      }
    }

    // Handle all non-context combinations
    if (aiPerm === 'r' && humanPerm === 'r') return 'aiRead_humanRead';
    if (aiPerm === 'r' && humanPerm === 'w') return 'aiRead_humanWrite'; // Default state - but still allow decoration
    if (aiPerm === 'r' && humanPerm === 'n') return 'aiRead_humanNoAccess';
    if (aiPerm === 'w' && humanPerm === 'r') return 'aiWrite_humanRead';
    if (aiPerm === 'w' && humanPerm === 'w') return 'aiWrite_humanWrite';
    if (aiPerm === 'w' && humanPerm === 'n') return 'aiWrite_humanNoAccess';
    if (aiPerm === 'n' && humanPerm === 'r') return 'aiNoAccess_humanRead';
    if (aiPerm === 'n' && humanPerm === 'w') return 'aiNoAccess_humanWrite';
    if (aiPerm === 'n' && humanPerm === 'n') return 'aiNoAccess_humanNoAccess';

    // Default case - shouldn't happen with valid permissions
    return 'aiRead_humanWrite'; // Default state
  }

  /**
   * Implementation of code decoration updates
   * This now uses the shared guard processing logic
   */
  private async updateCodeDecorationsImpl(document: TextDocument): Promise<void> {
    performanceMonitor.startTimer('updateCodeDecorations');

    try {
      if (!document) return;

      const activeEditor = window.activeTextEditor;
      if (!activeEditor) return;

      const text = document.getText();
      const lines = text.split(UTILITY_PATTERNS.LINE_SPLIT);

      // CLI worker handles guard tag detection - no need for pre-filtering

      // Use shared functions to parse guard tags and compute line permissions
      let guardTags: GuardTag[] = [];
      let linePermissions = new Map<number, LinePermission>();

      try {
        // Ensure CLI worker is ready before parsing guard tags
        const cliWorker = getCliWorker();
        if (cliWorker && !cliWorker.isWorkerReady()) {
          try {
            await cliWorker.waitForReady(10000); // Wait up to 10 seconds for CLI to be ready
          } catch (cliError) {
            console.error('CLI worker failed to become ready:', cliError);
            // Continue with empty results if CLI can't start
            return;
          }
        }

        // Parse guard tags - simple and direct
        guardTags = await parseGuardTags(document, lines);

        linePermissions = getLinePermissions(document, guardTags);
      } catch (error) {
        // Only log unexpected errors, not CLI worker availability issues (expected when CLI is incompatible)
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('CLI worker is not available') && !errorMessage.includes('CLI worker is not ready')) {
          errorHandler.handleError(
            error instanceof Error ? error : new Error(String(error)),
            {
              operation: 'parseGuardTags',
              details: { document: document.fileName }
            }
          );
        }
        this.clearDecorations();
        return;
      }

      // Now convert linePermissions to decoration ranges
      const decorationRanges: DecorationRanges = {
        // All permission combinations
        aiRead_humanRead: [],
        aiRead_humanWrite: [],
        aiRead_humanNoAccess: [],
        aiWrite_humanRead: [],
        aiWrite_humanWrite: [],
        aiWrite_humanNoAccess: [],
        aiNoAccess_humanRead: [],
        aiNoAccess_humanWrite: [],
        aiNoAccess_humanNoAccess: [],

        // Context variants
        aiReadContext_humanRead: [],
        aiReadContext_humanWrite: [],
        aiReadContext_humanNoAccess: [],
        aiWriteContext_humanRead: [],
        aiWriteContext_humanWrite: [],
        aiWriteContext_humanNoAccess: []
      };

      // Get default permissions
      const defaults = getDefaultPermissions();

      // Get debug flag
      const cm = configManager();
      const debugEnabled = cm.get(CONFIG_KEYS.ENABLE_DEBUG_LOGGING, false);

      // Decorate each line - just use what guardProcessor calculated
      for (let i = 0; i < document.lineCount; i++) {
        const lineNumber = i + 1;
        const perm = linePermissions.get(lineNumber);

        if (!perm) {
          if (debugEnabled) {
            DebugLogger.log(`[Extension] Line ${lineNumber}: No permission entry found`);
          }
          continue;
        }

        const aiPerm = perm.permissions?.ai || defaults.ai;
        const humanPerm = perm.permissions?.human || defaults.human;
        const aiContext = perm.isContext?.ai || false;
        const humanContext = perm.isContext?.human || false;

        // Debug logging
        if (debugEnabled && (aiContext || humanContext || aiPerm === 'context' || humanPerm === 'context')) {
          DebugLogger.log(`[Extension] Line ${lineNumber}: permissions=${JSON.stringify(perm.permissions)}, isContext=${JSON.stringify(perm.isContext)}`);
        }

        // Filter out 'context' and 'contextWrite' as permission values - they should only be tracked in isContext
        const effectiveAiPerm = (aiPerm === 'context' || aiPerm === 'contextWrite') ? 'w' : aiPerm;
        const effectiveHumanPerm = (humanPerm === 'context' || humanPerm === 'contextWrite') ? 'w' : humanPerm;

        // Get decoration type based on permissions
        const decorationType = this.getDecorationType(effectiveAiPerm, effectiveHumanPerm, aiContext, humanContext);

        // Debug logging for context lines
        if (debugEnabled && (aiContext || humanContext)) {
          DebugLogger.log(`[Extension] Line ${lineNumber}: effectiveAiPerm=${effectiveAiPerm}, effectiveHumanPerm=${effectiveHumanPerm}, aiContext=${aiContext}, humanContext=${humanContext}, decorationType=${decorationType}`);
        }

        // Skip lines with no decoration (default state)
        if (!decorationType) {
          continue;
        }

        // Debug logging for line 11 issue
        if (i === 10) { // Line 11 (0-based index 10)
          DebugLogger.log(`[DEBUG] Line 11: decorationType=${decorationType}, aiPerm=${effectiveAiPerm}, humanPerm=${effectiveHumanPerm}`);
        }

        // Add decoration for this line
        decorationRanges[decorationType as keyof DecorationRanges].push({
          range: new Range(
            new Position(i, 0),
            new Position(i, lines[i].length)
          )
        });
      }

      // Apply decorations - clear all first then apply active ones
      this.decorationTypes.forEach((decoration, key) => {
        const ranges = decorationRanges[key as keyof DecorationRanges] || [];
        activeEditor.setDecorations(decoration, ranges);
      });

      // Cache the decoration ranges to prevent flashing when switching tabs
      this.decorationCache.set(document, decorationRanges);

      performanceMonitor.endTimer('updateCodeDecorations', {
        lines: lines.length,
        guardTags: guardTags.length,
        fileName: document.fileName
      });
    } catch (error) {
      // Only log unexpected errors, not CLI worker availability issues (expected when CLI is incompatible)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('CLI worker is not available') && !errorMessage.includes('CLI worker is not ready')) {
        errorHandler.handleError(
          error instanceof Error ? error : new Error(String(error)),
          {
            operation: 'updateCodeDecorationsImpl',
            details: { document: document.fileName }
          }
        );
      }
      this.clearDecorations();
      performanceMonitor.endTimer('updateCodeDecorations', { error: true });
    }
  }

  /**
   * Get decoration types map (for refresh command)
   */
  getDecorationTypes(): Map<string, TextEditorDecorationType> {
    return this.decorationTypes;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    if (this.decorationUpdateTimer) {
      clearTimeout(this.decorationUpdateTimer);
      this.decorationUpdateTimer = undefined;
    }

    this.decorationTypes.forEach(decoration => decoration.dispose());
    this.decorationTypes.clear();

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}