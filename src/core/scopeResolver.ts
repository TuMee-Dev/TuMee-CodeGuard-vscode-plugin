/**
 * Core scope resolution logic - platform agnostic
 * No VSCode dependencies allowed in this module
 */

import type { Tree, Node } from 'web-tree-sitter';
import type { IDocument, ScopeBoundary } from './types';
import { parseDocument, findNodeAtPosition, findParentOfType, getNodeBoundaries } from './parser';
import { getLanguageScopeMappings } from './languageScopes';

// Guard tag prefix for context detection
const GUARD_TAG_PREFIX = '@guard:';

/**
 * Resolve semantic scope using tree-sitter
 */
export async function resolveSemanticScope(
  document: IDocument,
  line: number,
  scope: string,
  context: any, // Platform-specific context for parser initialization
  _addScopes?: string[],
  _removeScopes?: string[]
): Promise<ScopeBoundary | null> {
  const tree = await parseDocument(context, document);
  if (!tree) return null;

  const languageId = document.languageId;
  const scopeMap = getLanguageScopeMappings(languageId);
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
          // Check if the guard is inside a function/class - if not, prefer statement-by-statement
          const guardNode = findNodeAtPosition(tree, line);
          const enclosingFunc = guardNode ? findParentOfType(guardNode, ['class_declaration', 'function_declaration', 'method_definition', 'function_definition']) : null;
          
          // If not inside a function/class, skip tree-sitter block detection and use fallback
          if (!enclosingFunc) {
            // Skip tree-sitter block detection for top-level statements
            targetNode = null;
          } else {
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
          }
        } else {
          // For non-block scopes, use the original parent search
          targetNode = findParentOfType(searchNode, nodeTypes);
        }

        if (targetNode && targetNode.startPosition.row >= line) {
          const bounds = getNodeBoundaries(targetNode);

          // For Python classes, trim trailing whitespace
          if (scope === 'class' && document.languageId === 'python') {
            const lines = document.text.split('\n');
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
    
    // If we couldn't find a block scope, fall back to statement block
    // Include consecutive statements until hitting another guard, blank line, or EOF
    // Also prefer statement-by-statement for top-level blocks (not inside functions/classes)
    if (scope === 'block') {
      const guardNode = findNodeAtPosition(tree, line);
      const enclosingFunc = guardNode ? findParentOfType(guardNode, ['class_declaration', 'function_declaration', 'method_definition', 'function_definition']) : null;
      
      // Always use statement-by-statement for top-level blocks, or if tree-sitter failed
      if (!enclosingFunc || true) {
      const startLineNumber = line + 1; // Start from line after guard
      let endLineNumber = startLineNumber;
      
      // Scan forward to find the end of the statement block
      for (let currentLine = startLineNumber; currentLine < document.lineCount; currentLine++) {
        const lineText = document.lineAt(currentLine).text.trim();
        
        // Stop at blank lines
        if (lineText === '') {
          break;
        }
        
        // Stop at guard tags
        if (lineText.includes(GUARD_TAG_PREFIX)) {
          break;
        }
        
        // Include this line in the block
        endLineNumber = currentLine;
      }
      
      // Return the statement block if we found any statements
      if (endLineNumber >= startLineNumber) {
        return {
          startLine: startLineNumber + 1, // Convert to 1-based
          endLine: endLineNumber + 1,     // Convert to 1-based
          type: 'statement'
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
      return findSignatureScope(node, nodeTypes, line);

    case 'body':
      return findBodyScope(node, nodeTypes);

    case 'stmt':
    case 'statement':
      return findStatementScope(node, line);

    case 'context':
      // Context applies only to documentation nodes
      return findContextScope(tree, line, document);

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
export function findSignatureScope(
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
export function findBodyScope(
  node: Node,
  nodeTypes: string[]
): ScopeBoundary | null {
  // Find the function/method containing this node
  const funcNode = findParentOfType(node, nodeTypes);
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
export function findStatementScope(
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
export function findContextScope(
  tree: Tree,
  line: number,
  document: IDocument
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
export function isDocumentationNode(node: Node, languageId: string): boolean {
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