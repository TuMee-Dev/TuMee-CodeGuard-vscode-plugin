#!/usr/bin/env node
/**
 * Guard Tag Pattern Tests
 * Tests all guard tag regex patterns and parsing functionality
 */

const { GUARD_TAG_PATTERNS } = require('../dist/utils/regexCache');
const { parseGuardTag } = require('../dist/utils/acl');

const testCases = {
  basicFormats: [
    { input: '// @guard:ai:r', expected: { target: 'ai', permission: 'r' } },
    { input: '# @guard:human:w', expected: { target: 'human', permission: 'w' } },
    { input: '-- @guard:ai:n', expected: { target: 'ai', permission: 'n' } },
    { input: '/* @guard:ai:context */', expected: { target: 'ai', permission: 'context' } },
  ],
  
  withIdentifiers: [
    { input: '// @guard:ai[gpt-4]:r', expected: { target: 'ai', identifier: 'gpt-4', permission: 'r' } },
    { input: '# @guard:human[team-security]:w', expected: { target: 'human', identifier: 'team-security', permission: 'w' } },
    { input: '// @guard:ai[claude-3.5]:context', expected: { target: 'ai', identifier: 'claude-3.5', permission: 'context' } },
  ],
  
  withLineCount: [
    { input: '// @guard:ai:r.5', expected: { target: 'ai', permission: 'r', scope: '5' } },
    { input: '# @guard:human:w.10', expected: { target: 'human', permission: 'w', scope: '10' } },
    { input: '// @guard:ai[model]:n.3', expected: { target: 'ai', identifier: 'model', permission: 'n', scope: '3' } },
  ],
  
  withSemanticScope: [
    { input: '// @guard:ai:r.func', expected: { target: 'ai', permission: 'r', scope: 'func' } },
    { input: '# @guard:human:w.class', expected: { target: 'human', permission: 'w', scope: 'class' } },
    { input: '// @guard:ai:n.sig', expected: { target: 'ai', permission: 'n', scope: 'sig' } },
    { input: '// @guard:ai:r.block', expected: { target: 'ai', permission: 'r', scope: 'block' } },
  ],
  
  withScopeModifiers: [
    { input: '// @guard:ai:r.func+body', expected: { target: 'ai', permission: 'r', scope: 'func', addScopes: ['body'] } },
    { input: '// @guard:ai:w.class-private', expected: { target: 'ai', permission: 'w', scope: 'class', removeScopes: ['private'] } },
    { input: '// @guard:ai:r.func+body+comments-tests', expected: { 
      target: 'ai', 
      permission: 'r', 
      scope: 'func', 
      addScopes: ['body', 'comments'], 
      removeScopes: ['tests'] 
    }},
  ],
  
  markdownFormat: [
    { input: '<!-- @guard:ai:r -->', expected: { target: 'ai', permission: 'r' } },
    { input: '<!-- @guard:human[team]:w.5 -->', expected: { target: 'human', identifier: 'team', permission: 'w', scope: '5' } },
    { input: '<!--@guard:ai:context-->', expected: { target: 'ai', permission: 'context' } },
  ],
  
  edgeCases: [
    { input: '// Multiple spaces:   @guard:ai:r', expected: { target: 'ai', permission: 'r' } },
    { input: '//No space@guard:ai:w', expected: { target: 'ai', permission: 'w' } },
    { input: '# Inline comment @guard:human:n # more comment', expected: { target: 'human', permission: 'n' } },
    { input: '/* Multi-line\n * @guard:ai:r\n */', expected: { target: 'ai', permission: 'r' } },
  ],
};

console.log('Guard Tag Pattern Tests\n=======================\n');

let passed = 0;
let failed = 0;

// Test regex patterns
console.log('Testing Regex Patterns:');
Object.entries(testCases).forEach(([category, cases]) => {
  console.log(`\n${category}:`);
  
  cases.forEach(testCase => {
    const result = parseGuardTag(testCase.input);
    
    if (!result) {
      console.log(`  ❌ Failed to parse: "${testCase.input}"`);
      failed++;
      return;
    }
    
    let success = true;
    const errors = [];
    
    // Check each expected field
    Object.entries(testCase.expected).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (!Array.isArray(result[key]) || value.length !== result[key].length ||
            !value.every((v, i) => v === result[key][i])) {
          success = false;
          errors.push(`${key}: expected [${value}], got [${result[key]}]`);
        }
      } else if (result[key] !== value) {
        success = false;
        errors.push(`${key}: expected "${value}", got "${result[key]}"`);
      }
    });
    
    if (success) {
      console.log(`  ✅ "${testCase.input}"`);
      passed++;
    } else {
      console.log(`  ❌ "${testCase.input}"`);
      errors.forEach(err => console.log(`     ${err}`));
      failed++;
    }
  });
});

// Test pattern matching
console.log('\n\nTesting Pattern Matching:');
const patterns = [
  { name: 'GUARD_TAG', pattern: GUARD_TAG_PATTERNS.GUARD_TAG, shouldMatch: ['// @guard:ai:r', '# @guard:human:w'] },
  { name: 'MARKDOWN_GUARD_TAG', pattern: GUARD_TAG_PATTERNS.MARKDOWN_GUARD_TAG, shouldMatch: ['<!-- @guard:ai:r -->'] },
  { name: 'LEGACY_GUARD_TAG', pattern: GUARD_TAG_PATTERNS.LEGACY_GUARD_TAG, shouldMatch: ['// @guard:ai:r', '# @guard:human:w'] },
];

patterns.forEach(({ name, pattern, shouldMatch }) => {
  console.log(`\n${name}:`);
  shouldMatch.forEach(text => {
    pattern.lastIndex = 0; // Reset regex state
    if (pattern.test(text)) {
      console.log(`  ✅ Matches: "${text}"`);
      passed++;
    } else {
      console.log(`  ❌ Should match: "${text}"`);
      failed++;
    }
  });
});

// Summary
console.log('\n\nSummary');
console.log('=======');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);