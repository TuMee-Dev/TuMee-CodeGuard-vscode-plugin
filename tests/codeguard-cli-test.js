#!/usr/bin/env node

/**
 * Test the CodeGuard CLI integration
 */

const { promisify } = require('util');
const { exec: execCallback, spawn } = require('child_process');
const exec = promisify(execCallback);

// Enhanced exec with better timeout and process management for CodeGuard
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
      if (killed) return;
      
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
const path = require('path');
const fs = require('fs');

async function testCodeGuardCLI() {
  console.log('🔧 Testing CodeGuard CLI Integration\n');
  
  // Test 1: Check if CLI is available
  console.log('1️⃣ Checking CLI availability:');
  try {
    console.log('   ⏳ Testing CLI launch (15s timeout)...');
    const { stdout: whichOutput } = await execWithTimeout('which codeguard', 5000);
    console.log(`   ✅ Found at: ${whichOutput.trim()}`);
    
    const { stdout: versionOutput } = await execWithTimeout('codeguard --version', 15000);
    console.log(`   ✅ Version: ${versionOutput.trim()}`);
  } catch (error) {
    console.log('   ❌ CodeGuard CLI not found or hanging');
    console.log(`   Error: ${error.message}`);
    if (error.message.includes('timed out')) {
      console.log('   💡 CodeGuard appears to be hanging during startup');
    }
    return;
  }
  
  // Test 2: Test ACL query with timing
  console.log('\n2️⃣ Testing ACL query performance:');
  const testFile = __filename;
  
  console.log(`   Testing with: ${testFile}`);
  const startTime = Date.now();
  
  try {
    console.log('   ⏳ Querying ACL (15s timeout)...');
    const { stdout } = await execWithTimeout(`codeguard acl "${testFile}" -f json`, 15000);
    
    const elapsed = Date.now() - startTime;
    console.log(`   ✅ Query completed in ${elapsed}ms`);
    
    try {
      const result = JSON.parse(stdout);
      console.log(`   📋 Result:`);
      console.log(`      Path: ${result.path}`);
      console.log(`      Code: ${result.code}`);
      console.log(`      AI: ${result.permissions.ai}`);
      console.log(`      Human: ${result.permissions.human}`);
      console.log(`      Status: ${result.status}`);
    } catch (e) {
      console.log(`   ⚠️  Response is not valid JSON: ${stdout}`);
    }
  } catch (error) {
    console.log(`   ❌ Query failed: ${error.message}`);
  }
  
  // Test 3: Test multiple queries (to check if startup is only slow the first time)
  console.log('\n3️⃣ Testing multiple queries:');
  const times = [];
  
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    try {
      await execWithTimeout(`codeguard acl "${testFile}" -f json`, 15000);
      const elapsed = Date.now() - start;
      times.push(elapsed);
      console.log(`   Query ${i + 1}: ${elapsed}ms`);
    } catch (error) {
      console.log(`   Query ${i + 1}: Failed - ${error.message}`);
    }
  }
  
  if (times.length > 0) {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    console.log(`   📊 Average: ${avg}ms`);
    
    if (times[0] > times[times.length - 1] * 2) {
      console.log(`   ⚠️  First query was significantly slower (cold start)`);
    }
  }
  
  // Test 4: Test with different file types
  console.log('\n4️⃣ Testing different file types:');
  const testFiles = [
    { path: 'src/extension.ts', type: 'TypeScript' },
    { path: 'package.json', type: 'JSON' },
    { path: 'README.md', type: 'Markdown' },
    { path: 'webpack.config.js', type: 'JavaScript' }
  ];
  
  for (const file of testFiles) {
    const fullPath = path.join(__dirname, '..', file.path);
    if (fs.existsSync(fullPath)) {
      try {
        const start = Date.now();
        const { stdout } = await execWithTimeout(`codeguard acl "${fullPath}" -f json`, 15000);
        const elapsed = Date.now() - start;
        const result = JSON.parse(stdout);
        console.log(`   ${file.type}: ${result.code} (${elapsed}ms)`);
      } catch (error) {
        console.log(`   ${file.type}: Failed - ${error.message}`);
      }
    } else {
      console.log(`   ${file.type}: File not found`);
    }
  }
  
  // Test 5: Test error handling
  console.log('\n5️⃣ Testing error handling:');
  
  // Non-existent file
  try {
    await execWithTimeout(`codeguard acl "/non/existent/file.txt" -f json`, 10000);
    console.log('   ⚠️  Non-existent file: No error thrown');
  } catch (error) {
    console.log('   ✅ Non-existent file: Error handled properly');
  }
  
  // Invalid arguments
  try {
    await exec(`codeguard --invalid-flag`, {
      timeout: 10000
    });
    console.log('   ⚠️  Invalid flag: No error thrown');
  } catch (error) {
    console.log('   ✅ Invalid flag: Error handled properly');
  }
  
  console.log('\n✅ CLI integration test complete!');
}

// Run the test
testCodeGuardCLI().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});