/**
 * Core guard processing logic without VSCode dependencies
 * This module contains the pure logic for parsing and processing guard tags
 */

import type { GuardTag, LinePermission, ScopeBoundary } from '../types/guardTypes';
import { DEFAULT_PERMISSIONS } from '../types/guardTypes';
import { parseGuardTag } from './acl';
import { GuardProcessingError, ErrorSeverity } from './errorHandler';
import { isLineAComment } from './commentDetector';

// Import cache management
import { 
  clearScopeCache as clearScopeCacheCore, 
  markLinesModified as markLinesModifiedCore, 
  resolveSemanticWithCache,
  type IDocument,
  type ITextLine,
  type SemanticResolver
} from './guardCache';

// Import scope resolution functionality
import {
  resolveGuardScope,
  determineGuardBoundaries,
  findNextGuardLine,
  trimTrailingWhitespace
} from './guardScopeResolver';

/**
 * Configuration interface
 */
export interface IConfiguration {
  get<T>(key: string, defaultValue: T): T;
}

// Import guard stack management
import { 
  popGuardWithContextCleanup,
  removeInterruptedContextGuards,
  createGuardStackEntry,
  type GuardStackEntry
} from './guardStackManager';

// Re-export types for backward compatibility
export type { IDocument, ITextLine, SemanticResolver } from './guardCache';
export type { GuardStackEntry } from './guardStackManager';


// Re-export cache functions for external use
export { clearScopeCache, markLinesModified } from './guardCache';

/**
 * Parse guard tags from document lines
 * @param document The document to parse
 * @param lines All lines in the document
 * @param config Configuration object
 * @param semanticResolver Function to resolve semantic scopes
 * @param logger Optional logger for debug output
 */
