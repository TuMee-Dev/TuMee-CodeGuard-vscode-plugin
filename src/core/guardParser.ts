/**
 * Core guard tag parser - platform agnostic
 * No VSCode dependencies allowed in this module
 * This is the single source of truth for guard tag parsing
 */

// Import patterns from core
import { GUARD_TAG_PATTERNS, normalizePermission, normalizeScope } from './patterns';

/**
 * Guard tag parse result interface
 */
export interface GuardTagParseResult {
  identifier?: string;
  scope?: string;
  lineCount?: number;
  addScopes?: string[];
  removeScopes?: string[];
  type: string;
  aiPermission?: string;
  humanPermission?: string;
  allPermission?: string;
  aiIsContext?: boolean;
  humanIsContext?: boolean;
  allIsContext?: boolean;
  metadata?: string;
  conditional?: string;
}

/**
 * Core guard tag parser function
 * Parses a line of text for guard tag information
 * Supports ALL specification formats
 * 
 * @param line The line of text to parse
 * @returns Parsed guard tag information or null if no valid guard tags found
 */
export function parseGuardTag(line: string): GuardTagParseResult | null {
  // Track found permissions for each target
  let aiPermission: string | undefined;
  let humanPermission: string | undefined;
  let allPermission: string | undefined;
  let aiIsContext = false;
  let humanIsContext = false;
  let allIsContext = false;
  let identifier: string | undefined;
  let scope: string | undefined;
  let lineCount: number | undefined;
  let metadata: string | undefined;
  let conditional: string | undefined;
  const addScopes: string[] = [];
  const removeScopes: string[] = [];

  // Use comprehensive pattern to find all matches in the line
  const comprehensiveRegex = new RegExp(GUARD_TAG_PATTERNS.PARSE_GUARD_TAG.source, 'gi');
  let match;

  while ((match = comprehensiveRegex.exec(line)) !== null) {
    // Updated capture groups for comprehensive pattern:
    // [1] = primary target (ai|human|hu|all)
    // [2] = secondary target (if comma-separated)
    // [3] = identifier [...]
    // [4] = permission (read-only|readonly|read|write|noaccess|none|context|r|w|n)
    // [5] = context modifier (:r|:w|:read|:write)
    // [6] = metadata [...]
    // [7] = scope (.word or .number)
    // [8] = conditional (.if(condition))
    // [9] = add scopes (+scope)
    // [10] = remove scopes (-scope)
    const [, primaryTarget, secondaryTarget, id, permission, contextModifier, metadataCapture, scopeOrCount, conditionalCapture, addScopesStr, removeScopesStr] = match;

    // Handle targets - support multi-target syntax
    const targets = [primaryTarget];
    if (secondaryTarget) {
      targets.push(secondaryTarget);
    }

    // Check if scope is numeric (line count) or semantic
    const isLineCount = scopeOrCount && GUARD_TAG_PATTERNS.NUMERIC_SCOPE.test(scopeOrCount);

    // Normalize permission using alias mapping
    let normalizedPermission = normalizePermission(permission);

    // Handle context modifier for context permissions
    if (normalizedPermission === 'context' && contextModifier) {
      const modifierNormalized = normalizePermission(contextModifier); // contextModifier already excludes ':'
      if (modifierNormalized === 'w' || modifierNormalized === 'write') {
        normalizedPermission = 'contextWrite';
      }
      // For 'r' or 'read', keep as 'context' (read context)
    }

    // Set identifier (use first found)
    if (id && !identifier) {
      identifier = id;
    }

    // Set metadata (use first found)
    if (metadataCapture && !metadata) {
      metadata = metadataCapture;
    }

    // Set conditional (use first found)
    if (conditionalCapture && !conditional) {
      conditional = conditionalCapture;
    }

    // Set scope/lineCount (use first found)
    if (isLineCount && !lineCount) {
      lineCount = parseInt(scopeOrCount, 10);
    } else if (!isLineCount && scopeOrCount && !scope) {
      scope = normalizeScope(scopeOrCount);
    }

    // Merge add/remove scopes
    if (addScopesStr) {
      addScopes.push(...addScopesStr.split('+').filter(s => s).map(s => normalizeScope(s)));
    }
    if (removeScopesStr) {
      removeScopes.push(...removeScopesStr.split('-').filter(s => s).map(s => normalizeScope(s)));
    }

    // Store permission by target(s)
    for (const target of targets) {
      const normalizedTarget = target.toLowerCase() === 'hu' ? 'human' : target.toLowerCase();
      
      if (normalizedTarget === 'ai') {
        if (normalizedPermission === 'context') {
          aiIsContext = true;
        } else if (normalizedPermission === 'contextWrite') {
          aiPermission = 'contextWrite';
        } else {
          aiPermission = normalizedPermission;
        }
      } else if (normalizedTarget === 'human') {
        if (normalizedPermission === 'context') {
          humanIsContext = true;
        } else if (normalizedPermission === 'contextWrite') {
          humanPermission = 'contextWrite';
        } else {
          humanPermission = normalizedPermission;
        }
      } else if (normalizedTarget === 'all') {
        if (normalizedPermission === 'context') {
          allIsContext = true;
        } else if (normalizedPermission === 'contextWrite') {
          allPermission = 'contextWrite';
        } else {
          allPermission = normalizedPermission;
        }
      }
    }
  }

  // If we found any permissions or context flags, return them
  if (aiPermission || humanPermission || allPermission || aiIsContext || humanIsContext || allIsContext) {
    return {
      identifier,
      scope,
      lineCount,
      addScopes: addScopes.length > 0 ? [...new Set(addScopes)] : undefined,
      removeScopes: removeScopes.length > 0 ? [...new Set(removeScopes)] : undefined,
      type: 'comprehensive',
      aiPermission,
      humanPermission,
      allPermission,
      aiIsContext,
      humanIsContext,
      allIsContext,
      metadata,
      conditional
    };
  }

  // No valid guard tags found
  return null;
}

/**
 * Convenience function to check if a line contains any guard tags
 */
export function hasGuardTag(line: string): boolean {
  return GUARD_TAG_PATTERNS.HAS_GUARD_TAG.test(line);
}

/**
 * Extract all guard tag matches from a line (for advanced processing)
 */
export function extractGuardTagMatches(line: string): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  const regex = new RegExp(GUARD_TAG_PATTERNS.PARSE_GUARD_TAG.source, 'gi');
  let match;
  
  while ((match = regex.exec(line)) !== null) {
    matches.push(match);
  }
  
  return matches;
}