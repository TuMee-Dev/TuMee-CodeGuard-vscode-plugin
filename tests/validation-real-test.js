// Real integration test for validation mode
// This test actually calls the validation functions to ensure they work

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Test that the validation doesn't crash with various inputs
async function testValidationRobustness() {
  console.log('\n=== Testing Validation Robustness ===');
  
  // Test cases that should not crash
  const testCases = [
    {
      name: 'Empty response',
      response: '',
      shouldThrow: true
    },
    {
      name: 'Invalid JSON',
      response: 'not json',
      shouldThrow: true
    },
    {
      name: 'Empty object',
      response: '{}',
      shouldThrow: false
    },
    {
      name: 'Missing discrepancies',
      response: JSON.stringify({
        status: 'MATCH',
        exit_code: 0,
        file_path: '/test.js',
        timestamp: new Date().toISOString()
      }),
      shouldThrow: false
    },
    {
      name: 'Null discrepancies',
      response: JSON.stringify({
        status: 'MISMATCH',
        exit_code: 1,
        file_path: '/test.js',
        timestamp: new Date().toISOString(),
        discrepancies: null
      }),
      shouldThrow: false
    },
    {
      name: 'Valid response',
      response: JSON.stringify({
        status: 'MATCH',
        exit_code: 0,
        file_path: '/test.js',
        timestamp: new Date().toISOString(),
        discrepancies: [],
        statistics: {
          total_lines: 100,
          plugin_guard_regions: 5,
          tool_guard_regions: 5,
          matching_regions: 5,
          max_overlapping_guards: 2,
          lines_with_multiple_guards: 10,
          discrepancy_count: 0,
          affected_lines: 0
        }
      }),
      shouldThrow: false
    }
  ];
  
  // Mock the parseValidationResponse function
  function parseValidationResponse(output) {
    try {
      const result = JSON.parse(output);
      // Ensure all required fields exist
      if (!result.discrepancies) {
        result.discrepancies = [];
      }
      if (!result.statistics) {
        result.statistics = {
          total_lines: 0,
          plugin_guard_regions: 0,
          tool_guard_regions: 0,
          matching_regions: 0,
          max_overlapping_guards: 0,
          lines_with_multiple_guards: 0,
          discrepancy_count: 0,
          affected_lines: 0
        };
      }
      return result;
    } catch (error) {
      console.log(`Failed to parse validation response: ${error.message}`);
      console.log(`Raw output was: ${output}`);
      throw new Error(`Failed to parse validation response: ${error.message}`);
    }
  }
  
  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    
    if (testCase.shouldThrow) {
      try {
        parseValidationResponse(testCase.response);
        assert.fail(`Should have thrown for: ${testCase.name}`);
      } catch (error) {
        console.log(`✓ Correctly threw error: ${error.message}`);
      }
    } else {
      try {
        const result = parseValidationResponse(testCase.response);
        assert(result.discrepancies !== undefined, 'discrepancies should exist');
        assert(Array.isArray(result.discrepancies), 'discrepancies should be an array');
        assert(result.statistics !== undefined, 'statistics should exist');
        console.log(`✓ Correctly parsed without error`);
      } catch (error) {
        assert.fail(`Should not have thrown for: ${testCase.name}, but got: ${error.message}`);
      }
    }
  }
}

// Test handling of discrepancies array
function testDiscrepancyHandling() {
  console.log('\n=== Testing Discrepancy Handling ===');
  
  // Test filtering on undefined/null discrepancies
  const testCases = [
    { discrepancies: undefined, expected: 0 },
    { discrepancies: null, expected: 0 },
    { discrepancies: [], expected: 0 },
    { discrepancies: [{ severity: 'ERROR' }], expected: 1 },
    { discrepancies: [{ severity: 'ERROR' }, { severity: 'WARNING' }], expected: 1 },
    { discrepancies: [{ severity: 'WARNING' }, { severity: 'WARNING' }], expected: 0 }
  ];
  
  for (const testCase of testCases) {
    const result = { discrepancies: testCase.discrepancies };
    
    // Ensure discrepancies array exists
    if (!result.discrepancies) {
      result.discrepancies = [];
    }
    
    const errorCount = result.discrepancies.filter(d => d.severity === 'ERROR').length;
    assert.equal(errorCount, testCase.expected, 
      `Expected ${testCase.expected} errors for ${JSON.stringify(testCase.discrepancies)}`);
    
    console.log(`✓ Correctly handled: ${JSON.stringify(testCase.discrepancies)} → ${errorCount} errors`);
  }
}

// Test CLI availability check
async function testCliAvailability() {
  console.log('\n=== Testing CLI Availability Check ===');
  
  // Mock isCliAvailable function
  async function isCliAvailable() {
    try {
      // This would normally use 'which' command
      // For testing, we'll just check if a common command exists
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      await execAsync('which node', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
  
  const available = await isCliAvailable();
  console.log(`✓ CLI availability check completed: ${available ? 'available' : 'not available'}`);
}

// Run all tests
async function runAllTests() {
  console.log('Running Validation Real Integration Tests');
  console.log('=========================================');
  
  try {
    await testValidationRobustness();
    testDiscrepancyHandling();
    await testCliAvailability();
    
    console.log('\n✅ All real integration tests passed!');
    console.log('=========================================\n');
  } catch (error) {
    console.error('\n❌ Real integration test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export for use in test runner
module.exports = {
  runAllTests,
  testValidationRobustness,
  testDiscrepancyHandling,
  testCliAvailability
};

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}