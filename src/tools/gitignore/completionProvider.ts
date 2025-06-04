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

    // Get suggestions from the server
    const suggestions = await this.serverManager.getSuggestions(linePrefix);

    return suggestions.map(suggestion => {
      const item = new vscode.CompletionItem(suggestion.label, vscode.CompletionItemKind.Value);
      item.detail = suggestion.detail;
      item.documentation = new vscode.MarkdownString(suggestion.documentation);
      item.insertText = suggestion.insertText;
      return item;
    });
  }
}