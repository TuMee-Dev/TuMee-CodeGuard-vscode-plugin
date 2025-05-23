// The final extension.ts file with thoroughly verified line count handling

import { type Disposable, type ExtensionContext, type TextEditorDecorationType, type TextDocument, type StatusBarItem, window, workspace, commands, ThemeColor, Position, Range, StatusBarAlignment, ProgressLocation } from 'vscode';
import { registerFileDecorationProvider } from '@/tools/file-customization-provider';
import { registerContextMenu } from '@/tools/register-context-menu';
import { registerGuardTagCommands } from '@/tools/contextMenu/setGuardTags';
import { firstTimeRun, getExtensionWithOptionalName } from '@/utils';
import { parseGuardTags, parseGuardTagsChunked, computeLinePermissions, markLinesModified } from '@/utils/guardProcessor';
import { MARKDOWN_GUARD_TAG_REGEX, GUARD_TAG_REGEX } from '@/utils/acl';
import type { GuardTag } from '@/types/guardTypes';
import { errorHandler } from '@/utils/errorHandler';
import { initializeScopeResolver } from '@/utils/scopeResolver';
import { UTILITY_PATTERNS } from '@/utils/regexCache';
import { registerColorCustomizerCommand, type GuardColors } from '@/tools/colorCustomizer';
import { disposeACLCache } from '@/utils/aclCache';
import { performanceMonitor } from '@/utils/performanceMonitor';
import { configValidator } from '@/utils/configValidator';
import { backgroundProcessor } from '@/utils/backgroundProcessor';
import { incrementalParser } from '@/utils/incrementalParser';
import { registerValidationCommands } from '@/utils/validationMode';

let disposables: Disposable[] = [];
let aiOnlyDecoration: TextEditorDecorationType;
let humanOnlyDecoration: TextEditorDecorationType;
let mixedDecoration: TextEditorDecorationType;
let humanReadOnlyDecoration: TextEditorDecorationType;
let humanNoAccessDecoration: TextEditorDecorationType;
let contextDecoration: TextEditorDecorationType;
let statusBarItem: StatusBarItem;

// Debounce timer for decoration updates
let decorationUpdateTimer: NodeJS.Timeout | undefined;

// Performance optimization: track document versions to avoid redundant processing
const processedDocumentVersions = new WeakMap<TextDocument, number>();

// Track document change events for incremental parsing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const documentChangeEvents = new WeakMap<TextDocument, any>();

// Cache decoration ranges to prevent flashing when switching tabs
const decorationCache = new WeakMap<TextDocument, {
  aiWrite: { range: Range }[];
  aiNoAccess: { range: Range }[];
  humanReadOnly: { range: Range }[];
  humanNoAccess: { range: Range }[];
  context: { range: Range }[];
}>();

