import * as vscode from 'vscode';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
}

/**
 * Error context for better debugging
 */
export interface ErrorContext {
  operation: string;
  details?: unknown;
  userFriendlyMessage?: string;
}

/**
 * Custom error class for guard processing errors
 */
export class GuardProcessingError extends Error {
  constructor(
    message: string,
    public readonly severity: ErrorSeverity = ErrorSeverity.ERROR,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'GuardProcessingError';
  }
}

/**
 * Error logging configuration
 */
interface ErrorLogConfig {
  showUser: boolean;
  logToConsole: boolean;
  includeStack: boolean;
}

const defaultConfig: ErrorLogConfig = {
  showUser: false,
  logToConsole: true,
  includeStack: false
};

/**
 * Log an error with appropriate handling
 */
export function logError(
  error: unknown,
  context: string,
  config: Partial<ErrorLogConfig> = {}
): void {
  const cfg = { ...defaultConfig, ...config };

  const errorMessage = error instanceof Error ? error.message : String(error);
  const fullMessage = `[${context}] ${errorMessage}`;

  // Log to console if enabled
  if (cfg.logToConsole) {
    if (error instanceof Error && cfg.includeStack && error.stack) {
      console.error(fullMessage, '\n', error.stack);
    } else {
      console.error(fullMessage);
    }
  }

  // Show to user if enabled
  if (cfg.showUser) {
    const severity = error instanceof GuardProcessingError ? error.severity : ErrorSeverity.ERROR;

    switch (severity) {
      case ErrorSeverity.INFO:
        void vscode.window.showInformationMessage(errorMessage);
        break;
      case ErrorSeverity.WARNING:
        void vscode.window.showWarningMessage(errorMessage);
        break;
      case ErrorSeverity.ERROR:
        void vscode.window.showErrorMessage(errorMessage, 'Show Logs').then(action => {
          if (action === 'Show Logs') {
            getOutputChannel().show();
          }
        });
        break;
    }
  }
}

/**
 * Wrap a function with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => unknown>(
  fn: T,
  context: string,
  config: Partial<ErrorLogConfig> = {}
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args) as ReturnType<T>;

      // Handle async functions
      if (result instanceof Promise) {
        return result.catch((error: unknown) => {
          logError(error, context, config);
          return undefined;
        }) as ReturnType<T>;
      }

      return result;
    } catch (error) {
      logError(error, context, config);
      return undefined as ReturnType<T>;
    }
  }) as T;
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T = unknown>(
  text: string,
  defaultValue: T
): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    logError(error, 'JSON Parse', { showUser: false });
    return defaultValue;
  }
}

/**
 * Safe regex execution with timeout
 */
export function safeRegexExec(
  regex: RegExp,
  text: string,
  timeoutMs: number = 1000
): RegExpExecArray | null {
  const startTime = Date.now();

  try {
    // Reset regex state
    regex.lastIndex = 0;

    const result = regex.exec(text);

    // Check if execution took too long
    const elapsed = Date.now() - startTime;
    if (elapsed > timeoutMs) {
      console.warn(`Regex execution took ${elapsed}ms (timeout: ${timeoutMs}ms)`);
    }

    return result;
  } catch (error) {
    logError(error, 'Regex Execution');
    return null;
  }
}

/**
 * Validate document before processing
 */
export function validateDocument(document: unknown): document is { getText: () => string; languageId: string } {
  if (!document || typeof document !== 'object') {
    return false;
  }

  const doc = document as { getText?: unknown; languageId?: unknown };
  return typeof doc.getText === 'function' && typeof doc.languageId === 'string';
}

// Create a singleton output channel for logging
let outputChannel: vscode.OutputChannel | null = null;

/**
 * Get or create the output channel
 */
export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('CodeGuard');
  }
  return outputChannel;
}

/**
 * Enhanced error handler with better user feedback
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: Array<{ timestamp: Date; error: Error; context?: ErrorContext }> = [];

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handles errors with appropriate logging and user notification
   */
  handleError(error: Error, context?: ErrorContext): void {
    // Log to internal error log
    this.errorLog.push({ timestamp: new Date(), error, context });

    // Log to output channel
    this.logToOutput(error, context);

    // Show user notification based on severity
    if (context?.userFriendlyMessage) {
      void vscode.window.showErrorMessage(context.userFriendlyMessage, 'Show Logs').then(action => {
        if (action === 'Show Logs') {
          getOutputChannel().show();
        }
      });
    }
  }

  /**
   * Shows informational messages to the user
   */
  showInfo(message: string): void {
    void vscode.window.showInformationMessage(message);
  }

  /**
   * Shows warning messages to the user
   */
  showWarning(message: string): void {
    void vscode.window.showWarningMessage(message);
  }

  private logToOutput(error: Error, context?: ErrorContext): void {
    const channel = getOutputChannel();
    const timestamp = new Date().toISOString();
    channel.appendLine(`[${timestamp}] ${context?.operation || 'Unknown Operation'}`);
    channel.appendLine(`Error: ${error.message}`);
    if (error.stack) {
      channel.appendLine(`Stack: ${error.stack}`);
    }
    if (context?.details) {
      channel.appendLine(`Details: ${JSON.stringify(context.details, null, 2)}`);
    }
    channel.appendLine('---');
  }
}

export const errorHandler = ErrorHandler.getInstance();