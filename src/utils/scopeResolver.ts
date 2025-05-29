import type * as vscode from 'vscode';
import { getLanguagePatterns, UTILITY_PATTERNS, GUARD_TAG_PREFIX } from './regexCache';
import { parseDocument, findNodeAtPosition, findParentOfType, getNodeBoundaries, initializeTreeSitter } from './treeSitterParser';
import type { Node, Tree } from 'web-tree-sitter';
import { DebugLogger } from './debugLogger';

// Common patterns shared across languages
const COMMON_BLOCKS = ['if_statement', 'for_statement', 'while_statement', 'try_statement', 'switch_statement'];
const JS_BLOCKS = ['statement_block', 'object', 'object_expression', 'array', 'array_expression'];
const JS_FUNCS = ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'];
const JS_CLASSES = ['class_declaration', 'class_expression', 'object', 'object_expression'];

// Base JavaScript/TypeScript patterns
const JS_BASE = {
  'func': JS_FUNCS,
  'class': JS_CLASSES,
  'block': [...COMMON_BLOCKS, ...JS_BLOCKS],
  'sig': ['function_declaration', 'method_definition', 'function_signature'],
  'body': ['statement_block', 'class_body'],
  'method': ['method_definition'],
  'import': ['import_statement'],
  'export': ['export_statement'],
};

// TypeScript additions
const TS_ADDITIONS = {
  'func': ['method_signature'],
  'class': ['interface_declaration'],
  'sig': ['method_signature', 'function_signature'],
  'body': ['interface_body'],
  'method': ['method_signature'],
};

// Helper to merge base with additions
function mergePatterns(base: Record<string, string[]>, additions: Record<string, string[]>): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const key in base) {
    result[key] = [...base[key]];
  }
  for (const key in additions) {
    if (result[key]) {
      result[key] = [...result[key], ...additions[key]];
    } else {
      result[key] = additions[key];
    }
  }
  return result;
}

