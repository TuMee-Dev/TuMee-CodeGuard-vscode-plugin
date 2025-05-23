#!/usr/bin/env node
/**
 * Integration Tests for TuMee VSCode Plugin
 * Tests the complete flow of guard tag parsing and permission computation
 */

// Since the webpack bundle doesn't export individual modules,
// we'll test the actual behavior using the patterns from the source

const fs = require('fs');
const path = require('path');

// Load regex patterns from source
const regexCacheSource = fs.readFileSync(
  path.join(__dirname, '../src/utils/regexCache.ts'), 
  'utf8'
);

// Extract patterns from TypeScript object notation
const extractPattern = (name) => {
  // Match pattern in TypeScript object: NAME: /pattern/flags,
  const regex = new RegExp(`${name}:\\s*\/((?:[^/\\\\]|\\\\.)*)\\/([gimsu]*)(?:,|\\s*(?:\/\/|$))`, 'm');
  const match = regexCacheSource.match(regex);
  if (match) {
    try {
      return new RegExp(match[1], match[2]);
    } catch (e) {
      console.error(`Failed to compile pattern ${name}:`, e.message);
      return null;
    }
  }
  return null;
};

const PATTERNS = {
  GUARD_TAG: extractPattern('GUARD_TAG'),
  MARKDOWN_GUARD_TAG: extractPattern('MARKDOWN_GUARD_TAG'),
  LEGACY_GUARD_TAG: extractPattern('LEGACY_GUARD_TAG'),
};

// Simple guard tag parser for testing
function parseGuardTag(line) {
  const pattern = PATTERNS.GUARD_TAG;
  if (!pattern) return null;
  
  pattern.lastIndex = 0;
  const match = pattern.exec(line);
  
  if (!match) return null;
  
  const [, target, identifier, permission, scope, addScopes, removeScopes] = match;
  
  const result = {
    target,
    permission,
    type: 'guard'
  };
  
  if (identifier) result.identifier = identifier;
  if (scope) result.scope = scope;
  
  if (addScopes) {
    result.addScopes = addScopes.split('+').filter(s => s).map(s => s.trim());
  }
  
  if (removeScopes) {
    result.removeScopes = removeScopes.split('-').filter(s => s).map(s => s.substring(1));
  }
  
  return result;
}

console.log('Integration Tests\n=================\n');

let passed = 0;
let failed = 0;

// Test 1: Pattern Extraction
console.log('1. Pattern Extraction:');
if (PATTERNS.GUARD_TAG && PATTERNS.MARKDOWN_GUARD_TAG && PATTERNS.LEGACY_GUARD_TAG) {
  console.log('  ✅ All patterns loaded successfully');
  passed++;
} else {
  console.log('  ❌ Failed to extract patterns');
  failed++;
}

// Test 2: Basic Guard Tag Parsing
console.log('\n2. Basic Guard Tag Parsing:');
const basicTests = [
  { input: '// @guard:ai:r', expected: { target: 'ai', permission: 'r' } },
  { input: '# @guard:human:w', expected: { target: 'human', permission: 'w' } },
  { input: '// @guard:ai[gpt-4]:context', expected: { target: 'ai', identifier: 'gpt-4', permission: 'context' } },
  { input: '// @guard:ai:r.5', expected: { target: 'ai', permission: 'r', scope: '5' } },
  { input: '// @guard:ai:r.func', expected: { target: 'ai', permission: 'r', scope: 'func' } },
];

basicTests.forEach(test => {
  const result = parseGuardTag(test.input);
  if (result && result.target === test.expected.target && 
      result.permission === test.expected.permission &&
      (!test.expected.identifier || result.identifier === test.expected.identifier) &&
      (!test.expected.scope || result.scope === test.expected.scope)) {
    console.log(`  ✅ ${test.input}`);
    passed++;
  } else {
    console.log(`  ❌ ${test.input}`);
    failed++;
  }
});

// Test 3: Line Permission Logic
console.log('\n3. Line Permission Logic:');

