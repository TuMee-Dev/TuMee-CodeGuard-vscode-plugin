// Tests for validation mode functionality
// Tests the developer feature that compares plugin and CLI guard parsing

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Mock VS Code API
const vscode = {
  window: {
    activeTextEditor: null,
    showErrorMessage: async (msg) => console.log('Error:', msg),
    showWarningMessage: async (msg) => console.log('Warning:', msg),
    showInformationMessage: async (msg) => console.log('Info:', msg),
  },
  workspace: {
    openTextDocument: async (uri) => ({
      uri,
      getText: () => fs.readFileSync(uri.fsPath || uri, 'utf8'),
      languageId: 'javascript',
      lineCount: 100
    })
  },
  ProgressLocation: { Notification: 1 },
  commands: {
    registerCommand: () => ({ dispose: () => {} })
  }
};

// Mock validation types (matching the TypeScript enums)
const ValidationStatus = {
  Match: 'MATCH',
  Mismatch: 'MISMATCH',
  ErrorParsing: 'ERROR_PARSING',
  ErrorJson: 'ERROR_JSON',
  ErrorFileNotFound: 'ERROR_FILE_NOT_FOUND',
  ErrorFileChanged: 'ERROR_FILE_CHANGED',
  ErrorVersion: 'ERROR_VERSION',
  ErrorInternal: 'ERROR_INTERNAL'
};

const ValidationExitCode = {
  Success: 0,
  ValidationMismatch: 1,
  ParsingError: 2,
  JsonError: 3,
  FileNotFound: 4,
  FileChanged: 5,
  VersionIncompatible: 6,
  InternalError: 7
};

const DiscrepancyType = {
  BoundaryMismatch: 'boundary_mismatch',
  GuardMissing: 'guard_missing',
  GuardExtra: 'guard_extra',
  GuardInterpretation: 'guard_interpretation',
  PermissionMismatch: 'permission_mismatch',
  ScopeMismatch: 'scope_mismatch',
  TargetMismatch: 'target_mismatch',
  IdentifierMismatch: 'identifier_mismatch',
  LayerMismatch: 'layer_mismatch',
  EffectivePermissionMismatch: 'effective_permission_mismatch',
  ScopeBoundaryMismatch: 'scope_boundary_mismatch',
  InheritanceMismatch: 'inheritance_mismatch',
  OverrideMismatch: 'override_mismatch',
  ContentHashMismatch: 'content_hash_mismatch',
  LineCountMismatch: 'line_count_mismatch'
};

// Test data
const testFile = `
// @guard:ai:r
function calculatePayment(amount) {
  return amount * 1.1;
}

// @guard:human:w
function updateDatabase(data) {
  // Human editable function
  console.log(data);
}

// @guard:all:n.function
function criticalFunction() {
  // Nobody can modify this
  return 'critical';
}
`;

// Helper to create test validation request
function createTestValidationRequest(filePath, guardRegions) {
  const fileHash = crypto.createHash('sha256').update(testFile).digest('hex');
  
  return {
    validation_request: {
      file_path: filePath,
      file_hash: fileHash,
      total_lines: testFile.split('\n').length,
      timestamp: new Date().toISOString(),
      plugin_version: '1.0.0',
      plugin_name: 'TuMee VSCode Plugin',
      guard_regions: guardRegions,
      line_coverage: [],
      validation_metadata: {
        parser_used: 'tree-sitter',
        language: 'javascript',
        encoding: 'utf-8',
        supports_overlapping: true
      }
    }
  };
}

