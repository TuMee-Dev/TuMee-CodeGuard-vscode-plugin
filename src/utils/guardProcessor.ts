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
      return trimmed.startsWith('/*');
    case 'sql':
      return trimmed.startsWith('--') || trimmed.startsWith('/*');
    case 'lua':
      return trimmed.startsWith('--');
    case 'vb':
      return trimmed.startsWith("'");
    case 'fortran':
      return trimmed.startsWith('!') || trimmed.startsWith('C') || trimmed.startsWith('c');
    default:
      // Default to common comment patterns
      return trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*');
  }
}

/**
 * Find the end of an implicit scope (until next guard tag or end of current code block)
 */
function findImplicitScopeEnd(lines: string[], startLine: number, languageId: string): number {
  const totalLines = lines.length;
  const currentIndent = getIndentLevel(lines[startLine]);
  let endLine = startLine;

  // For Python and other indent-based languages, track indent level
  const isIndentBased = ['python', 'yaml', 'coffeescript', 'slim', 'pug', 'haml'].includes(languageId);

  for (let i = startLine + 1; i < totalLines; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Stop at next guard tag
    if (trimmed.includes('@guard:')) {
      return endLine;
    }

    // Skip empty lines
    if (trimmed === '') {
      continue;
    }

    // For indent-based languages, check if we've left the current block
    if (isIndentBased) {
      const lineIndent = getIndentLevel(line);
      if (lineIndent < currentIndent && !isLineAComment(trimmed, languageId)) {
        return endLine;
      }
    }

    // Update end line for non-empty, non-comment lines
    if (!isLineAComment(trimmed, languageId)) {
      endLine = i;
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

  // If cache doesn't exist, create new cache
  if (!cache) {
    cache = {
      documentVersion: version,
      scopes: new Map()
    };
    scopeCacheMap.set(document, cache);
  } else if (cache.documentVersion !== version) {
    // Document version changed - perform partial invalidation
    const modifiedLines = modifiedLinesMap.get(document);

    if (modifiedLines && modifiedLines.size > 0) {
      // Only invalidate cache entries for modified lines
      const newScopes = new Map<string, ScopeBoundary | null>();

      for (const [key, value] of cache.scopes) {
        const lineNum = parseInt(key.split(':')[0]);

        // Keep cache entry if line wasn't modified
        if (!modifiedLines.has(lineNum)) {
          newScopes.set(key, value);
        }
      }

      cache.scopes = newScopes;
      cache.documentVersion = version;

      // Clear modified lines tracking
      modifiedLines.clear();
    } else {
      // No tracking info, fall back to full invalidation
      cache = {
        documentVersion: version,
        scopes: new Map()
      };
      scopeCacheMap.set(document, cache);
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
 * Parse guard tags from document lines in chunks for better performance
 * @param document The document to parse
 * @param lines All lines in the document
 * @param chunkSize Number of lines to process at once (default: 1000)
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

        const tagInfo = parseGuardTag(line);

        if (tagInfo) {
          // If there's a semantic scope, resolve it to line numbers
          if (tagInfo.scope && !tagInfo.lineCount) {
            const scopeBoundary = await resolveSemanticWithCache(
              document,
              i,
              tagInfo.scope,
              tagInfo.addScopes,
              tagInfo.removeScopes
            );

            if (scopeBoundary) {
              // For semantic scopes, we need to handle the range differently
              guardTags.push({
                lineNumber: scopeBoundary.startLine,
                target: tagInfo.target as 'ai' | 'human',
                identifier: tagInfo.identifier,
                permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
                scope: tagInfo.scope,
                lineCount: scopeBoundary.endLine - scopeBoundary.startLine + 1,
                addScopes: tagInfo.addScopes,
                removeScopes: tagInfo.removeScopes,
                scopeStart: scopeBoundary.startLine,
                scopeEnd: scopeBoundary.endLine
              });
            } else {
              // If scope resolution fails, treat as unbounded
              guardTags.push({
                lineNumber: i,
                target: tagInfo.target as 'ai' | 'human',
                identifier: tagInfo.identifier,
                permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
                scope: tagInfo.scope,
                lineCount: tagInfo.lineCount,
                addScopes: tagInfo.addScopes,
                removeScopes: tagInfo.removeScopes
              });
            }
          } else {
            // For guard tags without explicit scope, check if they're on a comment line
            // If so, they should apply to the following code block
            const trimmedLine = line.trim();
            const isCommentLine = isLineAComment(trimmedLine, document.languageId);

            if (isCommentLine && !tagInfo.lineCount) {
              // Find the next non-comment, non-empty line as the start of the guarded region
              let startLine = i + 1;
              while (startLine < totalLines &&
                     (lines[startLine].trim() === '' ||
                      isLineAComment(lines[startLine].trim(), document.languageId))) {
                startLine++;
              }

              if (startLine < totalLines) {
                // Find the end of the current scope or next guard tag
                const endLine = findImplicitScopeEnd(lines, startLine, document.languageId);

                guardTags.push({
                  lineNumber: i + 1,  // Line numbers are 1-based
                  target: tagInfo.target as 'ai' | 'human',
                  identifier: tagInfo.identifier,
                  permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
                  scope: tagInfo.scope,
                  lineCount: endLine - startLine + 1,
                  addScopes: tagInfo.addScopes,
                  removeScopes: tagInfo.removeScopes,
                  scopeStart: startLine + 1,  // Convert to 1-based
                  scopeEnd: endLine + 1       // Convert to 1-based
                });
              } else {
                // No code follows, treat as single line
                guardTags.push({
                  lineNumber: i + 1,
                  target: tagInfo.target as 'ai' | 'human',
                  identifier: tagInfo.identifier,
                  permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
                  scope: tagInfo.scope,
                  lineCount: tagInfo.lineCount || 1,
                  addScopes: tagInfo.addScopes,
                  removeScopes: tagInfo.removeScopes
                });
              }
            } else {
              // Regular line count or on code line
              guardTags.push({
                lineNumber: i + 1,
                target: tagInfo.target as 'ai' | 'human',
                identifier: tagInfo.identifier,
                permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
                scope: tagInfo.scope,
                lineCount: tagInfo.lineCount,
                addScopes: tagInfo.addScopes,
                removeScopes: tagInfo.removeScopes
              });
            }
          }
        } // Close if (tagInfo)
      }

      // Report progress if callback provided
      if (onProgress) {
        onProgress(chunkEnd, totalLines);
      }

      // Yield to allow other operations
      await new Promise(resolve => setImmediate(resolve));
    }
  } catch (error) {
    logError(error, 'parseGuardTagsChunked', { showUser: false });
    // Return what we've parsed so far
    return guardTags;
  }

  return guardTags;
}

/**
 * Parse guard tags from document lines
 * This is the unified function that both updateCodeDecorations and updateStatusBarItem will use
 */
export async function parseGuardTags(document: vscode.TextDocument, lines: string[]): Promise<GuardTag[]> {
  // Validate input
  if (!validateDocument(document)) {
    throw new GuardProcessingError('Invalid document object', ErrorSeverity.ERROR);
  }

  if (!Array.isArray(lines)) {
    throw new GuardProcessingError('Invalid lines array', ErrorSeverity.ERROR);
  }

  const guardTags: GuardTag[] = [];

  try {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty or invalid lines
      if (typeof line !== 'string') {
        logError(
          new GuardProcessingError(`Invalid line at index ${i}`, ErrorSeverity.WARNING),
          'parseGuardTags'
        );
        continue;
      }

      const tagInfo = parseGuardTag(line);

      if (tagInfo) {
        // If there's a semantic scope, resolve it to line numbers
        if (tagInfo.scope && !tagInfo.lineCount) {
          const scopeBoundary = await resolveSemanticWithCache(
            document,
            i,
            tagInfo.scope,
            tagInfo.addScopes,
            tagInfo.removeScopes
          );

          if (scopeBoundary) {
          // For semantic scopes, we need to handle the range differently
            guardTags.push({
              lineNumber: scopeBoundary.startLine,
              target: tagInfo.target as 'ai' | 'human',
              identifier: tagInfo.identifier,
              permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
              scope: tagInfo.scope,
              lineCount: scopeBoundary.endLine - scopeBoundary.startLine + 1,
              addScopes: tagInfo.addScopes,
              removeScopes: tagInfo.removeScopes,
              scopeStart: scopeBoundary.startLine,
              scopeEnd: scopeBoundary.endLine
            });
          } else {
          // If scope resolution fails, treat as unbounded
            guardTags.push({
              lineNumber: i,
              target: tagInfo.target as 'ai' | 'human',
              identifier: tagInfo.identifier,
              permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
              scope: tagInfo.scope,
              lineCount: tagInfo.lineCount,
              addScopes: tagInfo.addScopes,
              removeScopes: tagInfo.removeScopes
            });
          }
        } else {
        // Regular line count or unbounded
          guardTags.push({
            lineNumber: i,
            target: tagInfo.target as 'ai' | 'human',
            identifier: tagInfo.identifier,
            permission: tagInfo.permission as 'r' | 'w' | 'n' | 'context',
            scope: tagInfo.scope,
            lineCount: tagInfo.lineCount,
            addScopes: tagInfo.addScopes,
            removeScopes: tagInfo.removeScopes
          });
        }
      } // Close if (tagInfo)
    }
  } catch (error) {
    logError(error, 'parseGuardTags', { showUser: false });
    // Return what we've parsed so far
    return guardTags;
  }

  return guardTags;
}

