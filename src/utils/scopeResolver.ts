import type * as vscode from 'vscode';
import { getLanguagePatterns, UTILITY_PATTERNS } from './regexCache';
import { parseDocument, findNodeAtPosition, findParentOfType, getNodeBoundaries, initializeTreeSitter } from './treeSitterParser';
import type { Node } from 'web-tree-sitter';

// Semantic scope to tree-sitter node type mappings
const SCOPE_MAPPINGS: Record<string, Record<string, string[]>> = {
  'javascript': {
    'func': ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'],
    'class': ['class_declaration', 'class_expression'],
    'block': ['statement_block', 'if_statement', 'for_statement', 'while_statement', 'try_statement', 'switch_statement'],
    'sig': ['function_declaration', 'method_definition', 'function_signature'],
    'body': ['statement_block', 'class_body'],
    'method': ['method_definition'],
    'import': ['import_statement'],
    'export': ['export_statement'],
  },
  'typescript': {
    'func': ['function_declaration', 'function_expression', 'arrow_function', 'method_definition', 'method_signature'],
    'class': ['class_declaration', 'class_expression', 'interface_declaration'],
    'block': ['statement_block', 'if_statement', 'for_statement', 'while_statement', 'try_statement', 'switch_statement'],
    'sig': ['function_declaration', 'method_definition', 'method_signature', 'function_signature'],
    'body': ['statement_block', 'class_body', 'interface_body'],
    'method': ['method_definition', 'method_signature'],
    'import': ['import_statement'],
    'export': ['export_statement'],
  },
  'tsx': {
    'func': ['function_declaration', 'function_expression', 'arrow_function', 'method_definition', 'method_signature'],
    'class': ['class_declaration', 'class_expression', 'interface_declaration'],
    'block': ['statement_block', 'if_statement', 'for_statement', 'while_statement', 'try_statement', 'switch_statement'],
    'sig': ['function_declaration', 'method_definition', 'method_signature', 'function_signature'],
    'body': ['statement_block', 'class_body', 'interface_body'],
    'method': ['method_definition', 'method_signature'],
    'import': ['import_statement'],
    'export': ['export_statement'],
  },
  'python': {
    'func': ['function_definition'],
    'class': ['class_definition'],
    'block': ['block', 'if_statement', 'for_statement', 'while_statement', 'try_statement', 'with_statement'],
    'sig': ['function_definition'],
    'body': ['block'],
    'method': ['function_definition'],
    'import': ['import_statement', 'import_from_statement'],
    'docstring': ['expression_statement'],
  },
  'java': {
    'func': ['method_declaration', 'constructor_declaration'],
    'class': ['class_declaration', 'interface_declaration', 'enum_declaration'],
    'block': ['block', 'if_statement', 'for_statement', 'while_statement', 'try_statement', 'switch_statement'],
    'sig': ['method_declaration', 'constructor_declaration'],
    'body': ['block', 'class_body', 'interface_body', 'enum_body'],
    'method': ['method_declaration'],
    'import': ['import_declaration'],
  },
  'csharp': {
    'func': ['method_declaration', 'constructor_declaration', 'property_declaration', 'local_function_statement'],
    'class': ['class_declaration', 'interface_declaration', 'struct_declaration', 'record_declaration'],
    'block': ['block', 'if_statement', 'for_statement', 'while_statement', 'try_statement', 'switch_statement'],
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
    'block': ['compound_statement', 'if_statement', 'for_statement', 'while_statement', 'switch_statement'],
    'sig': ['function_definition', 'method_declaration'],
    'body': ['compound_statement'],
    'method': ['method_declaration'],
    'import': ['use_statement', 'require_expression', 'include_expression'],
  },
  'c': {
    'func': ['function_definition'],
    'class': ['struct_specifier', 'union_specifier'],
    'block': ['compound_statement', 'if_statement', 'for_statement', 'while_statement', 'switch_statement'],
    'sig': ['function_declarator'],
    'body': ['compound_statement'],
    'method': ['function_definition'],
    'import': ['preproc_include'],
  },
  'cpp': {
    'func': ['function_definition', 'lambda_expression'],
    'class': ['class_specifier', 'struct_specifier', 'union_specifier'],
    'block': ['compound_statement', 'if_statement', 'for_statement', 'while_statement', 'switch_statement'],
    'sig': ['function_declarator'],
    'body': ['compound_statement', 'field_declaration_list'],
    'method': ['function_definition'],
    'import': ['preproc_include', 'using_declaration'],
  },
  'swift': {
    'func': ['function_declaration'],
    'class': ['class_declaration', 'struct_declaration', 'protocol_declaration', 'enum_declaration'],
    'block': ['code_block', 'if_statement', 'for_statement', 'while_statement', 'switch_statement'],
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
  await initializeTreeSitter(context);
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
  // First, try to use tree-sitter
  if (extensionContext) {
    try {
      const treeSitterResult = await resolveSemanticWithTreeSitter(document, line, scope);
      if (treeSitterResult) {
        return treeSitterResult;
      }
    } catch (error) {
      console.warn('Tree-sitter parsing failed, falling back to regex:', error);
    }
  }

  // Fall back to regex-based parsing
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

    default:
      return null;
  }
}

/**
 * Find function scope boundaries using regex
 */
function findFunctionScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  // Get cached language patterns
  const langPatterns = getLanguagePatterns(language);
  const pattern = langPatterns?.FUNCTION || /^\s*(async\s+)?function\s+\w+\s*\(|^\s*(const|let|var)\s+\w+\s*=\s*(async\s*)?\(/;

  // Search for function start before guard line
  let functionStart = -1;
  for (let i = guardLine; i >= 0; i--) {
    if (pattern.test(lines[i])) {
      functionStart = i;
      break;
    }
  }

  if (functionStart === -1) return null;

  // Find function end by tracking braces/indentation
  const functionEnd = findScopeEnd(lines, functionStart, language);

  return {
    startLine: functionStart + 1,  // Convert to 1-based
    endLine: functionEnd + 1,      // Convert to 1-based
    type: 'function'
  };
}

/**
 * Find class scope boundaries using regex
 */
function findClassScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  // Get cached language patterns
  const langPatterns = getLanguagePatterns(language);
  const pattern = langPatterns?.CLASS || /^\s*class\s+\w+/;

  // Search for class start before guard line
  let classStart = -1;
  for (let i = guardLine; i >= 0; i--) {
    if (pattern.test(lines[i])) {
      classStart = i;
      break;
    }
  }

  if (classStart === -1) return null;

  const classEnd = findScopeEnd(lines, classStart, language);

  return {
    startLine: classStart + 1,  // Convert to 1-based
    endLine: classEnd + 1,      // Convert to 1-based
    type: 'class'
  };
}

/**
 * Find block scope boundaries using regex
 */
function findBlockScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  // For languages with braces, find the nearest enclosing brace pair
  if (['javascript', 'typescript', 'java', 'csharp', 'c', 'cpp'].includes(language)) {
    // Search backwards for opening brace
    let blockStart = -1;
    let braceCount = 0;

    for (let i = guardLine; i >= 0; i--) {
      const line = lines[i];
      for (let j = line.length - 1; j >= 0; j--) {
        if (line[j] === '}') braceCount++;
        if (line[j] === '{') {
          if (braceCount === 0) {
            blockStart = i;
            break;
          }
          braceCount--;
        }
      }
      if (blockStart !== -1) break;
    }

    if (blockStart === -1) return null;

    const blockEnd = findScopeEnd(lines, blockStart, language);

    return {
      startLine: blockStart + 1,  // Convert to 1-based
      endLine: blockEnd + 1,      // Convert to 1-based
      type: 'block'
    };
  }

  // For Python, use indentation
  if (language === 'python') {
    return findPythonBlock(lines, guardLine);
  }

  return null;
}

/**
 * Find signature scope (just the signature, not the body) using regex
 */
function findSignatureScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  // Check if the guard tag is on the same line as a function signature
  const currentLine = lines[guardLine];

  // Language-specific patterns for function signatures
  const signaturePatterns: Record<string, RegExp> = {
    python: /^\s*(?:async\s+)?def\s+\w+\s*\(/,
    javascript: /^\s*(?:async\s+)?(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)\s*=>|function))/,
    typescript: /^\s*(?:async\s+)?(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)\s*=>|function))|^\s*(?:public|private|protected)?\s*(?:async\s+)?\w+\s*\(/,
  };

  const pattern = signaturePatterns[language] || signaturePatterns.javascript;

  // If the guard is inline with the signature, only highlight that line
  if (pattern.test(currentLine)) {
    return {
      startLine: guardLine + 1,  // Convert to 1-based
      endLine: guardLine + 1,    // Convert to 1-based
      type: 'signature'
    };
  }

  // Otherwise, find the function below the guard comment
  for (let i = guardLine + 1; i < lines.length && i <= guardLine + 3; i++) {
    if (pattern.test(lines[i])) {
      return {
        startLine: i + 1,  // Convert to 1-based
        endLine: i + 1,    // Convert to 1-based
        type: 'signature'
      };
    }
  }

  // Fallback to the original logic if no signature found nearby
  const functionScope = findFunctionScope(lines, guardLine, language);
  if (!functionScope) return null;

  return {
    startLine: functionScope.startLine,  // Already 1-based from findFunctionScope
    endLine: functionScope.startLine,    // Already 1-based from findFunctionScope
    type: 'signature'
  };
}

/**
 * Find body scope (implementation without signature) using regex
 */
function findBodyScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  const functionScope = findFunctionScope(lines, guardLine, language);
  if (!functionScope) return null;

  // Skip the definition line(s) to get just the body
  let bodyStart = functionScope.startLine;

  // Find the opening brace or colon
  for (let i = functionScope.startLine; i <= functionScope.endLine; i++) {
    if (lines[i].includes('{') || (language === 'python' && lines[i].includes(':'))) {
      bodyStart = i + 1;
      break;
    }
  }

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
  // First check if we're inside a class
  const classScope = findClassScope(lines, guardLine, language);
  if (!classScope) return null;

  // Then find the function within the class
  return findFunctionScope(lines, guardLine, language);
}

/**
 * Find statement scope (single logical statement) using regex
 */
function findStatementScope(lines: string[], guardLine: number): ScopeBoundary | null {
  // For now, just return the current line
  // A full implementation would parse multi-line statements
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
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue; // Skip empty lines

    if (getIndentLevel(line) <= baseIndent) {
      return i - 1;
    }
  }

  return lines.length - 1;
}

/**
 * Find Python block based on indentation
 */
function findPythonBlock(lines: string[], guardLine: number): ScopeBoundary | null {
  // Find the line that starts the current indentation block
  const currentIndent = getIndentLevel(lines[guardLine]);

  let blockStart = guardLine;
  for (let i = guardLine - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.trim() === '') continue;

    const indent = getIndentLevel(line);
    if (indent < currentIndent) {
      // This line starts the block
      blockStart = i;
      break;
    }
  }

  // Find block end
  let blockEnd = guardLine;
  for (let i = guardLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;

    if (getIndentLevel(line) < currentIndent) {
      blockEnd = i - 1;
      break;
    }
    blockEnd = i;
  }

  return {
    startLine: blockStart + 1,  // Convert to 1-based
    endLine: blockEnd + 1,      // Convert to 1-based
    type: 'block'
  };
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