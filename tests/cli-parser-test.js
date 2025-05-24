#!/usr/bin/env node

/**
 * Command-line test for guard parser
 * Usage: node tests/cli-parser-test.js <filepath>
 * 
 * This script uses the SAME guard parsing logic as the VS Code plugin
 * to ensure perfect synchronization with the CodeGuard CLI tool.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// We need to compile the TypeScript to use it from Node.js
// For now, we'll create a wrapper that calls the compiled JS
const { execSync } = require('child_process');

// Ensure the extension is compiled
console.log('Ensuring extension is compiled...');
try {
  execSync('npm run compile', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
} catch (error) {
  console.error('Failed to compile extension:', error.message);
  process.exit(1);
}

// Import the compiled guard processor
const guardProcessorPath = path.join(__dirname, '..', 'dist', 'utils', 'guardProcessor.js');
const { parseGuardTagsChunked, createGuardRegions, getLinePermissions } = require(guardProcessorPath);

// Import other utilities
const aclPath = path.join(__dirname, '..', 'dist', 'utils', 'acl.js');
const { parseGuardTag } = require(aclPath);

/**
 * Mock VS Code document interface for the guard processor
 */
class MockDocument {
  constructor(content, languageId) {
    this.content = content;
    this.lines = content.split('\n');
    this.languageId = languageId;
    this.version = 1;
    this.lineCount = this.lines.length;
  }

  getText() {
    return this.content;
  }

  lineAt(lineNumber) {
    // VS Code uses 0-based line numbers
    const text = this.lines[lineNumber] || '';
    return {
      text,
      range: {
        start: { line: lineNumber, character: 0 },
        end: { line: lineNumber, character: text.length }
      }
    };
  }
}

/**
 * Detect language from file extension
 */
function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const langMap = {
    '.py': 'python',
    '.js': 'javascript',
    '.ts': 'typescript',
    '.cs': 'csharp',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.go': 'go',
    '.rb': 'ruby',
    '.php': 'php'
  };
  return langMap[ext] || 'unknown';
}

/**
 * Map permission codes to full names
 */
function mapPermission(permission) {
  const map = {
    'r': 'read-only',
    'w': 'write',
    'n': 'none',
    'context': 'read-only'
  };
  return map[permission] || 'read-only';
}

/**
 * Build validation package using the plugin's guard processing
 */
async function buildValidationPackage(filePath, content) {
  const languageId = detectLanguage(filePath);
  const mockDoc = new MockDocument(content, languageId);
  const lines = content.split('\n');
  
  // Use the plugin's guard parser
  const guardTags = await parseGuardTagsChunked(mockDoc, lines);
  
  // Create guard regions using the plugin's logic
  const guardRegions = createGuardRegions(guardTags, lines.length);
  
  // Convert to validation format
  const validationRegions = guardRegions.map((tag, index) => ({
    index: index,
    guard: `@guard:${tag.target}:${tag.permission}`,
    parsed_guard: {
      raw: `@guard:${tag.target}:${tag.permission}`,
      target: tag.target,
      identifiers: tag.identifier ? tag.identifier.split(',') : ['*'],
      permission: mapPermission(tag.permission),
      scope: tag.scope || 'file',
      scope_modifiers: []
    },
    declaration_line: tag.lineNumber,
    start_line: tag.scopeStart || tag.lineNumber,
    end_line: tag.scopeEnd || lines.length,
    content_hash: '', // Simplified for testing
    content_preview: lines[tag.lineNumber - 1].trim().substring(0, 50) + '...'
  }));
  
  // Compute line coverage
  const lineCoverage = [];
  for (let line = 1; line <= lines.length; line++) {
    const applicableGuards = validationRegions
      .filter(r => line >= r.start_line && line <= r.end_line)
      .map(r => r.index);
    
    if (applicableGuards.length > 0) {
      lineCoverage.push({
        line,
        guards: applicableGuards
      });
    }
  }
  
  const fileHash = crypto.createHash('sha256').update(content).digest('hex');
  
  return {
    validation_request: {
      file_path: path.resolve(filePath),
      file_hash: fileHash,
      total_lines: lines.length,
      timestamp: new Date().toISOString(),
      plugin_version: '1.0.0',
      plugin_name: 'CodeGuard VS Code Plugin',
      guard_regions: validationRegions,
      line_coverage: lineCoverage,
      validation_metadata: {
        parser_used: 'tree-sitter',
        language: languageId,
        encoding: 'utf-8',
        supports_overlapping: true
      }
    }
  };
}

/**
 * Execute validation
 */
