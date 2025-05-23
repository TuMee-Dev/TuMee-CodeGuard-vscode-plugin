#!/usr/bin/env node
/**
 * Semantic Scope Tests
 * Tests scope resolution for function, class, signature, etc.
 */

const { resolveSemantic } = require('../dist/utils/scopeResolver');

// Mock document
class MockDocument {
  constructor(text, languageId = 'javascript') {
    this.text = text;
    this.languageId = languageId;
  }
  
  getText() {
    return this.text;
  }
}

const testCases = [
  {
    name: 'JavaScript function scope',
    language: 'javascript',
    code: `// Some code
function testFunction() {
  const x = 1;
  return x + 2;
}
// After function`,
    guardLine: 1,
    scope: 'func',
    expected: { startLine: 1, endLine: 4 }
  },
  
  {
    name: 'JavaScript signature scope',
    language: 'javascript',
    code: `// Before
function myFunction(a, b, c) {
  // Function body
  return a + b + c;
}`,
    guardLine: 1,
    scope: 'sig',
    expected: { startLine: 1, endLine: 1 }
  },
  
  {
    name: 'Python function scope',
    language: 'python',
    code: `# Python code
def test_function(param1, param2):
    """Docstring"""
    x = param1 + param2
    return x
# After function`,
    guardLine: 1,
    scope: 'func',
    expected: { startLine: 1, endLine: 4 }
  },
  
  {
    name: 'Python signature with inline guard',
    language: 'python',
    code: `# Before
def __init__(self, size=100):  # @guard:ai:r.sig
    self.size = size
# After`,
    guardLine: 1,
    scope: 'sig',
    expected: { startLine: 1, endLine: 1 }
  },
  
  {
    name: 'JavaScript class scope',
    language: 'javascript',
    code: `// Before
class MyClass {
  constructor() {
    this.value = 0;
  }
  
  getValue() {
    return this.value;
  }
}
// After`,
    guardLine: 1,
    scope: 'class',
    expected: { startLine: 1, endLine: 9 }
  },
  
  {
    name: 'Block scope',
    language: 'javascript',
    code: `// Start
if (condition) {
  // Inside block
  doSomething();
}
// After block`,
    guardLine: 1,
    scope: 'block',
    expected: { startLine: 1, endLine: 4 }
  }
];

console.log('Semantic Scope Tests\n===================\n');

let passed = 0;
let failed = 0;

testCases.forEach(testCase => {
  console.log(`Test: ${testCase.name}`);
  
  const doc = new MockDocument(testCase.code, testCase.language);
  
  try {
    const result = resolveSemantic(
      doc,
      testCase.guardLine,
      testCase.scope
    );
    
    if (!result) {
      console.log(`  ❌ No scope found\n`);
      failed++;
      return;
    }
    
    if (result.startLine === testCase.expected.startLine && 
        result.endLine === testCase.expected.endLine) {
      console.log(`  ✅ Scope: lines ${result.startLine}-${result.endLine}\n`);
      passed++;
    } else {
      console.log(`  ❌ Expected: lines ${testCase.expected.startLine}-${testCase.expected.endLine}`);
      console.log(`     Got: lines ${result.startLine}-${result.endLine}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}\n`);
    failed++;
  }
});

// Test unsupported scopes
console.log('Unsupported Scope Tests\n=======================');

const unsupportedScopes = ['expr', 'stmt', 'unknown'];
unsupportedScopes.forEach(scope => {
  const doc = new MockDocument('// Test code');
  const result = resolveSemantic(doc, 0, scope);
  
  if (result === null) {
    console.log(`✅ Correctly returned null for unsupported scope: ${scope}`);
    passed++;
  } else {
    console.log(`❌ Should return null for unsupported scope: ${scope}`);
    failed++;
  }
});

// Summary
console.log('\n\nSummary');
console.log('=======');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);