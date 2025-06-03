/**
 * Pure CLI-based guard processor - NO LOCAL PARSING ALLOWED
 * This module ONLY uses the CLI worker for all guard tag parsing
 */

import type * as vscode from 'vscode';
import type { GuardTag, LinePermission } from '../../types/guardTypes';
import {
  parseGuardTags as parseGuardTagsCli,
  getLinePermissions as getLinePermissionsCli,
  markLinesModified as markLinesModifiedCli,
  handleDocumentChange,
  initializeCliProcessor,
  shutdownCliProcessor,
  getCliWorker,
} from '../cli/guardProcessorCli';
import { validateDocument } from '../error/errorHandler';

// Re-export CLI processor functions - these are the ONLY parsing functions allowed
export {
  initializeCliProcessor,
  shutdownCliProcessor,
  getCliWorker,
  handleDocumentChange
};

/**
 * Parse guard tags from document - PURE CLI IMPLEMENTATION ONLY
 * This function is FORBIDDEN to do any local parsing
 */
export async function parseGuardTags(
  document: vscode.TextDocument,
  lines: string[]
): Promise<GuardTag[]> {
  // Validate input
  if (!validateDocument(document)) {
    return [];
  }

  // CLI ONLY - NO LOCAL PARSING ALLOWED
  return parseGuardTagsCli(document, lines);
}

/**
 * Get line permissions - PURE CLI IMPLEMENTATION ONLY
 * This function is FORBIDDEN to do any local parsing
 */
export function getLinePermissions(
  document: vscode.TextDocument,
  guardTags: GuardTag[]
): Map<number, LinePermission> {
  // CLI ONLY - NO LOCAL PARSING ALLOWED
  return getLinePermissionsCli(document, guardTags);
}

/**
 * Mark lines as modified - CLI implementation only
 */
export function markLinesModified(document: vscode.TextDocument, startLine: number, endLine: number): void {
  markLinesModifiedCli(document, startLine, endLine);
}

/**
 * Get default permissions - this is the ONLY function that doesn't require CLI
 * because it's just static default values
 */
export function getDefaultPermissions() {
  return {
    ai: 'r',
    human: 'w'
  };
}