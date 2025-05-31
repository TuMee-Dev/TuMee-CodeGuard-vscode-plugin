/**
 * Core tree-sitter parsing logic - platform agnostic
 * No VSCode dependencies allowed in this module
 */

import { Parser, Language, type Tree, type Node } from 'web-tree-sitter';
import type { IDocument, IExtensionContext, ParseResult, NodeBoundaries } from './types';

// Tree-sitter parser instance
let parser: Parser | null = null;
let parserInitialized = false;
let parserInitializing: Promise<void> | null = null;
const languageParsers: Map<string, Language> = new Map();

// Language to WASM file mappings
const LANGUAGE_WASM_FILES: Record<string, string> = {
  'javascript': 'tree-sitter-javascript.wasm',
  'typescript': 'tree-sitter-typescript.wasm',
  'tsx': 'tree-sitter-tsx.wasm',
  'python': 'tree-sitter-python.wasm',
  'java': 'tree-sitter-java.wasm',
  'csharp': 'tree-sitter-c_sharp.wasm',
  'c': 'tree-sitter-c.wasm',
  'cpp': 'tree-sitter-cpp.wasm',
  'go': 'tree-sitter-go.wasm',
  'rust': 'tree-sitter-rust.wasm',
  'ruby': 'tree-sitter-ruby.wasm',
  'php': 'tree-sitter-php.wasm',
  'swift': 'tree-sitter-swift.wasm',
  'kotlin': 'tree-sitter-kotlin.wasm',
};

/**
 * Initialize tree-sitter parser with platform-specific context
 */
export async function initializeTreeSitter(context: IExtensionContext): Promise<void> {
  if (parserInitialized) return;
  if (parserInitializing) return parserInitializing;

  parserInitializing = (async () => {
    try {
      // Initialize the parser with locateFile option to find the tree-sitter.wasm file
      await Parser.init({
        locateFile: (scriptName: string) => {
          // For web-tree-sitter, we need to point to the WASM file
          if (scriptName === 'tree-sitter.wasm') {
            // Use the extension context to find the WASM file
            return context.asAbsolutePath('node_modules/web-tree-sitter/tree-sitter.wasm');
          }
          return scriptName;
        }
      });
      parser = new Parser();
      parserInitialized = true;
    } catch (error) {
      console.error('Failed to initialize tree-sitter:', error);
      throw error;
    }
  })();

  return parserInitializing;
}

/**
 * Load a language parser for the given language ID
 */
export async function loadLanguageParser(
  languageId: string, 
  context: IExtensionContext
): Promise<Language | null> {
  if (!parser) {
    throw new Error('Tree-sitter parser not initialized');
  }

  // Check if already loaded
  if (languageParsers.has(languageId)) {
    return languageParsers.get(languageId)!;
  }

  const wasmFile = LANGUAGE_WASM_FILES[languageId];
  if (!wasmFile) {
    return null; // Language not supported
  }

  try {
    const wasmPath = context.asAbsolutePath(`resources/tree-sitter-wasm/${wasmFile}`);
    const language = await Language.load(wasmPath);
    languageParsers.set(languageId, language);
    return language;
  } catch (error) {
    console.error(`Failed to load language parser for ${languageId}:`, error);
    return null;
  }
}

/**
 * Parse a document using tree-sitter
 */
export async function parseDocument(
  context: IExtensionContext,
  document: IDocument
): Promise<Tree | null> {
  if (!parser) {
    await initializeTreeSitter(context);
  }

  const language = await loadLanguageParser(document.languageId, context);
  if (!language || !parser) {
    return null;
  }

  try {
    parser.setLanguage(language);
    const tree = parser.parse(document.text);
    return tree;
  } catch (error) {
    console.error(`Failed to parse document (${document.languageId}):`, error);
    return null;
  }
}

/**
 * Find the tree-sitter node at a specific line position
 */
export function findNodeAtPosition(tree: Tree, line: number): Node | null {
  if (!tree || !tree.rootNode) return null;

  try {
    // Convert 0-based line to tree-sitter position
    const position = { row: line, column: 0 };
    const node = tree.rootNode.namedDescendantForPosition(position, position);
    return node;
  } catch (error) {
    console.error(`Failed to find node at line ${line}:`, error);
    return null;
  }
}

/**
 * Find the nearest parent node of specified types
 */
export function findParentOfType(node: Node, nodeTypes: string[]): Node | null {
  let current: Node | null = node;
  
  while (current) {
    if (nodeTypes.includes(current.type)) {
      return current;
    }
    current = current.parent;
  }
  
  return null;
}

/**
 * Get the boundaries of a tree-sitter node
 */
export function getNodeBoundaries(node: Node): NodeBoundaries {
  const startLine = node.startPosition.row + 1; // Convert to 1-based
  let endLine = node.endPosition.row + 1; // Convert to 1-based

  // Handle the case where endPosition.column is 0 (exclusive end)
  // This means the node actually ends on the previous line
  if (node.endPosition.column === 0 && endLine > startLine) {
    endLine = endLine - 1;
  }

  return {
    startLine,
    endLine,
    startColumn: node.startPosition.column,
    endColumn: node.endPosition.column
  };
}

/**
 * Check if tree-sitter is initialized
 */
export function isTreeSitterInitialized(): boolean {
  return parserInitialized;
}

/**
 * Get the list of supported languages
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_WASM_FILES);
}