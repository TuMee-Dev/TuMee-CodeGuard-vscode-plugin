import type * as vscode from 'vscode';
import type { GuardTag, LinePermission, ScopeCache, ScopeBoundary } from '../types/guardTypes';
import { parseGuardTag } from './acl';
import { resolveSemantic } from './scopeResolver';
import { logError, validateDocument, GuardProcessingError, ErrorSeverity } from './errorHandler';

// Cache for scope resolutions to avoid recalculating on every keystroke
const scopeCacheMap = new WeakMap<vscode.TextDocument, ScopeCache>();

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
    case 'dockerfile':
    case 'makefile':
    case 'r':
      return trimmed.startsWith('#');
    case 'html':
    case 'xml':
    case 'markdown':
      return trimmed.startsWith('<!--');
    case 'css':
    case 'scss':
    case 'less':
    case 'sass':
      return trimmed.startsWith('/*');
    case 'lua':
      return trimmed.startsWith('--');
    case 'sql':
      return trimmed.startsWith('--') || trimmed.startsWith('/*');
    case 'vb':
    case 'vbnet':
      return trimmed.startsWith("'");
    case 'fsharp':
      return trimmed.startsWith('//') || trimmed.startsWith('(*');
    case 'clojure':
    case 'lisp':
    case 'scheme':
      return trimmed.startsWith(';');
    case 'haskell':
      return trimmed.startsWith('--');
    case 'matlab':
    case 'octave':
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
 * Find the end of an implicit scope (no longer used in stack-based approach)
 * @deprecated Use stack-based approach instead
 */
function findImplicitScopeEnd(lines: string[], startLine: number, languageId: string): number {
  if (startLine >= lines.length) {
    return startLine;
  }
  
  const baseIndent = lines[startLine].match(/^(\s*)/)?.[1]?.length || 0;
  let endLine = startLine;
  
  // For indent-based languages like Python
  if (languageId === 'python' || languageId === 'ruby' || languageId === 'yaml') {
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip empty lines
      if (trimmed === '') continue;
      
      // If we hit another guard tag, stop
      if (trimmed.includes('@guard:')) {
        break;
      }
      
      // Check indentation
      const currentIndent = line.match(/^(\s*)/)?.[1]?.length || 0;
      
      // If indentation is less than or equal to base, we're out of the block
      if (currentIndent < baseIndent && trimmed !== '') {
        break;
      }
      
      // Update end line for non-empty, non-comment lines
      if (!isLineAComment(trimmed, languageId)) {
        endLine = i;
      }
    }
  }
  
  return endLine;
}

/**
 * Get the indentation level of a line
 */
function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

/**
 * Clear the scope cache for a document
 */
export function clearScopeCache(document: vscode.TextDocument): void {
  scopeCacheMap.delete(document);
  modifiedLinesMap.delete(document);
}

/**
 * Mark lines as modified for partial cache invalidation
 * @param document The document being edited
 * @param startLine Starting line of the modification
 * @param endLine Ending line of the modification
 */
export function markLinesModified(document: vscode.TextDocument, startLine: number, endLine: number): void {
  let modifiedLines = modifiedLinesMap.get(document);
  if (!modifiedLines) {
    modifiedLines = new Set<number>();
    modifiedLinesMap.set(document, modifiedLines);
  }

  // Mark range of lines as modified
  for (let i = startLine; i <= endLine; i++) {
    modifiedLines.add(i);
  }
}

/**
 * Get or create scope cache for a document with partial invalidation
 */
function getScopeCache(document: vscode.TextDocument): ScopeCache {
  const version = document.version;
  let cache = scopeCacheMap.get(document);

  if (!cache || cache.version !== version) {
    // Create new cache or handle version mismatch
    if (!cache) {
      cache = {
        version,
        scopes: new Map<string, ScopeBoundary | null>()
      };
      scopeCacheMap.set(document, cache);
    } else {
      // Version changed - invalidate only modified lines
      const modifiedLines = modifiedLinesMap.get(document);
      if (modifiedLines && modifiedLines.size > 0) {
        // Create new cache with non-modified entries preserved
        const newCache: ScopeCache = {
          version,
          scopes: new Map<string, ScopeBoundary | null>()
        };

        // Copy entries that weren't affected by modifications
        cache.scopes.forEach((value, key) => {
          const [lineStr] = key.split(':');
          const line = parseInt(lineStr, 10);
          if (!modifiedLines.has(line) && value) {
            // Also check if the scope boundary itself was modified
            let scopeModified = false;
            for (let l = value.startLine; l <= value.endLine; l++) {
              if (modifiedLines.has(l)) {
                scopeModified = true;
                break;
              }
            }
            if (!scopeModified) {
              newCache.scopes.set(key, value);
            }
          }
        });

        cache = newCache;
        scopeCacheMap.set(document, cache);
        modifiedLines.clear();
      } else {
        // Full invalidation
        cache.version = version;
        cache.scopes.clear();
      }
    }
  }

  return cache;
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
): Promise<ScopeBoundary | null> {
  const cache = getScopeCache(document);
  const cacheKey = `${line}:${scope}:${addScopes?.join(',') || ''}:${removeScopes?.join(',') || ''}`;

  // Check cache first
  if (cache.scopes.has(cacheKey)) {
    return cache.scopes.get(cacheKey) || null;
  }

  // Resolve and cache
  const result = await resolveSemantic(document, line, scope, addScopes, removeScopes);
  cache.scopes.set(cacheKey, result);
  return result;
}

/**
 * Parse guard tags using stack-based approach for proper precedence
 * @param document The document to parse
 * @param lines All lines in the document
 * @param chunkSize Number of lines to process at once (for progress reporting)
 * @param onProgress Optional callback to report progress
 */
export async function parseGuardTagsChunked(
  document: vscode.TextDocument,
  lines: string[],
  chunkSize: number = 1000,
  onProgress?: (processed: number, total: number) => void
): Promise<GuardTag[]> {
  // Validate input
  if (!validateDocument(document)) {
    throw new GuardProcessingError('Invalid document object', ErrorSeverity.ERROR);
  }

  if (!Array.isArray(lines)) {
    throw new GuardProcessingError('Invalid lines array', ErrorSeverity.ERROR);
  }

  const guardTags: GuardTag[] = [];
  const totalLines = lines.length;
  const guardStack: GuardStackEntry[] = [];

  try {
    for (let chunkStart = 0; chunkStart < totalLines; chunkStart += chunkSize) {
      const chunkEnd = Math.min(chunkStart + chunkSize, totalLines);

      // Process chunk
      for (let i = chunkStart; i < chunkEnd; i++) {
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

      // Report progress
      if (onProgress) {
        onProgress(chunkEnd, totalLines);
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