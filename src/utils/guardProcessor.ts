import type * as vscode from 'vscode';
import type { GuardTag, LinePermission, ScopeBoundary } from '../types/guardTypes';
import { parseGuardTag } from './acl';
import { resolveSemantic } from './scopeResolver';
import { logError, validateDocument, GuardProcessingError, ErrorSeverity } from './errorHandler';

// Cache for scope resolutions to avoid recalculating on every keystroke
const scopeCacheMap = new WeakMap<vscode.TextDocument, Map<string, ScopeBoundary>>();

// Track which lines have been modified for smarter cache invalidation
const modifiedLinesMap = new WeakMap<vscode.TextDocument, Set<number>>();

/**
 * Stack entry for guard processing
 */
interface GuardStackEntry {
  guard: GuardTag;
  startLine: number;
  endLine: number; // For line-limited guards
  isLineLimited: boolean;
}

/**
 * Check if a line is a comment based on language
 */
function isLineAComment(line: string, languageId: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  switch (languageId) {
    case 'javascript':
    case 'typescript':
    case 'javascriptreact':
    case 'typescriptreact':
    case 'java':
    case 'c':
    case 'cpp':
    case 'csharp':
    case 'go':
    case 'rust':
    case 'swift':
    case 'kotlin':
    case 'scala':
    case 'php':
      return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
    case 'python':
    case 'ruby':
    case 'perl':
    case 'shellscript':
    case 'yaml':
      return trimmed.startsWith('#');
    case 'html':
    case 'xml':
    case 'svg':
      return !!trimmed.match(/^<!--/);
    case 'css':
    case 'scss':
    case 'less':
      return trimmed.startsWith('/*') || trimmed.startsWith('//');
    case 'sql':
      return trimmed.startsWith('--') || trimmed.startsWith('/*');
    case 'lua':
      return trimmed.startsWith('--');
    case 'haskell':
      return trimmed.startsWith('--') || trimmed.startsWith('{-');
    case 'r':
      return trimmed.startsWith('#');
    case 'powershell':
      return trimmed.startsWith('#') || trimmed.startsWith('<#');
    case 'vb':
    case 'vbscript':
      return trimmed.startsWith("'") || !!trimmed.match(/^rem\s/i);
    case 'elixir':
      return trimmed.startsWith('#');
    case 'clojure':
      return trimmed.startsWith(';');
    case 'lisp':
    case 'scheme':
      return trimmed.startsWith(';');
    case 'erlang':
      return trimmed.startsWith('%');
    case 'fortran':
      return !!trimmed.match(/^[cC!]/);
    case 'pascal':
    case 'delphi':
      return trimmed.startsWith('//') || trimmed.startsWith('{') || trimmed.startsWith('(*');
    default:
      // Default to common comment patterns
      return trimmed.startsWith('#') || trimmed.startsWith('//') ||
             trimmed.startsWith('/*') || trimmed.startsWith('*');
  }
}

/**
 * Clear the scope cache for a document
 */
export function clearScopeCache(document: vscode.TextDocument): void {
  scopeCacheMap.delete(document);
}

/**
 * Mark lines as modified for partial cache invalidation
 */
