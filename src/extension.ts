// The final extension.ts file with thoroughly verified line count handling

import { type Disposable, type ExtensionContext, type TextEditorDecorationType, type TextDocument, type StatusBarItem, window, workspace, commands, ThemeColor, Position, Range, StatusBarAlignment } from 'vscode';
import { registerFileDecorationProvider } from '@/tools/file-customization-provider';
import { registerContextMenu } from '@/tools/register-context-menu';
import { registerGuardTagCommands } from '@/tools/contextMenu/setGuardTags';
import { firstTimeRun, getExtensionWithOptionalName } from '@/utils';
import { parseGuardTags, computeLinePermissions } from '@/utils/guardProcessor';
import { MARKDOWN_GUARD_TAG_REGEX, GUARD_TAG_REGEX } from '@/utils/acl';
import type { GuardTag } from '@/types/guardTypes';
import { logError } from '@/utils/errorHandler';

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
const DECORATION_UPDATE_DELAY = 100; // milliseconds

export function activate(context: ExtensionContext) {
  disposables = [];

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

    // Create decorations for code regions
    initializeCodeDecorations(context);

    // Create status bar item
    createStatusBarItem(context);

    // Set up listeners for active editor
    const activeEditor = window.activeTextEditor;
    if (activeEditor) {
      triggerUpdateDecorations(activeEditor.document);
      updateStatusBarItem(activeEditor.document);
    }

    // Update decorations when document changes
    disposables.push(
      workspace.onDidChangeTextDocument(event => {
        const activeEditor = window.activeTextEditor;
        if (activeEditor && event.document === activeEditor.document) {
          triggerUpdateDecorations(event.document);
          updateStatusBarItem(event.document);
        }
      })
    );

    // Update decorations when editor changes
    disposables.push(
      window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          triggerUpdateDecorations(editor.document);
          updateStatusBarItem(editor.document);
        }
      })
    );
  }
}

function initializeCodeDecorations(_context: ExtensionContext) {
  // Get configured opacity
  const opacity = workspace.getConfiguration(getExtensionWithOptionalName()).get<number>('codeDecorationOpacity') || 0.1;

  // AI Write regions (red with transparency)
  aiOnlyDecoration = window.createTextEditorDecorationType({
    backgroundColor: `rgba(244, 67, 54, ${opacity})`, // Red color for AI Write
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: 'rgba(244, 67, 54, 0.6)',
    overviewRulerColor: new ThemeColor('tumee.ai'),
    overviewRulerLane: 2,
  });

  // AI No Access regions (green with transparency)
  humanOnlyDecoration = window.createTextEditorDecorationType({
    backgroundColor: `rgba(76, 175, 80, ${opacity})`, // Green color for AI No Access
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: 'rgba(76, 175, 80, 0.6)',
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

  // Human Read-Only regions (purple with transparency)
  humanReadOnlyDecoration = window.createTextEditorDecorationType({
    backgroundColor: `rgba(156, 39, 176, ${opacity})`, // Purple color for Human Read-Only
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: 'rgba(156, 39, 176, 0.6)',
    overviewRulerColor: new ThemeColor('tumee.humanReadOnly'),
    overviewRulerLane: 2,
  });

  // Human No Access regions (orange with transparency)
  humanNoAccessDecoration = window.createTextEditorDecorationType({
    backgroundColor: `rgba(255, 152, 0, ${opacity})`, // Orange color for Human No Access
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 152, 0, 0.6)',
    overviewRulerColor: new ThemeColor('tumee.humanNoAccess'),
    overviewRulerLane: 2,
  });

  // Context regions (light blue with transparency)
  contextDecoration = window.createTextEditorDecorationType({
    backgroundColor: `rgba(0, 188, 212, ${opacity})`, // Light blue color for Context
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: 'rgba(0, 188, 212, 0.6)',
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

  // Debounce the update
  decorationUpdateTimer = setTimeout(() => {
    updateCodeDecorations(document);
  }, DECORATION_UPDATE_DELAY);
}

function updateCodeDecorations(document: TextDocument) {
  const text = document.getText();
  if (!text) return;

  // Performance optimization - skip large files over threshold
  const MAX_FILE_SIZE = 1000000; // ~1MB
  if (text.length > MAX_FILE_SIZE) {
    console.warn(`File too large for decoration (${text.length} bytes). Skipping.`);
    return;
  }

  // Process the document to apply decorations
  updateCodeDecorationsImpl(document);
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
}

/**
 * Implementation of code decoration updates
 * This now uses the shared guard processing logic
 *
 * @param document The active document
 */
function updateCodeDecorationsImpl(document: TextDocument) {
  if (!document) return;

  const activeEditor = window.activeTextEditor;
  if (!activeEditor) return;

  const text = document.getText();
  const lines = text.split(/\r?\n/);

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
    guardTags = parseGuardTags(document, lines);
    linePermissions = computeLinePermissions(lines, guardTags);
  } catch (error) {
    logError(error, 'updateCodeDecorationsImpl', { showUser: false });
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

  // Helper function to find the last non-empty line in a range
  function findLastNonEmptyLine(startLine: number, endLine: number): number {
    for (let i = endLine; i >= startLine; i--) {
      if (lines[i].trim() !== '') {
        return i;
      }
    }
    return startLine; // Default to startLine if all lines are empty
  }

  // Process the line permissions into continuous ranges
  let currentStart = -1;
  let currentTarget = '';
  let currentPermission = '';

  for (let i = 0; i < linePermissions.length; i++) {
    const perm = linePermissions[i];
    const target = typeof perm === 'object' ? perm.target : 'ai';
    const permission = typeof perm === 'object' ? perm.permission : perm;

    // Check if we need to end the current range
    if (target !== currentTarget || permission !== currentPermission) {
      // End previous range if it exists
      if (currentStart >= 0) {
        const lastContentLine = findLastNonEmptyLine(currentStart, i - 1);
        const range = new Range(
          new Position(currentStart, 0),
          new Position(lastContentLine, lines[lastContentLine] ? lines[lastContentLine].length : 0)
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
      if (permission !== 'default' && permission !== 'r' && target) {
        currentStart = i;
        currentTarget = target;
        currentPermission = permission;
      } else {
        currentStart = -1;
        currentTarget = '';
        currentPermission = '';
      }
    }
  }

  // Handle the last range if it extends to the end of the file
  if (currentStart >= 0 && currentTarget && currentPermission) {
    const lastContentLine = findLastNonEmptyLine(currentStart, lines.length - 1);
    const range = new Range(
      new Position(currentStart, 0),
      new Position(lastContentLine, lines[lastContentLine] ? lines[lastContentLine].length : 0)
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
function updateStatusBarItem(document: TextDocument) {
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

  const lines = text.split(/\r?\n/);
  let currentAccess = 'Default';
  let lineCount: number | undefined = undefined;

  // Use shared functions to parse guard tags
  let guardTags: GuardTag[] = [];
  let linePermissions: ReturnType<typeof computeLinePermissions> = [];

  try {
    guardTags = parseGuardTags(document, lines);
    linePermissions = computeLinePermissions(lines, guardTags);
  } catch (error) {
    logError(error, 'updateStatusBarItem', { showUser: false });
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
}

export function deactivate(): void {
  for (const disposable of disposables) {
    disposable.dispose();
  }
  disposables = [];

  if (statusBarItem) {
    statusBarItem.dispose();
  }
}