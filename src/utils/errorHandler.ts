import { window } from 'vscode';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
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
        void window.showInformationMessage(errorMessage);
        break;
      case ErrorSeverity.WARNING:
        void window.showWarningMessage(errorMessage);
        break;
      case ErrorSeverity.ERROR:
        void window.showErrorMessage(errorMessage);
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