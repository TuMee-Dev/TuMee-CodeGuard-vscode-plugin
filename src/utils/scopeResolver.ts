import type * as vscode from 'vscode';
import { resolveSemanticScope as coreResolveSemanticScope, type ScopeBoundary } from '../core';
import { VSCodeDocumentAdapter, VSCodeExtensionContextAdapter } from '../vscode/documentAdapter';

// Re-export ScopeBoundary type from core
export type { ScopeBoundary } from '../core';

// Store the extension context for tree-sitter initialization
let extensionContext: vscode.ExtensionContext | null = null;

/**
 * Initialize the scope resolver with the extension context
 */
export function initializeScopeResolver(context: vscode.ExtensionContext): void {
  extensionContext = context;
  // Don't initialize tree-sitter yet - it will be initialized on first use
}

/**
 * Resolves semantic scope using ONLY the core module - no fallbacks
 */
export async function resolveSemantic(
  document: vscode.TextDocument,
  line: number,
  scope: string,
  _addScopes?: string[],
  _removeScopes?: string[]
): Promise<ScopeBoundary | null> {
  if (!extensionContext) {
    throw new Error(`[Core] Extension context not initialized for ${document.languageId}`);
  }

  // Use ONLY the core module - no fallbacks
  const docAdapter = new VSCodeDocumentAdapter(document);
  const contextAdapter = new VSCodeExtensionContextAdapter(extensionContext);
  
  return await coreResolveSemanticScope(docAdapter, line, scope, contextAdapter, _addScopes, _removeScopes);
}
