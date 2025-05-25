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
 * Stack entry for guard processing - contains complete permission state
 */
interface GuardStackEntry {
  permissions: {
    [target: string]: string;  // e.g., { ai: 'w', human: 'r' }
  };
  isContext: {
    [target: string]: boolean;  // e.g., { ai: true, human: false }
  };
  startLine: number;
  endLine: number;
  isLineLimited: boolean;
  sourceGuard?: GuardTag;  // The guard that triggered this state change
}

/**
 * Pop expired guards from stack and clean up any context guards below
 * Context guards cannot resume after being interrupted
 */
function popGuardWithContextCleanup(guardStack: GuardStackEntry[]): void {
  guardStack.pop();

  // After popping, also pop any context guards below
  // Context guards cannot resume after being interrupted
  while (guardStack.length > 0) {
    const next = guardStack[guardStack.length - 1];
    // Check if any permission in this entry is 'context'
    const hasContextPermission = Object.values(next.permissions).includes('context');
    if (hasContextPermission) {
      guardStack.pop();
    } else {
      break;
    }
  }
}

/**
 * Remove any context guards from the top of the stack
 * Context guards cannot be interrupted and resumed later
 */
function removeInterruptedContextGuards(guardStack: GuardStackEntry[]): void {
  while (guardStack.length > 0) {
    const top = guardStack[guardStack.length - 1];
    // Check if any permission in this entry is 'context'
    const hasContextPermission = Object.values(top.permissions).includes('context');
    if (hasContextPermission) {
      guardStack.pop();
    } else {
      break;
    }
  }
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

      // Check for expired guards (both line-limited and scope-based)
      while (guardStack.length > 0) {
        const top = guardStack[guardStack.length - 1];
        // Remove if we've passed the guard's end line (works for both line-limited and scope-based)
        if (i >= top.endLine) {
          popGuardWithContextCleanup(guardStack);
        } else {
          break;
        }
      }

      // Only parse guard tags from comment lines
      if (!isLineAComment(line, document.languageId)) {
        continue;
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
          // Line-limited guard - starts from the guard tag line
          endLine = startLine + tagInfo.lineCount - 1;
          isLineLimited = true;
        } else if (guardTag.scopeStart && guardTag.scopeEnd) {
          // Semantic scope - guard starts from the guard tag line
          // but ends at the scope end
          startLine = lineNumber;  // Always start from guard tag
          endLine = guardTag.scopeEnd;
        }
        // For simple guards without scope or line count,
        // the guard starts from the current line and goes to end of file

        // Update guard tag with calculated boundaries
        guardTag.scopeStart = startLine;
        guardTag.scopeEnd = endLine;

        // Before pushing new guard, remove any interrupted context guards
        removeInterruptedContextGuards(guardStack);

        // Push to stack with current permissions
        // Get current permissions and context state from top of stack or use defaults
        const currentPermissions = guardStack.length > 0
          ? { ...guardStack[guardStack.length - 1].permissions }
          : { ai: 'r', human: 'w' };  // Default permissions

        const currentContext = guardStack.length > 0
          ? { ...guardStack[guardStack.length - 1].isContext }
          : { ai: false, human: false };  // Default no context

        // Handle context as a modifier
        if (guardTag.permission === 'context') {
          // Context doesn't change read/write permissions
          currentContext[guardTag.target] = true;
        } else {
          // Update the actual permission
          currentPermissions[guardTag.target] = guardTag.permission;
          // Clear context when setting a new permission
          currentContext[guardTag.target] = false;
        }

        guardStack.push({
          permissions: currentPermissions,
          isContext: currentContext,
          startLine: startLine,
          endLine: endLine,
          isLineLimited: isLineLimited,
          sourceGuard: guardTag
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
 * Core guard stack processing logic - tracks all permission types independently
 */
interface ProcessedLinePermission {
  permissions: { [target: string]: string };
  isContext: { [target: string]: boolean };
}

function processGuardStack(
  guardTags: GuardTag[],
  totalLines: number,
  getLineText: (lineNumber: number) => string,
  defaultPermissions: { [target: string]: string } = { ai: 'r', human: 'w' }
): Map<number, ProcessedLinePermission> {
  const linePermissions = new Map<number, ProcessedLinePermission>();
  
  // Initialize stack with default permissions covering the entire file
  const guardStack: GuardStackEntry[] = [{
    permissions: { ...defaultPermissions },
    isContext: { ai: false, human: false },
    startLine: 1,
    endLine: totalLines,
    isLineLimited: false
  }];
  
  console.log('[DEBUG] processGuardStack called with defaults:', defaultPermissions);

  for (let line = 1; line <= totalLines; line++) {
    // Remove expired guards from stack
    while (guardStack.length > 0) {
      const top = guardStack[guardStack.length - 1];
      if (line > top.endLine) {
        popGuardWithContextCleanup(guardStack);
      } else {
        break;
      }
    }

    // Add new guards starting on this line
    for (const tag of guardTags) {
      if (tag.lineNumber === line) {
        // Get current permissions and context from top of stack or use defaults
        const currentPermissions = guardStack.length > 0
          ? { ...guardStack[guardStack.length - 1].permissions }
          : { ...defaultPermissions };

        const currentContext = guardStack.length > 0
          ? { ...guardStack[guardStack.length - 1].isContext }
          : { ai: false, human: false };

        // Handle context as a modifier
        if (tag.permission === 'context') {
          // Context doesn't change read/write permissions
          currentContext[tag.target] = true;
        } else {
          // Update the actual permission
          currentPermissions[tag.target] = tag.permission;
          // Clear context when setting a new permission
          currentContext[tag.target] = false;
        }

        const entry: GuardStackEntry = {
          permissions: currentPermissions,
          isContext: currentContext,
          startLine: tag.scopeStart || line,
          endLine: tag.scopeEnd || (tag.lineCount ? line + tag.lineCount - 1 : totalLines),
          isLineLimited: !!tag.lineCount,
          sourceGuard: tag
        };

        // Before pushing new guard, remove any interrupted context guards
        removeInterruptedContextGuards(guardStack);
        guardStack.push(entry);
      }
    }

    // Determine effective permissions for this line
    if (guardStack.length > 0) {
      const lineText = getLineText(line);
      const isWhitespaceOnly = lineText.trim().length === 0;

      // Get the current state from the stack
      const top = guardStack[guardStack.length - 1];
      if (line >= top.startLine && line <= top.endLine) {
        // For whitespace-only lines, check if we need to skip context guards
        let effectivePermissions = top.permissions;

        if (isWhitespaceOnly) {
          // Look for non-context permissions in the stack
          const nonContextPermissions: { [target: string]: string } = {};

          // Collect all non-context permissions from applicable stack entries
          for (let i = guardStack.length - 1; i >= 0; i--) {
            const entry = guardStack[i];
            if (line >= entry.startLine && line <= entry.endLine) {
              // Add any non-context permissions we haven't seen yet
              for (const [target, permission] of Object.entries(entry.permissions)) {
                if (permission !== 'context' && !nonContextPermissions[target]) {
                  nonContextPermissions[target] = permission;
                }
              }
            }
          }

          // If we found any non-context permissions, use them
          if (Object.keys(nonContextPermissions).length > 0) {
            effectivePermissions = nonContextPermissions;
          }
        }

        // Return the full permissions state for this line with context info
        linePermissions.set(line, {
          permissions: effectivePermissions,
          isContext: top.isContext
        });
      }
    } else {
      // No guards on stack - use defaults
      if (line <= 5) {
        console.log(`[DEBUG] Line ${line}: No guards on stack, using defaults:`, defaultPermissions);
      }
      linePermissions.set(line, {
        permissions: defaultPermissions,
        isContext: { ai: false, human: false }
      });
    }
  }

  return linePermissions;
}

// /**
//  * Create guard regions from parsed tags using stack-based precedence
//  * This function is used to create non-overlapping regions for visualization
//  * NOTE: This function needs to be refactored to work with the new permission model
//  */
// export function createGuardRegions(guardTags: GuardTag[], totalLines: number): GuardTag[] {
//   // TODO: Refactor to work with new permission model where we track both AI and human permissions
//   return [];
// }

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

  console.log('[DEBUG] getLinePermissions called for document:', document.fileName);
  console.log('[DEBUG] Guard tags found:', guardTags.length);

  // Use the shared guard stack processing logic with explicit defaults
  const linePermissions = processGuardStack(
    guardTags,
    totalLines,
    (line) => document.lineAt(line - 1).text,
    { ai: 'r', human: 'w' } // Explicit default permissions
  );
  
  console.log('[DEBUG] Default permissions being used:', { ai: 'r', human: 'w' });

  // Convert permissions dictionary to LinePermission map
  for (const [line, perms] of linePermissions) {
    if (line <= 5) { // Debug first 5 lines
      console.log(`[DEBUG] Line ${line} permissions:`, perms.permissions, 'isContext:', perms.isContext);
    }
    permissions.set(line, {
      line: line,
      permissions: perms.permissions,
      isContext: perms.isContext,
      identifier: undefined
    });
  }

  console.log('[DEBUG] Total lines with permissions:', permissions.size);
  return permissions;
}

/**
 * Export utility functions
 */
export { parseGuardTag } from './acl';
export { isLineAComment };