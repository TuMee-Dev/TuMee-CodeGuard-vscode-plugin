/**
 * Core regex-based fallback scope resolution for guard tags - platform agnostic
 * Used for languages without tree-sitter support
 * No dependencies allowed in this module
 */

import { getLanguagePatterns, UTILITY_PATTERNS, GUARD_TAG_PREFIX } from './patterns';
import type { ScopeBoundary } from './types';

/**
 * Resolve semantic scope using regex (fallback)
 */
export function resolveSemanticWithRegex(
  document: { getText(): string; languageId: string },
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
  const DEFAULT_FUNCTION_PATTERN = /^\s*(function|def|func|fun|fn)\s+\w+/;
  return findScopeByPattern(lines, guardLine, language, 'FUNCTION', 'function', DEFAULT_FUNCTION_PATTERN);
}

/**
 * Find class scope boundaries using regex
 */
function findClassScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  const DEFAULT_CLASS_PATTERN = /^\s*(class|interface|struct)\s+\w+/;
  return findScopeByPattern(lines, guardLine, language, 'CLASS', 'class', DEFAULT_CLASS_PATTERN);
}

/**
 * Find block scope boundaries using regex
 */
function findBlockScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  // Look for next opening brace after guard line
  let blockStart = -1;
  for (let i = guardLine + 1; i < lines.length; i++) {
    if (lines[i].includes('{') || (language === 'python' && lines[i].match(/:\s*$/))) {
      blockStart = i;
      break;
    }
  }

  if (blockStart === -1) return null;

  const blockEnd = findScopeEnd(lines, blockStart, language);

  return {
    startLine: blockStart + 1,  // Convert to 1-based
    endLine: blockEnd + 1,      // Convert to 1-based
    type: 'block'
  };
}

/**
 * Find signature scope boundaries using regex
 */
function findSignatureScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  // Find the function containing the guard
  let funcStart = -1;
  const langPatterns = getLanguagePatterns(language);
  const pattern = langPatterns?.FUNCTION || /^\s*(function|def|func|fun|fn)\s+\w+/;

  // Search backwards for function declaration
  for (let i = guardLine; i >= 0; i--) {
    if (pattern.test(lines[i])) {
      funcStart = i;
      break;
    }
  }

  if (funcStart === -1) return null;

  // Find where the body starts (opening brace or colon)
  let bodyStart = funcStart;
  for (let i = funcStart; i < lines.length && i <= funcStart + 10; i++) {
    if (lines[i].includes('{') || (language === 'python' && lines[i].includes(':'))) {
      bodyStart = i;
      break;
    }
  }

  return {
    startLine: funcStart + 1,  // Convert to 1-based
    endLine: bodyStart + 1,     // Convert to 1-based
    type: 'signature'
  };
}

/**
 * Find body scope boundaries using regex
 */
function findBodyScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  // Find the function containing the guard
  let funcStart = -1;
  const langPatterns = getLanguagePatterns(language);
  const pattern = langPatterns?.FUNCTION || /^\s*(function|def|func|fun|fn)\s+\w+/;

  // Search backwards for function declaration
  for (let i = guardLine; i >= 0; i--) {
    if (pattern.test(lines[i])) {
      funcStart = i;
      break;
    }
  }

  if (funcStart === -1) return null;

  // Find body start
  const bodyStart = findBodyStart(lines, funcStart, language);
  const bodyEnd = findScopeEnd(lines, bodyStart, language);

  return {
    startLine: bodyStart + 1,  // Convert to 1-based
    endLine: bodyEnd + 1,      // Convert to 1-based
    type: 'body'
  };
}

/**
 * Find method scope boundaries using regex
 */
function findMethodScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  // For now, treat methods the same as functions
  return findFunctionScope(lines, guardLine, language);
}

/**
 * Find statement scope boundaries using regex
 */
function findStatementScope(lines: string[], guardLine: number): ScopeBoundary | null {
  // Find the statement containing the guard line
  let statementStart = guardLine;
  let statementEnd = guardLine;

  // Look for statement terminators
  for (let i = guardLine; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(';') || line.match(/^\s*$/)) {
      statementEnd = i;
      break;
    }
    // Check for next line that starts with less indentation
    if (i > guardLine && lines[i + 1] && getIndentLevel(lines[i + 1]) < getIndentLevel(lines[guardLine])) {
      statementEnd = i;
      break;
    }
  }

  return {
    startLine: statementStart + 1,  // Convert to 1-based
    endLine: statementEnd + 1,      // Convert to 1-based
    type: 'statement'
  };
}

/**
 * Find the end of a scope by tracking delimiters
 */
function findScopeEnd(lines: string[], startLine: number, language: string): number {
  if (language === 'python') {
    return findPythonScopeEnd(lines, startLine);
  }

  // For brace-based languages
  let braceCount = 0;
  let inString = false;
  let stringChar = '';

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const prevChar = j > 0 ? line[j - 1] : '';

      // Handle strings
      if (!inString && (char === '"' || char === "'") && prevChar !== '\\') {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
      }

      // Count braces only outside strings
      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && i > startLine) {
            return i;
          }
        }
      }
    }
  }

  return lines.length - 1;
}

/**
 * Get the indentation level of a line
 */
function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

/**
 * Find Python scope end by tracking indentation
 */
function findPythonScopeEnd(lines: string[], startLine: number): number {
  // Find the base indentation level
  let baseIndent = -1;
  for (let i = startLine; i < lines.length && i <= startLine + 5; i++) {
    const line = lines[i];
    if (line.trim() && !line.trim().startsWith('#')) {
      baseIndent = getIndentLevel(line);
      break;
    }
  }

  if (baseIndent === -1) return startLine;

  // Find where indentation returns to or below base level
  let lastContentLine = startLine;
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const indent = getIndentLevel(line);
    if (indent <= baseIndent) {
      // Found end of scope
      break;
    }

    lastContentLine = i;
  }

  return lastContentLine;
}

/**
 * Get comment pattern for a language
 */
function getCommentPattern(language: string): RegExp {
  // For unknown languages, use common comment patterns
  return /^\s*\/\/|^\s*#/;
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