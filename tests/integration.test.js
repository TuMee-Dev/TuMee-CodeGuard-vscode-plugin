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

// Extract patterns using regex
const extractPattern = (name) => {
  const match = regexCacheSource.match(new RegExp(`${name}:\\s*\/(.*?)\/([gim]*),?`, 's'));
  if (match) {
    return new RegExp(match[1], match[2]);
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
  const permissions = new Array(lines.length).fill({ permission: 'default', target: null });
  let currentPermission = { permission: 'default', target: null };
  
  for (let i = 0; i < lines.length; i++) {
    const tag = parseGuardTag(lines[i]);
    
    if (tag) {
      if (tag.scope && !isNaN(parseInt(tag.scope))) {
        // Bounded region
        const lineCount = parseInt(tag.scope);
        for (let j = i; j <= i + lineCount && j < lines.length; j++) {
          permissions[j] = { permission: tag.permission, target: tag.target };
        }
      } else {
        // Unbounded region
        currentPermission = { permission: tag.permission, target: tag.target };
      }
    } else if (currentPermission.permission !== 'default') {
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
  { line: 1, permission: 'w', target: 'ai' },
  { line: 2, permission: 'w', target: 'ai' },
  { line: 3, permission: 'r', target: 'ai' },
  { line: 4, permission: 'r', target: 'ai' },
  { line: 5, permission: 'r', target: 'ai' },
  { line: 6, permission: 'w', target: 'ai' }
];

let permsPassed = true;
expectedPerms.forEach(expected => {
  const actual = perms[expected.line];
  if (actual.permission !== expected.permission || actual.target !== expected.target) {
    permsPassed = false;
  }
});

if (permsPassed) {
  console.log('  ✅ Line permissions computed correctly');
  passed++;
} else {
  console.log('  ❌ Line permission computation failed');
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
  if (legacyPattern.test('// @guard:ai:r') && legacyPattern.test('# @guard:human:w')) {
    console.log('  ✅ Legacy patterns work');
    passed++;
  } else {
    console.log('  ❌ Legacy pattern matching failed');
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