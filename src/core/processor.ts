/**
 * Core guard processing logic - platform agnostic
 * Main processing pipeline for parsing and processing guard tags
 * No VSCode dependencies allowed in this module
 */

import type { GuardTag, LinePermission, ICoreConfiguration, IDocument, GuardStackEntry, DEFAULT_PERMISSIONS } from './types';
import { parseGuardTag } from './guardParser';
import { GuardProcessingError, ErrorSeverity, type ILogger, consoleLogger } from './errorHandler';
import { isLineAComment } from './commentDetector';
import { 
  popGuardWithContextCleanup,
  removeInterruptedContextGuards,
  createGuardStackEntry 
} from './guardStackManager';
import { resolveSemanticScope } from './scopeResolver';

/**
 * Determine the default scope for a guard tag based on its properties
 */
function getDefaultScope(tagInfo: any): string | undefined {
  // If there's a line count, don't set a default scope
  if (tagInfo.lineCount) {
    return undefined;
  }
  
  // Check if this is a context permission (either context flag or contextWrite permission)
  const isContextPermission = 
    tagInfo.aiIsContext || 
    tagInfo.humanIsContext ||
    tagInfo.aiPermission === 'contextWrite' ||
    tagInfo.humanPermission === 'contextWrite';
  
  if (isContextPermission) {
    return 'context';
  }
  
  // Default to block scope for other permissions
  return 'block';
}

/**
 * Get default permissions
 */
export function getDefaultPermissions(): { [target: string]: string } {
  return { ai: 'r', human: 'w' };
}

/**
 * Basic guard tag parsing for a document
 * This is a simplified version focusing on core parsing logic
 */
export async function parseGuardTagsCore(
  document: IDocument,
  lines: string[],
  config: ICoreConfiguration,
  extensionContext?: any,
  logger: ILogger = consoleLogger
): Promise<GuardTag[]> {
  const guardTags: GuardTag[] = [];
  const totalLines = lines.length;

  // Parse each line for guard tags
  for (let i = 0; i < totalLines; i++) {
    const lineNumber = i + 1; // Convert to 1-based indexing
    const line = lines[i];

    try {
      const tagInfo = parseGuardTag(line);
      
      if (tagInfo) {
        // Create guard tag with core processing
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

        // Set scope boundaries - simplified logic
        if (guardTag.lineCount) {
          // Line count based scope
          guardTag.scopeStart = lineNumber;
          guardTag.scopeEnd = Math.min(lineNumber + guardTag.lineCount - 1, totalLines);
        } else if (guardTag.scope === 'context') {
          // Context scope - find next non-comment lines
          guardTag.scopeStart = lineNumber + 1;
          let endLine = lineNumber;
          
          for (let searchLine = lineNumber; searchLine < totalLines; searchLine++) {
            const searchLineText = lines[searchLine].trim();
            
            // Stop at next guard tag
            if (searchLineText.includes('@guard:')) {
              if (searchLine > lineNumber) break;
              continue;
            }
            
            // Include comments in context
            if (isLineAComment(searchLineText, document.languageId)) {
              endLine = searchLine + 1;
            } else if (searchLineText === '') {
              // For blank lines, check what comes immediately after
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
                  // Next non-empty line is a guard tag, don't include this blank line
                  break;
                } else {
                  // Include this blank line and continue processing
                  endLine = searchLine + 1;
                }
              } else {
                // No more non-empty lines (EOF), don't include trailing blank line
                // Don't update endLine, just continue to next iteration
              }
            } else {
              // Stop at actual code (functions, classes, variable declarations, etc.)
              break;
            }
          }
          
          guardTag.scopeEnd = Math.max(endLine, lineNumber);
        } else {
          // Use semantic scope resolution for block and other scopes
          const scope = guardTag.scope || 'block';
          
          // For block scopes, use statement-by-statement resolution
          // This gives the expected behavior: consecutive lines until blank line or next guard
          if (scope === 'block') {
            const startLineNumber = lineNumber + 1; // Start from line after guard (1-based)
            let endLineNumber = startLineNumber;
            
            // Get lines as text
            const allLines = document.text.split('\n');
            
            // Scan forward to find the end of the statement block
            for (let currentLine = startLineNumber - 1; currentLine < allLines.length; currentLine++) {
              const lineText = allLines[currentLine].trim();
              
              // Stop at blank lines
              if (lineText === '') {
                break;
              }
              
              // Stop at guard tags
              if (lineText.includes('@guard:')) {
                break;
              }
              
              // Include this line in the block
              endLineNumber = currentLine + 1; // Convert to 1-based
            }
            
            guardTag.scopeStart = startLineNumber;
            guardTag.scopeEnd = endLineNumber;
          } else {
            // For other scopes, try semantic resolution if available
            const boundary = extensionContext ? 
              await resolveSemanticScope(document, lineNumber - 1, scope, extensionContext) :
              null;
            
            if (boundary) {
              guardTag.scopeStart = boundary.startLine;
              guardTag.scopeEnd = boundary.endLine;
            } else {
              // Fallback to single line
              guardTag.scopeStart = lineNumber;
              guardTag.scopeEnd = lineNumber;
            }
          }
        }

        guardTags.push(guardTag);
        
        logger.log(`[Core] Parsed guard tag at line ${lineNumber}: ${JSON.stringify(guardTag)}`);
      }
    } catch (error) {
      const guardError = new GuardProcessingError(
        `Failed to parse guard tag at line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`,
        ErrorSeverity.WARNING,
        { line: lineNumber, lineText: line }
      );
      
      logger.warn(`[Core] ${guardError.message}`);
    }
  }

  return guardTags;
}

