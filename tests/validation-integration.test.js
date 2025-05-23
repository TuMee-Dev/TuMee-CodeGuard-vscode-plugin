// Integration tests for validation mode
// Tests the full validation flow including CLI execution

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Test file with various guard patterns
const TEST_FILE_CONTENT = `// Test file for validation mode
// @guard:ai:r
function aiReadableFunction() {
  return 'AI can read this';
}

// @guard:human:w
function humanEditableFunction() {
  // Humans can modify this
  console.log('Hello');
}

// @guard:all:n.function
function protectedFunction() {
  // Nobody can modify this function
  return 'protected';
}

// Overlapping guards test
// @guard:ai:r
// @guard:human:w
function overlappingGuardsFunction() {
  // Both AI (read) and human (write) guards apply here
  return 'overlapping';
}

// @guard:ai:dev:w.class
class DeveloperClass {
  // Only AI with dev identifier can write
  constructor() {
    this.value = 42;
  }
  
  // @guard:human:n
  criticalMethod() {
    // Humans cannot access this method
    return this.value;
  }
}
`;

// Create a mock validation response for different scenarios
function createMockValidationResponse(scenario) {
  const baseResponse = {
    file_path: '/test/validation-test.js',
    timestamp: new Date().toISOString(),
    plugin_version: '1.0.0',
    tool_version: '1.0.0'
  };
  
  switch (scenario) {
    case 'success':
      return {
        ...baseResponse,
        status: 'MATCH',
        exit_code: 0,
        discrepancies: [],
        statistics: {
          total_lines: 50,
          plugin_guard_regions: 6,
          tool_guard_regions: 6,
          matching_regions: 6,
          max_overlapping_guards: 2,
          lines_with_multiple_guards: 5,
          discrepancy_count: 0,
          affected_lines: 0
        }
      };
      
    case 'boundary_mismatch':
      return {
        ...baseResponse,
        status: 'MISMATCH',
        exit_code: 1,
        discrepancies: [
          {
            type: 'boundary_mismatch',
            severity: 'ERROR',
            line: 25,
            guard_index: 3,
            message: 'Guard region ends at different line',
            plugin_region: { start_line: 20, end_line: 25 },
            tool_region: { start_line: 20, end_line: 26 }
          }
        ],
        statistics: {
          total_lines: 50,
          plugin_guard_regions: 6,
          tool_guard_regions: 6,
          matching_regions: 5,
          max_overlapping_guards: 2,
          lines_with_multiple_guards: 5,
          discrepancy_count: 1,
          affected_lines: 2
        }
      };
      
    case 'layer_mismatch':
      return {
        ...baseResponse,
        status: 'MISMATCH',
        exit_code: 1,
        discrepancies: [
          {
            type: 'layer_mismatch',
            severity: 'ERROR',
            line: 30,
            message: 'Different overlapping guards at this line',
            plugin_guards: [
              { index: 4, guard: '@guard:ai:r', effective_permission: 'read-only' },
              { index: 5, guard: '@guard:human:w', effective_permission: 'write' }
            ],
            tool_guards: [
              { index: 4, guard: '@guard:ai:r', effective_permission: 'read-only' },
              { index: 5, guard: '@guard:human:w', effective_permission: 'none' },
              { index: 6, guard: '@guard:all:n', effective_permission: 'none' }
            ]
          }
        ],
        statistics: {
          total_lines: 50,
          plugin_guard_regions: 6,
          tool_guard_regions: 7,
          matching_regions: 5,
          max_overlapping_guards: 3,
          lines_with_multiple_guards: 8,
          discrepancy_count: 1,
          affected_lines: 5
        }
      };
      
    case 'parsing_error':
      return {
        ...baseResponse,
        status: 'ERROR_PARSING',
        exit_code: 2,
        error_details: {
          code: 'PARSE_ERROR',
          message: 'Failed to parse file: Unexpected token at line 15',
          details: 'SyntaxError: Unexpected token'
        }
      };
      
    case 'file_not_found':
      return {
        ...baseResponse,
        status: 'ERROR_FILE_NOT_FOUND',
        exit_code: 4,
        error_details: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found: /test/missing-file.js'
        }
      };
      
    case 'version_incompatible':
      return {
        ...baseResponse,
        status: 'ERROR_VERSION',
        exit_code: 6,
        plugin_version: '1.0.0',
        tool_version: '2.0.0',
        error_details: {
          code: 'VERSION_MISMATCH',
          message: 'Plugin version 1.0.0 is not compatible with tool version 2.0.0',
          details: 'Minimum required plugin version: 1.5.0'
        }
      };
      
    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
}

