import { getCliWorker } from '@/utils/cli/guardProcessorCli';
import { errorHandler } from '@/utils/error/errorHandler';

interface Suggestion {
  label: string;
  detail: string;
  documentation: string;
  insertText: string;
}

interface GitignoreSuggestionsResponse {
  suggestions: Suggestion[];
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

  async getSuggestions(prefix: string): Promise<Suggestion[]> {
    const cliWorker = getCliWorker();

    // If CLI worker is available, try to get suggestions from it
    if (cliWorker?.isWorkerReady()) {
      try {
        const response = await cliWorker.sendRequest('getGitignoreSuggestions', {
          prefix: prefix,
          context: 'file' // Could be 'file', 'folder', etc.
        });

        if (response.status === 'success' && response.result) {
          const result = response.result as GitignoreSuggestionsResponse;
          return result.suggestions || [];
        }
      } catch (error) {
        // Log but don't show error to user - fall back to built-in suggestions
        errorHandler.handleError(
          error instanceof Error ? error : new Error(String(error)),
          {
            operation: 'GitignoreServer.getSuggestions',
            details: { prefix }
          }
        );
      }
    }

    // Fallback to built-in suggestions
    return this.getBuiltInSuggestions(prefix);
  }

  private getBuiltInSuggestions(prefix: string): Suggestion[] {
    const allSuggestions = [
      {
        label: 'node_modules/',
        detail: 'Node.js dependencies',
        documentation: 'Ignores all Node.js package dependencies',
        insertText: 'node_modules/'
      },
      {
        label: '*.log',
        detail: 'Log files',
        documentation: 'Ignores all files with .log extension',
        insertText: '*.log'
      },
      {
        label: '.env',
        detail: 'Environment variables',
        documentation: 'Ignores environment configuration file',
        insertText: '.env'
      },
      {
        label: 'dist/',
        detail: 'Distribution folder',
        documentation: 'Ignores compiled/built distribution files',
        insertText: 'dist/'
      },
      {
        label: 'build/',
        detail: 'Build folder',
        documentation: 'Ignores build output directory',
        insertText: 'build/'
      },
      {
        label: 'coverage/',
        detail: 'Test coverage',
        documentation: 'Ignores test coverage reports',
        insertText: 'coverage/'
      },
      {
        label: '.DS_Store',
        detail: 'macOS system file',
        documentation: 'Ignores macOS Finder metadata files',
        insertText: '.DS_Store'
      },
      {
        label: 'Thumbs.db',
        detail: 'Windows system file',
        documentation: 'Ignores Windows thumbnail cache files',
        insertText: 'Thumbs.db'
      },
      {
        label: '*.tmp',
        detail: 'Temporary files',
        documentation: 'Ignores all temporary files',
        insertText: '*.tmp'
      },
      {
        label: '*.swp',
        detail: 'Vim swap files',
        documentation: 'Ignores Vim editor swap files',
        insertText: '*.swp'
      },
      {
        label: '.vscode/',
        detail: 'VS Code settings',
        documentation: 'Ignores VS Code workspace settings',
        insertText: '.vscode/'
      },
      {
        label: '.idea/',
        detail: 'IntelliJ IDEA settings',
        documentation: 'Ignores IntelliJ IDEA project files',
        insertText: '.idea/'
      }
    ];

    // Filter suggestions based on prefix
    return allSuggestions.filter(suggestion =>
      suggestion.label.toLowerCase().includes(prefix.toLowerCase()) ||
            suggestion.detail.toLowerCase().includes(prefix.toLowerCase())
    );
  }
}