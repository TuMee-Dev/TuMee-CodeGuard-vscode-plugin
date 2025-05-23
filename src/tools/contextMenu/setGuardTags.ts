import type { ExtensionContext, Disposable } from 'vscode';
import { window, commands, Position } from 'vscode';

/**
 * Implements commands for inserting guard tags at the cursor position or around selected code
 * @param context The extension context
 * @returns A promise that resolves to an array of disposables
 */
export const registerGuardTagCommands = (
  _context: ExtensionContext
): Disposable[] => {
  const disposables: Disposable[] = [];

  const insertGuardTag = async (target: string, permission: string, _lineCount?: number) => {
    const editor = window.activeTextEditor;
    if (!editor) {
      void window.showErrorMessage('No active editor found');
      return;
    }

    const selection = editor.selection;
    const document = editor.document;
    const languageId = document.languageId;
    const isMarkdown = languageId === 'markdown';

    // Get the appropriate comment style for the current language
    const commentPrefix = getCommentPrefix(languageId);

    // Special handling for closing comments in markdown files
    const commentSuffix = isMarkdown ? ' -->' : '';

    // If there's a selection, add guard tags before and after
    if (!selection.isEmpty) {
      // Create a tag at the start of the selection
      const startLine = selection.start.line;
      const startPos = new Position(startLine, 0);

      // Calculate line count from the selection
      const calculatedLineCount = selection.end.line - selection.start.line + 1;

      // Handle special cases for comment prefixes that shouldn't have spaces
      const spaceAfterComment = commentPrefix.endsWith(' ') ? '' : ' ';

      // Create the guard tag with line count from the selection
      const guardTag = `@guard:${target}:${permission}.${calculatedLineCount}`;

      await editor.edit(editBuilder => {
        // Insert the guard tag at the start of the selection with proper comment syntax
        editBuilder.insert(startPos, `${commentPrefix}${spaceAfterComment}${guardTag}${commentSuffix}\n`);
      });

      void window.showInformationMessage(`Added ${guardTag} tag for ${calculatedLineCount} lines`);
    } else {
      // For cursor position, show an input box to get line count
      void window.showInputBox({
        prompt: 'Enter number of lines this guard should apply to (optional)',
        placeHolder: 'Leave empty for no line count'
      }).then(async (value) => {
        // Handle special cases for comment prefixes that shouldn't have spaces
        const spaceAfterComment = commentPrefix.endsWith(' ') ? '' : ' ';

        let countSuffix = '';
        if (value && !isNaN(parseInt(value, 10))) {
          countSuffix = `.${value}`;
        }

        const guardTag = `@guard:${target}:${permission}${countSuffix}`;

        await editor.edit(editBuilder => {
          // Insert the guard tag with proper comment syntax for the language
          editBuilder.insert(selection.active, `${commentPrefix}${spaceAfterComment}${guardTag}${commentSuffix}`);
        });

        const countText = countSuffix ? ` for ${value} lines` : '';
        void window.showInformationMessage(`Inserted ${guardTag} tag${countText}`);
      });
    }
  };

  // Register the commands
  // AI commands
  disposables.push(
    commands.registerCommand('tumee-vscode-plugin.setAIReadOnly', async () => {
      await insertGuardTag('ai', 'r');
    })
  );

  disposables.push(
    commands.registerCommand('tumee-vscode-plugin.setAIWrite', async () => {
      await insertGuardTag('ai', 'w');
    })
  );

  disposables.push(
    commands.registerCommand('tumee-vscode-plugin.setAINoAccess', async () => {
      await insertGuardTag('ai', 'n');
    })
  );

  disposables.push(
    commands.registerCommand('tumee-vscode-plugin.setAIContext', async () => {
      await insertGuardTag('ai', 'context');
    })
  );

  // Human commands
  disposables.push(
    commands.registerCommand('tumee-vscode-plugin.setHumanReadOnly', async () => {
      await insertGuardTag('human', 'r');
    })
  );

  disposables.push(
    commands.registerCommand('tumee-vscode-plugin.setHumanNoAccess', async () => {
      await insertGuardTag('human', 'n');
    })
  );

  // Advanced command with custom options
  disposables.push(
    commands.registerCommand('tumee-vscode-plugin.setCustomGuard', async () => {
      const targetOptions = [
        { label: 'AI', value: 'ai' },
        { label: 'Human', value: 'human' }
      ];

      const target = await window.showQuickPick(targetOptions, {
        placeHolder: 'Select target'
      });

      if (!target) return;

      const permissionOptions = [
        { label: 'Read Only', value: 'r' },
        { label: 'Write Access', value: 'w' },
        { label: 'No Access', value: 'n' },
        { label: 'Context', value: 'context' }
      ];

      const permission = await window.showQuickPick(permissionOptions, {
        placeHolder: 'Select permission'
      });

      if (!permission) return;

      await insertGuardTag(target.value, permission.value);
    })
  );

  return disposables;
};

/**
 * Gets the appropriate comment prefix for the given language
 * @param languageId The language ID
 * @returns The comment prefix
 */
function getCommentPrefix(languageId: string): string {
  // Map of language IDs to comment prefixes
  const commentPrefixes: Record<string, string> = {
    typescript: '//',
    javascript: '//',
    typescriptreact: '//',
    javascriptreact: '//',
    json: '//',
    jsonc: '//',
    css: '/*',
    scss: '//',
    less: '//',
    html: '<!--',
    xml: '<!--',
    php: '//',
    python: '#',
    ruby: '#',
    shellscript: '#',
    bash: '#',
    sh: '#',
    zsh: '#',
    powershell: '#',
    perl: '#',
    r: '#',
    yaml: '#',
    toml: '#',
    ini: ';',
    properties: '#',
    makefile: '#',
    dockerfile: '#',
    markdown: '<!-- ',  // Note the added space for markdown
    c: '//',
    cpp: '//',
    csharp: '//',
    java: '//',
    go: '//',
    rust: '//',
    swift: '//',
    kotlin: '//',
    sql: '--',
    haskell: '--',
    lua: '--',
    elm: '--',
    plaintext: '//',
  };

  // Special case for markdown - ensures full HTML comment syntax
  if (languageId === 'markdown') {
    return '<!-- ';
  }

  // Get the comment prefix for the language, or default to "//"
  return commentPrefixes[languageId] || '//';
}