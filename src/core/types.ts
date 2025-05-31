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