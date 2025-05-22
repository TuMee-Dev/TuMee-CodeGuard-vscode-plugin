// The final extension.ts file with thoroughly verified line count handling

import type { Disposable, ExtensionContext } from "vscode";
import { window, workspace, commands, ThemeColor, Position, Range, TextEditorDecorationType, StatusBarAlignment } from "vscode";
import { registerFileDecorationProvider } from "@/tools/file-customization-provider";
import { registerContextMenu } from "@/tools/register-context-menu";
import { registerGuardTagCommands } from "@/tools/contextMenu/setGuardTags";
import { firstTimeRun, getExtensionWithOptionalName } from "@/utils";

let disposables: Disposable[] = [];
let aiOnlyDecoration: TextEditorDecorationType;
let humanOnlyDecoration: TextEditorDecorationType;
let mixedDecoration: TextEditorDecorationType;
let statusBarItem: any;

export function activate(context: ExtensionContext) {
  disposables = [];

  const isEnabled = context.globalState.get("isEnabled");

  if (isEnabled !== false) {
    firstTimeRun(context);

    // Register file and folder decoration provider
    const { disposable, provider } = registerFileDecorationProvider(context);
    disposables.push(disposable);

    // Register context menu commands
    registerContextMenu(context, provider).then((newDisposables) => {
      disposables.push(...newDisposables);
    });

    // Register guard tag commands for editor context menu
    registerGuardTagCommands(context).then((guardDisposables) => {
      disposables.push(...guardDisposables);
    });

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

function initializeCodeDecorations(context: ExtensionContext) {
  // Get configured opacity
  const opacity = workspace.getConfiguration(getExtensionWithOptionalName()).get<number>("codeDecorationOpacity") || 0.1;

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

  disposables.push(aiOnlyDecoration, humanOnlyDecoration, mixedDecoration);
}

function triggerUpdateDecorations(document: any) {
  if (!document) return;

  // Skip non-text files
  if (document.uri.scheme !== 'file') return;

  const text = document.getText();
  if (!text) return;

  // Performance optimization - skip large files over threshold
  const MAX_FILE_SIZE = 1000000; // ~1MB
  if (text.length > MAX_FILE_SIZE) {
    console.warn(`File too large for decoration (${text.length} bytes). Skipping.`);
    return;
  }

  // Process the document to apply decorations
  updateCodeDecorations(document);
}

/**
 * This function determines the effective permission for each line in the document
 * by parsing guard tags and then creates decoration ranges.
 * 
 * The algorithm exactly follows the verified implementation from focused-fix.js:
 * 1. Process unbounded regions to establish base permissions
 * 2. Find parent permissions for bounded regions 
 * 3. Apply bounded regions with reversion to parent permissions
 * 4. Skip empty lines at section boundaries
 * 
 * @param document The active document
 */
function updateCodeDecorations(document: any) {
  if (!document) return;
  
  const activeEditor = window.activeTextEditor;
  if (!activeEditor) return;

  const text = document.getText();
  const lines = text.split(/\r?\n/);
  const isMarkdown = document.languageId === 'markdown';
  const isPython = document.languageId === 'python';
  
  // Define language-specific patterns - all have line count in capture group 3
  const MARKDOWN_PATTERN = /<!--.*?@guard:ai:(r|w|n)(\.(\d+))?.*?-->/i;
  const PYTHON_PATTERN = /#\s*@guard:ai:(r|w|n)(\.(\d+))?/i;
  const GENERAL_PATTERN = /(?:\/\/|#|--|\/\*|\*)*\s*@guard:ai:(r|w|n)(\.(\d+))?/i;
  
  // Check if the document has any guard tags - if not, clear decorations and exit
  let hasGuardTags = false;
  
  if (isMarkdown) {
    hasGuardTags = text.includes("@guard:ai:") && MARKDOWN_PATTERN.test(text);
  } else if (isPython) {
    hasGuardTags = text.includes("@guard:ai:") && PYTHON_PATTERN.test(text);
  } else {
    hasGuardTags = text.includes("@guard:ai:") && GENERAL_PATTERN.test(text);
  }
  
  if (!hasGuardTags) {
    // No guard tags - clear decorations
    activeEditor.setDecorations(aiOnlyDecoration, []);
    activeEditor.setDecorations(humanOnlyDecoration, []);
    activeEditor.setDecorations(mixedDecoration, []);
    return;
  }
  
  // First, find all guard tags and store their positions and permissions
  const guardTags = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match guard tag based on file type
    let match = null;
    if (isMarkdown) {
      match = line.match(MARKDOWN_PATTERN);
    } else if (isPython) {
      match = line.match(PYTHON_PATTERN);
    } else {
      match = line.match(GENERAL_PATTERN);
    }
    
    if (match) {
      const permission = match[1].toLowerCase();
      const lineCount = match[3] ? parseInt(match[3], 10) : undefined;
      
      guardTags.push({
        lineNumber: i,
        permission,
        lineCount
      });
    }
  }
  
  // STEP 1: Create a map of permissions for each line
  const linePermissions = new Array(lines.length).fill('default');
  
  // Sort guard tags by line number to ensure we process them in order
  guardTags.sort((a, b) => a.lineNumber - b.lineNumber);
  
  // First process all unbounded regions to establish base permissions
  const basePermissions = new Array(lines.length).fill(null);
  
  for (let i = 0; i < guardTags.length; i++) {
    const tag = guardTags[i];
    
    // Skip bounded regions for now
    if (tag.lineCount !== undefined) continue;
    
    // For unbounded regions, apply from this line to the next guard tag
    const startLine = tag.lineNumber;
    let endLine;
    
    // Find the next guard tag (bounded or unbounded)
    if (i < guardTags.length - 1) {
      endLine = guardTags[i + 1].lineNumber;
    } else {
      endLine = lines.length;
    }
    
    // Apply this permission to all lines in the range
    for (let j = startLine; j < endLine; j++) {
      basePermissions[j] = tag.permission;
      linePermissions[j] = tag.permission;
    }
  }
  
  // STEP 2: Determine parent permissions for bounded regions
  // For each bounded region, find the most recent unbounded region before it
  const parentPermissions = new Map();

  for (let i = 0; i < guardTags.length; i++) {
    const tag = guardTags[i];
    if (tag.lineCount === undefined) continue; // Skip unbounded regions

    // Find the most recent unbounded region before this one
    let parentPermission = 'default';
    for (let j = 0; j < i; j++) {
      const prevTag = guardTags[j];
      if (prevTag.lineCount === undefined && prevTag.lineNumber < tag.lineNumber) {
        parentPermission = prevTag.permission;
      }
    }

    parentPermissions.set(tag.lineNumber, parentPermission);
  }

  // STEP 3: Process bounded regions (with line counts)
  for (const tag of guardTags) {
    if (tag.lineCount === undefined) continue; // Skip unbounded regions

    const startLine = tag.lineNumber;
    // Adding +1 so we count the line with the guard tag itself
    const endLine = Math.min(startLine + tag.lineCount + 1, lines.length);

    // Apply the bounded region's permission
    for (let i = startLine; i < endLine; i++) {
      linePermissions[i] = tag.permission;
    }

    // BUGFIX 1: After a bounded region ends, revert to the parent permission
    if (endLine < lines.length) {
      // Get the parent permission we determined earlier
      const parentPermission = parentPermissions.get(startLine);
      if (parentPermission) {
        linePermissions[endLine] = parentPermission;
      }
    }
  }
  
  // Apply base permissions to any lines that haven't been set yet
  for (let i = 0; i < lines.length; i++) {
    if (linePermissions[i] === 'default' && basePermissions[i]) {
      linePermissions[i] = basePermissions[i];
    }
  }
  
  // BUGFIX 2: Make sure empty lines inherit permissions
  // This is the fix for the second bug
  for (let i = 1; i < lines.length; i++) {
    if (linePermissions[i] === 'default' && i > 0 && linePermissions[i-1] !== 'default') {
      // An empty or unprocessed line inherits from the previous line
      linePermissions[i] = linePermissions[i-1];
    }
  }

  // Now convert linePermissions to decoration ranges
  // But exclude empty lines at the END of sections
  const aiOnlyRanges: { range: Range }[] = [];
  const humanOnlyRanges: { range: Range }[] = [];

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
  let currentPermission = '';

  for (let i = 0; i < linePermissions.length; i++) {
    const permission = linePermissions[i];

    if (permission !== currentPermission) {
      // End previous range if it exists
      if (currentStart >= 0) {
        // Find the last non-empty line before this permission change
        const lastContentLine = findLastNonEmptyLine(currentStart, i - 1);

        // Create range that ends at the last content line, not including trailing empty lines
        const range = new Range(
          new Position(currentStart, 0),
          new Position(lastContentLine, lines[lastContentLine] ? lines[lastContentLine].length : 0)
        );

        if (currentPermission === 'w') {
          aiOnlyRanges.push({ range });
        } else if (currentPermission === 'n') {
          humanOnlyRanges.push({ range });
        }
      }

      // Start new range if this is a highlighted permission
      if (permission === 'w' || permission === 'n') {
        currentStart = i;
        currentPermission = permission;
      } else {
        currentStart = -1;
        currentPermission = '';
      }
    }
  }

  // Handle the last range if it extends to the end of the file
  if (currentStart >= 0 && currentPermission) {
    // Find the last non-empty line in the file
    const lastContentLine = findLastNonEmptyLine(currentStart, lines.length - 1);

    // Create range that ends at the last content line
    const range = new Range(
      new Position(currentStart, 0),
      new Position(lastContentLine, lines[lastContentLine] ? lines[lastContentLine].length : 0)
    );

    if (currentPermission === 'w') {
      aiOnlyRanges.push({ range });
    } else if (currentPermission === 'n') {
      humanOnlyRanges.push({ range });
    }
  }
  
  // Apply decorations
  activeEditor.setDecorations(aiOnlyDecoration, aiOnlyRanges);
  activeEditor.setDecorations(humanOnlyDecoration, humanOnlyRanges);
  activeEditor.setDecorations(mixedDecoration, []);
}

/**
 * Creates the status bar item that shows the current AI access level
 * @param context The extension context
 */
function createStatusBarItem(context: ExtensionContext) {
  statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  statusBarItem.command = "tumee-vscode-plugin.toggleAIAccess";

  // Add command to toggle AI access level
  const toggleDisposable = commands.registerCommand("tumee-vscode-plugin.toggleAIAccess", () => {
    const items = [
      { label: "AI Read-Only", permission: "r" },
      { label: "AI Write Access", permission: "w" },
      { label: "AI No Access", permission: "n" }
    ];

    window.showQuickPick(items, {
      placeHolder: "Select AI Access Level"
    }).then(item => {
      if (item) {
        commands.executeCommand(`tumee-vscode-plugin.setAI${item.permission === 'r' ? 'ReadOnly' : item.permission === 'w' ? 'Write' : 'NoAccess'}`);
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
function updateStatusBarItem(document: any) {
  if (!document || !statusBarItem) return;

  // Get the text at the current cursor position
  const activeEditor = window.activeTextEditor;
  if (!activeEditor) {
    statusBarItem.text = `$(shield) AI: Unknown`;
    return;
  }

  const text = document.getText();
  if (!text) {
    statusBarItem.text = `$(shield) AI: Default`;
    return;
  }

  // Scan the document to find the current AI access level at cursor
  const cursorPosition = activeEditor.selection.active;
  const cursorLine = cursorPosition.line;

  const lines = text.split(/\r?\n/);
  let currentAccess = "Default";
  let lineCount = undefined;

  const isMarkdown = document.languageId === 'markdown';
  const isPython = document.languageId === 'python';
  
  // Define language-specific patterns
  const MARKDOWN_PATTERN = /<!--.*?@guard:ai:(r|w|n)(\.(\d+))?.*?-->/i;
  const PYTHON_PATTERN = /#\s*@guard:ai:(r|w|n)(\.(\d+))?/i;
  const GENERAL_PATTERN = /(?:\/\/|#|--|\/\*|\*)*\s*@guard:ai:(r|w|n)(\.(\d+))?/i;
  
  // Use same approach as updateCodeDecorations
  const guardTags = [];
  
  // Find all guard tags
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    let match = null;
    if (isMarkdown) {
      match = line.match(MARKDOWN_PATTERN);
    } else if (isPython) {
      match = line.match(PYTHON_PATTERN);
    } else {
      match = line.match(GENERAL_PATTERN);
    }
    
    if (match) {
      const permission = match[1].toLowerCase();
      const count = match[3] ? parseInt(match[3], 10) : undefined;
      
      guardTags.push({
        lineNumber: i,
        permission,
        lineCount: count
      });
    }
  }
  
  // Process just like in updateCodeDecorations but for a single line
  // Create a permission map for every line
  const linePermissions = new Array(lines.length).fill({ permission: 'default' });

  // Sort guard tags by line number
  guardTags.sort((a, b) => a.lineNumber - b.lineNumber);

  // Process unbounded regions first
  const basePermissions = new Array(lines.length).fill(null);
  
  for (let i = 0; i < guardTags.length; i++) {
    const tag = guardTags[i];
    
    // Skip bounded regions for now
    if (tag.lineCount !== undefined) continue;
    
    // For unbounded regions, apply from this line to the next guard tag
    const startLine = tag.lineNumber;
    let endLine;
    
    // Find the next guard tag (bounded or unbounded)
    if (i < guardTags.length - 1) {
      endLine = guardTags[i + 1].lineNumber;
    } else {
      endLine = lines.length;
    }
    
    // Apply this permission to all lines in the range
    for (let j = startLine; j < endLine; j++) {
      basePermissions[j] = tag.permission;
      linePermissions[j] = { 
        permission: tag.permission
      };
    }
  }
  
  // Determine parent permissions for bounded regions
  const parentPermissions = new Map();

  for (let i = 0; i < guardTags.length; i++) {
    const tag = guardTags[i];
    if (tag.lineCount === undefined) continue; // Skip unbounded regions

    // Find the most recent unbounded region before this one
    let parentPermission = 'default';
    for (let j = 0; j < i; j++) {
      const prevTag = guardTags[j];
      if (prevTag.lineCount === undefined && prevTag.lineNumber < tag.lineNumber) {
        parentPermission = prevTag.permission;
      }
    }

    parentPermissions.set(tag.lineNumber, parentPermission);
  }

  // Process bounded regions (with line counts)
  for (const tag of guardTags) {
    if (tag.lineCount === undefined) continue; // Skip unbounded regions

    const startLine = tag.lineNumber;
    // Adding +1 so we count the line with the guard tag itself
    const endLine = Math.min(startLine + tag.lineCount + 1, lines.length);

    // Apply the bounded region's permission
    for (let i = startLine; i < endLine; i++) {
      linePermissions[i] = {
        permission: tag.permission,
        lineCount: tag.lineCount
      };
    }

    // After a bounded region ends, revert to the parent permission
    if (endLine < lines.length) {
      // Get the parent permission we determined earlier
      const parentPermission = parentPermissions.get(startLine);
      if (parentPermission) {
        linePermissions[endLine] = { 
          permission: parentPermission
        };
      }
    }
  }
  
  // Get the permission at cursor position
  if (cursorLine < linePermissions.length) {
    const linePermission = linePermissions[cursorLine];
    
    currentAccess = 
      linePermission.permission === 'r' ? "Read-Only" :
      linePermission.permission === 'w' ? "Write" :
      linePermission.permission === 'n' ? "No Access" : "Default";
    
    lineCount = linePermission.lineCount;
  }

  // Set status bar text with line count if present
  const lineCountText = lineCount ? ` (${lineCount} lines)` : '';
  statusBarItem.text = `$(shield) AI: ${currentAccess}${lineCountText}`;
  
  // Set color based on permission
  if (currentAccess === "Read-Only") {
    statusBarItem.color = new ThemeColor('editor.foreground');
  } else if (currentAccess === "Write") {
    statusBarItem.color = new ThemeColor('errorForeground');
  } else if (currentAccess === "No Access") {
    statusBarItem.color = new ThemeColor('editorInfo.foreground');
  }
}

export function deactivate() {
  disposables.forEach((disposable) => disposable.dispose());
  disposables = [];

  if (statusBarItem) {
    statusBarItem.dispose();
  }
}