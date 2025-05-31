/**
 * Browser-compatible guard parser
 * This is the guard parsing logic adapted for webview usage
 */

// Guard tag pattern from regexCache.ts - exactly the same pattern
const GUARD_TAG_PATTERN = /(?:\/\/|#|--|\/\*|\*)*\s*@guard:(ai|human|hu)(?:\[([^\]]+)\])?:(read|write|noaccess|context|r|w|n)(?:\.([a-zA-Z]+|\d+))?(?:(\+[a-zA-Z]+)*)?(?:(-[a-zA-Z]+)*)?/gi;

// Parse guard tags from a line - browser-compatible version of parseGuardTag from acl.ts
function parseGuardTag(line) {
  // Track found permissions for each target
  let aiPermission = undefined;
  let humanPermission = undefined;
  let aiIsContext = false;
  let humanIsContext = false;
  let identifier = undefined;
  let scope = undefined;
  let lineCount = undefined;
  const addScopes = [];
  const removeScopes = [];

  // Use global flag to find all matches in the line
  const newFormatRegex = new RegExp(GUARD_TAG_PATTERN.source, 'g');
  let match;

  while ((match = newFormatRegex.exec(line)) !== null) {
    const [, target, id, permission, scopeOrCount, addScopesStr, removeScopesStr] = match;

    // Check if scope is numeric (line count) or semantic
    const isLineCount = scopeOrCount && /^\d+$/.test(scopeOrCount);

    // Normalize target: 'hu' -> 'human'
    const normalizedTarget = target.toLowerCase() === 'hu' ? 'human' : target.toLowerCase();

    // Normalize permission: 'read' -> 'r', 'write' -> 'w', 'noaccess' -> 'n'
    let normalizedPermission = permission.toLowerCase();
    if (normalizedPermission === 'read') normalizedPermission = 'r';
    else if (normalizedPermission === 'write') normalizedPermission = 'w';
    else if (normalizedPermission === 'noaccess') normalizedPermission = 'n';

    // Set identifier (use first found)
    if (id && !identifier) {
      identifier = id;
    }

    // Set scope/lineCount (use first found)
    if (isLineCount && !lineCount) {
      lineCount = parseInt(scopeOrCount, 10);
    } else if (!isLineCount && scopeOrCount && !scope) {
      scope = scopeOrCount;
    }

    // Merge add/remove scopes
    if (addScopesStr) {
      addScopes.push(...addScopesStr.split('+').filter(s => s));
    }
    if (removeScopesStr) {
      removeScopes.push(...removeScopesStr.split('-').filter(s => s));
    }

    // Store permission by target
    if (normalizedTarget === 'ai') {
      if (normalizedPermission === 'context') {
        // Handle context with modifiers
        if (scopeOrCount) {
          const scopeLower = scopeOrCount.toLowerCase();
          if (scopeLower.startsWith('w')) {
            // context:w or context:write
            aiPermission = 'contextWrite';
            scope = undefined; // Clear scope since it's part of the permission
          } else if (scopeLower.startsWith('r')) {
            // context:r or context:read  
            aiIsContext = true;
            scope = undefined; // Clear scope since it's part of the permission
          } else {
            // Some other scope modifier
            aiIsContext = true;
          }
        } else {
          // Just 'context' with no modifier - defaults to read
          aiIsContext = true;
        }
      } else {
        aiPermission = normalizedPermission;
      }
    } else if (normalizedTarget === 'human') {
      if (normalizedPermission === 'context') {
        // Handle context with modifiers
        if (scopeOrCount) {
          const scopeLower = scopeOrCount.toLowerCase();
          if (scopeLower.startsWith('w')) {
            // context:w or context:write
            humanPermission = 'contextWrite';
            scope = undefined; // Clear scope since it's part of the permission
          } else if (scopeLower.startsWith('r')) {
            // context:r or context:read
            humanIsContext = true;
            scope = undefined; // Clear scope since it's part of the permission
          } else {
            // Some other scope modifier
            humanIsContext = true;
          }
        } else {
          // Just 'context' with no modifier - defaults to read
          humanIsContext = true;
        }
      } else {
        humanPermission = normalizedPermission;
      }
    }
  }

  // If we found any permissions or context flags, return them
  if (aiPermission || humanPermission || aiIsContext || humanIsContext) {
    return {
      identifier,
      scope,
      lineCount,
      addScopes,
      removeScopes,
      type: 'guard',
      aiPermission,
      humanPermission,
      aiIsContext,
      humanIsContext
    };
  }

  // No valid guard tags found
  return null;
}

// Export for webview
window.GuardParser = {
  parseGuardTag: parseGuardTag,
  GUARD_TAG_PATTERN: GUARD_TAG_PATTERN
};