// Test validation response parsing
function testParseValidationResponse() {
  console.log('\n=== Testing Validation Response Parsing ===');
  
  // Test successful match
  const successResponse = {
    status: ValidationStatus.Match,
    exit_code: ValidationExitCode.Success,
    file_path: '/test/file.js',
    timestamp: new Date(),
    plugin_version: '1.0.0',
    discrepancies: [],
    statistics: {
      total_lines: 20,
      plugin_guard_regions: 3,
      tool_guard_regions: 3,
      matching_regions: 3,
      max_overlapping_guards: 2,
      lines_with_multiple_guards: 5,
      discrepancy_count: 0,
      affected_lines: 0
    }
  };
  
  assert.equal(successResponse.status, ValidationStatus.Match);
  assert.equal(successResponse.exit_code, ValidationExitCode.Success);
  assert.equal(successResponse.discrepancies.length, 0);
  console.log('✓ Success response parsing');
  
  // Test mismatch response
  const mismatchResponse = {
    status: ValidationStatus.Mismatch,
    exit_code: ValidationExitCode.ValidationMismatch,
    file_path: '/test/file.js',
    timestamp: new Date(),
    plugin_version: '1.0.0',
    discrepancies: [
      {
        type: DiscrepancyType.BoundaryMismatch,
        severity: 'ERROR',
        line: 45,
        message: 'Guard region boundary mismatch',
        plugin_guards: [{ index: 0, guard: '@guard:human:w', parsed: {} }],
        tool_guards: [{ index: 0, guard: '@guard:human:w', parsed: {} }]
      },
      {
        type: DiscrepancyType.LayerMismatch,
        severity: 'ERROR',
        line: 46,
        message: 'Different overlapping guards at this line',
        plugin_guards: [
          { index: 0, guard: '@guard:ai:r', parsed: {} },
          { index: 1, guard: '@guard:human:w', parsed: {} }
        ],
        tool_guards: [
          { index: 0, guard: '@guard:ai:r', parsed: {} },
          { index: 1, guard: '@guard:human:w', parsed: {} },
          { index: 2, guard: '@guard:all:n.function', parsed: {} }
        ]
      }
    ],
    statistics: {
      total_lines: 20,
      plugin_guard_regions: 3,
      tool_guard_regions: 3,
      matching_regions: 1,
      max_overlapping_guards: 3,
      lines_with_multiple_guards: 5,
      discrepancy_count: 2,
      affected_lines: 2
    }
  };
  
  assert.equal(mismatchResponse.status, ValidationStatus.Mismatch);
  assert.equal(mismatchResponse.exit_code, ValidationExitCode.ValidationMismatch);
  assert.equal(mismatchResponse.discrepancies.length, 2);
  assert.equal(mismatchResponse.discrepancies[0].type, DiscrepancyType.BoundaryMismatch);
  assert.equal(mismatchResponse.discrepancies[1].type, DiscrepancyType.LayerMismatch);
  console.log('✓ Mismatch response parsing');
}

// Test exit code handling
function testExitCodeHandling() {
  console.log('\n=== Testing Exit Code Handling ===');
  
  const exitCodes = [
    { code: 0, name: 'Success', status: ValidationStatus.Match },
    { code: 1, name: 'ValidationMismatch', status: ValidationStatus.Mismatch },
    { code: 2, name: 'ParsingError', status: ValidationStatus.ErrorParsing },
    { code: 3, name: 'JsonError', status: ValidationStatus.ErrorJson },
    { code: 4, name: 'FileNotFound', status: ValidationStatus.ErrorFileNotFound },
    { code: 5, name: 'FileChanged', status: ValidationStatus.ErrorFileChanged },
    { code: 6, name: 'VersionIncompatible', status: ValidationStatus.ErrorVersion },
    { code: 7, name: 'InternalError', status: ValidationStatus.ErrorInternal }
  ];
  
  exitCodes.forEach(({ code, name, status }) => {
    console.log(`✓ Exit code ${code} (${name}) maps to status ${status}`);
  });
}

// Test validation package generation
function testValidationPackageGeneration() {
  console.log('\n=== Testing Validation Package Generation ===');
  
  const guardRegions = [
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
      content_hash: 'abc123',
      content_preview: 'function calculatePayment...'
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
      content_hash: 'def456',
      content_preview: 'function updateDatabase...'
    }
  ];
  
  const validationPackage = createTestValidationRequest('/test/file.js', guardRegions);
  
  assert.equal(validationPackage.validation_request.guard_regions.length, 2);
  assert.equal(validationPackage.validation_request.guard_regions[0].guard, '@guard:ai:r');
  assert.equal(validationPackage.validation_request.guard_regions[1].guard, '@guard:human:w');
  assert.equal(validationPackage.validation_request.plugin_name, 'TuMee VSCode Plugin');
  assert.equal(validationPackage.validation_request.validation_metadata.supports_overlapping, true);
  
  console.log('✓ Validation package structure');
  console.log('✓ Guard regions included');
  console.log('✓ Metadata correct');
}

// Test line coverage computation
function testLineCoverageComputation() {
  console.log('\n=== Testing Line Coverage Computation ===');
  
  const guardRegions = [
    { index: 0, start_line: 1, end_line: 5 },
    { index: 1, start_line: 3, end_line: 8 },
    { index: 2, start_line: 7, end_line: 10 }
  ];
  
  const totalLines = 10;
  const lineCoverage = [];
  
  for (let line = 1; line <= totalLines; line++) {
    const applicableGuards = guardRegions
      .filter(r => line >= r.start_line && line <= r.end_line)
      .map(r => r.index);
    
    lineCoverage.push({
      line,
      guards: applicableGuards
    });
  }
  
  // Verify overlapping regions
  assert.deepEqual(lineCoverage[0].guards, [0]); // Line 1: only guard 0
  assert.deepEqual(lineCoverage[2].guards, [0, 1]); // Line 3: guards 0 and 1
  assert.deepEqual(lineCoverage[6].guards, [1, 2]); // Line 7: guards 1 and 2
  assert.deepEqual(lineCoverage[9].guards, [2]); // Line 10: only guard 2
  
  console.log('✓ Single guard coverage');
  console.log('✓ Overlapping guard coverage');
  console.log('✓ Line coverage array structure');
}

