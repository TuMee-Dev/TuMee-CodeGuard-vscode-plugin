/**
 * VSCode adapter for the core guard processing logic
 * This module wraps the pure guard processing core with VSCode-specific interfaces
 */

import type * as vscode from 'vscode';
import type { GuardTag, LinePermission } from '../types/guardTypes';
import type {
  IDocument,
  ITextLine,
  IConfiguration,
  SemanticResolver
} from './guardProcessorCore';
import {
  parseGuardTagsCore,
  getLinePermissionsCore,
  clearScopeCache as clearScopeCacheCore,
  markLinesModified as markLinesModifiedCore,
  getDefaultPermissions
} from './guardProcessorCore';
import { isLineAComment, parseGuardTag } from '../core';
import { resolveSemantic } from './scopeResolver';
import { logError, validateDocument } from './errorHandler';
import { DebugLogger } from './debugLogger';
import { configManager } from './configurationManager';

/**
 * Adapter to convert vscode.TextDocument to IDocument
 */
class DocumentAdapter implements IDocument {
  constructor(private readonly doc: vscode.TextDocument) {}

  getText(): string {
    return this.doc.getText();
  }

  get lineCount(): number {
    return this.doc.lineCount;
  }

  get languageId(): string {
    return this.doc.languageId;
  }

  lineAt(line: number): ITextLine {
    const textLine = this.doc.lineAt(line);
    return {
      text: textLine.text,
      firstNonWhitespaceCharacterIndex: textLine.firstNonWhitespaceCharacterIndex
    };
  }
}

/**
 * Adapter to convert vscode.WorkspaceConfiguration to IConfiguration
 */
class ConfigurationAdapter implements IConfiguration {
  constructor(private readonly config: vscode.WorkspaceConfiguration) {}

  get<T>(key: string, defaultValue: T): T {
    return this.config.get<T>(key, defaultValue);
  }
}

/**
 * Semantic resolver adapter that uses VSCode's document
 */
const semanticResolverAdapter: SemanticResolver = async (
  document: IDocument,
  line: number,
  scope: string,
  addScopes?: string[],
  removeScopes?: string[]
) => {
  // We need to convert back to a VSCode document for the resolver
  // This is a bit hacky but necessary since resolveSemantic expects a VSCode document
  // In the future, resolveSemantic should also be refactored to use IDocument
  const vscodeDoc = ('doc' in document && document.doc ? document.doc : document) as vscode.TextDocument;
  return resolveSemantic(vscodeDoc, line, scope, addScopes, removeScopes);
};

/**
 * Logger adapter for DebugLogger
 */
const loggerAdapter = {
  log: (message: string) => DebugLogger.log(message)
};

/**
 * Clear the scope cache for a document
 */
export function clearScopeCache(document: vscode.TextDocument): void {
  const adapter = new DocumentAdapter(document);
  clearScopeCacheCore(adapter);
}

/**
 * Mark lines as modified for partial cache invalidation
 */
export function markLinesModified(document: vscode.TextDocument, startLine: number, endLine: number): void {
  const adapter = new DocumentAdapter(document);
  markLinesModifiedCore(adapter, startLine, endLine);
}

/**
 * Parse guard tags from document lines
 * @param document The document to parse
 * @param lines All lines in the document
 */
export async function parseGuardTags(
  document: vscode.TextDocument,
  lines: string[]
): Promise<GuardTag[]> {
  // Validate input
  if (!validateDocument(document)) {
    return [];
  }

  const docAdapter = new DocumentAdapter(document);
  const cm = configManager();
  const configAdapter = new ConfigurationAdapter(cm.getRawConfiguration());

  try {
    return await parseGuardTagsCore(
      docAdapter,
      lines,
      configAdapter,
      semanticResolverAdapter,
      loggerAdapter
    );
  } catch (error) {
    logError(
      error instanceof Error ? error : new Error(String(error)),
      'parseGuardTags'
    );
    throw error;
  }
}

/**
 * Export alias for backward compatibility
 */
export const parseGuardTagsChunked = parseGuardTags;

/**
 * Get line permissions for a document (used for decorations)
 * @param document The document to analyze
 * @param guardTags The parsed guard tags
 * @returns Map of line numbers to their effective guard permission
 */
export function getLinePermissions(
  document: vscode.TextDocument,
  guardTags: GuardTag[]
): Map<number, LinePermission> {
  const docAdapter = new DocumentAdapter(document);
  const cm = configManager();
  const configAdapter = new ConfigurationAdapter(cm.getRawConfiguration());

  return getLinePermissionsCore(
    docAdapter,
    guardTags,
    configAdapter,
    loggerAdapter
  );
}

/**
 * Export utility functions from core
 */
export { parseGuardTag, isLineAComment, getDefaultPermissions };