export async function parseGuardTagsCore(
  document: IDocument,
  lines: string[],
  config: IConfiguration,
  semanticResolver: SemanticResolver,
  logger?: { log: (message: string) => void }
): Promise<GuardTag[]> {
  // Get debug flag from configuration
  const debugEnabled = config.get<boolean>('enableDebugLogging', false);

  const guardTags: GuardTag[] = [];
  const totalLines = lines.length;
  const guardStack: GuardStackEntry[] = [];

  try {
    // Start from line 1 (0-based becomes 1-based naturally)
    // Line 0 is reserved for default permissions
    for (let lineNumber = 1; lineNumber <= totalLines; lineNumber++) {
      const line = lines[lineNumber - 1]; // Get the actual line content

      // Skip empty or invalid lines
      if (typeof line !== 'string') {
        throw new GuardProcessingError(
          `Invalid line at index ${lineNumber - 1}`,
          ErrorSeverity.WARNING
        );
      }

      // Check for expired guards (both line-limited and scope-based)
      while (guardStack.length > 0) {
        const top = guardStack[guardStack.length - 1];
        // Remove if we've passed the guard's end line (works for both line-limited and scope-based)
        if (lineNumber > top.endLine) {
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
        // lineNumber is already 1-based from the loop

        // Create ONE guard tag - no differentiation between single/combined
        const guardTag: GuardTag = {
          lineNumber: lineNumber,
          identifier: tagInfo.identifier,
          scope: tagInfo.scope || (!tagInfo.lineCount && (!tagInfo.aiIsContext && !tagInfo.humanIsContext) ? 'block' : undefined),
          lineCount: tagInfo.lineCount,
          addScopes: tagInfo.addScopes,
          removeScopes: tagInfo.removeScopes,
          aiPermission: tagInfo.aiPermission as 'r' | 'w' | 'n' | undefined,
          humanPermission: tagInfo.humanPermission as 'r' | 'w' | 'n' | undefined,
          aiIsContext: tagInfo.aiIsContext,
          humanIsContext: tagInfo.humanIsContext
        };

        // Handle semantic scope resolution using dedicated scope resolver
        await resolveGuardScope(
          guardTag,
          lineNumber,
          totalLines,
          lines,
          document,
          semanticResolver,
          tagInfo,
          debugEnabled,
          logger
        );

        // Determine guard boundaries using dedicated boundary determination
        let { startLine, endLine, isLineLimited } = determineGuardBoundaries(
          guardTag,
          tagInfo,
          lineNumber,
          totalLines,
          lines,
          document,
          debugEnabled
        );

        // Before pushing new guard, remove any interrupted context guards
        removeInterruptedContextGuards(guardStack);

        // Push to stack with current permissions
        // Get current permissions and context state from top of stack or use defaults
        // IMPORTANT: Check that we're inheriting from a valid scope
        let currentPermissions: { [target: string]: string } = { ...DEFAULT_PERMISSIONS };  // Default permissions
        let currentContext: { ai: boolean; human: boolean } = { ai: false, human: false };  // Default no context

        // Find the appropriate permissions to inherit
        for (let i = guardStack.length - 1; i >= 0; i--) {
          const stackEntry = guardStack[i];
          if (lineNumber >= stackEntry.startLine && lineNumber <= stackEntry.endLine) {
            currentPermissions = { ...stackEntry.permissions };
            currentContext = {
              ai: stackEntry.isContext.ai || false,
              human: stackEntry.isContext.human || false
            };
            break;
          }
        }

        // Update permissions based on the guard tag
        // Check if aiPermission is set (could be from a combined tag or single ai tag)
        if (guardTag.aiPermission !== undefined) {
          currentPermissions.ai = guardTag.aiPermission;
        }
        // Always check context flag
        if (tagInfo.aiIsContext) {
          currentContext.ai = true;
        }

        // Check if humanPermission is set (could be from a combined tag or single human tag)
        if (guardTag.humanPermission !== undefined) {
          currentPermissions.human = guardTag.humanPermission;
        }
        // Always check context flag
        if (tagInfo.humanIsContext) {
          currentContext.human = true;
        }

        // Note: Legacy tags are now handled by parseGuardTag directly,
        // which sets aiPermission for legacy AI-only tags

        // For context guards, trim the endLine to exclude trailing whitespace
        let effectiveEndLine = endLine;
        if ((tagInfo.aiIsContext || tagInfo.humanIsContext) && guardTag.scope !== 'file') {
          // Find the last line with content within the scope
          let lastContentLine = startLine; // Default to start if all lines are empty
          // Work backwards from the end to find the last non-empty line
          for (let i = endLine; i >= startLine; i--) {
            const lineText = i > lines.length ? '' : lines[i - 1];
            if (lineText.trim().length > 0) {
              lastContentLine = i;
              break;
            }
          }
          effectiveEndLine = lastContentLine;

          // Update the guard tag's scope to reflect the trimmed end
          guardTag.scopeEnd = effectiveEndLine;
          endLine = effectiveEndLine;

          if (debugEnabled && logger) {
            logger.log(`[GuardProcessor] Context guard scope trimmed from ${endLine} to ${effectiveEndLine} (last content line)`);
          }
        }

        const stackEntry: GuardStackEntry = {
          permissions: currentPermissions,
          isContext: currentContext,
          startLine: startLine,
          endLine: effectiveEndLine,
          isLineLimited: isLineLimited,
          sourceGuard: guardTag
        };

        if (debugEnabled && logger) {
          const permissions = [];
          if (guardTag.aiPermission) permissions.push(`ai:${guardTag.aiPermission}`);
          if (guardTag.humanPermission) permissions.push(`human:${guardTag.humanPermission}`);
          logger.log(`[GuardProcessor] Creating guard stack entry at line ${lineNumber}: ${permissions.join(', ')}, startLine=${startLine}, endLine=${effectiveEndLine}, inherited permissions: ${JSON.stringify(currentPermissions)}`);
        }

        if (debugEnabled && (tagInfo.aiIsContext || tagInfo.humanIsContext) && logger) {
          logger.log(`[GuardProcessor] Pushing context guard to stack: ${JSON.stringify({
            aiPermission: guardTag.aiPermission,
            humanPermission: guardTag.humanPermission,
            startLine: stackEntry.startLine,
            endLine: stackEntry.endLine,
            scope: guardTag.scope
          })}`);
        }

        guardStack.push(stackEntry);
        guardTags.push(guardTag);
      }
    }

    // Post-process guard tags to update block scope end lines
    // When a block-scoped guard is followed by another guard that changes the same target,
    // the block should end one line before the new guard
    // ONLY do this for guards that extend to end-of-file (totalLines)
    for (let i = 0; i < guardTags.length; i++) {
      const currentTag = guardTags[i];

      // Only process block-scoped guards that extend to end-of-file
      if (currentTag.scope === 'block' && !currentTag.lineCount && currentTag.scopeEnd === totalLines) {
        // Look for the next guard that changes the same target
        for (let j = i + 1; j < guardTags.length; j++) {
          const nextTag = guardTags[j];

          // Check if the next guard changes any of the same targets (and isn't a context guard)
          const currentAffectsAI = currentTag.aiPermission !== undefined;
          const currentAffectsHuman = currentTag.humanPermission !== undefined;
          const nextAffectsAI = nextTag.aiPermission !== undefined && !nextTag.aiIsContext;
          const nextAffectsHuman = nextTag.humanPermission !== undefined && !nextTag.humanIsContext;

          const affectsSameTarget = (currentAffectsAI && nextAffectsAI) || (currentAffectsHuman && nextAffectsHuman);

          if (affectsSameTarget) {
            // Update the current guard to end one line before the next guard
            const newEndLine = nextTag.lineNumber - 1;

            // Only update if it would shorten the scope
            if (newEndLine < currentTag.scopeEnd) {
              currentTag.scopeEnd = newEndLine;

              // Also trim trailing whitespace
              let lastContentLine = currentTag.scopeStart || currentTag.lineNumber;
              for (let line = newEndLine; line >= (currentTag.scopeStart || currentTag.lineNumber); line--) {
                const lineText = lines[line - 1];
                if (lineText.trim().length > 0) {
                  lastContentLine = line;
                  break;
                }
              }
              currentTag.scopeEnd = lastContentLine;

              // Also update the associated guard stack entry if it exists
              for (let k = 0; k < guardStack.length; k++) {
                if (guardStack[k].sourceGuard === currentTag) {
                  guardStack[k].endLine = lastContentLine;
                  break;
                }
              }

              if (debugEnabled && logger) {
                const currentPerms = [];
                if (currentTag.aiPermission) currentPerms.push(`ai:${currentTag.aiPermission}`);
                if (currentTag.humanPermission) currentPerms.push(`human:${currentTag.humanPermission}`);
                const nextPerms = [];
                if (nextTag.aiPermission) nextPerms.push(`ai:${nextTag.aiPermission}`);
                if (nextTag.humanPermission) nextPerms.push(`human:${nextTag.humanPermission}`);
                logger.log(`[GuardProcessor] Updated block scope end for ${currentPerms.join(', ')} at line ${currentTag.lineNumber} to end at line ${currentTag.scopeEnd} (before next ${nextPerms.join(', ')} guard at line ${nextTag.lineNumber})`);
              }
            }
            break; // Found the next guard for this target
          }
        }
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
  defaultPermissions: { [target: string]: string } = { ...DEFAULT_PERMISSIONS },
  debugEnabled: boolean = false,
  logger?: { log: (message: string) => void }
): Map<number, ProcessedLinePermission> {
  const linePermissions = new Map<number, ProcessedLinePermission>();

  // Initialize stack with default permissions covering the entire file
  // Use line 0 for defaults to avoid 0-based/1-based confusion
  const guardStack: GuardStackEntry[] = [{
    permissions: { ...defaultPermissions },
    isContext: { ai: false, human: false },
    startLine: 0,
    endLine: totalLines,
    isLineLimited: false
  }];

  // Process from line 0 (defaults) through all lines
  for (let line = 0; line <= totalLines; line++) {
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
        // IMPORTANT: We need to get permissions from the active scope at this line,
        // not from a block that might have ended
        let currentPermissions = { ...defaultPermissions };
        let currentContext: { ai: boolean; human: boolean } = { ai: false, human: false };

        // Find the appropriate permissions to inherit
        // Walk backwards through the stack to find the active guard for this line
        for (let i = guardStack.length - 1; i >= 0; i--) {
          const stackEntry = guardStack[i];
          if (line >= stackEntry.startLine && line <= stackEntry.endLine) {
            currentPermissions = { ...stackEntry.permissions };
            currentContext = {
              ai: stackEntry.isContext.ai || false,
              human: stackEntry.isContext.human || false
            };
            break;
          }
        }

        // Update permissions based on the guard tag
        // Check if aiPermission is set
        if (tag.aiPermission !== undefined) {
          currentPermissions.ai = tag.aiPermission;
        }
        // Always check context flag
        if (tag.aiIsContext) {
          currentContext.ai = true;
        }

        // Check if humanPermission is set
        if (tag.humanPermission !== undefined) {
          currentPermissions.human = tag.humanPermission;
        }
        // Always check context flag
        if (tag.humanIsContext) {
          currentContext.human = true;
        }

        // Note: Legacy tags are now handled by parseGuardTag directly

        const entry: GuardStackEntry = {
          permissions: currentPermissions,
          isContext: currentContext,
          startLine: tag.scopeStart || line,
          endLine: tag.scopeEnd || (tag.lineCount ? line + tag.lineCount - 1 : totalLines),
          isLineLimited: !!tag.lineCount,
          sourceGuard: tag
        };

        // DEBUG: Log context guard scope
        if ((tag.aiIsContext || tag.humanIsContext) && debugEnabled && logger) {
          logger.log(`[GuardProcessor] Context guard scope: startLine=${entry.startLine}, endLine=${entry.endLine}, scopeStart=${tag.scopeStart}, scopeEnd=${tag.scopeEnd}`);
        }

        if (debugEnabled && logger) {
          const permissions = [];
          if (tag.aiPermission) permissions.push(`ai:${tag.aiPermission}`);
          if (tag.humanPermission) permissions.push(`human:${tag.humanPermission}`);
          logger.log(`[GuardProcessor] Pushing guard to stack at line ${line}: ${JSON.stringify({
            permissions: permissions.join(', '),
            startLine: entry.startLine,
            endLine: entry.endLine,
            scopeStart: tag.scopeStart,
            scopeEnd: tag.scopeEnd,
            isContext: currentContext
          })}`);
        }

        // Before pushing new guard, remove any interrupted context guards
        removeInterruptedContextGuards(guardStack);
        guardStack.push(entry);
      }
    }

    // Determine effective permissions for this line
    if (guardStack.length > 0) {
      // Line 0 is special - it's the default permissions line
      const lineText = line === 0 ? '' : getLineText(line);
      const isWhitespaceOnly = lineText.trim().length === 0;

      // Get the current state from the stack
      const top = guardStack[guardStack.length - 1];
      if (line >= top.startLine && line <= top.endLine) {
        // Start with the top permissions
        let effectivePermissions = top.permissions;
        const effectiveIsContext = top.isContext;

        // Handle context guards first
        if ((top.isContext.ai || top.isContext.human)) {
          // Context guard is active
          if (debugEnabled && logger) {
            logger.log(`[GuardProcessor] Context guard active: line ${line}, guard range ${top.startLine}-${top.endLine}, isWhitespace=${isWhitespaceOnly}`);
          }

          // Context guard is active - ALL lines within the range get context marking
          // Collect all non-context permissions from applicable stack entries
          const nonContextPermissions: { [target: string]: string } = {};
          for (let i = guardStack.length - 1; i >= 0; i--) {
            const entry = guardStack[i];
            if (line >= entry.startLine && line <= entry.endLine) {
              // Add any non-context permissions we haven't seen yet
              for (const [target, permission] of Object.entries(entry.permissions)) {
                if (!nonContextPermissions[target]) {
                  nonContextPermissions[target] = permission;
                }
              }
            }
          }

          // If we found any non-context permissions, use them
          if (Object.keys(nonContextPermissions).length > 0) {
            effectivePermissions = nonContextPermissions;
          }
          // effectiveIsContext remains as set from top.isContext - applies to ALL lines
        } else if (isWhitespaceOnly) {
          // Non-context guard with whitespace - check for trailing whitespace
          let isTrailing = false;
          let nextGuardLine = -1;

          // Find the next guard that will start
          for (const tag of guardTags) {
            if (tag.lineNumber > line) {
              if (nextGuardLine === -1 || tag.lineNumber < nextGuardLine) {
                nextGuardLine = tag.lineNumber;
              }
            }
          }

          // Check if all lines between here and the next guard (or end of current guard) are empty
          if (nextGuardLine > 0 && nextGuardLine <= top.endLine) {
            isTrailing = true;
            for (let j = line; j < nextGuardLine && j <= top.endLine; j++) {
              if (getLineText(j).trim().length > 0) {
                isTrailing = false;
                break;
              }
            }
          }

          if (isTrailing && guardStack.length > 1) {
            // Don't apply trailing whitespace logic to file-scoped guards
            const currentGuard = top.sourceGuard;
            if (currentGuard && currentGuard.scope === 'file') {
              // File scope explicitly includes all whitespace - don't trim
              effectivePermissions = top.permissions;
            } else {
              // Use permissions from the stack entry below current
              const underlyingEntry = guardStack[guardStack.length - 2];
              effectivePermissions = underlyingEntry.permissions;
            }
          }
        }

        // Return the full permissions state for this line
        if (debugEnabled && logger) {
          const lineTextDebug = line === 0 ? '[DEFAULT]' : getLineText(line);
          const isEmpty = lineTextDebug.trim() === '' || lineTextDebug === '[DEFAULT]';
          if ((effectiveIsContext.ai || effectiveIsContext.human) || isEmpty) {
            logger.log(`[GuardProcessor] Line ${line} (${isEmpty ? 'EMPTY' : 'content'}): isContext=${JSON.stringify(effectiveIsContext)}, permissions=${JSON.stringify(effectivePermissions)}`);
          }
        }

        linePermissions.set(line, {
          permissions: effectivePermissions,
          isContext: effectiveIsContext
        });
      }
    } else {
      // No guards on stack - use defaults
      linePermissions.set(line, {
        permissions: defaultPermissions,
        isContext: { ai: false, human: false }
      });
    }
  }

  return linePermissions;
}

/**
 * Get default permissions (will be configurable via ACL tool in future)
 */
export function getDefaultPermissions(): { [target: string]: string } {
  return { ...DEFAULT_PERMISSIONS };
}

/**
 * Get line permissions for a document (used for decorations)
 * @param document The document to analyze
 * @param guardTags The parsed guard tags
 * @param config Configuration object
 * @param logger Optional logger for debug output
 * @returns Map of line numbers to their effective guard permission
 */
export function getLinePermissionsCore(
  document: IDocument,
  guardTags: GuardTag[],
  config: IConfiguration,
  logger?: { log: (message: string) => void }
): Map<number, LinePermission> {
  // Get debug flag from configuration
  const debugEnabled = config.get<boolean>('enableDebugLogging', false);

  const permissions = new Map<number, LinePermission>();
  const totalLines = document.lineCount;

  // Use the shared guard stack processing logic with explicit defaults
  const linePermissions = processGuardStack(
    guardTags,
    totalLines,
    (line) => line === 0 ? '' : document.lineAt(line - 1).text,
    getDefaultPermissions(),
    debugEnabled,
    logger
  );

  // Convert permissions dictionary to LinePermission map
  for (const [line, perms] of linePermissions) {
    permissions.set(line, {
      line: line,
      permissions: perms.permissions,
      isContext: perms.isContext,
      identifier: undefined
    });
  }

  return permissions;
}

// Export utility functions
export { parseGuardTag } from './acl';