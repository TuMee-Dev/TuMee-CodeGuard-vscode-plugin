/**
 * WASM-compatible version of the processor without tree-sitter dependencies
 */

import type { GuardTag, LinePermission, ICoreConfiguration, IDocument } from './types';
import { parseGuardTag } from './guardParser';
import { isLineAComment } from './commentDetector';
import { 
  popGuardWithContextCleanup,
  createGuardStackEntry 
} from './guardStackManager';

/**
 * Determine the default scope for a guard tag based on its properties
 */
function getDefaultScope(tagInfo: any): string | undefined {
  if (tagInfo.lineCount) {
    return undefined;
  }
  
  const isContextPermission = 
    tagInfo.aiIsContext || 
    tagInfo.humanIsContext ||
    tagInfo.aiPermission === 'contextWrite' ||
    tagInfo.humanPermission === 'contextWrite';
  
  if (isContextPermission) {
    return 'context';
  }
  
  return 'block';
}

/**
 * Get default permissions
 */
export function getDefaultPermissions(): { [target: string]: string } {
  return { ai: 'r', human: 'w' };
}

/**
 * Parse guard tags without semantic scope resolution (WASM-compatible)
 */
export async function parseGuardTagsCore(
  document: IDocument,
  lines: string[]
): Promise<GuardTag[]> {
  const guardTags: GuardTag[] = [];
  const totalLines = lines.length;

  for (let i = 0; i < totalLines; i++) {
    const lineNumber = i + 1;
    const line = lines[i];

    const tagInfo = parseGuardTag(line);
    
    if (tagInfo) {
      const guardTag: GuardTag = {
        lineNumber: lineNumber,
        identifier: tagInfo.identifier,
        scope: tagInfo.scope || getDefaultScope(tagInfo),
        lineCount: tagInfo.lineCount,
        addScopes: tagInfo.addScopes,
        removeScopes: tagInfo.removeScopes,
        aiPermission: tagInfo.aiPermission as 'r' | 'w' | 'n' | undefined,
        humanPermission: tagInfo.humanPermission as 'r' | 'w' | 'n' | undefined,
        aiIsContext: tagInfo.aiIsContext,
        humanIsContext: tagInfo.humanIsContext
      };

      // Set scope boundaries without tree-sitter
      if (guardTag.lineCount) {
        guardTag.scopeStart = lineNumber;
        guardTag.scopeEnd = Math.min(lineNumber + guardTag.lineCount - 1, totalLines);
      } else if (guardTag.scope === 'context') {
        // Context scope logic (same as before)
        guardTag.scopeStart = lineNumber + 1;
        let endLine = lineNumber;
        
        for (let searchLine = lineNumber; searchLine < totalLines; searchLine++) {
          const searchLineText = lines[searchLine].trim();
          
          if (searchLineText.includes('@guard:')) {
            if (searchLine > lineNumber) break;
            continue;
          }
          
          if (isLineAComment(searchLineText, document.languageId)) {
            endLine = searchLine + 1;
          } else if (searchLineText === '') {
            let nextNonEmptyLineIndex = -1;
            for (let lookAhead = searchLine + 1; lookAhead < totalLines; lookAhead++) {
              const nextLineText = lines[lookAhead].trim();
              if (nextLineText !== '') {
                nextNonEmptyLineIndex = lookAhead;
                break;
              }
            }
            
            if (nextNonEmptyLineIndex !== -1) {
              const nextNonEmptyLine = lines[nextNonEmptyLineIndex].trim();
              if (nextNonEmptyLine.includes('@guard:')) {
                break;
              } else {
                endLine = searchLine + 1;
              }
            }
          } else {
            break;
          }
        }
        
        guardTag.scopeEnd = Math.max(endLine, lineNumber);
      } else {
        // Simple block scope without tree-sitter
        const startLineNumber = lineNumber + 1;
        let endLineNumber = startLineNumber;
        
        for (let currentLine = startLineNumber - 1; currentLine < lines.length; currentLine++) {
          const lineText = lines[currentLine].trim();
          
          if (lineText === '') {
            break;
          }
          
          if (lineText.includes('@guard:')) {
            break;
          }
          
          endLineNumber = currentLine + 1;
        }
        
        guardTag.scopeStart = startLineNumber;
        guardTag.scopeEnd = endLineNumber;
      }

      guardTags.push(guardTag);
    }
  }

  return guardTags;
}

/**
 * Get line permissions for a document
 */
export function getLinePermissionsCore(
  document: IDocument,
  guardTags: GuardTag[]
): Map<number, LinePermission> {
  const linePermissions = new Map<number, LinePermission>();
  const guardStack: any[] = [];
  const totalLines = document.lineCount;

  const defaultPerms = getDefaultPermissions();
  
  for (let lineNumber = 1; lineNumber <= totalLines; lineNumber++) {
    while (guardStack.length > 0 && guardStack[guardStack.length - 1].endLine < lineNumber) {
      popGuardWithContextCleanup(guardStack);
    }

    const guardsAtLine = guardTags.filter(tag => tag.lineNumber === lineNumber);
    
    for (const guard of guardsAtLine) {
      if (guard.scopeStart && guard.scopeEnd) {
        const permissions: { [target: string]: string } = {};
        const isContext: { [target: string]: boolean } = {};
        
        if (guard.aiPermission) {
          permissions.ai = guard.aiPermission;
          isContext.ai = guard.aiPermission === 'contextWrite' || !!guard.aiIsContext;
        } else if (guard.aiIsContext) {
          permissions.ai = 'r';
          isContext.ai = true;
        }
        
        if (guard.humanPermission) {
          permissions.human = guard.humanPermission;
          isContext.human = guard.humanPermission === 'contextWrite' || !!guard.humanIsContext;
        } else if (guard.humanIsContext) {
          permissions.human = 'r';
          isContext.human = true;
        }

        const stackEntry = createGuardStackEntry(
          permissions,
          isContext,
          guard.scopeStart,
          guard.scopeEnd,
          !!guard.lineCount,
          guard
        );
        
        guardStack.push(stackEntry);
      }
    }

    let currentPermissions = { ...defaultPerms };
    let currentIsContext: { [target: string]: boolean } = {};
    
    if (guardStack.length > 0) {
      const topStack = guardStack[guardStack.length - 1];
      currentPermissions = { ...currentPermissions, ...topStack.permissions };
      currentIsContext = { ...topStack.isContext };
    }

    linePermissions.set(lineNumber, {
      line: lineNumber,
      permissions: currentPermissions,
      isContext: currentIsContext
    });
  }

  return linePermissions;
}