// Semantic scope to tree-sitter node type mappings
const SCOPE_MAPPINGS: Record<string, Record<string, string[]>> = {
  'javascript': JS_BASE,
  'typescript': mergePatterns(JS_BASE, TS_ADDITIONS),
  'tsx': mergePatterns(JS_BASE, TS_ADDITIONS),
  'python': {
    'func': ['function_definition'],
    'class': ['class_definition'],
    'block': ['block', ...COMMON_BLOCKS, 'with_statement', 'dictionary', 'list', 'set'],
    'sig': ['function_definition'],
    'body': ['block'],
    'method': ['function_definition'],
    'import': ['import_statement', 'import_from_statement'],
    'docstring': ['expression_statement'],
  },
  'java': {
    'func': ['method_declaration', 'constructor_declaration'],
    'class': ['class_declaration', 'interface_declaration', 'enum_declaration'],
    'block': ['block', ...COMMON_BLOCKS],
    'sig': ['method_declaration', 'constructor_declaration'],
    'body': ['block', 'class_body', 'interface_body', 'enum_body'],
    'method': ['method_declaration'],
    'import': ['import_declaration'],
  },
  'csharp': {
    'func': ['method_declaration', 'constructor_declaration', 'property_declaration', 'local_function_statement'],
    'class': ['class_declaration', 'interface_declaration', 'struct_declaration', 'record_declaration'],
    'block': ['block', ...COMMON_BLOCKS],
    'sig': ['method_declaration', 'constructor_declaration'],
    'body': ['block', 'class_body', 'interface_body'],
    'method': ['method_declaration'],
    'import': ['using_directive'],
  },
  'go': {
    'func': ['function_declaration', 'method_declaration'],
    'class': ['type_declaration'],
    'block': ['block', 'if_statement', 'for_statement', 'switch_statement'],
    'sig': ['function_declaration', 'method_declaration'],
    'body': ['block'],
    'method': ['method_declaration'],
    'import': ['import_declaration'],
  },
  'rust': {
    'func': ['function_item', 'function_signature_item'],
    'class': ['struct_item', 'enum_item', 'trait_item', 'impl_item'],
    'block': ['block', 'if_expression', 'for_expression', 'while_expression', 'match_expression'],
    'sig': ['function_item', 'function_signature_item'],
    'body': ['block'],
    'method': ['function_item'],
    'import': ['use_declaration'],
  },
  'ruby': {
    'func': ['method', 'lambda'],
    'class': ['class', 'module'],
    'block': ['do_block', 'block', 'if', 'for', 'while', 'case'],
    'sig': ['method'],
    'body': ['do_block', 'block'],
    'method': ['method'],
    'import': ['require', 'load'],
  },
  'php': {
    'func': ['function_definition', 'method_declaration'],
    'class': ['class_declaration', 'interface_declaration', 'trait_declaration'],
    'block': ['compound_statement', ...COMMON_BLOCKS],
    'sig': ['function_definition', 'method_declaration'],
    'body': ['compound_statement'],
    'method': ['method_declaration'],
    'import': ['use_statement', 'require_expression', 'include_expression'],
  },
  'c': {
    'func': ['function_definition'],
    'class': ['struct_specifier', 'union_specifier'],
    'block': ['compound_statement', ...COMMON_BLOCKS],
    'sig': ['function_declarator'],
    'body': ['compound_statement'],
    'method': ['function_definition'],
    'import': ['preproc_include'],
  },
  'cpp': {
    'func': ['function_definition', 'lambda_expression'],
    'class': ['class_specifier', 'struct_specifier', 'union_specifier'],
    'block': ['compound_statement', ...COMMON_BLOCKS],
    'sig': ['function_declarator'],
    'body': ['compound_statement', 'field_declaration_list'],
    'method': ['function_definition'],
    'import': ['preproc_include', 'using_declaration'],
  },
  'swift': {
    'func': ['function_declaration'],
    'class': ['class_declaration', 'struct_declaration', 'protocol_declaration', 'enum_declaration'],
    'block': ['code_block', ...COMMON_BLOCKS],
    'sig': ['function_declaration'],
    'body': ['code_block', 'class_body'],
    'method': ['function_declaration'],
    'import': ['import_declaration'],
  },
  'kotlin': {
    'func': ['function_declaration', 'anonymous_function'],
    'class': ['class_declaration', 'object_declaration', 'interface_declaration'],
    'block': ['statements', 'if_expression', 'for_statement', 'while_statement', 'when_expression'],
    'sig': ['function_declaration'],
    'body': ['statements', 'class_body'],
    'method': ['function_declaration'],
    'import': ['import_header'],
  },
};

// Store the extension context for tree-sitter initialization
let extensionContext: vscode.ExtensionContext | null = null;

/**
 * Initialize the scope resolver with the extension context
 */
