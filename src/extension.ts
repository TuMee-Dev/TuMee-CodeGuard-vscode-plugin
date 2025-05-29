// The final extension.ts file with thoroughly verified line count handling

import type * as vscode from 'vscode';
import { type Disposable, type ExtensionContext, type TextEditorDecorationType, type TextDocument, type StatusBarItem, window, workspace, commands, ThemeColor, Position, Range, StatusBarAlignment } from 'vscode';
import type { FileCustomizationProvider } from '@/tools/file-customization-provider';
import { registerFileDecorationProvider } from '@/tools/file-customization-provider';
import { registerContextMenu } from '@/tools/register-context-menu';
import { registerGuardTagCommands } from '@/tools/contextMenu/setGuardTags';
import { firstTimeRun } from '@/utils';
import { parseGuardTags, getLinePermissions, markLinesModified, getDefaultPermissions } from '@/utils/guardProcessor';
import { MARKDOWN_GUARD_TAG_REGEX, GUARD_TAG_REGEX } from '@/utils/acl';
import type { GuardTag, LinePermission, DecorationRanges } from '@/types/guardTypes';
import { errorHandler } from '@/utils/errorHandler';
import { initializeScopeResolver } from '@/utils/scopeResolver';
import { UTILITY_PATTERNS } from '@/utils/regexCache';
import { registerColorCustomizerCommand } from '@/tools/colorCustomizer';
import { disposeACLCache } from '@/utils/aclCache';
import { performanceMonitor } from '@/utils/performanceMonitor';
import { configValidator } from '@/utils/configValidator';
import { DebugLogger } from '@/utils/debugLogger';
import { backgroundProcessor } from '@/utils/backgroundProcessor';
import { registerValidationCommands } from '@/utils/validationMode';
import { DecorationTypeFactory } from '@/utils/decorationTypeFactory';
import { configManager, CONFIG_KEYS } from '@/utils/configurationManager';

let disposables: Disposable[] = [];
// Map of decoration types for all permission combinations
const decorationTypes: Map<string, TextEditorDecorationType> = new Map();
let statusBarItem: StatusBarItem;

// Debounce timer for decoration updates
let decorationUpdateTimer: NodeJS.Timeout | undefined;

// Performance optimization: track document versions to avoid redundant processing
const processedDocumentVersions = new WeakMap<TextDocument, number>();

// Cache decoration ranges to prevent flashing when switching tabs
const decorationCache = new WeakMap<TextDocument, DecorationRanges>();

/**
 * Initialize the extension core components
 */
function initializeExtension(context: ExtensionContext): void {
  disposables = [];

  // Initialize scope resolver context (but don't wait for tree-sitter)
  initializeScopeResolver(context);

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
      decorationTypes.forEach(decoration => decoration.dispose());
      decorationTypes.clear();

      // Reinitialize with new colors
      initializeCodeDecorations(context);

      // Update current editor
      const activeEditor = window.activeTextEditor;
      if (activeEditor) {
        triggerUpdateDecorations(activeEditor.document);
      }
    })
  );

  // Register performance report command
  disposables.push(
    commands.registerCommand('tumee-vscode-plugin.showPerformanceReport', () => {
      performanceMonitor.showReport();
    })
  );

  // Register validation commands (developer feature)
  const validationDisposables = registerValidationCommands(context);
  disposables.push(...validationDisposables);
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
        handleColorConfigurationChange(context);
      }
    })
  );

  // Update decorations when document changes
  disposables.push(
    workspace.onDidChangeTextDocument(event => {
      const activeEditor = window.activeTextEditor;
      if (activeEditor && event.document === activeEditor.document) {
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
      processedDocumentVersions.delete(document);
      decorationCache.delete(document);
    })
  );

  // Update decorations when visible ranges change (scrolling)
  disposables.push(
    window.onDidChangeTextEditorVisibleRanges(event => {
      if (event.textEditor === window.activeTextEditor) {
        triggerUpdateDecorations(event.textEditor.document);
      }
    })
  );
}