/**
 * Get line permissions for a document - core logic
 */
export function getLinePermissionsCore(
  document: IDocument,
  guardTags: GuardTag[],
  config: ICoreConfiguration,
  logger: ILogger = consoleLogger
): Map<number, LinePermission> {
  const linePermissions = new Map<number, LinePermission>();
  const guardStack: GuardStackEntry[] = [];
  const totalLines = document.lineCount;

  // Initialize with default permissions
  const defaultPerms = getDefaultPermissions();
  
  // Process each line
  for (let lineNumber = 1; lineNumber <= totalLines; lineNumber++) {
    // Check if any guards end at this line
    while (guardStack.length > 0 && guardStack[guardStack.length - 1].endLine < lineNumber) {
      popGuardWithContextCleanup(guardStack);
    }

    // Check if any guards start at this line
    const guardsAtLine = guardTags.filter(tag => tag.lineNumber === lineNumber);
    
    for (const guard of guardsAtLine) {
      if (guard.scopeStart && guard.scopeEnd) {
        // Create permissions object
        const permissions: { [target: string]: string } = {};
        const isContext: { [target: string]: boolean } = {};
        
        // Set AI permissions
        if (guard.aiPermission) {
          permissions.ai = guard.aiPermission;
          isContext.ai = guard.aiPermission === 'contextWrite' || !!guard.aiIsContext;
        } else if (guard.aiIsContext) {
          // Handle context-only guards like @guard:ai:context (no explicit permission)
          // Default to read permission with context flag
          permissions.ai = 'r';
          isContext.ai = true;
        }
        
        // Set human permissions  
        if (guard.humanPermission) {
          permissions.human = guard.humanPermission;
          isContext.human = guard.humanPermission === 'contextWrite' || !!guard.humanIsContext;
        } else if (guard.humanIsContext) {
          // Handle context-only guards like @guard:human:context (no explicit permission)
          // Default to read permission with context flag
          permissions.human = 'r';
          isContext.human = true;
        }

        // Push to stack
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

    // Determine current permissions (top of stack or default)
    let currentPermissions = { ...defaultPerms };
    let currentIsContext: { [target: string]: boolean } = {};
    
    if (guardStack.length > 0) {
      const topStack = guardStack[guardStack.length - 1];
      currentPermissions = { ...currentPermissions, ...topStack.permissions };
      currentIsContext = { ...topStack.isContext };
    }

    // Set line permissions
    linePermissions.set(lineNumber, {
      line: lineNumber,
      permissions: currentPermissions,
      isContext: currentIsContext
    });
  }

  logger.log(`[Core] Processed ${linePermissions.size} line permissions`);
  return linePermissions;
}

/**
 * Process document and return both guard tags and line permissions
 */
export async function processDocument(
  document: IDocument,
  config: ICoreConfiguration,
  semanticResolver?: (document: IDocument, line: number, scope: string) => Promise<any>,
  logger: ILogger = consoleLogger
): Promise<{
  guardTags: GuardTag[];
  linePermissions: Map<number, LinePermission>;
}> {
  // Split document into lines
  const lines = document.getText().split('\n');
  
  // Parse guard tags
  const guardTags = await parseGuardTagsCore(document, lines, config, semanticResolver, logger);
  
  // Calculate line permissions
  const linePermissions = getLinePermissionsCore(document, guardTags, config, logger);
  
  return {
    guardTags,
    linePermissions
  };
}