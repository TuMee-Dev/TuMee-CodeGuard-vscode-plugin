import type * as vscode from 'vscode';
import type { GuardTag, LinePermission, ScopeCache, ScopeBoundary } from '../types/guardTypes';
import { parseGuardTag } from './acl';
import { resolveSemantic } from './scopeResolver';
import { logError, validateDocument, GuardProcessingError, ErrorSeverity } from './errorHandler';

// Cache for scope resolutions to avoid recalculating on every keystroke
const scopeCacheMap = new WeakMap<vscode.TextDocument, ScopeCache>();

/**
 * Clear the scope cache for a document
 */
export function clearScopeCache(document: vscode.TextDocument): void {
  scopeCacheMap.delete(document);
}

/**
 * Get or create scope cache for a document
 */
function getScopeCache(document: vscode.TextDocument): ScopeCache {
  const version = document.version;
  let cache = scopeCacheMap.get(document);

  // If cache doesn't exist or document version changed, create new cache
  if (!cache || cache.documentVersion !== version) {
    cache = {
      documentVersion: version,
      scopes: new Map()
    };
    scopeCacheMap.set(document, cache);
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