async function validateWithTool(validationPackage) {
  const tempFile = path.join(__dirname, `temp_validation_${Date.now()}.json`);
  
  try {
    // Write validation package to temp file
    await fs.promises.writeFile(tempFile, JSON.stringify(validationPackage, null, 2));
    
    // Execute codeguard CLI
    const command = `codeguard validate-sections --json-file "${tempFile}"`;
    console.log(`Executing: ${command}\n`);
    
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
      return { exitCode: 0, stdout, stderr };
    } catch (error) {
      return { 
        exitCode: error.code || 1, 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      };
    }
  } finally {
    // Cleanup temp file
    try {
      await fs.promises.unlink(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Format and display results
 */
function displayResults(result, validationPackage) {
  console.log('='.repeat(60));
  console.log('VALIDATION RESULTS');
  console.log('='.repeat(60));
  
  console.log(`\nExit Code: ${result.exitCode}`);
  
  if (result.stderr) {
    console.log(`\nStderr:\n${result.stderr}`);
  }
  
  // Try to parse JSON response
  try {
    const response = JSON.parse(result.stdout);
    
    if (response.validation_result) {
      const vr = response.validation_result;
      console.log(`\nStatus: ${vr.status}`);
      console.log(`Tool Version: ${vr.tool_version}`);
      console.log(`Plugin Version: ${vr.plugin_version}`);
      
      if (vr.statistics) {
        console.log('\nStatistics:');
        console.log(`  Total Lines: ${vr.statistics.total_lines}`);
        console.log(`  Plugin Guard Regions: ${vr.statistics.plugin_guard_regions}`);
        console.log(`  Tool Guard Regions: ${vr.statistics.tool_guard_regions}`);
        console.log(`  Matching Regions: ${vr.statistics.matching_regions}`);
        console.log(`  Discrepancy Count: ${vr.statistics.discrepancy_count}`);
      }
      
      if (vr.discrepancies && vr.discrepancies.length > 0) {
        console.log('\nDiscrepancies:');
        vr.discrepancies.slice(0, 5).forEach((d, i) => {
          console.log(`\n  ${i + 1}. ${d.type} (${d.severity})`);
          console.log(`     ${d.message}`);
          if (d.plugin_region && d.tool_region) {
            console.log(`     Plugin: [${d.plugin_region.start_line}-${d.plugin_region.end_line}]`);
            console.log(`     Tool:   [${d.tool_region.start_line}-${d.tool_region.end_line}]`);
          }
        });
        if (vr.discrepancies.length > 5) {
          console.log(`\n  ... and ${vr.discrepancies.length - 5} more discrepancies`);
        }
      }
      
      // Show summary
      console.log('\n' + '='.repeat(60));
      if (result.exitCode === 0) {
        console.log('✅ SUCCESS: Parser output matches tool perfectly!');
      } else if (result.exitCode === 1) {
        console.log(`❌ MISMATCH: Found ${vr.statistics.discrepancy_count} discrepancies`);
        console.log('\nThis indicates the plugin parser and tool parser are out of sync.');
        console.log('Please investigate the discrepancies above.');
      } else {
        console.log('❌ ERROR: Validation failed');
      }
    }
  } catch (e) {
    console.log('\nRaw output:');
    console.log(result.stdout.substring(0, 1000));
    if (result.stdout.length > 1000) {
      console.log('... (truncated)');
    }
  }
  
  // Show our parsed guards for debugging
  console.log('\n' + '='.repeat(60));
  console.log('PARSED GUARD REGIONS:');
  console.log('='.repeat(60));
  validationPackage.validation_request.guard_regions.forEach(r => {
    console.log(`${r.index}. ${r.guard} [${r.start_line}-${r.end_line}] declared at line ${r.declaration_line}`);
  });
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node tests/cli-parser-test.js <filepath>');
    console.log('\nExample:');
    console.log('  node tests/cli-parser-test.js examples/api-key-manager.py');
    console.log('\nThis test uses the SAME guard processing engine as the VS Code plugin.');
    process.exit(1);
  }
  
  const filePath = args[0];
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  console.log(`Testing parser with file: ${filePath}`);
  console.log(`Language detected: ${detectLanguage(filePath)}`);
  console.log('Using plugin guard processing engine...\n');
  
  try {
    // Read file content
    const content = await fs.promises.readFile(filePath, 'utf8');
    
    // Build validation package using the plugin's guard processor
    const validationPackage = await buildValidationPackage(filePath, content);
    
    console.log(`Found ${validationPackage.validation_request.guard_regions.length} guard regions`);
    
    // Validate with tool
    const result = await validateWithTool(validationPackage);
    
    // Display results
    displayResults(result, validationPackage);
    
    // Exit with same code as validation
    process.exit(result.exitCode === 0 || result.exitCode === 1 ? 0 : result.exitCode);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run main function
main().catch(console.error);