/**
 * VSCode adapter for core guard processing logic 
 * Delegates to core module - no local processing logic
 */

import type { GuardTag, LinePermission, ScopeBoundary } from '../types/guardTypes';
import { DEFAULT_PERMISSIONS } from '../types/guardTypes';
import { 
  parseGuardTagsCore as coreParseGuardTags,
  getLinePermissionsCore as coreGetLinePermissions,
  processDocument as coreProcessDocument,
  parseGuardTag,
  type ICoreConfiguration,
  type ILogger,
  consoleLogger
} from '../core';
import { VSCodeDocumentAdapter } from '../vscode/documentAdapter';
import { VSCodeConfigurationAdapter, type IConfiguration } from '../vscode/configAdapter';

// Import cache management for backward compatibility
import { 
  clearScopeCache as clearScopeCacheCore, 
  markLinesModified as markLinesModifiedCore, 
  resolveSemanticWithCache,
  type IDocument,
  type ITextLine,
  type SemanticResolver
} from './guardCache';

// Re-export types for backward compatibility
export type { IDocument, ITextLine, SemanticResolver } from './guardCache';
export type { GuardStackEntry } from '../core';
export type { IConfiguration } from '../vscode/configAdapter';

// Re-export cache functions for external use
export { clearScopeCache, markLinesModified } from './guardCache';

// Re-export core functions for backward compatibility
export { parseGuardTag };

/**
 * VSCode logger adapter
 */
class VSCodeLoggerAdapter implements ILogger {
  constructor(private logger?: { log: (message: string) => void }) {}
  
  log(message: string): void {
    this.logger?.log(message) || console.log(message);
  }
  
  warn(message: string): void {
    this.logger?.log(`[WARN] ${message}`) || console.warn(message);
  }
  
  error(message: string): void {
    this.logger?.log(`[ERROR] ${message}`) || console.error(message);
  }
}

/**
 * Parse guard tags from document lines - delegates to core module
 */
export async function parseGuardTagsCore(
  document: IDocument,
  lines: string[],
  config: IConfiguration,
  semanticResolver: SemanticResolver,
  logger?: { log: (message: string) => void }
): Promise<GuardTag[]> {
  // Delegate to core module
  const docAdapter = new VSCodeDocumentAdapter(document as any);
  const configAdapter = new VSCodeConfigurationAdapter(config);
  const loggerAdapter = new VSCodeLoggerAdapter(logger);
  
  // Need to get the extension context for semantic resolution
  const extensionContext = (global as any).extensionContext;
  
  return await coreParseGuardTags(docAdapter, lines, configAdapter, extensionContext, loggerAdapter);
}

/**
 * Get default permissions - delegates to core module
 */
export function getDefaultPermissions(): { [target: string]: string } {
  return { ...DEFAULT_PERMISSIONS };
}

/**
 * Get line permissions for a document - delegates to core module
 */
export function getLinePermissionsCore(
  document: IDocument,
  guardTags: GuardTag[],
  config: IConfiguration,
  logger?: { log: (message: string) => void }
): Map<number, LinePermission> {
  // Delegate to core module
  const docAdapter = new VSCodeDocumentAdapter(document as any);
  const configAdapter = new VSCodeConfigurationAdapter(config);
  const loggerAdapter = new VSCodeLoggerAdapter(logger);
  
  return coreGetLinePermissions(docAdapter, guardTags, configAdapter, loggerAdapter);
}