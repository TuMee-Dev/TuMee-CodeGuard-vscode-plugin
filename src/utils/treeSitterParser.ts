import * as vscode from 'vscode';
import { Parser, Language, type Tree, type Node, type Point } from 'web-tree-sitter';

// Tree-sitter parser instance
let parser: Parser | null = null;
let parserInitialized = false;
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
  'scala': 'tree-sitter-scala.wasm',
  'haskell': 'tree-sitter-haskell.wasm',
  'lua': 'tree-sitter-lua.wasm',
  'perl': 'tree-sitter-perl.wasm',
  'r': 'tree-sitter-r.wasm',
  'dart': 'tree-sitter-dart.wasm',
  'julia': 'tree-sitter-julia.wasm',
  'elixir': 'tree-sitter-elixir.wasm',
  'ocaml': 'tree-sitter-ocaml.wasm',
  'zig': 'tree-sitter-zig.wasm',
  'nim': 'tree-sitter-nim.wasm',
  'bash': 'tree-sitter-bash.wasm',
  'yaml': 'tree-sitter-yaml.wasm',
  'json': 'tree-sitter-json.wasm',
  'html': 'tree-sitter-html.wasm',
  'css': 'tree-sitter-css.wasm',
  'scss': 'tree-sitter-scss.wasm',
  'sql': 'tree-sitter-sql.wasm',
  'graphql': 'tree-sitter-graphql.wasm',
  'dockerfile': 'tree-sitter-dockerfile.wasm',
  'hcl': 'tree-sitter-hcl.wasm',
  'nix': 'tree-sitter-nix.wasm',
  'vue': 'tree-sitter-vue.wasm',
  'markdown': 'tree-sitter-markdown.wasm',
  'toml': 'tree-sitter-toml.wasm',
  'xml': 'tree-sitter-xml.wasm',
  'latex': 'tree-sitter-latex.wasm',
  'solidity': 'tree-sitter-solidity.wasm',
  'proto': 'tree-sitter-proto.wasm',
  'erlang': 'tree-sitter-erlang.wasm',
  'clojure': 'tree-sitter-clojure.wasm',
  'objc': 'tree-sitter-objc.wasm',
  'objcpp': 'tree-sitter-objcpp.wasm',
  'v': 'tree-sitter-v.wasm',
  'fortran': 'tree-sitter-fortran.wasm',
  'ada': 'tree-sitter-ada.wasm',
  'scheme': 'tree-sitter-scheme.wasm',
  'racket': 'tree-sitter-racket.wasm',
  'pascal': 'tree-sitter-pascal.wasm',
  'd': 'tree-sitter-d.wasm',
  'elm': 'tree-sitter-elm.wasm',
  'purescript': 'tree-sitter-purescript.wasm',
  'fsharp': 'tree-sitter-fsharp.wasm',
  'verilog': 'tree-sitter-verilog.wasm',
  'vhdl': 'tree-sitter-vhdl.wasm',
  'cmake': 'tree-sitter-cmake.wasm',
  'makefile': 'tree-sitter-make.wasm',
  'asm': 'tree-sitter-asm.wasm',
  'wasm': 'tree-sitter-wast.wasm',
  'glsl': 'tree-sitter-glsl.wasm',
  'hlsl': 'tree-sitter-hlsl.wasm',
};

// Language ID mappings (VSCode language ID to tree-sitter language)
const LANGUAGE_ID_MAPPINGS: Record<string, string> = {
  'typescriptreact': 'tsx',
  'javascriptreact': 'javascript',
  'shellscript': 'bash',
  'objective-c': 'objc',
  'objective-cpp': 'objcpp',
  'c_sharp': 'csharp',
  'c++': 'cpp',
};

/**
 * Initialize the tree-sitter parser
 */