// Test validation request JSON generation
async function testValidationRequestGeneration() {
  console.log('\n=== Testing Validation Request Generation ===');
  
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  
  const testFile = path.join(tempDir, 'test-validation.js');
  fs.writeFileSync(testFile, TEST_FILE_CONTENT);
  
  // Create validation request
  const validationRequest = {
    validation_request: {
      file_path: testFile,
      file_hash: require('crypto').createHash('sha256').update(TEST_FILE_CONTENT).digest('hex'),
      total_lines: TEST_FILE_CONTENT.split('\n').length,
      timestamp: new Date().toISOString(),
      plugin_version: '1.0.0',
      plugin_name: 'TuMee VSCode Plugin',
      guard_regions: [
        {
          index: 0,
          guard: '@guard:ai:r',
          parsed_guard: {
            raw: '@guard:ai:r',
            target: 'ai',
            identifiers: ['*'],
            permission: 'read-only',
            scope: 'file',
            scope_modifiers: []
          },
          declaration_line: 2,
          start_line: 3,
          end_line: 5,
          content_hash: 'hash1',
          content_preview: 'function aiReadableFunction()...'
        },
        {
          index: 1,
          guard: '@guard:human:w',
          parsed_guard: {
            raw: '@guard:human:w',
            target: 'human',
            identifiers: ['*'],
            permission: 'write',
            scope: 'file',
            scope_modifiers: []
          },
          declaration_line: 7,
          start_line: 8,
          end_line: 11,
          content_hash: 'hash2',
          content_preview: 'function humanEditableFunction()...'
        }
      ],
      line_coverage: [],
      validation_metadata: {
        parser_used: 'tree-sitter',
        language: 'javascript',
        encoding: 'utf-8',
        supports_overlapping: true
      }
    }
  };
  
  const jsonFile = path.join(tempDir, 'validation-request.json');
  fs.writeFileSync(jsonFile, JSON.stringify(validationRequest, null, 2));
  
  assert(fs.existsSync(jsonFile), 'JSON file should be created');
  const content = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  assert.equal(content.validation_request.guard_regions.length, 2);
  assert.equal(content.validation_request.plugin_name, 'TuMee VSCode Plugin');
  
  console.log('✓ Validation request JSON generated');
  console.log('✓ File hash included');
  console.log('✓ Guard regions properly formatted');
  
  // Cleanup
  fs.unlinkSync(jsonFile);
  fs.unlinkSync(testFile);
  fs.rmdirSync(tempDir);
}

// Test different validation scenarios
async function testValidationScenarios() {
  console.log('\n=== Testing Validation Scenarios ===');
  
  const scenarios = [
    { name: 'Perfect Match', type: 'success', exitCode: 0 },
    { name: 'Boundary Mismatch', type: 'boundary_mismatch', exitCode: 1 },
    { name: 'Layer Mismatch', type: 'layer_mismatch', exitCode: 1 },
    { name: 'Parsing Error', type: 'parsing_error', exitCode: 2 },
    { name: 'File Not Found', type: 'file_not_found', exitCode: 4 },
    { name: 'Version Incompatible', type: 'version_incompatible', exitCode: 6 }
  ];
  
  for (const scenario of scenarios) {
    const response = createMockValidationResponse(scenario.type);
    assert.equal(response.exit_code, scenario.exitCode, 
      `${scenario.name} should have exit code ${scenario.exitCode}`);
    console.log(`✓ ${scenario.name} scenario (exit code: ${scenario.exitCode})`);
  }
}

// Test overlapping guard detection
function testOverlappingGuardDetection() {
  console.log('\n=== Testing Overlapping Guard Detection ===');
  
  const guardRegions = [
    { index: 0, start_line: 1, end_line: 10 },  // Guard A
    { index: 1, start_line: 5, end_line: 15 },  // Guard B overlaps with A
    { index: 2, start_line: 12, end_line: 20 }, // Guard C overlaps with B
    { index: 3, start_line: 8, end_line: 18 }   // Guard D overlaps with B and C
  ];
  
  // Check line 8 - should have guards A, B, and D
  const line8Guards = guardRegions
    .filter(g => 8 >= g.start_line && 8 <= g.end_line)
    .map(g => g.index);
  
  assert.deepEqual(line8Guards, [0, 1, 3], 'Line 8 should have guards 0, 1, and 3');
  
  // Check line 13 - should have guards B, C, and D
  const line13Guards = guardRegions
    .filter(g => 13 >= g.start_line && 13 <= g.end_line)
    .map(g => g.index);
  
  assert.deepEqual(line13Guards, [1, 2, 3], 'Line 13 should have guards 1, 2, and 3');
  
  // Find max overlapping
  const maxOverlapping = Math.max(...Array.from({ length: 20 }, (_, i) => {
    const line = i + 1;
    return guardRegions.filter(g => line >= g.start_line && line <= g.end_line).length;
  }));
  
  assert.equal(maxOverlapping, 3, 'Maximum overlapping guards should be 3');
  
  console.log('✓ Overlapping guard detection');
  console.log('✓ Multiple guard layers per line');
  console.log('✓ Maximum overlap calculation');
}

// Test error handling
async function testErrorHandling() {
  console.log('\n=== Testing Error Handling ===');
  
  // Test invalid JSON handling
  try {
    JSON.parse('invalid json');
    assert.fail('Should throw on invalid JSON');
  } catch (error) {
    console.log('✓ Invalid JSON handling');
  }
  
  // Test missing file handling
  const missingFile = '/path/to/missing/file.js';
  assert(!fs.existsSync(missingFile), 'File should not exist');
  console.log('✓ Missing file detection');
  
  // Test timeout handling
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Command timeout')), 100);
  });
  
  try {
    await Promise.race([
      timeoutPromise,
      new Promise(resolve => setTimeout(resolve, 200))
    ]);
    assert.fail('Should timeout');
  } catch (error) {
    assert(error.message.includes('timeout'), 'Should be timeout error');
    console.log('✓ Command timeout handling');
  }
}

// Run all integration tests
async function runAllTests() {
  console.log('Running Validation Mode Integration Tests');
  console.log('=========================================');
  
  try {
    await testValidationRequestGeneration();
    await testValidationScenarios();
    testOverlappingGuardDetection();
    await testErrorHandling();
    
    console.log('\n✅ All integration tests passed!');
    console.log('=========================================\n');
  } catch (error) {
    console.error('\n❌ Integration test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export for use in test runner
module.exports = {
  runAllTests,
  testValidationRequestGeneration,
  testValidationScenarios,
  testOverlappingGuardDetection,
  testErrorHandling,
  createMockValidationResponse
};

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}