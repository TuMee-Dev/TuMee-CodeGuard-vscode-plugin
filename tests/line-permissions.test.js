#!/usr/bin/env node
/**
 * Line Permissions Tests
 * Tests the core logic for computing line-by-line permissions
 */

const { parseGuardTags, computeLinePermissions } = require('../dist/utils/guardProcessor');

// Mock document for testing
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

const testCases = [
  {
    name: 'Basic unbounded regions',
    document: `// Normal code
// @guard:ai:w
// AI can write here
// More AI code
// @guard:human:r
// Human read-only section`,
    expected: [
      { line: 0, permission: 'default' },
      { line: 1, permission: 'w', target: 'ai' },
      { line: 2, permission: 'w', target: 'ai' },
      { line: 3, permission: 'w', target: 'ai' },
      { line: 4, permission: 'r', target: 'human' },
      { line: 5, permission: 'r', target: 'human' },
    ]
  },
  
  {
    name: 'Bounded regions with line count',
    document: `# Start of file
# @guard:ai:r.3
# Line 1 of read-only
# Line 2 of read-only  
# Line 3 of read-only
# This should be default
# @guard:ai:w
# Write access from here`,
    expected: [
      { line: 0, permission: 'default' },
      { line: 1, permission: 'r', target: 'ai' },
      { line: 2, permission: 'r', target: 'ai' },
      { line: 3, permission: 'r', target: 'ai' },
      { line: 4, permission: 'r', target: 'ai' },
      { line: 5, permission: 'default' },
      { line: 6, permission: 'w', target: 'ai' },
      { line: 7, permission: 'w', target: 'ai' },
    ]
  },
  
  {
    name: 'Nested bounded regions',
    document: `// @guard:ai:w
// Unbounded write region
// @guard:ai:n.2
// No access line 1
// No access line 2
// Should revert to write
// More write access`,
    expected: [
      { line: 0, permission: 'w', target: 'ai' },
      { line: 1, permission: 'w', target: 'ai' },
      { line: 2, permission: 'n', target: 'ai' },
      { line: 3, permission: 'n', target: 'ai' },
      { line: 4, permission: 'n', target: 'ai' },
      { line: 5, permission: 'w', target: 'ai' },
      { line: 6, permission: 'w', target: 'ai' },
    ]
  },
  
  {
    name: 'Empty line inheritance',
    document: `// @guard:ai:r
// Read-only section

// Empty line above should inherit
// @guard:ai:w
// Write section

// Empty line should be write`,
    expected: [
      { line: 0, permission: 'r', target: 'ai' },
      { line: 1, permission: 'r', target: 'ai' },
      { line: 2, permission: 'r', target: 'ai' },
      { line: 3, permission: 'r', target: 'ai' },
      { line: 4, permission: 'w', target: 'ai' },
      { line: 5, permission: 'w', target: 'ai' },
      { line: 6, permission: 'w', target: 'ai' },
      { line: 7, permission: 'w', target: 'ai' },
    ]
  },
  
  {
    name: 'Mixed targets',
    document: `// @guard:ai:r
// AI read-only
// @guard:human:w
// Human can write
// @guard:ai:context
// Context section`,
    expected: [
      { line: 0, permission: 'r', target: 'ai' },
      { line: 1, permission: 'r', target: 'ai' },
      { line: 2, permission: 'w', target: 'human' },
      { line: 3, permission: 'w', target: 'human' },
      { line: 4, permission: 'context', target: 'ai' },
      { line: 5, permission: 'context', target: 'ai' },
    ]
  }
];

console.log('Line Permission Tests\n====================\n');

let passed = 0;
let failed = 0;

testCases.forEach(testCase => {
  console.log(`Test: ${testCase.name}`);
  
  const doc = new MockDocument(testCase.document);
  const lines = testCase.document.split('\n');
  
  try {
    const guardTags = parseGuardTags(doc, lines);
    const linePermissions = computeLinePermissions(lines, guardTags);
    
    let testPassed = true;
    const errors = [];
    
    testCase.expected.forEach(expected => {
      const actual = linePermissions[expected.line];
      
      if (!actual) {
        testPassed = false;
        errors.push(`  Line ${expected.line}: No permission found`);
        return;
      }
      
      if (actual.permission !== expected.permission) {
        testPassed = false;
        errors.push(`  Line ${expected.line}: Expected permission '${expected.permission}', got '${actual.permission}'`);
      }
      
      if (expected.target && actual.target !== expected.target) {
        testPassed = false;
        errors.push(`  Line ${expected.line}: Expected target '${expected.target}', got '${actual.target}'`);
      }
    });
    
    if (testPassed) {
      console.log('  ✅ All permissions match\n');
      passed++;
    } else {
      console.log('  ❌ Permission mismatches:');
      errors.forEach(err => console.log(err));
      console.log('');
      failed++;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}\n`);
    failed++;
  }
});

// Performance test
console.log('Performance Test\n================');
const largeDoc = Array(1000).fill('// Some code').join('\n') + 
                 '\n// @guard:ai:w\n' +
                 Array(1000).fill('// More code').join('\n');

const perfDoc = new MockDocument(largeDoc);
const perfLines = largeDoc.split('\n');

const startTime = process.hrtime.bigint();
const tags = parseGuardTags(perfDoc, perfLines);
const perms = computeLinePermissions(perfLines, tags);
const endTime = process.hrtime.bigint();

const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
console.log(`Processed ${perfLines.length} lines in ${duration.toFixed(2)}ms`);
console.log(`Average: ${(duration / perfLines.length).toFixed(4)}ms per line\n`);

// Summary
console.log('Summary');
console.log('=======');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);