import * as vscode from 'vscode';
import { logError } from './errorHandler';

/**
 * Wraps an async operation with standardized error handling
 * @param operation The async operation to execute
 * @param context Context string for error logging
 * @param defaultValue Optional default value to return on error
 * @returns The operation result or default value if error occurs
 */
export async function withErrorWrapper<T>(
  operation: () => Promise<T>,
  context: string,
  defaultValue?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    logError(error, context);
    return defaultValue;
  }
}

/**
 * Wraps a sync operation with standardized error handling
 * @param operation The sync operation to execute
 * @param context Context string for error logging
 * @param defaultValue Optional default value to return on error
 * @returns The operation result or default value if error occurs
 */
export function withErrorHandlingSync<T>(
  operation: () => T,
  context: string,
  defaultValue?: T
): T | undefined {
  try {
    return operation();
  } catch (error) {
    logError(error, context);
    return defaultValue;
  }
}

/**
 * Wraps an async operation that should show user notification on error
 * @param operation The async operation to execute
 * @param context Context string for error logging
 * @param userMessage Optional custom message to show user
 * @returns The operation result or undefined if error occurs
 */
export async function withErrorNotification<T>(
  operation: () => Promise<T>,
  context: string,
  userMessage?: string
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    const message = userMessage || `Operation failed: ${context}`;
    void vscode.window.showErrorMessage(message);
    logError(error, context, { showUser: false });
    return undefined;
  }
}

/**
 * Wraps an operation that should rethrow with context
 * @param operation The operation to execute
 * @param context Context string for the new error
 * @param errorMessage Custom error message
 */
export async function withErrorRethrow<T>(
  operation: () => Promise<T>,
  context: string,
  errorMessage: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`${context}:`, error);
    throw new Error(errorMessage);
  }
}