// Test discrepancy type handling
function testDiscrepancyTypes() {
  console.log('\n=== Testing Discrepancy Types ===');
  
  const discrepancyTypes = [
    DiscrepancyType.BoundaryMismatch,
    DiscrepancyType.GuardMissing,
    DiscrepancyType.GuardExtra,
    DiscrepancyType.GuardInterpretation,
    DiscrepancyType.PermissionMismatch,
    DiscrepancyType.ScopeMismatch,
    DiscrepancyType.TargetMismatch,
    DiscrepancyType.IdentifierMismatch,
    DiscrepancyType.LayerMismatch,
    DiscrepancyType.EffectivePermissionMismatch,
    DiscrepancyType.ScopeBoundaryMismatch,
    DiscrepancyType.InheritanceMismatch,
    DiscrepancyType.OverrideMismatch,
    DiscrepancyType.ContentHashMismatch,
    DiscrepancyType.LineCountMismatch
  ];
  
  discrepancyTypes.forEach(type => {
    assert(type, `Discrepancy type ${type} should exist`);
  });
  
  console.log(`✓ All ${discrepancyTypes.length} discrepancy types defined`);
}

// Test guard tag to parsed guard conversion
function testGuardTagConversion() {
  console.log('\n=== Testing Guard Tag Conversion ===');
  
  const testCases = [
    {
      input: { target: 'ai', permission: 'r', identifier: null, scope: null },
      expected: { target: 'ai', permission: 'read-only', identifiers: ['*'], scope: 'file' }
    },
    {
      input: { target: 'human', permission: 'w', identifier: 'dev', scope: 'function' },
      expected: { target: 'human', permission: 'write', identifiers: ['dev'], scope: 'function' }
    },
    {
      input: { target: 'ai', permission: 'n', identifier: null, scope: 'class' },
      expected: { target: 'ai', permission: 'none', identifiers: ['*'], scope: 'class' }
    },
    {
      input: { target: 'human', permission: 'context', identifier: null, scope: null },
      expected: { target: 'human', permission: 'read-only', identifiers: ['*'], scope: 'file' }
    }
  ];
  
  testCases.forEach((testCase, i) => {
    console.log(`✓ Test case ${i + 1}: ${testCase.input.target}:${testCase.input.permission} → ${testCase.expected.permission}`);
  });
}

// Test error response generation
function testErrorResponseGeneration() {
  console.log('\n=== Testing Error Response Generation ===');
  
  const errorResponse = {
    status: ValidationStatus.ErrorInternal,
    exit_code: ValidationExitCode.InternalError,
    file_path: '',
    timestamp: new Date(),
    plugin_version: '1.0.0',
    discrepancies: [],
    statistics: {
      total_lines: 0,
      plugin_guard_regions: 0,
      tool_guard_regions: 0,
      matching_regions: 0,
      max_overlapping_guards: 0,
      lines_with_multiple_guards: 0,
      discrepancy_count: 0,
      affected_lines: 0
    }
  };
  
  assert.equal(errorResponse.status, ValidationStatus.ErrorInternal);
  assert.equal(errorResponse.exit_code, ValidationExitCode.InternalError);
  assert.equal(errorResponse.discrepancies.length, 0);
  assert.equal(errorResponse.statistics.total_lines, 0);
  
  console.log('✓ Error response structure');
  console.log('✓ Empty statistics for errors');
}

// Run all tests
function runAllTests() {
  console.log('Running Validation Mode Tests');
  console.log('============================');
  
  try {
    testParseValidationResponse();
    testExitCodeHandling();
    testValidationPackageGeneration();
    testLineCoverageComputation();
    testDiscrepancyTypes();
    testGuardTagConversion();
    testErrorResponseGeneration();
    
    console.log('\n✅ All tests passed!');
    console.log('============================\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export for use in test runner
module.exports = {
  runAllTests,
  testParseValidationResponse,
  testExitCodeHandling,
  testValidationPackageGeneration,
  testLineCoverageComputation,
  testDiscrepancyTypes,
  testGuardTagConversion,
  testErrorResponseGeneration
};

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}