// Simulate line permission computation
function computeSimplePermissions(lines) {
  // Create individual objects for each line to avoid shared reference issues
  const permissions = [];
  const boundedLines = new Set(); // Track which lines are in bounded regions
  
  for (let i = 0; i < lines.length; i++) {
    permissions.push({ permission: 'default', target: null });
  }
  
  let currentPermission = { permission: 'default', target: null };
  
  // First pass: mark bounded regions
  for (let i = 0; i < lines.length; i++) {
    const tag = parseGuardTag(lines[i]);
    if (tag && tag.scope && !isNaN(parseInt(tag.scope))) {
      const lineCount = parseInt(tag.scope);
      for (let j = i; j <= i + lineCount && j < lines.length; j++) {
        boundedLines.add(j);
      }
    }
  }
  
  // Second pass: apply permissions
  for (let i = 0; i < lines.length; i++) {
    const tag = parseGuardTag(lines[i]);
    
    if (tag) {
      if (tag.scope && !isNaN(parseInt(tag.scope))) {
        // Bounded region - applies to current line and next N lines
        const lineCount = parseInt(tag.scope);
        permissions[i] = { permission: tag.permission, target: tag.target };
        for (let j = i + 1; j <= i + lineCount && j < lines.length; j++) {
          permissions[j] = { permission: tag.permission, target: tag.target };
        }
      } else {
        // Unbounded region - update current permission and apply to this line
        currentPermission = { permission: tag.permission, target: tag.target };
        permissions[i] = { permission: tag.permission, target: tag.target };
      }
    } else if (!boundedLines.has(i) && currentPermission.permission !== 'default') {
      // No tag on this line and not in a bounded region, use current unbounded permission
      permissions[i] = currentPermission;
    }
  }
  
  return permissions;
}

const testDoc = [
  '// Normal code',
  '// @guard:ai:w',
  '// AI can write',
  '// @guard:ai:r.2',
  '// Read line 1',
  '// Read line 2',
  '// Back to write'
];

const perms = computeSimplePermissions(testDoc);
const expectedPerms = [
  { line: 0, permission: 'default', target: null }, // Before any guard tag
  { line: 1, permission: 'w', target: 'ai' },       // Guard tag line itself
  { line: 2, permission: 'w', target: 'ai' },       // Following unbounded guard
  { line: 3, permission: 'r', target: 'ai' },       // Guard tag with .2 (line 1 of bounded region)
  { line: 4, permission: 'r', target: 'ai' },       // Within bounded region (line 2 of bounded region)
  { line: 5, permission: 'r', target: 'ai' },       // Last line of bounded region (line 3 total: tag + 2 more)
  { line: 6, permission: 'w', target: 'ai' }        // Back to unbounded region
];

let permsPassed = true;
let debugOutput = [];
expectedPerms.forEach(expected => {
  const actual = perms[expected.line];
  if (actual.permission !== expected.permission || actual.target !== expected.target) {
    permsPassed = false;
    debugOutput.push(`    Line ${expected.line}: expected ${expected.target}:${expected.permission}, got ${actual.target}:${actual.permission}`);
  }
});

if (permsPassed) {
  console.log('  ✅ Line permissions computed correctly');
  passed++;
} else {
  console.log('  ❌ Line permission computation failed');
  if (debugOutput.length > 0) {
    debugOutput.forEach(line => console.log(line));
  }
  failed++;
}

// Test 4: Markdown Support
console.log('\n4. Markdown Guard Tags:');
const markdownPattern = PATTERNS.MARKDOWN_GUARD_TAG;
if (markdownPattern) {
  markdownPattern.lastIndex = 0;
  if (markdownPattern.test('<!-- @guard:ai:r -->')) {
    console.log('  ✅ Markdown pattern matches correctly');
    passed++;
  } else {
    console.log('  ❌ Markdown pattern failed');
    failed++;
  }
} else {
  console.log('  ❌ No markdown pattern found');
  failed++;
}

// Test 5: Legacy Format Support
console.log('\n5. Legacy Format Support:');
const legacyPattern = PATTERNS.LEGACY_GUARD_TAG;
if (legacyPattern) {
  legacyPattern.lastIndex = 0;
  const test1 = legacyPattern.test('// @guard:ai:r');
  legacyPattern.lastIndex = 0; // Reset lastIndex for global regex
  const test2 = legacyPattern.test('# @guard:human:w');
  
  if (test1 && test2) {
    console.log('  ✅ Legacy patterns work');
    passed++;
  } else {
    console.log('  ❌ Legacy pattern matching failed');
    console.log(`    Test 1 (// @guard:ai:r): ${test1}`);
    console.log(`    Test 2 (# @guard:human:w): ${test2}`);
    failed++;
  }
} else {
  console.log('  ❌ No legacy pattern found');
  failed++;
}

// Summary
console.log('\n\nSummary');
console.log('=======');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);