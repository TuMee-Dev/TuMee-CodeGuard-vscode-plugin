#!/usr/bin/env node
/**
 * Test Runner
 * Runs all test suites and reports results
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const testFiles = [
  'guard-tags.test.js',
  'line-permissions.test.js', 
  'semantic-scopes.test.js',
  'validation-mode.test.js',
  'validation-integration.test.js',
  'context-guards.test.js'
];

console.log('TuMee VSCode Plugin Test Suite\n==============================\n');

let totalPassed = 0;
let totalFailed = 0;

// First compile the project
console.log('Compiling project...');
try {
  execSync('npm run compile', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe' 
  });
  console.log('✅ Compilation successful\n');
} catch (error) {
  console.error('❌ Compilation failed:', error.message);
  process.exit(1);
}

// Run each test file
testFiles.forEach(testFile => {
  const testPath = path.join(__dirname, testFile);
  
  if (!fs.existsSync(testPath)) {
    console.log(`⚠️  Skipping ${testFile} - file not found\n`);
    return;
  }
  
  console.log(`Running ${testFile}...`);
  console.log('─'.repeat(50));
  
  try {
    const output = execSync(`node "${testPath}"`, { 
      cwd: __dirname,
      encoding: 'utf8'
    });
    
    console.log(output);
    
    // Extract pass/fail counts from output
    const passMatch = output.match(/Passed: (\d+)/);
    const failMatch = output.match(/Failed: (\d+)/);
    
    if (passMatch) totalPassed += parseInt(passMatch[1]);
    if (failMatch) totalFailed += parseInt(failMatch[1]);
    
  } catch (error) {
    console.error(`❌ Test failed with error code ${error.status}`);
    console.error(error.stdout || error.message);
    
    // Try to extract counts even from failed tests
    const output = error.stdout || '';
    const passMatch = output.match(/Passed: (\d+)/);
    const failMatch = output.match(/Failed: (\d+)/);
    
    if (passMatch) totalPassed += parseInt(passMatch[1]);
    if (failMatch) totalFailed += parseInt(failMatch[1]);
  }
  
  console.log('');
});

// Overall summary
console.log('═'.repeat(50));
console.log('Overall Test Summary');
console.log('═'.repeat(50));
console.log(`Total Passed: ${totalPassed}`);
console.log(`Total Failed: ${totalFailed}`);
console.log(`Total Tests: ${totalPassed + totalFailed}`);
console.log(`Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);

process.exit(totalFailed > 0 ? 1 : 0);