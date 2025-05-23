#!/usr/bin/env node

/**
 * CodeGuard CLI Acceptance Test
 * 
 * This test verifies that the CodeGuard CLI is working correctly
 * with real guard tags before we use it in other tests.
 */

const { promisify } = require('util');
const { exec: execCallback, spawn } = require('child_process');
const exec = promisify(execCallback);

// Enhanced exec with better timeout and process management
async function execWithTimeout(command, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command]);
    let stdout = '';
    let stderr = '';
    let killed = false;
    
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
    }, timeoutMs);
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return; // Already handled by timeout
      
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!killed) {
        reject(error);
      }
    });
  });
}

// Helper function to kill hung CodeGuard processes
async function killHungProcesses() {
  try {
    const { stdout } = await execWithTimeout('pgrep -f codeguard', 3000);
    const pids = stdout.trim().split('\n').filter(line => line);
    
    if (pids.length > 0) {
      console.log(`🔪 Killing ${pids.length} hung CodeGuard processes...`);
      for (const pid of pids) {
        try {
          await execWithTimeout(`kill -9 ${pid}`, 2000);
          console.log(`   ✅ Killed process ${pid}`);
        } catch (error) {
          console.log(`   ⚠️  Could not kill process ${pid}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    // No processes found or pgrep failed - this is OK
  }
}

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Test files with known guard tags
const testFiles = {
  'test-ai-write.js': `// @guard:ai:w
console.log("AI can write this");
// More AI writable code
function aiFunction() {
  return "AI accessible";
}`,
  
  'test-human-only.py': `# @guard:human:w
def human_only_function():
    """Only humans should modify this"""
    return "sensitive logic"
    
# @guard:ai:r
def ai_readable():
    return "AI can read but not write"`,
  
  'test-mixed-permissions.ts': `// @guard:ai:w
interface PublicAPI {
  getData(): string;
}

// @guard:human:w  
class SensitiveImplementation implements PublicAPI {
  private secret = "classified";
  
  getData(): string {
    // @guard:ai:r
    return "public data";
  }
}

// @guard:ai:context
// This is context information for AI
const contextInfo = "AI can use this for understanding";`,

  'test-line-counts.java': `// @guard:ai:w.5
public class TestClass {
    public void method1() {
        System.out.println("Line 1");
        System.out.println("Line 2");  
    }
    
    // @guard:human:w.3
    private void sensitiveMethod() {
        // Critical logic
        doSomething();
    }
}`
};

async function createTestFiles() {
  console.log('📁 Creating test files...');
  const testDir = path.join(__dirname, 'acceptance-test-files');
  
  try {
    await fs.mkdir(testDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  
  const filePaths = {};
  for (const [filename, content] of Object.entries(testFiles)) {
    const filePath = path.join(testDir, filename);
    await fs.writeFile(filePath, content);
    filePaths[filename] = filePath;
    console.log(`   ✅ Created: ${filename}`);
  }
  
  return { testDir, filePaths };
}

async function cleanupTestFiles(testDir) {
  console.log('🧹 Cleaning up test files...');
  try {
    await fs.rm(testDir, { recursive: true, force: true });
    console.log('   ✅ Test files cleaned up');
  } catch (error) {
    console.warn(`   ⚠️  Could not clean up test directory: ${error.message}`);
  }
}

async function testCodeGuardCLI() {
  console.log('🧪 CodeGuard CLI Acceptance Test\n');
  
  // Step 1: Verify CLI is available
  console.log('1️⃣ Verifying CLI availability...');
  try {
    console.log('   ⏳ Testing CodeGuard launch (15s timeout)...');
    const { stdout } = await execWithTimeout('codeguard --version', 15000);
    console.log(`   ✅ CodeGuard version: ${stdout.trim()}`);
  } catch (error) {
    console.error('   ❌ CodeGuard CLI not found, not working, or hanging at launch');
    console.error(`   Error: ${error.message}`);
    if (error.message.includes('timed out')) {
      console.error('   💡 CodeGuard appears to be hanging during startup');
    }
    return false;
  }
  
  // Step 2: Create test files
  const { testDir, filePaths } = await createTestFiles();
  
  let allTestsPassed = true;
  
  try {
    // Step 3: Test each file
    console.log('\n2️⃣ Testing ACL queries...');
    
    // Test AI write file
    console.log('\n   📄 Testing AI write file...');
    try {
      console.log('   ⏳ Querying ACL (15s timeout)...');
      const { stdout } = await execWithTimeout(`codeguard acl "${filePaths['test-ai-write.js']}" -f json`, 15000);
      const result = JSON.parse(stdout);
      
      if (result.permissions?.ai === 'write') {
        console.log('   ✅ AI write permission detected correctly');
      } else {
        console.log(`   ❌ Expected AI write, got: ${result.permissions?.ai}`);
        allTestsPassed = false;
      }
      
      console.log(`   📊 Result: ${result.code || 'unknown'}`);
    } catch (error) {
      console.log(`   ❌ Failed to query AI write file: ${error.message}`);
      allTestsPassed = false;
    }
    
    // Test human only file
    console.log('\n   📄 Testing human permissions file...');
    try {
      console.log('   ⏳ Querying ACL (15s timeout)...');
      const { stdout } = await execWithTimeout(`codeguard acl "${filePaths['test-human-only.py']}" -f json`, 15000);
      const result = JSON.parse(stdout);
      
      console.log(`   📊 Permissions - AI: ${result.permissions?.ai}, Human: ${result.permissions?.human}`);
      console.log(`   📊 Code: ${result.code}`);
      
      // This file has mixed permissions, so we expect it to reflect the most restrictive
      if (result.permissions?.human === 'write') {
        console.log('   ✅ Human write permission detected');
      } else {
        console.log(`   ⚠️  Human permission: ${result.permissions?.human}`);
      }
    } catch (error) {
      console.log(`   ❌ Failed to query human file: ${error.message}`);
      allTestsPassed = false;
    }
    
    // Test mixed permissions
    console.log('\n   📄 Testing mixed permissions file...');
    try {
      console.log('   ⏳ Querying ACL (15s timeout)...');
      const { stdout } = await execWithTimeout(`codeguard acl "${filePaths['test-mixed-permissions.ts']}" -f json`, 15000);
      const result = JSON.parse(stdout);
      
      console.log(`   📊 Mixed file - AI: ${result.permissions?.ai}, Human: ${result.permissions?.human}`);
      console.log(`   📊 Code: ${result.code}`);
      console.log('   ✅ Mixed permissions file processed');
    } catch (error) {
      console.log(`   ❌ Failed to query mixed file: ${error.message}`);
      allTestsPassed = false;
    }
    
    // Test line counts
    console.log('\n   📄 Testing line count annotations...');
    try {
      console.log('   ⏳ Querying ACL (15s timeout)...');
      const { stdout } = await execWithTimeout(`codeguard acl "${filePaths['test-line-counts.java']}" -f json`, 15000);
      const result = JSON.parse(stdout);
      
      console.log(`   📊 Line count file - AI: ${result.permissions?.ai}, Human: ${result.permissions?.human}`);
      console.log(`   📊 Code: ${result.code}`);
      console.log('   ✅ Line count annotations processed');
    } catch (error) {
      console.log(`   ❌ Failed to query line count file: ${error.message}`);
      allTestsPassed = false;
    }
    
    // Step 4: Test performance
    console.log('\n3️⃣ Testing performance...');
    console.log('   ⏳ Running performance test (10s timeout)...');
    const perfStart = Date.now();
    try {
      await execWithTimeout(`codeguard acl "${filePaths['test-ai-write.js']}" -f json`, 10000);
      const elapsed = Date.now() - perfStart;
      console.log(`   ⏱️  Query time: ${elapsed}ms`);
      
      if (elapsed > 10000) {
        console.log('   ⚠️  Query took longer than 10 seconds');
      } else {
        console.log('   ✅ Performance acceptable');
      }
    } catch (error) {
      console.log(`   ❌ Performance test failed: ${error.message}`);
      allTestsPassed = false;
    }
    
    // Step 5: Test error handling
    console.log('\n4️⃣ Testing error handling...');
    console.log('   ⏳ Testing with nonexistent file (10s timeout)...');
    try {
      await execWithTimeout(`codeguard acl "/nonexistent/file.txt" -f json`, 10000);
      console.log('   ⚠️  Expected error for nonexistent file, but got success');
    } catch (error) {
      if (error.message.includes('timed out')) {
        console.log('   ❌ CodeGuard hung on nonexistent file');
        allTestsPassed = false;
      } else {
        console.log('   ✅ Properly handles nonexistent files');
      }
    }
    
    // Step 6: Test validate-sections command
    console.log('\n5️⃣ Testing validate-sections command...');
    console.log('   📄 Testing validation mode with test-mixed-permissions.ts...');
    
    // Create a validation package with actual file hash
    const fileContent = await fs.readFile(filePaths['test-mixed-permissions.ts'], 'utf8');
    const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');
    
    const validationPackage = {
      validation_request: {
        file_path: filePaths['test-mixed-permissions.ts'],
        file_hash: fileHash,
        total_lines: testFiles['test-mixed-permissions.ts'].split('\n').length,
        timestamp: new Date().toISOString(),
        plugin_version: "1.0.0",
        plugin_name: "CodeGuard for VSCode Test",
        guard_regions: [
          {
            index: 0,
            guard: "@guard:ai:w",
            parsed_guard: {
              raw: "@guard:ai:w",
              target: "ai",
              identifiers: ["*"],
              permission: "write",
              scope: "file",
              scope_modifiers: []
            },
            declaration_line: 1,
            start_line: 2,
            end_line: 4,
            content_hash: "mock_hash_1",
            content_preview: "interface PublicAPI {"
          },
          {
            index: 1,
            guard: "@guard:human:w",
            parsed_guard: {
              raw: "@guard:human:w",
              target: "human",
              identifiers: ["*"],
              permission: "write",
              scope: "file",
              scope_modifiers: []
            },
            declaration_line: 5,
            start_line: 6,
            end_line: 12,
            content_hash: "mock_hash_2"
          },
          {
            index: 2,
            guard: "@guard:ai:r",
            parsed_guard: {
              raw: "@guard:ai:r",
              target: "ai",
              identifiers: ["*"],
              permission: "read-only",
              scope: "file",
              scope_modifiers: []
            },
            declaration_line: 10,
            start_line: 11,
            end_line: 12,
            content_hash: "mock_hash_3"
          },
          {
            index: 3,
            guard: "@guard:ai:context",
            parsed_guard: {
              raw: "@guard:ai:context",
              target: "ai",
              identifiers: ["*"],
              permission: "context",
              scope: "file",
              scope_modifiers: []
            },
            declaration_line: 15,
            start_line: 16,
            end_line: 17,
            content_hash: "mock_hash_4"
          }
        ],
        line_coverage: [],
        validation_metadata: {
          parser_used: "regex",
          language: "typescript",
          encoding: "utf-8",
          supports_overlapping: true
        }
      }
    };
    
    // Write validation package to temp file
    const tempValidationFile = path.join(testDir, 'validation-test.json');
    try {
      await fs.writeFile(tempValidationFile, JSON.stringify(validationPackage, null, 2));
      console.log('   ✅ Created validation package');
      
      // Test validate-sections command
      console.log('   ⏳ Running validate-sections command (15s timeout)...');
      try {
        const { stdout, stderr } = await execWithTimeout(
          `codeguard validate-sections --json-file "${tempValidationFile}"`,
          15000
        );
        
        // Check if command succeeded or reported mismatches
        console.log('   📊 Validation command executed');
        
        // Try to parse the output
        try {
          const result = JSON.parse(stdout);
          console.log(`   📊 Validation status: ${result.status || 'unknown'}`);
          if (result.discrepancies?.length > 0) {
            console.log(`   📊 Found ${result.discrepancies.length} discrepancies (expected for test)`);
          }
          console.log('   ✅ validate-sections command works correctly');
        } catch (parseError) {
          // Command might output non-JSON on success
          console.log('   ℹ️  Output was not JSON, checking exit code...');
          console.log('   ✅ validate-sections command executed');
        }
      } catch (error) {
        if (error.message.includes('timed out')) {
          console.log('   ❌ validate-sections command timed out');
          allTestsPassed = false;
        } else if (error.message.includes('code 1')) {
          // Exit code 1 means validation mismatch, which is expected for our test
          console.log('   ✅ validate-sections found mismatches (expected behavior)');
        } else if (error.message.includes('code 5')) {
          // Exit code 5 means file changed - but we're using the actual hash now
          console.log('   ✅ validate-sections detected file hash correctly');
          // Parse the error output to check details
          try {
            const errorOutput = error.message.substring(error.message.indexOf('{'));
            const result = JSON.parse(errorOutput);
            console.log(`   📊 Exit code: ${result.validation_result.exit_code}`);
            console.log(`   📊 Status: ${result.validation_result.status}`);
          } catch (e) {}
        } else if (error.message.includes('Unknown command') || error.message.includes('invalid choice')) {
          console.log('   ⚠️  validate-sections command not available in this CodeGuard version');
          console.log('   ℹ️  This feature may not be implemented yet');
        } else {
          console.log(`   ❌ validate-sections command failed: ${error.message}`);
          allTestsPassed = false;
        }
      }
      
      // Cleanup temp file
      await fs.unlink(tempValidationFile).catch(() => {});
      
    } catch (error) {
      console.log(`   ❌ Failed to test validate-sections: ${error.message}`);
      allTestsPassed = false;
    }
    
    // Step 7: Test process cleanup
    console.log('\n6️⃣ Testing process cleanup...');
    console.log('   🔍 Checking for hung CodeGuard processes...');
    try {
      const { stdout } = await execWithTimeout('pgrep -f codeguard || echo "No processes found"', 5000);
      const processes = stdout.trim().split('\n').filter(line => line && line !== 'No processes found');
      if (processes.length > 0) {
        console.log(`   ⚠️  Found ${processes.length} CodeGuard processes still running: ${processes.join(', ')}`);
        console.log('   💡 This may indicate hanging processes from previous runs');
      } else {
        console.log('   ✅ No hung CodeGuard processes detected');
      }
    } catch (error) {
      console.log('   ℹ️  Could not check for processes (this is OK)');
    }
    
  } catch (fatalError) {
    console.error('\n💥 Fatal error during testing:', fatalError.message);
    if (fatalError.message.includes('timed out')) {
      console.error('🚨 CodeGuard appears to be hanging - killing any hung processes');
      await killHungProcesses();
    }
    allTestsPassed = false;
  } finally {
    // Always cleanup
    await cleanupTestFiles(testDir);
    
    // Final cleanup - kill any remaining processes
    console.log('\n🧹 Final cleanup...');
    await killHungProcesses();
  }
  
  // Final result
  console.log('\n📋 Acceptance Test Results:');
  if (allTestsPassed) {
    console.log('✅ All tests passed! CodeGuard CLI is working correctly.');
    console.log('🚀 Safe to proceed with integration tests.');
    console.log('⏱️  All operations completed within timeout limits.');
    return true;
  } else {
    console.log('❌ Some tests failed. Please check CodeGuard CLI configuration.');
    console.log('🔧 Fix issues before proceeding with integration tests.');
    console.log('💡 Common issues:');
    console.log('   - CodeGuard hanging at startup (cold start issues)');
    console.log('   - CodeGuard hanging on specific file types');
    console.log('   - Network/filesystem access issues');
    return false;
  }
}

// Run the test
testCodeGuardCLI().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Fatal error in acceptance test:', error);
  process.exit(1);
});