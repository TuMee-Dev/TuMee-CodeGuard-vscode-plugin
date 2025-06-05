import * as vscode from 'vscode';
import type { ServerManager } from './serverManager';

export class GitignoreCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private serverManager: ServerManager) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    const linePrefix = document.lineAt(position).text.substr(0, position.character);

    // Get suggestions from both common patterns and workspace analysis
    const suggestions = await this.serverManager.getSuggestions(linePrefix, document);

    return suggestions.map(suggestion => {
      const item = new vscode.CompletionItem(suggestion.label, vscode.CompletionItemKind.Value);
      item.detail = suggestion.detail;
      item.documentation = new vscode.MarkdownString(suggestion.documentation);
      item.insertText = suggestion.insertText;

      // Set appropriate completion item kind based on suggestion type
      if ('type' in suggestion) {
        const workspaceSuggestion = suggestion as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        switch (workspaceSuggestion.type) {
          case 'file':
            item.kind = vscode.CompletionItemKind.File;
            break;
          case 'folder':
            item.kind = vscode.CompletionItemKind.Folder;
            break;
          case 'pattern':
            item.kind = vscode.CompletionItemKind.Text;
            break;
          default:
            item.kind = vscode.CompletionItemKind.Value;
        }
      }

      return item;
    });
  }
}