import type { CancellationToken, Progress } from 'vscode';
import { ProgressLocation, window } from 'vscode';

export interface BackgroundTask<T> {
  id: string;
  execute: (progress?: Progress<{ message?: string; increment?: number }>, token?: CancellationToken) => Promise<T>;
  priority?: number;
  showProgress?: boolean;
}

interface QueuedTask<T> extends BackgroundTask<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

/**
 * Background processor for heavy operations
 * Runs tasks with proper yielding and progress reporting
 */
class BackgroundProcessor {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private taskQueue: Array<QueuedTask<any>> = [];
  private isProcessing = false;
  private activeTask: string | null = null;

  /**
   * Queue a task for background processing
   */
  async queueTask<T>(task: BackgroundTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedTask: QueuedTask<T> = {
        ...task,
        resolve,
        reject
      };

      // Insert based on priority (higher priority first)
      const priority = task.priority || 0;
      const insertIndex = this.taskQueue.findIndex(t => (t.priority || 0) < priority);

      if (insertIndex === -1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.taskQueue.push(queuedTask as QueuedTask<any>);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.taskQueue.splice(insertIndex, 0, queuedTask as QueuedTask<any>);
      }

      // Start processing if not already running
      if (!this.isProcessing) {
        void this.processQueue();
      }
    });
  }

  /**
   * Process queued tasks
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (!task) break;

      this.activeTask = task.id;

      try {
        let result: unknown;

        if (task.showProgress) {
          // Show progress notification
          result = await window.withProgress({
            location: ProgressLocation.Notification,
            title: `Processing: ${task.id}`,
            cancellable: true
          }, async (progress, token) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return await task.execute(progress, token);
          });
        } else {
          // Execute without progress UI
          result = await task.execute();
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (task as any).resolve(result);
      } catch (error) {
        task.reject(error instanceof Error ? error : new Error(String(error)));
      }

      // Yield to event loop between tasks
      await new Promise(resolve => setImmediate(resolve));
    }

    this.activeTask = null;
    this.isProcessing = false;
  }

  /**
   * Get current queue status
   */
  getStatus(): { queueLength: number; activeTask: string | null; isProcessing: boolean } {
    return {
      queueLength: this.taskQueue.length,
      activeTask: this.activeTask,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Clear all pending tasks
   */
  clearQueue(): void {
    this.taskQueue.forEach(task => {
      task.reject(new Error('Task cancelled - queue cleared'));
    });
    this.taskQueue = [];
  }
}

// Singleton instance
export const backgroundProcessor = new BackgroundProcessor();