export async function initializeScopeResolver(context: vscode.ExtensionContext): Promise<void> {
  extensionContext = context;
  // Don't initialize tree-sitter yet - it will be initialized on first use
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
 * Resolves semantic scope to line numbers using tree-sitter with regex fallback
 */
export async function resolveSemantic(
  document: vscode.TextDocument,
  line: number,
  scope: string,
  _addScopes?: string[],
  _removeScopes?: string[]
): Promise<ScopeBoundary | null> {
  const languageId = document.languageId;
  const hasTreeSitterSupport = SCOPE_MAPPINGS[languageId] !== undefined;

  // If we have tree-sitter support for this language, it MUST work
  if (hasTreeSitterSupport) {
    if (!extensionContext) {
      throw new Error(`[TreeSitter] Extension context not initialized for ${languageId}`);
    }

    try {
      // Initialize tree-sitter on first use
      await initializeTreeSitter(extensionContext);
      
      const treeSitterResult = await resolveSemanticWithTreeSitter(document, line, scope);
      if (!treeSitterResult) {
        // This is a bug - tree-sitter should always find scopes for supported languages
        throw new Error(`[TreeSitter] Failed to resolve scope '${scope}' at line ${line + 1} in ${languageId} file. This is a bug.`);
      }
      return treeSitterResult;
    } catch (error) {
      // Re-throw with more context
      throw new Error(`[TreeSitter] Critical failure for ${languageId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Only use regex for languages without tree-sitter support
  return resolveSemanticWithRegex(document, line, scope);
}

/**
 * Resolve semantic scope using tree-sitter
 */
async function resolveSemanticWithTreeSitter(
  document: vscode.TextDocument,
  line: number,
  scope: string
): Promise<ScopeBoundary | null> {
  if (!extensionContext) return null;

  const tree = await parseDocument(extensionContext, document);
  if (!tree) return null;

  const languageId = document.languageId;
  const scopeMap = SCOPE_MAPPINGS[languageId];
  if (!scopeMap) return null;

  const nodeTypes = scopeMap[scope] || scopeMap[scope.toLowerCase()];
  if (!nodeTypes || nodeTypes.length === 0) return null;

  // For scoped guards, we need to search forward from the guard line
  // to find the next occurrence of the scope type
  if (scope === 'class' || scope === 'func' || scope === 'function' || scope === 'block') {
    // For block scope, we always want to find the next code block,
    // not apply to the comment itself

    // Start searching from the line after the guard
    for (let searchLine = line + 1; searchLine < document.lineCount; searchLine++) {
      const searchNode = findNodeAtPosition(tree, searchLine);
      if (searchNode) {

        // For block scope, we need to handle differently
        // Dictionary/list/set nodes might be children of assignments
        let targetNode: Node | null = null;

        if (scope === 'block') {
          // Special case: if we encounter a class or function when looking for a block,
          // use the entire class/function as the block
          const classOrFunc = findParentOfType(searchNode, ['class_declaration', 'function_declaration']);
          if (classOrFunc && classOrFunc.startPosition.row >= line) {
            targetNode = classOrFunc;
          } else {
            // First check if the current node itself is a block type
            if (nodeTypes.includes(searchNode.type)) {
              targetNode = searchNode;
            } else {
              // For assignments like "DICT = {}", search children
              for (const child of searchNode.children) {
                if (child && nodeTypes.includes(child.type)) {
                  targetNode = child;
                  break;
                }
              }

              // If not found in immediate children, check parent's children
              // This handles cases where we land on a leaf node
              // BUT: Only do this if the sibling starts at the current search line
              // Otherwise we'll skip over closer blocks
              if (!targetNode && searchNode.parent) {
                for (const sibling of searchNode.parent.children) {
                  if (sibling && nodeTypes.includes(sibling.type) &&
                      sibling.startPosition.row === searchLine) {
                    targetNode = sibling;
                    break;
                  }
                }
              }
            }
          }
        } else {
          // For non-block scopes, use the original parent search
          targetNode = findParentOfType(searchNode, nodeTypes);
        }

        if (targetNode && targetNode.startPosition.row >= line) {
          const bounds = getNodeBoundaries(targetNode);
          DebugLogger.log(`[ScopeResolver] Found ${scope} node: type=${targetNode.type}, start=${bounds.startLine}, end=${bounds.endLine}`);

          // For Python classes, trim trailing whitespace
          if (scope === 'class' && document.languageId === 'python') {
            const lines = document.getText().split('\n');
            let endLine = bounds.endLine - 1; // Convert to 0-based

            // Walk backwards from the end to find the last non-empty line
            while (endLine > bounds.startLine - 1 && lines[endLine].trim() === '') {
              endLine--;
            }

            return {
              startLine: line + 1, // Start from the guard line, not the block start
              endLine: endLine + 1, // Convert back to 1-based
              type: scope
            };
          }

          return {
            startLine: line + 1, // Start from the guard line (1-based)
            endLine: bounds.endLine,
            type: scope
          };
        }
      }
    }
    return null;
  }

  // Find the node at the guard tag line
  const node = findNodeAtPosition(tree, line);
  if (!node) return null;

  // Handle different scope types
  switch (scope) {
    case 'sig':
    case 'signature':
      return findSignatureScopeTreeSitter(node, nodeTypes, line);

    case 'body':
      return findBodyScopeTreeSitter(node, nodeTypes);

    case 'stmt':
    case 'statement':
      return findStatementScopeTreeSitter(node, line);

    case 'context':
      // Context applies only to documentation nodes
      return findContextScopeTreeSitter(tree, line, document);

    default: {
      // For other scopes, find the nearest parent of the specified type
      const parentNode = findParentOfType(node, nodeTypes);
      if (parentNode) {
        const bounds = getNodeBoundaries(parentNode);
        return {
          startLine: bounds.startLine,
          endLine: bounds.endLine,
          type: scope
        };
      }
    }
  }

  return null;
}

/**
 * Find signature scope using tree-sitter
 */
function findSignatureScopeTreeSitter(
  node: Node,
  nodeTypes: string[],
  _guardLine: number
): ScopeBoundary | null {
  // Check if we're on a function/method node
  const funcNode = findParentOfType(node, nodeTypes);
  if (!funcNode) return null;

  // For signatures, we want just the declaration line(s), not the body
  const startLine = funcNode.startPosition.row + 1;  // Convert to 1-based

  // Find where the body starts (usually after '{' or ':')
  let endLine = startLine;
  for (const child of funcNode.children) {
    if (child && ['statement_block', 'block', 'compound_statement', 'code_block'].includes(child.type)) {
      endLine = child.startPosition.row;  // Convert to 1-based (row is 0-based, so +1-1=+0)
      break;
    }
  }

  // If we didn't find a body, check if the signature spans multiple lines
  if (endLine === startLine) {
    // Look for the opening brace or colon on the same or next lines
    const text = funcNode.text;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('{') || lines[i].includes(':')) {
        endLine = startLine + i;
        break;
      }
    }
  }

  return {
    startLine,
    endLine: Math.max(startLine, endLine),
    type: 'signature'
  };
}

/**
 * Find body scope using tree-sitter
 */
function findBodyScopeTreeSitter(
  node: Node,
  nodeTypes: string[]
): ScopeBoundary | null {
  // Find the function/method containing this node
  const funcTypes = SCOPE_MAPPINGS[node.tree.rootNode.type]?.func || nodeTypes;
  const funcNode = findParentOfType(node, funcTypes);
  if (!funcNode) return null;

  // Find the body within the function
  for (const child of funcNode.children) {
    if (child && ['statement_block', 'block', 'compound_statement', 'code_block', 'do_block'].includes(child.type)) {
      const bounds = getNodeBoundaries(child);
      return {
        startLine: bounds.startLine + 1, // Skip the opening brace line
        endLine: bounds.endLine - 1, // Skip the closing brace line
        type: 'body'
      };
    }
  }

  return null;
}

/**
 * Find statement scope using tree-sitter
 */
function findStatementScopeTreeSitter(
  node: Node,
  line: number
): ScopeBoundary | null {
  // Find the smallest statement containing this line
  let current = node;
  while (current.parent) {
    if (current.type.includes('statement') || current.type.includes('expression')) {
      const bounds = getNodeBoundaries(current);
      if (bounds.startLine <= line && bounds.endLine >= line) {
        return {
          startLine: bounds.startLine,
          endLine: bounds.endLine,
          type: 'statement'
        };
      }
    }
    current = current.parent;
  }

  // Default to just the current line
  return {
    startLine: line,
    endLine: line,
    type: 'statement'
  };
}

/**
 * Find context scope using tree-sitter
 * Context applies only to documentation (comments and docstrings)
 */
function findContextScopeTreeSitter(
  tree: Tree,
  line: number,
  document: vscode.TextDocument
): ScopeBoundary | null {
  const languageId = document.languageId;

  // Start from the line after the guard tag
  const startLine = line + 1;
  let lastContentLine = -1;  // Track last line with actual content

  // Check each line to see if it's documentation
  for (let currentLine = startLine; currentLine < document.lineCount; currentLine++) {
    // First check if the line is empty
    const lineText = document.lineAt(currentLine).text.trim();
    if (lineText === '') {
      // Empty line, continue but don't update lastContentLine
      continue;
    }

    const node = findNodeAtPosition(tree, currentLine);
    if (!node) {
      // No node found - this might be an empty line or end of file
      break;
    }

    // Check if this is a documentation node
    const isDocumentation = isDocumentationNode(node, languageId);

    if (!isDocumentation) {
      // Found code, stop here
      break;
    }

    // Still in documentation with content
    lastContentLine = currentLine;
  }

  // If we found any documentation lines with content
  if (lastContentLine >= startLine) {
    const result = {
      startLine: startLine + 1,  // Convert to 1-based
      endLine: lastContentLine + 1,  // Use last content line instead of endLine
      type: 'context'
    };
    return result;
  }

  return null;
}

/**
 * Check if a node represents documentation (comment or docstring)
 */
function isDocumentationNode(node: Node, languageId: string): boolean {
  // Check node type
  if (node.type === 'comment' || node.type === 'line_comment' || node.type === 'block_comment') {
    // Check if this comment contains a guard tag - if so, it's not part of the context
    if (node.text && node.text.includes(GUARD_TAG_PREFIX)) {
      return false;
    }
    return true;
  }

  // Language-specific docstring detection
  if (languageId === 'python') {
    // Check for docstrings (string as first statement in function/class)
    if (node.type === 'expression_statement') {
      const stringChild = node.children.find(child => child && child.type === 'string');
      if (stringChild) {
        // Check if this is the first non-comment statement in a function/class
        const parent = node.parent;
        if (parent && (parent.type === 'function_definition' || parent.type === 'class_definition')) {
          // Find the first non-comment child
          for (const sibling of parent.children) {
            if (sibling && (sibling.type === 'expression_statement' || sibling.type.includes('statement'))) {
              return sibling === node;  // It's a docstring if it's the first statement
            }
          }
        }
        // Standalone string at module level could be documentation
        if (parent && parent.type === 'module') {
          return true;
        }
      }
    }
  }

  // JavaScript/TypeScript JSDoc comments
  if (languageId === 'javascript' || languageId === 'typescript' || languageId === 'tsx') {
    // JSDoc nodes might be parsed as comments
    if (node.text && node.text.trim().startsWith('/**')) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve semantic scope using regex (fallback)
 */
function resolveSemanticWithRegex(
  document: vscode.TextDocument,
  line: number,
  scope: string
): ScopeBoundary | null {
  const languageId = document.languageId;
  const text = document.getText();
  const lines = text.split(UTILITY_PATTERNS.LINE_SPLIT);

  // Simple implementation for common scopes
  switch (scope) {
    case 'func':
    case 'function':
      return findFunctionScope(lines, line, languageId);

    case 'class':
      return findClassScope(lines, line, languageId);

    case 'block':
      return findBlockScope(lines, line, languageId);

    case 'sig':
    case 'signature':
      return findSignatureScope(lines, line, languageId);

    case 'body':
      return findBodyScope(lines, line, languageId);

    case 'method':
      return findMethodScope(lines, line, languageId);

    case 'stmt':
    case 'statement':
      return findStatementScope(lines, line);

    case 'context':
      return findContextScope(lines, line, languageId);

    default:
      return null;
  }
}

/**
 * Generic scope finder using regex patterns
 */
function findScopeByPattern(
  lines: string[],
  guardLine: number,
  language: string,
  patternName: 'FUNCTION' | 'CLASS',
  scopeType: string,
  defaultPattern: RegExp
): ScopeBoundary | null {
  // Get cached language patterns
  const langPatterns = getLanguagePatterns(language);
  const pattern = langPatterns?.[patternName] || defaultPattern;

  // Search for scope start after guard line
  let scopeStart = -1;
  for (let i = guardLine + 1; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      scopeStart = i;
      break;
    }
  }

  if (scopeStart === -1) return null;

  // Find scope end by tracking braces/indentation
  const scopeEnd = findScopeEnd(lines, scopeStart, language);

  return {
    startLine: scopeStart + 1,  // Convert to 1-based
    endLine: scopeEnd + 1,      // Convert to 1-based
    type: scopeType
  };
}

/**
 * Find function scope boundaries using regex
 */
function findFunctionScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  return findScopeByPattern(
    lines,
    guardLine,
    language,
    'FUNCTION',
    'function',
    /^\s*(async\s+)?function\s+\w+\s*\(|^\s*(const|let|var)\s+\w+\s*=\s*(async\s*)?\(/
  );
}

/**
 * Find class scope boundaries using regex
 */
function findClassScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  return findScopeByPattern(
    lines,
    guardLine,
    language,
    'CLASS',
    'class',
    /^\s*class\s+\w+/
  );
}

/**
 * Find block scope boundaries using regex
 */
function findBlockScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  // For block scopes, search FORWARD for the next brace-delimited block
  return findDelimitedScope(lines, guardLine, language, 'block');
}

/**
 * Find signature scope (just the signature, not the body) using regex
 */
function findSignatureScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  return findLinearScope(lines, guardLine, language, 'signature', 'FUNCTION');
}

/**
 * Find body scope (implementation without signature) using regex
 */
function findBodyScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  const functionScope = findFunctionScope(lines, guardLine, language);
  if (!functionScope) return null;

  // Skip the definition line(s) to get just the body
  const bodyStart = findBodyStart(lines, functionScope.startLine - 1, language);

  return {
    startLine: bodyStart + 1,  // Convert to 1-based
    endLine: functionScope.endLine,  // Already 1-based from findFunctionScope
    type: 'body'
  };
}

/**
 * Find method scope (similar to function but within a class) using regex
 */
function findMethodScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  // For methods, we just use function scope - the class check is not necessary
  // since the guard tag already indicates method scope
  return findFunctionScope(lines, guardLine, language);
}

/**
 * Find statement scope (single logical statement) using regex
 */
function findStatementScope(lines: string[], guardLine: number): ScopeBoundary | null {
  // For statements, we return the current line
  return {
    startLine: guardLine + 1,  // Convert to 1-based
    endLine: guardLine + 1,    // Convert to 1-based
    type: 'statement'
  };
}

/**
 * Helper to find the end of a scope based on braces or indentation
 */
function findScopeEnd(lines: string[], startLine: number, language: string): number {
  if (language === 'python') {
    return findPythonScopeEnd(lines, startLine);
  }

  // For brace-based languages
  let braceCount = 0;
  let foundFirstBrace = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        foundFirstBrace = true;
      } else if (char === '}') {
        braceCount--;
        if (foundFirstBrace && braceCount === 0) {
          return i;
        }
      }
    }
  }

  return lines.length - 1;
}

/**
 * Get indentation level of a line
 */
function getIndentLevel(line: string): number {
  let indent = 0;
  for (const char of line) {
    if (char === ' ') indent++;
    else if (char === '\t') indent += 4; // Treat tab as 4 spaces
    else break;
  }
  return indent;
}

/**
 * Find Python scope end based on indentation
 */
function findPythonScopeEnd(lines: string[], startLine: number): number {
  // Get the indentation of the definition line
  const baseIndent = getIndentLevel(lines[startLine]);

  // Skip to the first line of the body
  let i = startLine + 1;
  while (i < lines.length && lines[i].trim() === '') {
    i++;
  }

  // Find where the indentation returns to base level or less
  let lastNonEmptyLine = startLine;
  for (; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() !== '') {
      if (getIndentLevel(line) <= baseIndent) {
        // Return the last non-empty line before the dedent
        return lastNonEmptyLine;
      }
      // Update last non-empty line if still within scope
      lastNonEmptyLine = i;
    }
  }

  return lastNonEmptyLine;
}

/**
 * Get comment pattern for a language
 */
function getCommentPattern(language: string): RegExp {
  switch (language) {
    case 'python':
      return /^\s*#|^\s*"""|^\s*'''/;
    case 'javascript':
    case 'typescript':
    case 'tsx':
    case 'java':
    case 'c':
    case 'cpp':
      return /^\s*\/\/|^\s*\/\*|^\s*\*/;
    default:
      return /^\s*\/\/|^\s*#/;
  }
}

/**
 * Find delimited scope (blocks with braces/brackets)
 */
function findDelimitedScope(lines: string[], guardLine: number, language: string, scopeType: string): ScopeBoundary | null {
  // Search forward for opening delimiter
  let blockStart = -1;
  let openChar = '';
  let closeChar = '';

  for (let i = guardLine + 1; i < lines.length; i++) {
    const line = lines[i];
    // Check for various block delimiters
    if (line.includes('{')) {
      blockStart = i;
      openChar = '{';
      closeChar = '}';
      break;
    } else if (line.includes('[') && language === 'python') {
      blockStart = i;
      openChar = '[';
      closeChar = ']';
      break;
    }
  }

  if (blockStart === -1) return null;

  // Find the matching closing delimiter
  let nestCount = 0;
  let blockEnd = -1;

  for (let i = blockStart; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
      if (char === openChar) nestCount++;
      if (char === closeChar) {
        nestCount--;
        if (nestCount === 0) {
          blockEnd = i;
          break;
        }
      }
    }
    if (blockEnd !== -1) break;
  }

  if (blockEnd === -1) return null;

  return {
    startLine: blockStart + 1,  // Convert to 1-based
    endLine: blockEnd + 1,      // Convert to 1-based
    type: scopeType
  };
}

/**
 * Find linear scope (single line patterns like signatures)
 */
function findLinearScope(lines: string[], guardLine: number, language: string, scopeType: string, patternName: 'FUNCTION' | 'CLASS'): ScopeBoundary | null {
  const currentLine = lines[guardLine];
  const langPatterns = getLanguagePatterns(language);
  const pattern = langPatterns?.[patternName] || /^\s*(?:async\s+)?function\s+\w+\s*\(/;

  // If the guard is inline with the pattern, only highlight that line
  if (pattern.test(currentLine)) {
    return {
      startLine: guardLine + 1,  // Convert to 1-based
      endLine: guardLine + 1,    // Convert to 1-based
      type: scopeType
    };
  }

  // Otherwise, find the pattern below the guard comment (within 3 lines)
  for (let i = guardLine + 1; i < lines.length && i <= guardLine + 3; i++) {
    if (pattern.test(lines[i])) {
      return {
        startLine: i + 1,  // Convert to 1-based
        endLine: i + 1,    // Convert to 1-based
        type: scopeType
      };
    }
  }

  // Fallback for signature scope
  if (scopeType === 'signature') {
    const functionScope = findFunctionScope(lines, guardLine, language);
    if (!functionScope) return null;
    return {
      startLine: functionScope.startLine,
      endLine: functionScope.startLine,
      type: 'signature'
    };
  }

  return null;
}

/**
 * Find the start of a function body
 */
function findBodyStart(lines: string[], functionStart: number, language: string): number {
  // Find the opening brace or colon
  for (let i = functionStart; i < lines.length && i <= functionStart + 10; i++) {
    if (lines[i].includes('{') || (language === 'python' && lines[i].includes(':'))) {
      return i + 1;
    }
  }
  return functionStart + 1;
}

/**
 * Find context scope boundaries using regex (fallback)
 * Context applies only to documentation (comments and docstrings)
 */
function findContextScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  // Start from the line after the guard tag
  const startLine = guardLine + 1;
  let lastContentLine = -1;  // Track last line with actual content

  // Get comment pattern for the language
  const commentPattern = getCommentPattern(language);

  // Check each line to see if it's documentation
  let inBlockComment = false;
  let inDocstring = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle Python docstrings
    if (language === 'python') {
      if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
        if (!inDocstring) {
          inDocstring = true;
          lastContentLine = i;
          continue;
        } else if (trimmed.endsWith('"""') || trimmed.endsWith("'''")) {
          inDocstring = false;
          lastContentLine = i;
          continue;
        }
      }
      if (inDocstring) {
        if (trimmed !== '') {
          lastContentLine = i;
        }
        continue;
      }
    }

    // Handle block comments
    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      lastContentLine = i;
      continue;
    }
    if (inBlockComment) {
      if (trimmed !== '') {
        lastContentLine = i;
      }
      if (trimmed.endsWith('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    // Handle line comments
    if (commentPattern.test(line)) {
      // Check if this is a guard tag - if so, context ends
      if (trimmed.includes(GUARD_TAG_PREFIX)) {
        break;
      }
      lastContentLine = i;
      continue;
    }

    // If we hit a non-comment, non-empty line, stop
    if (trimmed !== '') {
      break;
    }

    // Empty lines are included in the range but don't update lastContentLine
  }

  // If we found any documentation lines
  if (lastContentLine >= startLine) {
    const result = {
      startLine: startLine + 1,  // Convert to 1-based
      endLine: lastContentLine + 1,  // Use last content line instead of endLine
      type: 'context'
    };
    return result;
  }

  return null;
}