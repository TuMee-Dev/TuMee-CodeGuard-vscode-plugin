// Test file for new guard tag format
const { parseGuardTag } = require('../../src/utils/acl');

// Test new format with AI targets
console.log("\n=== Testing New AI Guard Format ===");

// Basic AI guards
console.log(parseGuardTag("// @guard:ai:r"));
// Expected: { target: 'ai', permission: 'r', type: 'new-format' }

console.log(parseGuardTag("# @guard:ai:w"));
// Expected: { target: 'ai', permission: 'w', type: 'new-format' }

console.log(parseGuardTag("// @guard:ai:n"));
// Expected: { target: 'ai', permission: 'n', type: 'new-format' }

console.log(parseGuardTag("// @guard:ai:context"));
// Expected: { target: 'ai', permission: 'context', type: 'new-format' }

// AI guards with specific models
console.log("\n=== Testing AI Guards with Identifiers ===");
console.log(parseGuardTag("// @guard:ai[claude-4]:w"));
// Expected: { target: 'ai', identifier: 'claude-4', permission: 'w', type: 'new-format' }

console.log(parseGuardTag("# @guard:ai[gpt-4,claude-4]:r"));
// Expected: { target: 'ai', identifier: 'gpt-4,claude-4', permission: 'r', type: 'new-format' }

// Human guards
console.log("\n=== Testing Human Guard Format ===");
console.log(parseGuardTag("// @guard:human:r"));
// Expected: { target: 'human', permission: 'r', type: 'new-format' }

console.log(parseGuardTag("// @guard:human:n"));
// Expected: { target: 'human', permission: 'n', type: 'new-format' }

console.log(parseGuardTag("// @guard:human[security-team]:w"));
// Expected: { target: 'human', identifier: 'security-team', permission: 'w', type: 'new-format' }

// Semantic scopes
console.log("\n=== Testing Semantic Scopes ===");
console.log(parseGuardTag("// @guard:ai:r.func"));
// Expected: { target: 'ai', permission: 'r', scope: 'func', type: 'new-format' }

console.log(parseGuardTag("# @guard:ai:n.class"));
// Expected: { target: 'ai', permission: 'n', scope: 'class', type: 'new-format' }

console.log(parseGuardTag("// @guard:ai:w.block"));
// Expected: { target: 'ai', permission: 'w', scope: 'block', type: 'new-format' }

// Line counts (should still work)
console.log("\n=== Testing Line Count Support ===");
console.log(parseGuardTag("// @guard:ai:r.5"));
// Expected: { target: 'ai', permission: 'r', lineCount: 5, type: 'new-format' }

console.log(parseGuardTag("# @guard:ai:n.10"));
// Expected: { target: 'ai', permission: 'n', lineCount: 10, type: 'new-format' }

// Legacy format
console.log("\n=== Testing Legacy Format ===");
console.log(parseGuardTag("// @guard:ai:r"));
// Expected: { target: 'ai', permission: 'r', type: 'new-format' }

console.log(parseGuardTag("# @guard:ai:w.3"));
// Expected: { target: 'ai', permission: 'w', lineCount: 3, type: 'new-format' }

// Complex examples
console.log("\n=== Testing Complex Examples ===");
console.log(parseGuardTag("// @guard:ai[claude-4,gpt-4]:w.func"));
// Expected: { target: 'ai', identifier: 'claude-4,gpt-4', permission: 'w', scope: 'func', type: 'new-format' }

console.log(parseGuardTag("/* @guard:human[dev-team]:r.class */"));
// Expected: { target: 'human', identifier: 'dev-team', permission: 'r', scope: 'class', type: 'new-format' }

// Markdown format
console.log("\n=== Testing Markdown Format ===");
console.log(parseGuardTag("<!-- @guard:ai:context -->"));
// Expected: { target: 'ai', permission: 'context', type: 'new-format' }

console.log(parseGuardTag("<!-- @guard:human[docs-team]:w -->"));
// Expected: { target: 'human', identifier: 'docs-team', permission: 'w', type: 'new-format' }