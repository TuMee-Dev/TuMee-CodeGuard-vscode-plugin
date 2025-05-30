/**
 * Guard scope boundary calculation and resolution logic
 * Handles semantic scope resolution, block detection, and guard boundary determination
 */

import type { GuardTag, ScopeBoundary } from '../types/guardTypes';
import { parseGuardTag } from './acl';
import { GuardProcessingError, ErrorSeverity } from './errorHandler';
import { isLineAComment } from './commentDetector';
import { resolveSemanticWithCache, type IDocument, type SemanticResolver } from './guardCache';

/**
 * Resolve semantic scope boundaries for a guard tag
 */
export async function resolveGuardScope(
  guardTag: GuardTag,
  lineNumber: number,
  totalLines: number,
  lines: string[],
  document: IDocument,
  semanticResolver: SemanticResolver,
  tagInfo: any,
  debugEnabled: boolean = false,
  logger?: { log: (message: string) => void }
): Promise<void> {
  const effectiveScope = guardTag.scope;

  // Handle semantic scope resolution
  if (effectiveScope && !guardTag.lineCount) {
    // Special handling for 'file' scope
    if (effectiveScope === 'file') {
      guardTag.scopeStart = lineNumber;
      guardTag.scopeEnd = totalLines;
    } else {
      try {
        const scopeBoundary = await resolveSemanticWithCache(
          document,
          lineNumber - 1,  // Convert to 0-based for the resolver
          effectiveScope,
          semanticResolver,
          tagInfo.addScopes,
          tagInfo.removeScopes
        );

        // Check if tree-sitter returned a meaningful block
        // For guards in comments with block scope, we should use tree-sitter's block
        // UNLESS it extends to end-of-file (suggesting no real block was found)
        const isGuardInComment = isLineAComment(lines[lineNumber - 1], document.languageId);
        let isMeaningfulBlock = scopeBoundary &&
          (scopeBoundary.startLine !== lineNumber || scopeBoundary.endLine !== totalLines);

        // For guards in comments with block scope, only use tree-sitter if it found a reasonable block
        // (not extending to end of file)
        if (isGuardInComment && effectiveScope === 'block' && scopeBoundary && scopeBoundary.endLine === totalLines) {
          isMeaningfulBlock = false;
        }

        if (isMeaningfulBlock && scopeBoundary) {
          guardTag.scopeStart = scopeBoundary.startLine;
          guardTag.scopeEnd = scopeBoundary.endLine;
          guardTag.lineCount = scopeBoundary.endLine - scopeBoundary.startLine + 1;
          if (debugEnabled && logger) {
            logger.log(`[GuardProcessor] Resolved ${effectiveScope} at line ${lineNumber}: start=${scopeBoundary.startLine}, end=${scopeBoundary.endLine}`);
          }
        } else {
          // No block found - for block scope, extend to next guard or end of file
          if (effectiveScope === 'block') {
            guardTag.scopeStart = lineNumber;
            // Find the next guard tag of any type
            let nextGuardLine = totalLines;
            for (let i = lineNumber + 1; i <= totalLines; i++) {
              if (isLineAComment(lines[i - 1], document.languageId)) {
                const nextTag = parseGuardTag(lines[i - 1]);
                if (nextTag) {
                  nextGuardLine = i - 1; // End just before the next guard
                  break;
                }
              }
            }

            // Trim trailing whitespace
            let effectiveEndLine = nextGuardLine;
            for (let i = nextGuardLine; i > lineNumber; i--) {
              const lineText = lines[i - 1];
              if (lineText.trim().length > 0) {
                effectiveEndLine = i;
                break;
              }
            }

            guardTag.scopeEnd = effectiveEndLine;
            if (debugEnabled) {
              console.warn(`[GuardProcessor] No ${effectiveScope} found for guard at line ${lineNumber}, extending to line ${effectiveEndLine} (trimmed from ${nextGuardLine})`);
            }
          } else {
            // For other scopes, apply only to current line
            if (debugEnabled) {
              console.warn(`[GuardProcessor] No ${effectiveScope} found for guard at line ${lineNumber}, applying to current line only`);
            }
            guardTag.scopeStart = lineNumber;
            guardTag.scopeEnd = lineNumber;
            guardTag.lineCount = 1;
          }
        }
      } catch (error) {
        console.error(`[GuardProcessor] Tree-sitter scope resolution failed at line ${lineNumber}:`, error);
        throw new GuardProcessingError(
          `Failed to resolve scope '${effectiveScope}' at line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`,
          ErrorSeverity.ERROR
        );
      }
    }
  }
}

/**
 * Determine guard boundaries based on guard type and resolved scope
 */
export function determineGuardBoundaries(
  guardTag: GuardTag,
  tagInfo: any,
  lineNumber: number,
  totalLines: number,
  lines: string[],
  document: IDocument,
  debugEnabled: boolean = false
): { startLine: number; endLine: number; isLineLimited: boolean } {
  let startLine = lineNumber;
  let endLine = totalLines;
  let isLineLimited = false;

  if (tagInfo.lineCount) {
    // Line-limited guard - starts from the guard tag line
    endLine = startLine + tagInfo.lineCount - 1;
    isLineLimited = true;
    guardTag.scopeStart = startLine;
    guardTag.scopeEnd = endLine;
  } else if (guardTag.scopeStart && guardTag.scopeEnd) {
    // Semantic scope - scope boundaries already set by resolver
    // For block/class/func scopes, the guard applies to the resolved scope
    // Don't overwrite the resolved boundaries!
    startLine = guardTag.scopeStart;
    endLine = guardTag.scopeEnd;
  } else if (tagInfo.aiIsContext || tagInfo.humanIsContext) {
    // Context guards without explicit scope extend until the next guard
    guardTag.scopeStart = lineNumber;
    // Find the next guard tag
    let nextGuardLine = totalLines;
    for (let i = lineNumber + 1; i <= totalLines; i++) {
      if (isLineAComment(lines[i - 1], document.languageId)) {
        const nextTag = parseGuardTag(lines[i - 1]);
        if (nextTag) {
          nextGuardLine = i - 1; // End just before the next guard
          break;
        }
      }
    }
    guardTag.scopeEnd = nextGuardLine;
    startLine = guardTag.scopeStart;
    endLine = guardTag.scopeEnd;
  } else {
    // No scope specified - guard only applies to current line
    if (debugEnabled) {
      console.warn(`[GuardProcessor] No scope resolution for line ${lineNumber} - using line-only fallback`);
    }
    guardTag.scopeStart = lineNumber;
    guardTag.scopeEnd = lineNumber;
    startLine = lineNumber;
    endLine = lineNumber;
  }

  return { startLine, endLine, isLineLimited };
}

/**
 * Find the next guard line after a given line number
 */
export function findNextGuardLine(
  lineNumber: number,
  totalLines: number,
  lines: string[],
  document: IDocument
): number {
  for (let i = lineNumber + 1; i <= totalLines; i++) {
    if (isLineAComment(lines[i - 1], document.languageId)) {
      const nextTag = parseGuardTag(lines[i - 1]);
      if (nextTag) {
        return i - 1; // End just before the next guard
      }
    }
  }
  return totalLines;
}

/**
 * Trim trailing whitespace from a guard scope
 */
export function trimTrailingWhitespace(
  startLine: number,
  endLine: number,
  lines: string[]
): number {
  let effectiveEndLine = endLine;
  for (let i = endLine; i > startLine; i--) {
    const lineText = lines[i - 1];
    if (lineText.trim().length > 0) {
      effectiveEndLine = i;
      break;
    }
  }
  return effectiveEndLine;
}