export async function activate(context: ExtensionContext) {
  try {
    disposables = [];

    // Initialize tree-sitter for semantic scope resolution
    await initializeScopeResolver(context);

    const isEnabled = context.globalState.get('isEnabled');

    if (isEnabled !== false) {
      firstTimeRun(context);

      // Register file and folder decoration provider
      const { disposable, provider } = registerFileDecorationProvider(context);
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
          aiOnlyDecoration?.dispose();
          humanOnlyDecoration?.dispose();
          mixedDecoration?.dispose();
          humanReadOnlyDecoration?.dispose();
          humanNoAccessDecoration?.dispose();
          contextDecoration?.dispose();

          // Reinitialize with new colors
          initializeCodeDecorations(context);

          // Update current editor
          const activeEditor = window.activeTextEditor;
          if (activeEditor) {
            triggerUpdateDecorations(activeEditor.document);
          }
        })
      );

      // Create decorations for code regions
      initializeCodeDecorations(context);

      // Create status bar item
      createStatusBarItem(context);

      // Register performance report command
      disposables.push(
        commands.registerCommand('tumee-vscode-plugin.showPerformanceReport', () => {
          performanceMonitor.showReport();
        })
      );

      // Register validation commands (developer feature)
      const validationDisposables = registerValidationCommands(context);
      disposables.push(...validationDisposables);

      // Validate configuration on startup
      const validationResult = configValidator.validateConfiguration();
      if (!validationResult.valid) {
        configValidator.showValidationErrors(validationResult);
        // Auto-fix if possible
        void configValidator.autoFixConfiguration();
      }

      // Watch for configuration changes
      disposables.push(
        workspace.onDidChangeConfiguration(event => {
          configValidator.handleConfigurationChange(event);
        })
      );

      // Set up listeners for active editor
      const activeEditor = window.activeTextEditor;
      if (activeEditor) {
        // Update immediately without debounce for initial load
        void updateCodeDecorations(activeEditor.document);
        void updateStatusBarItem(activeEditor.document);
      }

      // Update decorations when document changes
      disposables.push(
        workspace.onDidChangeTextDocument(event => {
          const activeEditor = window.activeTextEditor;
          if (activeEditor && event.document === activeEditor.document) {
            // Store the change event for incremental parsing
            documentChangeEvents.set(event.document, event);

            // Track modified lines for partial cache invalidation
            for (const change of event.contentChanges) {
              const startLine = change.range.start.line;
              const endLine = change.range.end.line;
              const linesAdded = change.text.split('\n').length - 1;
              // const linesRemoved = endLine - startLine; // kept for future use

              // Mark affected lines as modified
              markLinesModified(event.document, startLine, Math.max(endLine, startLine + linesAdded));
            }

            triggerUpdateDecorations(event.document);
            void updateStatusBarItem(event.document);
          }
        })
      );

      // Update decorations when editor changes
      disposables.push(
        window.onDidChangeActiveTextEditor(editor => {
          if (editor) {
            // Apply cached decorations immediately to prevent flashing
            const cachedDecorations = decorationCache.get(editor.document);
            if (cachedDecorations) {
              editor.setDecorations(aiOnlyDecoration, cachedDecorations.aiWrite);
              editor.setDecorations(humanOnlyDecoration, cachedDecorations.aiNoAccess);
              editor.setDecorations(humanReadOnlyDecoration, cachedDecorations.humanReadOnly);
              editor.setDecorations(humanNoAccessDecoration, cachedDecorations.humanNoAccess);
              editor.setDecorations(contextDecoration, cachedDecorations.context);
            }

            // Then trigger a proper update (no debounce for tab switches)
            void updateCodeDecorations(editor.document);
            void updateStatusBarItem(editor.document);
          }
        })
      );

      // Clear caches when documents are closed
      disposables.push(
        workspace.onDidCloseTextDocument(document => {
          incrementalParser.clearCache(document);
          documentChangeEvents.delete(document);
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
  // Get configured colors and opacity
  const config = workspace.getConfiguration(getExtensionWithOptionalName());
  const colors = config.get<GuardColors>('guardColors') || {
    aiWrite: '#FFA500',      // Yellow/Amber for AI write
    aiNoAccess: '#90EE90',   // Light green for AI no access
    humanReadOnly: '#D3D3D3', // Light grey for human read-only
    humanNoAccess: '#FF0000', // Red for human no access
    context: '#00CED1',      // Light blue/cyan for AI context
    opacity: 0.3
  };

  const opacity = colors.opacity || config.get<number>('codeDecorationOpacity') || 0.1;

  // Helper function to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // AI Write regions
  aiOnlyDecoration = window.createTextEditorDecorationType({
    backgroundColor: hexToRgba(colors.aiWrite, opacity),
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: hexToRgba(colors.aiWrite, 0.6),
    overviewRulerColor: new ThemeColor('tumee.ai'),
    overviewRulerLane: 2,
  });

  // AI No Access regions
  humanOnlyDecoration = window.createTextEditorDecorationType({
    backgroundColor: hexToRgba(colors.aiNoAccess, opacity),
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: hexToRgba(colors.aiNoAccess, 0.6),
    overviewRulerColor: new ThemeColor('tumee.human'),
    overviewRulerLane: 2,
  });

  // Mixed regions (unused but kept for backward compatibility)
  mixedDecoration = window.createTextEditorDecorationType({
    backgroundColor: `rgba(33, 150, 243, ${opacity})`, // Blue color for mixed (unused)
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: 'rgba(33, 150, 243, 0.6)',
    overviewRulerColor: new ThemeColor('tumee.humanAI'),
    overviewRulerLane: 2,
  });

  // Human Read-Only regions
  humanReadOnlyDecoration = window.createTextEditorDecorationType({
    backgroundColor: hexToRgba(colors.humanReadOnly, opacity),
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: hexToRgba(colors.humanReadOnly, 0.6),
    overviewRulerColor: new ThemeColor('tumee.humanReadOnly'),
    overviewRulerLane: 2,
  });

  // Human No Access regions
  humanNoAccessDecoration = window.createTextEditorDecorationType({
    backgroundColor: hexToRgba(colors.humanNoAccess, opacity),
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: hexToRgba(colors.humanNoAccess, 0.6),
    overviewRulerColor: new ThemeColor('tumee.humanNoAccess'),
    overviewRulerLane: 2,
  });

  // Context regions
  contextDecoration = window.createTextEditorDecorationType({
    backgroundColor: hexToRgba(colors.context, opacity),
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: hexToRgba(colors.context, 0.6),
    overviewRulerColor: new ThemeColor('tumee.context'),
    overviewRulerLane: 2,
  });

  disposables.push(aiOnlyDecoration, humanOnlyDecoration, mixedDecoration, humanReadOnlyDecoration, humanNoAccessDecoration, contextDecoration);
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
  const config = workspace.getConfiguration(getExtensionWithOptionalName());
  const delay = config.get<number>('decorationUpdateDelay', 300);

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
  const config = workspace.getConfiguration(getExtensionWithOptionalName());
  const maxFileSize = config.get<number>('maxFileSize', 1000000);

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

  activeEditor.setDecorations(aiOnlyDecoration, []);
  activeEditor.setDecorations(humanOnlyDecoration, []);
  activeEditor.setDecorations(mixedDecoration, []);
  activeEditor.setDecorations(humanReadOnlyDecoration, []);
  activeEditor.setDecorations(humanNoAccessDecoration, []);
  activeEditor.setDecorations(contextDecoration, []);

  // Also clear the cache for this document
  if (activeEditor.document) {
    decorationCache.delete(activeEditor.document);
  }
}

/**
 * Helper function to find the last non-empty line in a range
 */
function findLastNonEmptyLine(lines: string[], startLine: number, endLine: number): number {
  for (let i = endLine; i >= startLine; i--) {
    if (lines[i].trim() !== '') {
      return i;
    }
  }
  return startLine; // Default to startLine if all lines are empty
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
    let linePermissions: ReturnType<typeof computeLinePermissions> = [];

    try {
      const config = workspace.getConfiguration(getExtensionWithOptionalName());
      const enableIncremental = config.get<boolean>('enableIncrementalParsing', true);
      const enableChunked = config.get<boolean>('enableChunkedProcessing', true);
      const chunkSize = config.get<number>('chunkSize', 1000);

      // Use incremental parsing if enabled and we have a change event
      if (enableIncremental) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const changeEvent = documentChangeEvents.get(document);
        performanceMonitor.startTimer('incrementalParse');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        guardTags = await incrementalParser.parseIncremental(document, changeEvent);
        performanceMonitor.endTimer('incrementalParse', {
          lines: lines.length,
          incremental: !!changeEvent,
          cached: incrementalParser.getCacheStats()
        });

        // Clear the change event after use
        if (changeEvent) {
          documentChangeEvents.delete(document);
        }
      } else {
        // Fallback to regular parsing
        // Use chunked processing for large files
        if (enableChunked && lines.length > chunkSize * 2) {
          // Show progress notification for very large files
          const showProgress = lines.length > 10000;

          performanceMonitor.startTimer('parseGuardTagsChunked');
          if (showProgress) {
            await window.withProgress({
              location: ProgressLocation.Notification,
              title: 'Processing guard tags...',
              cancellable: false
            }, async (progress) => {
              guardTags = await parseGuardTagsChunked(document, lines, chunkSize, (processed, total) => {
                const percentage = Math.round((processed / total) * 100);
                progress.report({ increment: percentage / 100, message: `${percentage}%` });
              });
              return guardTags;
            });
          } else {
            guardTags = await parseGuardTagsChunked(document, lines, chunkSize);
          }
          performanceMonitor.endTimer('parseGuardTagsChunked', { lines: lines.length, chunked: true });
        } else {
          performanceMonitor.startTimer('parseGuardTags');
          guardTags = await parseGuardTags(document, lines);
          performanceMonitor.endTimer('parseGuardTags', { lines: lines.length, chunked: false });
        }
      }

      performanceMonitor.startTimer('computeLinePermissions');
      linePermissions = computeLinePermissions(lines, guardTags);
      performanceMonitor.endTimer('computeLinePermissions', { lines: lines.length, guardTags: guardTags.length });
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
    const decorationRanges = {
      aiWrite: [] as { range: Range }[],
      aiNoAccess: [] as { range: Range }[],
      humanReadOnly: [] as { range: Range }[],
      humanNoAccess: [] as { range: Range }[],
      context: [] as { range: Range }[]
    };

    // Process the line permissions into continuous ranges
    let currentStart = -1;
    let currentTarget = '';
    let currentPermission = '';

    for (let i = 0; i < linePermissions.length; i++) {
      const perm = linePermissions[i];
      const target = typeof perm === 'object' ? perm.target : 'ai';
      const permission = typeof perm === 'object' ? perm.permission : perm;

      // Treat all default permissions as AI writable
      let effectivePermission = permission;
      let effectiveTarget = target || 'ai';
      if (permission === 'default') {
        effectivePermission = 'w';
        effectiveTarget = 'ai';
      }

      // Check if we need to end the current range
      if (effectiveTarget !== currentTarget || effectivePermission !== currentPermission) {
      // End previous range if it exists
        if (currentStart >= 0) {
          // Only trim whitespace for read-only and no-access sections
          const shouldTrimWhitespace = (currentTarget === 'ai' && currentPermission === 'n') ||
                                       (currentTarget === 'human' && (currentPermission === 'r' || currentPermission === 'n'));
          const lastLine = shouldTrimWhitespace
            ? findLastNonEmptyLine(lines, currentStart, i - 1)
            : i - 1;

          const range = new Range(
            new Position(currentStart, 0),
            new Position(lastLine, lines[lastLine] ? lines[lastLine].length : 0)
          );

          // Add range to appropriate decoration array
          if (currentTarget === 'ai') {
            if (currentPermission === 'w') {
              decorationRanges.aiWrite.push({ range });
            } else if (currentPermission === 'n') {
              decorationRanges.aiNoAccess.push({ range });
            } else if (currentPermission === 'context') {
              decorationRanges.context.push({ range });
            }
          } else if (currentTarget === 'human') {
            if (currentPermission === 'r') {
              decorationRanges.humanReadOnly.push({ range });
            } else if (currentPermission === 'n') {
              decorationRanges.humanNoAccess.push({ range });
            }
          }
        }

        // Start new range if this is a highlighted permission
        const shouldHighlight =
          (effectiveTarget === 'ai' && (effectivePermission === 'w' || effectivePermission === 'n' || effectivePermission === 'context')) ||
          (effectiveTarget === 'human' && (effectivePermission === 'r' || effectivePermission === 'n'));

        if (shouldHighlight) {
          currentStart = i;
          currentTarget = effectiveTarget;
          currentPermission = effectivePermission;
        } else {
          currentStart = -1;
          currentTarget = '';
          currentPermission = '';
        }
      }
    }

    // Handle the last range if it extends to the end of the file
    if (currentStart >= 0 && currentTarget && currentPermission) {
      // Only trim whitespace for read-only and no-access sections
      const shouldTrimWhitespace = (currentTarget === 'ai' && currentPermission === 'n') ||
                                   (currentTarget === 'human' && (currentPermission === 'r' || currentPermission === 'n'));
      const lastLine = shouldTrimWhitespace
        ? findLastNonEmptyLine(lines, currentStart, lines.length - 1)
        : lines.length - 1;

      const range = new Range(
        new Position(currentStart, 0),
        new Position(lastLine, lines[lastLine] ? lines[lastLine].length : 0)
      );

      if (currentTarget === 'ai') {
        if (currentPermission === 'w') {
          decorationRanges.aiWrite.push({ range });
        } else if (currentPermission === 'n') {
          decorationRanges.aiNoAccess.push({ range });
        } else if (currentPermission === 'context') {
          decorationRanges.context.push({ range });
        }
      } else if (currentTarget === 'human') {
        if (currentPermission === 'r') {
          decorationRanges.humanReadOnly.push({ range });
        } else if (currentPermission === 'n') {
          decorationRanges.humanNoAccess.push({ range });
        }
      }
    }

    // Apply decorations
    activeEditor.setDecorations(aiOnlyDecoration, decorationRanges.aiWrite);
    activeEditor.setDecorations(humanOnlyDecoration, decorationRanges.aiNoAccess);
    activeEditor.setDecorations(mixedDecoration, []);
    activeEditor.setDecorations(humanReadOnlyDecoration, decorationRanges.humanReadOnly);
    activeEditor.setDecorations(humanNoAccessDecoration, decorationRanges.humanNoAccess);
    activeEditor.setDecorations(contextDecoration, decorationRanges.context);

    // Cache the decoration ranges to prevent flashing when switching tabs
    decorationCache.set(document, {
      aiWrite: decorationRanges.aiWrite,
      aiNoAccess: decorationRanges.aiNoAccess,
      humanReadOnly: decorationRanges.humanReadOnly,
      humanNoAccess: decorationRanges.humanNoAccess,
      context: decorationRanges.context
    });

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
    let lineCount: number | undefined = undefined;

    // Use shared functions to parse guard tags
    let guardTags: GuardTag[] = [];
    let linePermissions: ReturnType<typeof computeLinePermissions> = [];

    try {
      guardTags = await parseGuardTags(document, lines);
      linePermissions = computeLinePermissions(lines, guardTags);
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
    const cursorPermission = linePermissions[cursorLine];

    // Only show AI permissions in the status bar for now
    if (cursorPermission && cursorPermission.target === 'ai') {
      currentAccess =
      cursorPermission.permission === 'r' ? 'Read-Only' :
        cursorPermission.permission === 'w' ? 'Write' :
          cursorPermission.permission === 'n' ? 'No Access' :
            cursorPermission.permission === 'context' ? 'Context' : 'Default';

      lineCount = cursorPermission.lineCount;
    }

    // Set status bar text with line count if present
    const lineCountText = lineCount ? ` (${lineCount} lines)` : '';
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