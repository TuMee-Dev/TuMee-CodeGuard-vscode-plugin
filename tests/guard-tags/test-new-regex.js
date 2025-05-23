// Standalone test for new guard tag regex patterns

// Copy of the new regex pattern from acl.ts
const GUARD_TAG_REGEX = /(?:\/\/|#|--|\/\*|\*)*\s*@guard:(ai|human)(?:\[([^\]]+)\])?:(r|w|n|context)(?:\.([a-zA-Z]+|\d+))?(?:(\+[a-zA-Z]+)*)?(?:(-[a-zA-Z]+)*)?/i;

// Simple parse function
function parseGuardTag(line) {
  const match = line.match(GUARD_TAG_REGEX);
  if (!match) return null;
  
  const [, target, identifier, permission, scopeOrCount, addScopesStr, removeScopesStr] = match;
  const isLineCount = scopeOrCount && /^\d+$/.test(scopeOrCount);
  
  return {
    target: target.toLowerCase(),
    identifier: identifier || undefined,
    permission: permission.toLowerCase(),
    scope: isLineCount ? undefined : scopeOrCount,
    lineCount: isLineCount ? parseInt(scopeOrCount, 10) : undefined,
    addScopes: addScopesStr ? addScopesStr.split('+').filter(s => s) : undefined,
    removeScopes: removeScopesStr ? removeScopesStr.split('-').filter(s => s) : undefined,
  };
}

// Test cases
console.log("=== Testing New AI Guard Format ===");
console.log("// @guard:ai:r =>", parseGuardTag("// @guard:ai:r"));
console.log("# @guard:ai:w =>", parseGuardTag("# @guard:ai:w"));
console.log("// @guard:ai:n =>", parseGuardTag("// @guard:ai:n"));
console.log("// @guard:ai:context =>", parseGuardTag("// @guard:ai:context"));

console.log("\n=== Testing AI Guards with Identifiers ===");
console.log("// @guard:ai[claude-4]:w =>", parseGuardTag("// @guard:ai[claude-4]:w"));
console.log("# @guard:ai[gpt-4,claude-4]:r =>", parseGuardTag("# @guard:ai[gpt-4,claude-4]:r"));

console.log("\n=== Testing Human Guard Format ===");
console.log("// @guard:human:r =>", parseGuardTag("// @guard:human:r"));
console.log("// @guard:human:n =>", parseGuardTag("// @guard:human:n"));
console.log("// @guard:human[security-team]:w =>", parseGuardTag("// @guard:human[security-team]:w"));

console.log("\n=== Testing Semantic Scopes ===");
console.log("// @guard:ai:r.func =>", parseGuardTag("// @guard:ai:r.func"));
console.log("# @guard:ai:n.class =>", parseGuardTag("# @guard:ai:n.class"));
console.log("// @guard:ai:w.block =>", parseGuardTag("// @guard:ai:w.block"));

console.log("\n=== Testing Line Count Support ===");
console.log("// @guard:ai:r.5 =>", parseGuardTag("// @guard:ai:r.5"));
console.log("# @guard:ai:n.10 =>", parseGuardTag("# @guard:ai:n.10"));

console.log("\n=== Testing Complex Examples ===");
console.log("// @guard:ai[claude-4,gpt-4]:w.func =>", parseGuardTag("// @guard:ai[claude-4,gpt-4]:w.func"));
console.log("/* @guard:human[dev-team]:r.class */ =>", parseGuardTag("/* @guard:human[dev-team]:r.class */"));

console.log("\n=== Testing Compound Scopes ===");
console.log("// @guard:ai:r.func+doc =>", parseGuardTag("// @guard:ai:r.func+doc"));
console.log("// @guard:ai:w.class-methods =>", parseGuardTag("// @guard:ai:w.class-methods"));

console.log("\n=== Testing Markdown Format ===");
console.log("<!-- @guard:ai:context --> =>", parseGuardTag("<!-- @guard:ai:context -->"));
console.log("<!-- @guard:human[docs-team]:w --> =>", parseGuardTag("<!-- @guard:human[docs-team]:w -->"));

console.log("\n=== Testing Edge Cases ===");
console.log("@guard:ai:r (no comment) =>", parseGuardTag("@guard:ai:r"));
console.log("// @GUARD:AI:R (uppercase) =>", parseGuardTag("// @GUARD:AI:R"));
console.log("# @guard:ai[*]:n (wildcard) =>", parseGuardTag("# @guard:ai[*]:n"));