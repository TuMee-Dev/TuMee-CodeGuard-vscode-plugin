/**
 * Core error handling - platform agnostic
 * No dependencies allowed in this module
 */

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
 * Simple logger interface for platform-agnostic logging
 */
export interface ILogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Default console logger implementation
 */
export const consoleLogger: ILogger = {
  log: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message),
  error: (message: string) => console.error(message)
};

/**
 * Handle guard processing errors in a platform-agnostic way
 */
export function handleGuardError(
  error: GuardProcessingError,
  context: ErrorContext,
  logger: ILogger = consoleLogger
): void {
  const message = `[${error.severity.toUpperCase()}] ${context.operation}: ${error.message}`;
  
  switch (error.severity) {
    case ErrorSeverity.INFO:
      logger.log(message);
      break;
    case ErrorSeverity.WARNING:
      logger.warn(message);
      break;
    case ErrorSeverity.ERROR:
      logger.error(message);
      break;
  }
  
  if (error.details) {
    logger.log(`Details: ${JSON.stringify(error.details, null, 2)}`);
  }
}