/**
 * Handle color configuration changes
 */
function handleColorConfigurationChange(context: ExtensionContext): void {
  // Get current decorations from cache to reapply immediately
  const cachedDecorations = new Map<TextDocument, DecorationRanges>();
  for (const editor of window.visibleTextEditors) {
    const cached = decorationCache.get(editor.document);
    if (cached) {
      cachedDecorations.set(editor.document, cached);
    }
  }

  // Recreate decoration types with new colors
  initializeCodeDecorations(context);

  // Immediately reapply cached decorations to prevent flash
  for (const editor of window.visibleTextEditors) {
    const cached = cachedDecorations.get(editor.document);
    if (cached) {
      decorationTypes.forEach((decoration, key) => {
        const ranges = cached[key as keyof DecorationRanges] || [];
        editor.setDecorations(decoration, ranges);
      });
    }
  }
}

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

  triggerUpdateDecorations(event.document);
  void updateStatusBarItem(event.document);
}

/**
 * Handle active editor changes
 */
function handleActiveEditorChange(editor: vscode.TextEditor): void {
  // Apply cached decorations immediately to prevent flashing
  const cachedDecorations = decorationCache.get(editor.document);
  if (cachedDecorations) {
    decorationTypes.forEach((decoration, key) => {
      const ranges = cachedDecorations[key as keyof DecorationRanges] || [];
      editor.setDecorations(decoration, ranges);
    });
  }

  // Then trigger a proper update (no debounce for tab switches)
  void updateCodeDecorations(editor.document);
  void updateStatusBarItem(editor.document);
}

/**
 * Initialize the current active editor
 */
