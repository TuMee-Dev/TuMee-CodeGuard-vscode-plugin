/**
 * Core types for the parsing module - platform agnostic
 * No VSCode dependencies allowed in this module
 */

import type { Node, Tree } from 'web-tree-sitter';

/**
 * Generic document interface that can be implemented by any platform
 */
export interface IDocument {
  readonly text: string;
  readonly languageId: string;
  readonly lineCount: number;
  getText(): string;
  lineAt(line: number): ITextLine;
}

/**
 * Generic text line interface
 */
export interface ITextLine {
  readonly lineNumber: number;
  readonly text: string;
}

/**
 * Represents a scope boundary in the document
 */
export interface ScopeBoundary {
  startLine: number;
  endLine: number;
  type: string;
}

/**
 * Generic extension context interface for resource loading
 */
export interface IExtensionContext {
  extensionPath: string;
  asAbsolutePath(relativePath: string): string;
}

/**
 * Configuration interface for parsing behavior
 */
export interface IParsingConfig {
  enablePerformanceMonitoring?: boolean;
  maxFileSize?: number;
  chunkSize?: number;
}

/**
 * Result of parsing a document with tree-sitter
 */
export interface ParseResult {
  tree: Tree | null;
  languageId: string;
  success: boolean;
  error?: string;
}

/**
 * Node position information
 */
export interface NodePosition {
  row: number;
  column: number;
}

/**
 * Node boundaries information
 */
export interface NodeBoundaries {
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

// Re-export tree-sitter types for convenience
export type { Node, Tree } from 'web-tree-sitter';

/**
 * Default permissions for AI and human targets
 * These are used when no guard tags are present
 */
export const DEFAULT_PERMISSIONS = {
  ai: 'r',    // AI has read-only access by default
  human: 'w'  // Human has write access by default
} as const;

/**
 * Type for permission values
 */
export type PermissionValue = 'r' | 'w' | 'n';

/**
 * Type for permission targets
 */
export type PermissionTarget = 'ai' | 'human';

/**
 * Guard tag information
 */
export interface GuardTag {
  lineNumber: number;
  identifier?: string;
  scope?: string;
  lineCount?: number;
  addScopes?: string[];
  removeScopes?: string[];
  scopeStart?: number;
  scopeEnd?: number;
  // Store the actual permissions for each target
  aiPermission?: 'r' | 'w' | 'n' | 'contextWrite';
  humanPermission?: 'r' | 'w' | 'n' | 'contextWrite';
  // Track if permissions are context-based
  aiIsContext?: boolean;
  humanIsContext?: boolean;
}

/**
 * Line permission information
 */
export interface LinePermission {
  line: number;
  permissions: {
    [target: string]: string;  // e.g., { ai: 'w', human: 'r' }
  };
  isContext: {
    [target: string]: boolean;  // e.g., { ai: true, human: false }
  };
  identifier?: string;
  isTrailingWhitespace?: boolean;  // True if this is trailing whitespace at end of a guard scope
}

/**
 * Stack entry for guard processing - contains complete permission state
 */
export interface GuardStackEntry {
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
 * Core configuration interface
 */
export interface ICoreConfiguration {
  get<T>(key: string, defaultValue: T): T;
}