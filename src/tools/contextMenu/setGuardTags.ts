import type { ExtensionContext } from "vscode";
import { window, commands, Selection, Position } from "vscode";
import * as vscode from "vscode";

/**
 * Implements commands for inserting guard tags at the cursor position or around selected code
 * @param context The extension context
 * @returns A promise that resolves to an array of disposables
 */
export const registerGuardTagCommands = async (
  context: ExtensionContext
): Promise<vscode.Disposable[]> => {
  const disposables: vscode.Disposable[] = [];

  const insertGuardTag = async (tag: string, lineCount?: number) => {
    const editor = window.activeTextEditor;
    if (!editor) {
      window.showErrorMessage("No active editor found");
      return;
    }

    const selection = editor.selection;
    const document = editor.document;
    const languageId = document.languageId;
    const isMarkdown = languageId === 'markdown';

    // Get the appropriate comment style for the current language
    const commentPrefix = getCommentPrefix(languageId);

    // Special handling for closing comments in markdown files
    const commentSuffix = isMarkdown ? " -->" : "";

    // If there's a selection, add guard tags before and after
    if (!selection.isEmpty) {
      // Create a tag at the start of the selection
      const startLine = selection.start.line;
      const startPos = new Position(startLine, 0);

      // Calculate line count from the selection
      const calculatedLineCount = selection.end.line - selection.start.line + 1;

      // Handle special cases for comment prefixes that shouldn't have spaces
      const spaceAfterComment = commentPrefix.endsWith(" ") ? "" : " ";

      // Create the guard tag with line count from the selection
      const guardTag = `@guard:ai:${tag}.${calculatedLineCount}`;

      await editor.edit(editBuilder => {
        // Insert the guard tag at the start of the selection with proper comment syntax
        editBuilder.insert(startPos, `${commentPrefix}${spaceAfterComment}${guardTag}${commentSuffix}\n`);
      });

      window.showInformationMessage(`Added ${guardTag} tag for ${calculatedLineCount} lines`);
    } else {
      // For cursor position, show an input box to get line count
      window.showInputBox({
        prompt: "Enter number of lines this guard should apply to (optional)",
        placeHolder: "Leave empty for no line count"
      }).then(async (value) => {
        // Handle special cases for comment prefixes that shouldn't have spaces
        const spaceAfterComment = commentPrefix.endsWith(" ") ? "" : " ";

        let countSuffix = '';
        if (value && !isNaN(parseInt(value, 10))) {
          countSuffix = `.${value}`;
        }

        const guardTag = `@guard:ai:${tag}${countSuffix}`;

        await editor.edit(editBuilder => {
          // Insert the guard tag with proper comment syntax for the language
          editBuilder.insert(selection.active, `${commentPrefix}${spaceAfterComment}${guardTag}${commentSuffix}`);
        });

        const countText = countSuffix ? ` for ${value} lines` : '';
        window.showInformationMessage(`Inserted ${guardTag} tag${countText}`);
      });
    }
  };

  // Register the commands
  disposables.push(
    commands.registerCommand("tumee-vscode-plugin.setAIReadOnly", async () => {
      await insertGuardTag("r");
    })
  );

  disposables.push(
    commands.registerCommand("tumee-vscode-plugin.setAIWrite", async () => {
      await insertGuardTag("w");
    })
  );

  disposables.push(
    commands.registerCommand("tumee-vscode-plugin.setAINoAccess", async () => {
      await insertGuardTag("n");
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
    typescript: "//",
    javascript: "//",
    typescriptreact: "//",
    javascriptreact: "//",
    json: "//",
    jsonc: "//",
    css: "/*",
    scss: "//",
    less: "//",
    html: "<!--",
    xml: "<!--",
    php: "//",
    python: "#",
    ruby: "#",
    shellscript: "#",
    bash: "#",
    sh: "#",
    zsh: "#",
    powershell: "#",
    perl: "#",
    r: "#",
    yaml: "#",
    toml: "#",
    ini: ";",
    properties: "#",
    makefile: "#",
    dockerfile: "#",
    markdown: "<!-- ",  // Note the added space for markdown
    c: "//",
    cpp: "//",
    csharp: "//",
    java: "//",
    go: "//",
    rust: "//",
    swift: "//",
    kotlin: "//",
    sql: "--",
    haskell: "--",
    lua: "--",
    elm: "--",
    plaintext: "//",
  };

  // Special case for markdown - ensures full HTML comment syntax
  if (languageId === 'markdown') {
    return "<!-- ";
  }

  // Get the comment prefix for the language, or default to "//"
  return commentPrefixes[languageId] || "//";
}