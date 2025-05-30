import type * as vscode from 'vscode';
import { initializeTreeSitter } from './treeSitterParser';
import { getLanguageScopeMappings } from './languageScopeLoader';
import { resolveSemanticWithTreeSitter, type ScopeBoundary } from './treeSitterScopeResolver';
import { resolveSemanticWithRegex } from './regexScopeResolver';

// Re-export ScopeBoundary type
export type { ScopeBoundary } from './treeSitterScopeResolver';

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
 * Resolves semantic scope to line numbers using tree-sitter with regex fallback
 */
export async function resolveSemantic(
  document: vscode.TextDocument,
  line: number,
  scope: string,
  _addScopes?: string[],
  _removeScopes?: string[]
): Promise<ScopeBoundary | null> {
  const languageId = document.languageId;
  const languageScopes = getLanguageScopeMappings(languageId);
  const hasTreeSitterSupport = languageScopes !== undefined;

  // If we have tree-sitter support for this language, it MUST work
  if (hasTreeSitterSupport) {
    if (!extensionContext) {
      throw new Error(`[TreeSitter] Extension context not initialized for ${languageId}`);
    }

    try {
      // Initialize tree-sitter on first use
      await initializeTreeSitter(extensionContext);

      const treeSitterResult = await resolveSemanticWithTreeSitter(document, line, scope, extensionContext);
      if (!treeSitterResult) {
        // This is a bug - tree-sitter should always find scopes for supported languages
        throw new Error(`[TreeSitter] Failed to resolve scope '${scope}' at line ${line + 1} in ${languageId} file. This is a bug.`);
      }
      return treeSitterResult;
    } catch (error) {
      // Re-throw with more context
      throw new Error(`[TreeSitter] Critical failure for ${languageId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Only use regex for languages without tree-sitter support
  return resolveSemanticWithRegex(document, line, scope);
}