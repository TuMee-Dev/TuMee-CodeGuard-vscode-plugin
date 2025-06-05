import { getCliWorker } from '@/utils/cli/guardProcessorCli';
import { errorHandler } from '@/utils/error/errorHandler';
import type { CLIWorker } from '@/utils/cli/cliWorker';
import * as vscode from 'vscode';

interface Suggestion {
  label: string;
  detail: string;
  documentation: string;
  insertText: string;
}

interface WorkspaceSuggestion extends Suggestion {
  type: 'file' | 'folder' | 'pattern';
  fullPath: string;
}

interface GitignoreSuggestionsResponse {
  suggestions: Suggestion[];
}

interface WorkspaceGitignoreSuggestionsResponse {
  suggestions: WorkspaceSuggestion[];
}

export class ServerManager {
  constructor() {
    // No initialization needed - uses existing CLI worker
  }

  startServer() {
    // No-op: CLI worker handles all server communication
  }

  stopServer() {
    // No-op: CLI worker handles all server communication
  }

  async getSuggestions(prefix: string, document?: vscode.TextDocument): Promise<Suggestion[]> {
    const cliWorker = getCliWorker();

    if (!cliWorker?.isWorkerReady()) {
      return [];
    }

    // Get workspace path for workspace-specific suggestions
    const workspacePath = this.getWorkspacePath(document);

    try {
      // Call both APIs in parallel for comprehensive suggestions
      const [commonSuggestions, workspaceSuggestions] = await Promise.allSettled([
        this.getCommonSuggestions(cliWorker, prefix),
        this.getWorkspaceSuggestions(cliWorker, prefix, workspacePath)
      ]);

      // Merge results, prioritizing workspace suggestions for path completions
      const results: Suggestion[] = [];

      // Add workspace suggestions first (higher priority for file/folder completions)
      if (workspaceSuggestions.status === 'fulfilled') {
        results.push(...workspaceSuggestions.value);
      }

      // Add common pattern suggestions
      if (commonSuggestions.status === 'fulfilled') {
        // Avoid duplicates by checking labels
        const existingLabels = new Set(results.map(s => s.label));
        const uniqueCommonSuggestions = commonSuggestions.value.filter(
          s => !existingLabels.has(s.label)
        );
        results.push(...uniqueCommonSuggestions);
      }

      return results;

    } catch (error) {
      errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'GitignoreServer.getSuggestions',
          details: { prefix, workspacePath }
        }
      );
      return [];
    }
  }

  private async getCommonSuggestions(cliWorker: CLIWorker, prefix: string): Promise<Suggestion[]> {
    const response = await cliWorker.sendRequest('getGitignoreSuggestions', {
      prefix: prefix,
      context: 'file'
    });

    if (response.status === 'success' && response.result) {
      const result = response.result as GitignoreSuggestionsResponse;
      return result.suggestions || [];
    }

    return [];
  }

  private async getWorkspaceSuggestions(
    cliWorker: CLIWorker,
    prefix: string,
    workspacePath: string | null
  ): Promise<WorkspaceSuggestion[]> {
    if (!workspacePath) {
      return [];
    }

    const response = await cliWorker.sendRequest('getWorkspaceGitignoreSuggestions', {
      prefix: prefix,
      workspacePath: workspacePath,
      context: 'file',
      maxSuggestions: 20
    });

    if (response.status === 'success' && response.result) {
      const result = response.result as WorkspaceGitignoreSuggestionsResponse;
      return result.suggestions || [];
    }

    return [];
  }

  private getWorkspacePath(document?: vscode.TextDocument): string | null {
    if (document) {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (workspaceFolder) {
        return workspaceFolder.uri.fsPath;
      }
    }

    // Fallback to first workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath;
    }

    return null;
  }

}