function initializeActiveEditor(): void {
  const activeEditor = window.activeTextEditor;
  if (activeEditor) {
    // Update immediately without debounce for initial load
    void updateCodeDecorations(activeEditor.document);
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

export async function activate(context: ExtensionContext) {
  try {
    initializeExtension(context);

    const isEnabled = context.globalState.get('isEnabled');
    if (isEnabled !== false) {
      const { provider } = registerFileDecorationProvider(context);

      registerCommands(context, provider);

      // Create decorations for code regions
      initializeCodeDecorations(context);

      // Create status bar item
      createStatusBarItem(context);

      // Validate configuration on startup
      validateConfiguration();

      // Set up event handlers
      setupEventHandlers(context);

      // Initialize current editor
      initializeActiveEditor();
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

function initializeCodeDecorations(_context: ExtensionContext) {
  const factory = new DecorationTypeFactory();
  const newDecorationTypes = factory.createDecorationTypes();

  // Clear existing decorations
  decorationTypes.forEach(decoration => decoration.dispose());
  decorationTypes.clear();

  // Copy the new decoration types
  newDecorationTypes.forEach((decoration, key) => {
    decorationTypes.set(key, decoration);
    disposables.push(decoration);
  });
}
function triggerUpdateDecorations(document: TextDocument) {
  if (!document) return;

  // Skip non-text files
  if (document.uri.scheme !== 'file') return;

  // Clear any pending update
  if (decorationUpdateTimer) {
    clearTimeout(decorationUpdateTimer);
  }

  // Get debounce delay from configuration
  const cm = configManager();
  const delay = cm.get(CONFIG_KEYS.DECORATION_UPDATE_DELAY, 300);

  // Debounce the update
  decorationUpdateTimer = setTimeout(() => {
    // For large files, queue as background task
    const text = document.getText();
    const isLargeFile = text.length > 100000; // 100KB

    if (isLargeFile) {
      void backgroundProcessor.queueTask({
        id: `updateDecorations-${document.fileName}`,
        execute: async () => {
          await updateCodeDecorations(document);
        },
        priority: 1,
        showProgress: false
      });
    } else {
      void updateCodeDecorations(document);
    }
  }, delay);
}

async function updateCodeDecorations(document: TextDocument): Promise<void> {
  // Check if we've already processed this document version
  const currentVersion = document.version;
  const lastProcessedVersion = processedDocumentVersions.get(document);

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
      `File too large for guard tag decorations (${Math.round(text.length / 1024)}KB). Increase max file size in settings if needed.`
    );
    return;
  }

  // Mark this version as being processed
  processedDocumentVersions.set(document, currentVersion);

  // Process the document to apply decorations
  await updateCodeDecorationsImpl(document);
}

/**
 * Clear all decorations
 */
function clearDecorations() {
  const activeEditor = window.activeTextEditor;
  if (!activeEditor) return;

  // Clear all decoration types
  decorationTypes.forEach(decoration => {
    activeEditor.setDecorations(decoration, []);
  });

  // Also clear the cache for this document
  if (activeEditor.document) {
    decorationCache.delete(activeEditor.document);
  }
}

/**
 * Helper function to determine decoration type based on permission combination
 */
function getDecorationType(aiPerm: string, humanPerm: string, aiContext: boolean, _humanContext: boolean): keyof DecorationRanges | null {
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
 *
 * @param document The active document
 */
async function updateCodeDecorationsImpl(document: TextDocument) {
  performanceMonitor.startTimer('updateCodeDecorations');

  try {
    if (!document) return;

    const activeEditor = window.activeTextEditor;
    if (!activeEditor) return;

    const text = document.getText();
    const lines = text.split(UTILITY_PATTERNS.LINE_SPLIT);

    // Check if the document has any guard tags - if not, clear decorations and exit
    const isMarkdown = document.languageId === 'markdown';
    let hasGuardTags = false;

    if (isMarkdown) {
      hasGuardTags = MARKDOWN_GUARD_TAG_REGEX.test(text);
    } else {
      hasGuardTags = GUARD_TAG_REGEX.test(text);
    }

    if (!hasGuardTags) {
      clearDecorations();
      return;
    }

    // Use shared functions to parse guard tags and compute line permissions
    let guardTags: GuardTag[] = [];
    let linePermissions = new Map<number, LinePermission>();

    try {
      // Parse guard tags - simple and direct
      guardTags = await parseGuardTags(document, lines);

      linePermissions = getLinePermissions(document, guardTags);
    } catch (error) {
      errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'parseGuardTags',
          details: { document: document.fileName }
        }
      );
      clearDecorations();
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

      // Filter out 'context' as a permission value - it should only be tracked in isContext
      const effectiveAiPerm = aiPerm === 'context' ? defaults.ai : aiPerm;
      const effectiveHumanPerm = humanPerm === 'context' ? defaults.human : humanPerm;

      // Get decoration type based on permissions
      const decorationType = getDecorationType(effectiveAiPerm, effectiveHumanPerm, aiContext, humanContext);

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
    decorationTypes.forEach((decoration, key) => {
      const ranges = decorationRanges[key as keyof DecorationRanges] || [];
      activeEditor.setDecorations(decoration, ranges);
    });

    // Cache the decoration ranges to prevent flashing when switching tabs
    decorationCache.set(document, decorationRanges);

    performanceMonitor.endTimer('updateCodeDecorations', {
      lines: lines.length,
      guardTags: guardTags.length,
      fileName: document.fileName
    });
  } catch (error) {
    errorHandler.handleError(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'updateCodeDecorationsImpl',
        details: { document: document.fileName }
      }
    );
    clearDecorations();
    performanceMonitor.endTimer('updateCodeDecorations', { error: true });
  }
}

/**
 * Creates the status bar item that shows the current AI access level
 * @param context The extension context
 */
function createStatusBarItem(_context: ExtensionContext) {
  statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  statusBarItem.command = 'tumee-vscode-plugin.toggleAIAccess';

  // Add command to toggle AI access level
  const toggleDisposable = commands.registerCommand('tumee-vscode-plugin.toggleAIAccess', () => {
    const items = [
      { label: 'AI Read-Only', permission: 'r' },
      { label: 'AI Write Access', permission: 'w' },
      { label: 'AI No Access', permission: 'n' }
    ];

    void window.showQuickPick(items, {
      placeHolder: 'Select AI Access Level'
    }).then(item => {
      if (item) {
        void commands.executeCommand(`tumee-vscode-plugin.setAI${item.permission === 'r' ? 'ReadOnly' : item.permission === 'w' ? 'Write' : 'NoAccess'}`);
      }
    });
  });

  disposables.push(statusBarItem, toggleDisposable);
  statusBarItem.show();
}

/**
 * Updates the status bar item to show the current AI access level
 * @param document The active document
 */
async function updateStatusBarItem(document: TextDocument) {
  try {
    if (!document || !statusBarItem) return;

    // Get the text at the current cursor position
    const activeEditor = window.activeTextEditor;
    if (!activeEditor) {
      statusBarItem.text = '$(shield) AI: Unknown';
      return;
    }

    const text = document.getText();
    if (!text) {
      statusBarItem.text = '$(shield) AI: Default';
      return;
    }

    // Scan the document to find the current AI access level at cursor
    const cursorPosition = activeEditor.selection.active;
    const cursorLine = cursorPosition.line;

    const lines = text.split(UTILITY_PATTERNS.LINE_SPLIT);
    let currentAccess = 'Default';
    const lineCount: number | undefined = undefined;

    // Use shared functions to parse guard tags
    let guardTags: GuardTag[] = [];
    let linePermissions = new Map<number, LinePermission>();

    try {
      guardTags = await parseGuardTags(document, lines);
      linePermissions = getLinePermissions(document, guardTags);
    } catch (error) {
      errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'parseGuardTags.statusBar',
          details: { document: document.fileName }
        }
      );
      statusBarItem.text = '$(shield) AI: Error';
      return;
    }

    // Get the permission at the cursor line
    const cursorPermission = linePermissions.get(cursorLine + 1); // 1-based

    // Show AI permissions in the status bar
    if (cursorPermission && cursorPermission.permissions.ai) {
      const aiPerm = cursorPermission.permissions.ai;
      currentAccess =
        aiPerm === 'r' ? 'Read-Only' :
          aiPerm === 'w' ? 'Write' :
            aiPerm === 'n' ? 'No Access' :
              aiPerm === 'context' ? 'Context' : 'Default';
    }

    // Set status bar text with line count if present
    const lineCountText = lineCount ? ` (${String(lineCount)} lines)` : '';
    statusBarItem.text = `$(shield) AI: ${currentAccess}${lineCountText}`;

    // Set color based on permission
    if (currentAccess === 'Read-Only') {
      statusBarItem.color = new ThemeColor('editor.foreground');
    } else if (currentAccess === 'Write') {
      statusBarItem.color = new ThemeColor('errorForeground');
    } else if (currentAccess === 'No Access') {
      statusBarItem.color = new ThemeColor('editorInfo.foreground');
    } else if (currentAccess === 'Context') {
      statusBarItem.color = new ThemeColor('textLink.foreground');
    }
  } catch (error) {
    errorHandler.handleError(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'updateStatusBarItem',
        details: { document: document.fileName }
      }
    );
    statusBarItem.text = '$(shield) AI: Error';
  }
}

export function deactivate(): void {
  for (const disposable of disposables) {
    disposable.dispose();
  }
  disposables = [];

  if (statusBarItem) {
    statusBarItem.dispose();
  }

  // Dispose ACL cache
  disposeACLCache();

  // Dispose performance monitor
  performanceMonitor.dispose();

  // Clear background processor queue
  backgroundProcessor.clearQueue();
}