export function markLinesModified(document: vscode.TextDocument, startLine: number, endLine: number): void {
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
  document: vscode.TextDocument,
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
  document: vscode.TextDocument,
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
async function resolveSemanticWithCache(
  document: vscode.TextDocument,
  line: number,
  scope: string,
  addScopes?: string[],
  removeScopes?: string[]
): Promise<ScopeBoundary | undefined> {
  // Check cache first
  const cached = getCachedScope(document, line, scope, addScopes, removeScopes);
  if (cached) {
    return cached;
  }

  // Resolve scope
  const boundary = await resolveSemantic(document, line, scope, addScopes, removeScopes);

  // Cache the result
  if (boundary) {
    setCachedScope(document, line, scope, boundary, addScopes, removeScopes);
  }

  return boundary || undefined;
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

  // Check if document has been modified - if not, use cached results
  const modifiedLines = modifiedLinesMap.get(document);
  if (!modifiedLines || modifiedLines.size === 0) {
    // Document hasn't been modified, but we still need to parse
  }

  const guardTags: GuardTag[] = [];
  const totalLines = lines.length;
  const guardStack: GuardStackEntry[] = [];

  try {
    for (let i = 0; i < totalLines; i++) {
      const line = lines[i];

      // Skip empty or invalid lines
      if (typeof line !== 'string') {
        logError(
          new GuardProcessingError(`Invalid line at index ${i}`, ErrorSeverity.WARNING),
          'parseGuardTagsChunked'
        );
        continue;
      }

      // Check for expired line-limited guards
      while (guardStack.length > 0) {
        const top = guardStack[guardStack.length - 1];
        if (top.isLineLimited && i >= top.endLine) {
          guardStack.pop();
        } else {
          break;
        }
      }

      const tagInfo = parseGuardTag(line);

      if (tagInfo) {
        const lineNumber = i + 1; // 1-based line number

        // Create guard tag entry
        const guardTag: GuardTag = {
          lineNumber: lineNumber,
          target: tagInfo.target as 'ai' | 'human',
          identifier: tagInfo.identifier,
          permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
          scope: tagInfo.scope,
          lineCount: tagInfo.lineCount,
          addScopes: tagInfo.addScopes,
          removeScopes: tagInfo.removeScopes
        };

        // Handle semantic scope resolution
        if (tagInfo.scope && !tagInfo.lineCount) {
          const scopeBoundary = await resolveSemanticWithCache(
            document,
            lineNumber - 1,  // Convert back to 0-based for the resolver
            tagInfo.scope,
            tagInfo.addScopes,
            tagInfo.removeScopes
          );

          if (scopeBoundary) {
            guardTag.scopeStart = scopeBoundary.startLine;
            guardTag.scopeEnd = scopeBoundary.endLine;
            guardTag.lineCount = scopeBoundary.endLine - scopeBoundary.startLine + 1;
          }
        }

        // Determine guard boundaries
        let startLine = lineNumber;
        let endLine = totalLines;
        let isLineLimited = false;

        if (tagInfo.lineCount) {
          // Line-limited guard
          endLine = startLine + tagInfo.lineCount - 1;
          isLineLimited = true;
        } else if (guardTag.scopeStart && guardTag.scopeEnd) {
          // Semantic scope
          startLine = guardTag.scopeStart;
          endLine = guardTag.scopeEnd;
        }

        // Update guard tag with calculated boundaries
        guardTag.scopeStart = startLine;
        guardTag.scopeEnd = endLine;

        // Push to stack
        guardStack.push({
          guard: guardTag,
          startLine: startLine,
          endLine: endLine,
          isLineLimited: isLineLimited
        });

        guardTags.push(guardTag);
      }
    }

    return guardTags;

  } catch (error) {
    if (error instanceof GuardProcessingError) {
      throw error;
    }

    throw new GuardProcessingError(
      `Unexpected error parsing guard tags: ${error instanceof Error ? error.message : String(error)}`,
      ErrorSeverity.ERROR
    );
  }
}

// Export alias for backward compatibility
export const parseGuardTagsChunked = parseGuardTags;

/**
 * Create guard regions from parsed tags using stack-based precedence
 * This function is used to create non-overlapping regions for visualization
 */
export function createGuardRegions(guardTags: GuardTag[], totalLines: number): GuardTag[] {
  const regions: GuardTag[] = [];
  const linePermissions: Map<number, GuardTag> = new Map();

  // Process guards to determine effective permission for each line
  const guardStack: GuardStackEntry[] = [];

  for (let line = 1; line <= totalLines; line++) {
    // Remove expired guards from stack
    while (guardStack.length > 0) {
      const top = guardStack[guardStack.length - 1];
      if (top.isLineLimited && line > top.endLine) {
        guardStack.pop();
      } else {
        break;
      }
    }

    // Add new guards starting on this line
    for (const tag of guardTags) {
      if (tag.lineNumber === line) {
        const entry: GuardStackEntry = {
          guard: tag,
          startLine: tag.scopeStart || line,
          endLine: tag.scopeEnd || (tag.lineCount ? line + tag.lineCount - 1 : totalLines),
          isLineLimited: !!tag.lineCount
        };
        guardStack.push(entry);
      }
    }

    // Top of stack determines effective permission
    if (guardStack.length > 0) {
      const top = guardStack[guardStack.length - 1];
      if (line >= top.startLine && line <= top.endLine) {
        linePermissions.set(line, top.guard);
      }
    }
  }

  // Create contiguous regions from line permissions
  let currentRegion: GuardTag | null = null;
  let regionStart = 1;

  for (let line = 1; line <= totalLines + 1; line++) {
    const permission = line <= totalLines ? linePermissions.get(line) : null;

    if (currentRegion) {
      // Check if we need to end the current region
      const needNewRegion = !permission ||
        permission.target !== currentRegion.target ||
        permission.permission !== currentRegion.permission ||
        permission.identifier !== currentRegion.identifier;

      if (needNewRegion) {
        // End current region
        currentRegion.scopeStart = regionStart;
        currentRegion.scopeEnd = line - 1;
        currentRegion.lineCount = line - regionStart;
        regions.push(currentRegion);
        currentRegion = null;
      }
    }

    if (permission && !currentRegion) {
      // Start new region
      currentRegion = {
        lineNumber: line,
        target: permission.target,
        identifier: permission.identifier,
        permission: permission.permission,
        scope: permission.scope,
        addScopes: permission.addScopes,
        removeScopes: permission.removeScopes
      };
      regionStart = line;
    }
  }

  return regions;
}

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
  const permissions = new Map<number, LinePermission>();
  const totalLines = document.lineCount;
  const guardStack: GuardStackEntry[] = [];

  for (let line = 1; line <= totalLines; line++) {
    // Remove expired guards from stack
    while (guardStack.length > 0) {
      const top = guardStack[guardStack.length - 1];
      if (top.isLineLimited && line > top.endLine) {
        guardStack.pop();
      } else {
        break;
      }
    }

    // Add new guards starting on this line
    for (const tag of guardTags) {
      if (tag.lineNumber === line) {
        const entry: GuardStackEntry = {
          guard: tag,
          startLine: tag.scopeStart || line,
          endLine: tag.scopeEnd || (tag.lineCount ? line + tag.lineCount - 1 : totalLines),
          isLineLimited: !!tag.lineCount
        };
        guardStack.push(entry);
      }
    }

    // Top of stack determines effective permission
    if (guardStack.length > 0) {
      const top = guardStack[guardStack.length - 1];
      if (line >= top.startLine && line <= top.endLine) {
        permissions.set(line, {
          line: line,
          permission: top.guard.permission,
          target: top.guard.target,
          identifier: top.guard.identifier
        });
      }
    }
  }

  return permissions;
}

/**
 * Export utility functions
 */
export { parseGuardTag } from './acl';
export { isLineAComment };