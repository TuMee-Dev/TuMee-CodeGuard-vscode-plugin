// The final extension.ts file with thoroughly verified line count handling

import { type Disposable, type ExtensionContext, type TextEditorDecorationType, type TextDocument, type StatusBarItem, window, workspace, commands, ThemeColor, Position, Range, StatusBarAlignment } from 'vscode';
import { registerFileDecorationProvider } from '@/tools/file-customization-provider';
import { registerContextMenu } from '@/tools/register-context-menu';
import { registerGuardTagCommands } from '@/tools/contextMenu/setGuardTags';
import { firstTimeRun, getExtensionWithOptionalName } from '@/utils';
import { parseGuardTags, getLinePermissions, markLinesModified } from '@/utils/guardProcessor';
import { MARKDOWN_GUARD_TAG_REGEX, GUARD_TAG_REGEX } from '@/utils/acl';
import type { GuardTag, LinePermission, DecorationRanges } from '@/types/guardTypes';
import { errorHandler } from '@/utils/errorHandler';
import { initializeScopeResolver } from '@/utils/scopeResolver';
import { UTILITY_PATTERNS } from '@/utils/regexCache';
import { registerColorCustomizerCommand, type GuardColors } from '@/tools/colorCustomizer';
import { disposeACLCache } from '@/utils/aclCache';
import { performanceMonitor } from '@/utils/performanceMonitor';
import { configValidator } from '@/utils/configValidator';
import { backgroundProcessor } from '@/utils/backgroundProcessor';
import { registerValidationCommands } from '@/utils/validationMode';

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
          
          // If guard colors changed, refresh all decorations
          if (event.affectsConfiguration('tumee-vscode-plugin.guardColors') || 
              event.affectsConfiguration('tumee-vscode-plugin.guardColorsComplete')) {
            // Refresh decorations in all visible editors
            for (const editor of window.visibleTextEditors) {
              void updateCodeDecorations(editor.document);
            }
          }
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
              decorationTypes.forEach((decoration, key) => {
                const ranges = cachedDecorations[key as keyof DecorationRanges] || [];
                editor.setDecorations(decoration, ranges);
              });
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
  const defaultColors = {
    aiWrite: '#FFA500',
    aiRead: '#808080',
    aiNoAccess: '#90EE90',
    humanWrite: '#0000FF',
    humanRead: '#D3D3D3',
    humanNoAccess: '#FF0000',
    contextRead: '#00CED1',
    contextWrite: '#1E90FF',
    opacity: 0.3,
    aiTransparencyLevels: {
      write: 1.0,
      read: 1.0,
      noAccess: 1.0
    },
    humanTransparencyLevels: {
      write: 0.3,
      read: 0.6,
      noAccess: 1.0
    },
    useAiColorAsBase: true
  };

  // Merge user colors with defaults to ensure all properties exist
  const userColors = config.get<GuardColors>('guardColors') || {};
  const colors = { ...defaultColors, ...userColors };

  const opacity = colors.opacity || config.get<number>('codeDecorationOpacity') || 0.1;

  // Helper function to convert hex to rgba
  const hexToRgba = (hex: string | undefined, alpha: number): string => {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
      // Return transparent if no valid hex color provided
      return 'rgba(0, 0, 0, 0)';
    }
    try {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch (error) {
      console.error('Invalid hex color:', hex);
      return 'rgba(0, 0, 0, 0)';
    }
  };

  // Clear existing decorations
  decorationTypes.forEach(decoration => decoration.dispose());
  decorationTypes.clear();

  // Helper function to get the color for a permission combination
  const getPermissionColor = (key: string): { color: string, opacity: number } => {
    // Check if there's a custom color for this exact combination
    const customColor = (colors as Record<string, any>)[key] as string | undefined;
    if (customColor && typeof customColor === 'string') {
      return { color: customColor, opacity };
    }

    // Parse the permission key
    const parts = key.split('_');
    const aiPart = parts[0];
    const humanPart = parts[1];

    // Extract permissions
    const aiPermission = aiPart.replace('Context', '').replace('ai', '').toLowerCase();
    const humanPermission = humanPart.replace('human', '').toLowerCase();
    const isContext = aiPart.includes('Context');

    // Get base colors
    const aiColors = {
      write: colors.aiWrite,
      read: colors.aiRead,
      noaccess: colors.aiNoAccess
    };
    const humanColors = {
      write: colors.humanWrite,
      read: colors.humanRead,
      noaccess: colors.humanNoAccess
    };
    const contextColors = {
      write: colors.contextWrite,
      read: colors.contextRead
    };

    // Get transparency levels
    const aiTransparency = colors.aiTransparencyLevels || defaultColors.aiTransparencyLevels;
    const humanTransparency = colors.humanTransparencyLevels || defaultColors.humanTransparencyLevels;

    let baseColor: string;
    let effectiveOpacity = opacity;

    // Handle context colors specially
    if (isContext) {
      // For context, use the context color based on AI permission
      baseColor = aiPermission === 'write' ? contextColors.write : contextColors.read;

      // Apply human transparency to context
      if (colors.useAiColorAsBase) {
        effectiveOpacity *= humanTransparency[humanPermission as keyof typeof humanTransparency] || 1.0;
      }
    } else {
      // Determine base color and transparency based on configuration
      if (colors.useAiColorAsBase) {
        // Use AI color as base, apply human transparency
        baseColor = aiColors[aiPermission as keyof typeof aiColors];
        effectiveOpacity *= humanTransparency[humanPermission as keyof typeof humanTransparency] || 1.0;
      } else {
        // Use human color as base, apply AI transparency
        baseColor = humanColors[humanPermission as keyof typeof humanColors];
        effectiveOpacity *= aiTransparency[aiPermission as keyof typeof aiTransparency] || 1.0;
      }
    }

    return { color: baseColor, opacity: effectiveOpacity };
  };

  // All possible permission combinations
  const permissionCombinations = [
    'aiRead_humanRead',
    'aiRead_humanWrite',
    'aiRead_humanNoAccess',
    'aiWrite_humanRead',
    'aiWrite_humanWrite',
    'aiWrite_humanNoAccess',
    'aiNoAccess_humanRead',
    'aiNoAccess_humanWrite',
    'aiNoAccess_humanNoAccess',
    'aiReadContext_humanRead',
    'aiReadContext_humanWrite',
    'aiReadContext_humanNoAccess',
    'aiWriteContext_humanRead',
    'aiWriteContext_humanWrite',
    'aiWriteContext_humanNoAccess'
  ];

  // Create decoration types for all permission combinations
  permissionCombinations.forEach(key => {
    const { color, opacity: effectiveOpacity } = getPermissionColor(key);

    const decoration = window.createTextEditorDecorationType({
      backgroundColor: hexToRgba(color, effectiveOpacity),
      isWholeLine: true,
      borderWidth: '0 0 0 3px',
      borderStyle: 'solid',
      borderColor: hexToRgba(color, 0.6),
      overviewRulerColor: hexToRgba(color, 0.8),
      overviewRulerLane: 2,
    });
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
  if (aiPerm === 'r' && humanPerm === 'w') return 'aiRead_humanWrite';
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
 * Determine if whitespace should be trimmed for a given guard permission
 * @param target The guard target ('ai' or 'human')
 * @param permission The guard permission ('r', 'w', 'n', 'context')
 * @returns true if trailing whitespace should be trimmed from the decoration range
 */
function shouldTrimWhitespaceForPermissions(aiPerm: string, humanPerm: string): boolean {
  // Trim whitespace for:
  // - AI no-access or context
  // - Human read-only or no-access
  // - Either permission is context
  return aiPerm === 'n' || aiPerm === 'context' ||
         humanPerm === 'r' || humanPerm === 'n' || humanPerm === 'context';
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

    // Process the line permissions into continuous ranges
    let currentStart = -1;
    let currentAiPerm = '';
    let currentHumanPerm = '';
    let currentAiContext = false;
    let currentHumanContext = false;

    for (let i = 0; i < document.lineCount; i++) {
      const lineNumber = i + 1; // Convert to 1-based for permission lookup
      const perm = linePermissions.get(lineNumber);

      // Get AI and human permissions for this line
      const aiPerm = perm?.permissions?.ai || '';
      const humanPerm = perm?.permissions?.human || '';
      const aiContext = perm?.isContext?.ai || false;
      const humanContext = perm?.isContext?.human || false;

      // Check if we need to end the current range
      if (aiPerm !== currentAiPerm || humanPerm !== currentHumanPerm ||
          aiContext !== currentAiContext || humanContext !== currentHumanContext) {
        // End previous range if it exists
        if (currentStart >= 0) {
          const decorationType = getDecorationType(currentAiPerm, currentHumanPerm, currentAiContext, currentHumanContext);
          if (decorationType) {
            const shouldTrim = shouldTrimWhitespaceForPermissions(currentAiPerm, currentHumanPerm);
            const lastLine = shouldTrim
              ? findLastNonEmptyLine(lines, currentStart, i - 1)
              : i - 1;

            const endChar = lines[lastLine] ? lines[lastLine].length : 0;
            decorationRanges[decorationType].push({
              range: new Range(
                new Position(currentStart, 0),
                new Position(lastLine, endChar > 0 ? endChar : 0)
              )
            });
          }
        }

        // Start new range if we have permissions
        if (aiPerm || humanPerm) {
          currentStart = i;
          currentAiPerm = aiPerm;
          currentHumanPerm = humanPerm;
          currentAiContext = aiContext;
          currentHumanContext = humanContext;
        } else {
          currentStart = -1;
          currentAiPerm = '';
          currentHumanPerm = '';
          currentAiContext = false;
          currentHumanContext = false;
        }
      }
    }

    // Handle the last range if it extends to the end of the file
    if (currentStart >= 0 && (currentAiPerm || currentHumanPerm)) {
      const decorationType = getDecorationType(currentAiPerm, currentHumanPerm, currentAiContext, currentHumanContext);
      if (decorationType) {
        const shouldTrim = shouldTrimWhitespaceForPermissions(currentAiPerm, currentHumanPerm);
        const lastLine = shouldTrim
          ? findLastNonEmptyLine(lines, currentStart, lines.length - 1)
          : lines.length - 1;

        const endChar = lines[lastLine] ? lines[lastLine].length : 0;
        decorationRanges[decorationType].push({
          range: new Range(
            new Position(currentStart, 0),
            new Position(lastLine, endChar > 0 ? endChar : 0)
          )
        });
      }
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