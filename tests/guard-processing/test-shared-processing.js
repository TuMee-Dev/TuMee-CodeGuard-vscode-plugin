#!/usr/bin/env node

// Test the shared guard processing logic
const { parseGuardTags, computeLinePermissions } = require('../../dist/utils/guardProcessor');
const { parseGuardTag } = require('../../dist/utils/acl');

// Mock document object
class MockDocument {
  constructor(text, languageId = 'javascript') {
    this.text = text;
    this.languageId = languageId;
    this.version = 1;
  }
  
  getText() {
    return this.text;
  }
}

// Test cases
const testCases = [
  {
    name: 'Basic guard tags',
    document: new MockDocument(`
// Normal code
// @guard:ai:w
function test() {
  // AI can write here
}
// @guard:human:r
// Human read-only section
`),
    expected: {
      guardCount: 2,
      permissions: [
        { line: 0, target: null, permission: 'default' },
        { line: 1, target: null, permission: 'default' },
        { line: 2, target: 'ai', permission: 'w' },
        { line: 3, target: 'ai', permission: 'w' },
        { line: 4, target: 'ai', permission: 'w' },
        { line: 5, target: 'ai', permission: 'w' },
        { line: 6, target: 'human', permission: 'r' },
        { line: 7, target: 'human', permission: 'r' },
      ]
    }
  },
  {
    name: 'Line count guards',
    document: new MockDocument(`
// @guard:ai:r.3
// Line 1
// Line 2
// Line 3
// Should revert to default
`),
    expected: {
      guardCount: 1,
      permissions: [
        { line: 0, target: 'ai', permission: 'r' },
        { line: 1, target: 'ai', permission: 'r' },
        { line: 2, target: 'ai', permission: 'r' },
        { line: 3, target: 'ai', permission: 'r' },
        { line: 4, target: null, permission: 'default' },
      ]
    }
  },
  {
    name: 'New format with identifiers',
    document: new MockDocument(`
// @guard:ai[gpt-4]:w
// AI write section
// @guard:human[team-a]:n
// Human no access
// @guard:ai:context
// Context section
`),
    expected: {
      guardCount: 3,
      hasIdentifiers: true,
      permissions: [
        { line: 0, target: 'ai', permission: 'w' },
        { line: 1, target: 'ai', permission: 'w' },
        { line: 2, target: 'human', permission: 'n' },
        { line: 3, target: 'human', permission: 'n' },
        { line: 4, target: 'ai', permission: 'context' },
        { line: 5, target: 'ai', permission: 'context' },
      ]
    }
  },
  {
    name: 'Python signature scope',
    document: new MockDocument(`
# Normal code
# @guard:ai:r.sig
def test_function(param1, param2):
    """Test function"""
    return param1 + param2

# Should revert to default
`, 'python'),
    expected: {
      guardCount: 1,
      hasSemanticScope: true,
      permissions: [
        { line: 0, target: null, permission: 'default' },
        { line: 1, target: 'ai', permission: 'r' },
        { line: 2, target: 'ai', permission: 'r' },
        { line: 3, target: 'ai', permission: 'r' },
        { line: 4, target: 'ai', permission: 'r' },
        { line: 5, target: null, permission: 'default' },
        { line: 6, target: null, permission: 'default' },
      ]
    }
  }
];

// Run tests
console.log('Testing Shared Guard Processing\n===============================\n');

let passed = 0;
let failed = 0;

testCases.forEach(testCase => {
  console.log(`Test: ${testCase.name}`);
  
  const lines = testCase.document.getText().split(/\r?\n/);
  const guardTags = parseGuardTags(testCase.document, lines);
  const linePermissions = computeLinePermissions(lines, guardTags);
  
  // Check guard count
  if (guardTags.length !== testCase.expected.guardCount) {
    console.log(`  ❌ Guard count mismatch: expected ${testCase.expected.guardCount}, got ${guardTags.length}`);
    failed++;
    return;
  }
  
  // Check identifiers if expected
  if (testCase.expected.hasIdentifiers) {
    const hasIdentifiers = guardTags.some(tag => tag.identifier);
    if (!hasIdentifiers) {
      console.log('  ❌ Expected guards with identifiers');
      failed++;
      return;
    }
  }
  
  // Check semantic scopes if expected
  if (testCase.expected.hasSemanticScope) {
    const hasSemanticScope = guardTags.some(tag => tag.scope && isNaN(parseInt(tag.scope)));
    if (!hasSemanticScope) {
      console.log('  ❌ Expected guards with semantic scopes');
      failed++;
      return;
    }
  }
  
  // Check line permissions
  let permissionsPassed = true;
  testCase.expected.permissions.forEach(expected => {
    const actual = linePermissions[expected.line];
    if (!actual || actual.target !== expected.target || actual.permission !== expected.permission) {
      console.log(`  ❌ Line ${expected.line}: expected ${expected.target}:${expected.permission}, got ${actual?.target}:${actual?.permission}`);
      permissionsPassed = false;
    }
  });
  
  if (permissionsPassed) {
    console.log('  ✅ All permissions match');
    passed++;
  } else {
    failed++;
  }
  
  console.log('');
});

// Test performance
console.log('Performance Test\n================');
const largeDoc = new MockDocument(
  Array(1000).fill('// Some code\n').join('') +
  '// @guard:ai:w\n' +
  Array(1000).fill('// More code\n').join('')
);

const startTime = process.hrtime();
const lines = largeDoc.getText().split(/\r?\n/);
const tags = parseGuardTags(largeDoc, lines);
const perms = computeLinePermissions(lines, tags);
const endTime = process.hrtime(startTime);

const totalMs = endTime[0] * 1000 + endTime[1] / 1000000;
console.log(`Processed ${lines.length} lines in ${totalMs.toFixed(2)}ms`);
console.log(`Average: ${(totalMs / lines.length).toFixed(4)}ms per line\n`);

// Summary
console.log('Test Summary\n============');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);