/**
 * Cache management and optimization for guard processing
 * Handles scope resolutions, modified line tracking, and cache invalidation
 */

import type { ScopeBoundary } from '../../types/guardTypes';

/**
 * Document interface that matches what we need from vscode.TextDocument
 */
export interface IDocument {
  getText(): string;
  readonly lineCount: number;
  readonly languageId: string;
  lineAt(line: number): ITextLine;
}

/**
 * Text line interface that matches vscode.TextLine
 */
export interface ITextLine {
  readonly text: string;
  readonly firstNonWhitespaceCharacterIndex: number;
}

/**
 * Semantic resolver function type
 */
export type SemanticResolver = (
  document: IDocument,
  line: number,
  scope: string,
  addScopes?: string[],
  removeScopes?: string[]
) => Promise<ScopeBoundary | null>;

/**
 * Cache for scope resolutions to avoid recalculating on every keystroke
 */
const scopeCacheMap = new WeakMap<IDocument, Map<string, ScopeBoundary>>();

/**
 * Track which lines have been modified for smarter cache invalidation
 */
const modifiedLinesMap = new WeakMap<IDocument, Set<number>>();

/**
 * Clear the scope cache for a document
 */
export function clearScopeCache(document: IDocument): void {
  scopeCacheMap.delete(document);
}

/**
 * Mark lines as modified for partial cache invalidation
 */
export function markLinesModified(document: IDocument, startLine: number, endLine: number): void {
  let modifiedLines = modifiedLinesMap.get(document);
  if (!modifiedLines) {
    modifiedLines = new Set<number>();
    modifiedLinesMap.set(document, modifiedLines);
  }

  for (let line = startLine; line <= endLine; line++) {
    modifiedLines.add(line);
  }

  // Partial cache invalidation for scope cache
  const scopeCache = scopeCacheMap.get(document);
  if (scopeCache) {
    // Remove cached scope entries that overlap with modified lines
    for (const [key, boundary] of scopeCache.entries()) {
      if (boundary.startLine <= endLine && boundary.endLine >= startLine) {
        scopeCache.delete(key);
      }
    }
  }
}

/**
 * Get cached scope boundaries for a given line and scope type
 */
function getCachedScope(
  document: IDocument,
  line: number,
  scope: string,
  addScopes?: string[],
  removeScopes?: string[]
): ScopeBoundary | undefined {
  const scopeCache = scopeCacheMap.get(document);
  if (!scopeCache) return undefined;

  // Create a cache key that includes all scope modifiers
  const scopeKey = `${line}:${scope}:${addScopes?.join(',') || ''}:${removeScopes?.join(',') || ''}`;
  return scopeCache.get(scopeKey);
}

/**
 * Cache scope boundaries
 */
function setCachedScope(
  document: IDocument,
  line: number,
  scope: string,
  boundary: ScopeBoundary,
  addScopes?: string[],
  removeScopes?: string[]
): void {
  let scopeCache = scopeCacheMap.get(document);
  if (!scopeCache) {
    scopeCache = new Map();
    scopeCacheMap.set(document, scopeCache);
  }

  // Create a cache key that includes all scope modifiers
  const scopeKey = `${line}:${scope}:${addScopes?.join(',') || ''}:${removeScopes?.join(',') || ''}`;
  scopeCache.set(scopeKey, boundary);
}

/**
 * Resolve semantic scope with caching
 */
export async function resolveSemanticWithCache(
  document: IDocument,
  line: number,
  scope: string,
  semanticResolver: SemanticResolver,
  addScopes?: string[],
  removeScopes?: string[]
): Promise<ScopeBoundary | undefined> {
  // Check cache first
  const cached = getCachedScope(document, line, scope, addScopes, removeScopes);
  if (cached) {
    return cached;
  }

  // Resolve scope
  const boundary = await semanticResolver(document, line, scope, addScopes, removeScopes);

  // Cache the result
  if (boundary) {
    setCachedScope(document, line, scope, boundary, addScopes, removeScopes);
  }

  return boundary || undefined;
}