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

    // If CLI worker is available, get suggestions from RPC
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
        // Log error and return empty array - no fallback suggestions in IDE
        errorHandler.handleError(
          error instanceof Error ? error : new Error(String(error)),
          {
            operation: 'GitignoreServer.getSuggestions',
            details: { prefix }
          }
        );
      }
    }

    // No CLI available - return empty suggestions
    return [];
  }

}