import type * as vscode from 'vscode';
import { getLanguagePatterns } from './regexCache';

// Tree-sitter for VSCode needs web-tree-sitter (WASM version)
// These are placeholders for future tree-sitter implementation
let _Parser: unknown;
const _parserCache: Map<string, unknown> = new Map();

// Language to parser mappings
const _LANGUAGE_PARSERS: Record<string, string> = {
  'javascript': 'tree-sitter-javascript.wasm',
  'typescript': 'tree-sitter-typescript.wasm',
  'python': 'tree-sitter-python.wasm',
  'java': 'tree-sitter-java.wasm',
  'csharp': 'tree-sitter-c_sharp.wasm',
  'c': 'tree-sitter-c.wasm',
  'cpp': 'tree-sitter-cpp.wasm',
  'go': 'tree-sitter-go.wasm',
  'rust': 'tree-sitter-rust.wasm',
  'ruby': 'tree-sitter-ruby.wasm',
  'php': 'tree-sitter-php.wasm',
};

// Semantic scope to tree-sitter node type mappings
const _SCOPE_MAPPINGS: Record<string, Record<string, string[]>> = {
  'javascript': {
    'func': ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'],
    'class': ['class_declaration', 'class_expression'],
    'block': ['block_statement', 'if_statement', 'for_statement', 'while_statement', 'try_statement'],
    'sig': ['function_declaration', 'method_definition'],
    'body': ['block_statement', 'class_body'],
    'method': ['method_definition'],
    'import': ['import_statement'],
    'export': ['export_statement'],
  },
  'typescript': {
    'func': ['function_declaration', 'function_expression', 'arrow_function', 'method_definition', 'method_signature'],
    'class': ['class_declaration', 'class_expression', 'interface_declaration'],
    'block': ['block_statement', 'if_statement', 'for_statement', 'while_statement', 'try_statement'],
    'sig': ['function_declaration', 'method_definition', 'method_signature'],
    'body': ['block_statement', 'class_body', 'interface_body'],
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
    'method': ['function_definition'], // Python doesn't distinguish methods syntactically
    'import': ['import_statement', 'import_from_statement'],
    'docstring': ['expression_statement'], // Need to check if it contains a string
  },
  'java': {
    'func': ['method_declaration', 'constructor_declaration'],
    'class': ['class_declaration', 'interface_declaration', 'enum_declaration'],
    'block': ['block', 'if_statement', 'for_statement', 'while_statement', 'try_statement'],
    'sig': ['method_declaration', 'constructor_declaration'],
    'body': ['block', 'class_body', 'interface_body', 'enum_body'],
    'method': ['method_declaration'],
    'import': ['import_declaration'],
  },
  'csharp': {
    'func': ['method_declaration', 'constructor_declaration', 'property_declaration'],
    'class': ['class_declaration', 'interface_declaration', 'struct_declaration'],
    'block': ['block', 'if_statement', 'for_statement', 'while_statement', 'try_statement'],
    'sig': ['method_declaration', 'constructor_declaration'],
    'body': ['block', 'class_body', 'interface_body'],
    'method': ['method_declaration'],
    'import': ['using_directive'],
  },
};

// Initialize parser (this would need to be called with proper WASM loading in real implementation)
export async function initializeParser(_context: vscode.ExtensionContext) {
  // In a real implementation, we'd load web-tree-sitter here
  // For now, we'll use a simplified approach
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
 * Resolves semantic scope to line numbers
 * For now, this is a simplified implementation that uses regex patterns
 * In a full implementation, this would use tree-sitter
 */
export function resolveSemantic(
  document: vscode.TextDocument,
  line: number,
  scope: string,
  _addScopes?: string[],
  _removeScopes?: string[]
): ScopeBoundary | null {
  const languageId = document.languageId;
  const text = document.getText();
  const lines = text.split(/\r?\n/);

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
 * Find function scope boundaries
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
    startLine: functionStart,
    endLine: functionEnd,
    type: 'function'
  };
}

/**
 * Find class scope boundaries
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
    startLine: classStart,
    endLine: classEnd,
    type: 'class'
  };
}

/**
 * Find block scope boundaries
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
      startLine: blockStart,
      endLine: blockEnd,
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
 * Find signature scope (just the signature, not the body)
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
      startLine: guardLine,
      endLine: guardLine,
      type: 'signature'
    };
  }

  // Otherwise, find the function below the guard comment
  for (let i = guardLine + 1; i < lines.length && i <= guardLine + 3; i++) {
    if (pattern.test(lines[i])) {
      return {
        startLine: i,
        endLine: i,
        type: 'signature'
      };
    }
  }

  // Fallback to the original logic if no signature found nearby
  const functionScope = findFunctionScope(lines, guardLine, language);
  if (!functionScope) return null;

  return {
    startLine: functionScope.startLine,
    endLine: functionScope.startLine,
    type: 'signature'
  };
}

/**
 * Find body scope (implementation without signature)
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
    startLine: bodyStart,
    endLine: functionScope.endLine,
    type: 'body'
  };
}

/**
 * Find method scope (similar to function but within a class)
 */
function findMethodScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  // First check if we're inside a class
  const classScope = findClassScope(lines, guardLine, language);
  if (!classScope) return null;

  // Then find the function within the class
  return findFunctionScope(lines, guardLine, language);
}

/**
 * Find statement scope (single logical statement)
 */
function findStatementScope(lines: string[], guardLine: number): ScopeBoundary | null {
  // For now, just return the current line
  // A full implementation would parse multi-line statements
  return {
    startLine: guardLine,
    endLine: guardLine,
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
    startLine: blockStart,
    endLine: blockEnd,
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