/**
 * Compute line permissions from guard tags
 * This unifies the permission processing logic
 */
export function computeLinePermissions(lines: string[], guardTags: GuardTag[]): LinePermission[] {
  // Validate input
  if (!Array.isArray(lines)) {
    throw new GuardProcessingError('Invalid lines array', ErrorSeverity.ERROR);
  }

  if (!Array.isArray(guardTags)) {
    throw new GuardProcessingError('Invalid guardTags array', ErrorSeverity.ERROR);
  }

  try {
    // Initialize line permissions
    const linePermissions: LinePermission[] = new Array(lines.length)
      .fill(null)
      .map(() => ({ target: null, permission: 'default' }));

    // Sort guard tags by line number to ensure we process them in order
    const sortedTags = [...guardTags].sort((a, b) => a.lineNumber - b.lineNumber);

    // STEP 1: Process all unbounded regions to establish base permissions
    const basePermissions: (LinePermission | null)[] = new Array(lines.length).fill(null) as (LinePermission | null)[];

    for (let i = 0; i < sortedTags.length; i++) {
      const tag = sortedTags[i];

      // Skip bounded regions for now
      if (tag.lineCount !== undefined) continue;

      // For unbounded regions, apply from this line to the next guard tag
      const startLine = tag.lineNumber;
      let endLine: number;

      // Find the next guard tag (bounded or unbounded)
      if (i < sortedTags.length - 1) {
        endLine = sortedTags[i + 1].lineNumber;
      } else {
        endLine = lines.length;
      }

      // Apply this permission to all lines in the range
      for (let j = startLine; j < endLine; j++) {
        const perm = { target: tag.target, permission: tag.permission };
        basePermissions[j] = perm;
        linePermissions[j] = perm;
      }
    }

    // STEP 2: Determine parent permissions for bounded regions
    const parentPermissions = new Map<number, LinePermission>();

    for (let i = 0; i < sortedTags.length; i++) {
      const tag = sortedTags[i];
      if (tag.lineCount === undefined) continue; // Skip unbounded regions

      // Find the most recent unbounded region before this one
      let parentPermission: LinePermission = { target: null, permission: 'default' };
      for (let j = 0; j < i; j++) {
        const prevTag = sortedTags[j];
        if (prevTag.lineCount === undefined && prevTag.lineNumber < tag.lineNumber) {
          parentPermission = { target: prevTag.target, permission: prevTag.permission };
        }
      }

      parentPermissions.set(tag.lineNumber, parentPermission);
    }

    // STEP 3: Process bounded regions (with line counts)
    for (const tag of sortedTags) {
      if (tag.lineCount === undefined) continue; // Skip unbounded regions

      const startLine = tag.lineNumber;
      // For semantic scopes, lineCount already includes the exact range
      // For numeric line counts, we add +1 to include the guard tag line
      const isSemanticScope = tag.scope && isNaN(parseInt(tag.scope));
      const endLine = isSemanticScope
        ? Math.min(startLine + tag.lineCount, lines.length)
        : Math.min(startLine + tag.lineCount + 1, lines.length);

      // Apply the bounded region's permission
      for (let i = startLine; i < endLine; i++) {
        linePermissions[i] = {
          target: tag.target,
          permission: tag.permission,
          lineCount: tag.lineCount
        };
      }

      // After a bounded region ends, revert to the parent permission
      if (endLine < lines.length) {
        const parentPerm = parentPermissions.get(startLine);
        if (parentPerm) {
          linePermissions[endLine] = parentPerm;
        }
      }
    }

    // STEP 4: Apply base permissions to any lines that haven't been set yet
    for (let i = 0; i < lines.length; i++) {
      const perm = linePermissions[i];
      const basePerm = basePermissions[i];
      if (perm && perm.permission === 'default' && basePerm) {
        linePermissions[i] = basePerm;
      }
    }

    // STEP 5: Make sure empty lines inherit permissions
    for (let i = 1; i < lines.length; i++) {
      const currentPerm = linePermissions[i];
      const prevPerm = linePermissions[i - 1];
      if (currentPerm && currentPerm.permission === 'default' && prevPerm && prevPerm.permission !== 'default') {
      // An empty or unprocessed line inherits from the previous line
        linePermissions[i] = linePermissions[i - 1];
      }
    }

    return linePermissions;
  } catch (error) {
    logError(error, 'computeLinePermissions', { showUser: false });
    // Return default permissions for all lines
    return new Array(lines.length)
      .fill(null)
      .map(() => ({ target: null, permission: 'default' }));
  }
}