export async function initializeTreeSitter(context: vscode.ExtensionContext): Promise<void> {
  if (parserInitialized) return;

  try {
    // Initialize the parser with locateFile option to find the tree-sitter.wasm file
    await Parser.init({
      locateFile: (scriptName: string) => {
        // For web-tree-sitter, we need to point to the WASM file
        if (scriptName === 'tree-sitter.wasm') {
          // Check if we're in VSCode environment or CLI
          if (context.extensionUri) {
            // In VSCode extensions, we can use the extensionUri
            return vscode.Uri.joinPath(context.extensionUri, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm').toString();
          } else if (context.extensionPath) {
            // In CLI environment, use path.join
            const path = require('path');
            return path.join(context.extensionPath, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm');
          }
        }
        return scriptName;
      }
    });
    parser = new Parser();
    parserInitialized = true;
  } catch (error) {
    console.error('Failed to initialize tree-sitter:', error);
    parser = null;
  }
}

/**
 * Get or load the language parser for a given language
 */
async function getLanguageParser(context: vscode.ExtensionContext, languageId: string): Promise<Language | null> {
  if (!parser) return null;

  // Map VSCode language ID to tree-sitter language
  const language = LANGUAGE_ID_MAPPINGS[languageId] || languageId;

  // Check if we already have this parser loaded
  const cachedLanguage = languageParsers.get(language);
  if (cachedLanguage) {
    return cachedLanguage;
  }

  // Get the WASM file name
  const wasmFile = LANGUAGE_WASM_FILES[language];
  if (!wasmFile) {
    console.warn(`No tree-sitter parser available for language: ${language}`);
    return null;
  }

  try {
    // Try to load from the extension's resources
    let wasmBytes: ArrayBuffer;

    if (context.extensionUri) {
      // VSCode environment
      const wasmPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'tree-sitter-wasm', wasmFile);
      try {
        const wasmData = await vscode.workspace.fs.readFile(wasmPath);
        wasmBytes = wasmData.buffer;
      } catch {
        // If local file doesn't exist, return null to gracefully fall back to regex
        return null;
      }
    } else if (context.extensionPath) {
      // CLI environment
      const path = require('path');
      const fs = require('fs');
      const wasmPath = path.join(context.extensionPath, 'resources', 'tree-sitter-wasm', wasmFile);
      try {
        const wasmData = fs.readFileSync(wasmPath);
        wasmBytes = wasmData.buffer;
      } catch {
        // If local file doesn't exist, return null to gracefully fall back to regex
        return null;
      }
    } else {
      return null;
    }

    const languageObj = await Language.load(new Uint8Array(wasmBytes));
    languageParsers.set(language, languageObj);
    return languageObj;
  } catch (error) {
    console.error(`Failed to load tree-sitter language for ${language}:`, error);
    return null;
  }
}

/**
 * Parse a document using tree-sitter
 */
export async function parseDocument(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument
): Promise<Tree | null> {
  if (!parser || !parserInitialized) {
    await initializeTreeSitter(context);
    if (!parser) return null;
  }

  const language = await getLanguageParser(context, document.languageId);
  if (!language) return null;

  try {
    parser.setLanguage(language);
    const tree = parser.parse(document.getText());
    return tree;
  } catch (error) {
    console.error('Failed to parse document with tree-sitter:', error);
    return null;
  }
}

/**
 * Find a node at a specific position
 */
export function findNodeAtPosition(
  tree: Tree,
  line: number,
  column: number = 0
): Node | null {
  const point: Point = { row: line, column };
  return tree.rootNode.descendantForPosition(point);
}

/**
 * Find the nearest parent node of a specific type
 */
export function findParentOfType(
  node: Node,
  types: string[]
): Node | null {
  let current: Node | null = node;
  while (current) {
    if (types.includes(current.type)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Get the scope boundaries from a syntax node
 */
export function getNodeBoundaries(node: Node): { startLine: number; endLine: number } {
  // Tree-sitter's endPosition points to the position AFTER the last character
  // This is inclusive of the last character, so we don't need to adjust
  return {
    startLine: node.startPosition.row + 1,  // Convert to 1-based line numbers
    endLine: node.endPosition.row + 1      // Convert to 1-based line numbers
  };
}

/**
 * Find all nodes of a specific type within a node
 */
export function findNodesOfType(
  node: Node,
  types: string[]
): Node[] {
  const results: Node[] = [];

  function traverse(n: Node) {
    if (types.includes(n.type)) {
      results.push(n);
    }
    for (const child of n.children) {
      if (child) traverse(child);
    }
  }

  traverse(node);
  return results;
}

/**
 * Cleanup parser resources
 */
export function cleanupTreeSitter(): void {
  if (parser) {
    parser = null;
  }
  languageParsers.clear();
  parserInitialized = false;
}