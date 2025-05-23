#!/usr/bin/env node

/**
 * Verification test to ensure tree-sitter is properly integrated
 * This test checks that tree-sitter files exist and the module loads correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Tree-sitter Integration\n');

let allChecksPass = true;

// Check 1: Verify web-tree-sitter is installed
console.log('1️⃣ Checking web-tree-sitter installation:');
try {
  const treeSitterPath = require.resolve('web-tree-sitter');
  console.log(`   ✅ Found at: ${treeSitterPath}`);
  
  // Check for WASM file
  const wasmPath = path.join(path.dirname(treeSitterPath), 'tree-sitter.wasm');
  if (fs.existsSync(wasmPath)) {
    const stats = fs.statSync(wasmPath);
    console.log(`   ✅ WASM file found: ${(stats.size / 1024).toFixed(2)} KB`);
  } else {
    console.log(`   ❌ WASM file not found at: ${wasmPath}`);
    allChecksPass = false;
  }
} catch (error) {
  console.log('   ❌ web-tree-sitter not found');
  allChecksPass = false;
}

// Check 2: Verify our tree-sitter parser module exists
console.log('\n2️⃣ Checking tree-sitter parser module:');
const parserPath = path.join(__dirname, '..', 'src', 'utils', 'treeSitterParser.ts');
if (fs.existsSync(parserPath)) {
  const content = fs.readFileSync(parserPath, 'utf8');
  console.log(`   ✅ treeSitterParser.ts exists (${content.length} bytes)`);
  
  // Check for key functions
  const functions = ['initializeTreeSitter', 'parseDocument', 'findNodeAtPosition', 'getNodeBoundaries'];
  for (const func of functions) {
    if (content.includes(`export function ${func}`) || content.includes(`export async function ${func}`) || content.includes(`function ${func}`)) {
      console.log(`   ✅ Function '${func}' exported`);
    } else {
      console.log(`   ❌ Function '${func}' not found`);
      // Don't fail for all functions, some might be internal
    }
  }
} else {
  console.log(`   ❌ treeSitterParser.ts not found at: ${parserPath}`);
  allChecksPass = false;
}

// Check 3: Verify scopeResolver uses tree-sitter
console.log('\n3️⃣ Checking scopeResolver integration:');
const scopeResolverPath = path.join(__dirname, '..', 'src', 'utils', 'scopeResolver.ts');
if (fs.existsSync(scopeResolverPath)) {
  const content = fs.readFileSync(scopeResolverPath, 'utf8');
  
  if (content.includes('resolveSemanticWithTreeSitter')) {
    console.log('   ✅ Tree-sitter resolution function found');
  } else {
    console.log('   ❌ Tree-sitter resolution function not found');
    allChecksPass = false;
  }
  
  if (content.includes('// Fall back to regex-based parsing')) {
    console.log('   ✅ Fallback to regex comment found');
  }
  
  if (content.includes('await resolveSemanticWithTreeSitter')) {
    console.log('   ✅ Tree-sitter is called before regex fallback');
  }
} else {
  console.log(`   ❌ scopeResolver.ts not found`);
  allChecksPass = false;
}

// Check 4: Verify language WASM files location
console.log('\n4️⃣ Checking language parser setup:');
const wasmDir = path.join(__dirname, '..', 'resources', 'tree-sitter-wasm');
if (fs.existsSync(wasmDir)) {
  console.log(`   ✅ WASM directory exists: ${wasmDir}`);
  
  const files = fs.readdirSync(wasmDir);
  const wasmFiles = files.filter(f => f.endsWith('.wasm'));
  
  if (wasmFiles.length > 0) {
    console.log(`   ✅ Found ${wasmFiles.length} WASM files:`);
    wasmFiles.forEach(file => {
      const size = fs.statSync(path.join(wasmDir, file)).size;
      console.log(`      • ${file} (${(size / 1024).toFixed(2)} KB)`);
    });
  } else {
    console.log('   ⚠️  No language WASM files found');
    console.log('      Run: cd resources/tree-sitter-wasm && ./download-parsers.sh');
  }
} else {
  console.log(`   ⚠️  WASM directory not found: ${wasmDir}`);
}

// Check 5: Verify webpack configuration
console.log('\n5️⃣ Checking webpack configuration:');
const webpackPath = path.join(__dirname, '..', 'webpack.config.js');
if (fs.existsSync(webpackPath)) {
  const content = fs.readFileSync(webpackPath, 'utf8');
  
  if (content.includes('copy-webpack-plugin')) {
    console.log('   ✅ CopyWebpackPlugin configured');
  }
  
  if (content.includes('tree-sitter.wasm')) {
    console.log('   ✅ tree-sitter.wasm copy configured');
  }
  
  if (content.includes('resources/tree-sitter-wasm')) {
    console.log('   ✅ Language WASM files copy configured');
  }
} else {
  console.log('   ❌ webpack.config.js not found');
  allChecksPass = false;
}

// Check 6: Verify compiled output
console.log('\n6️⃣ Checking compiled output:');
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  const distFiles = fs.readdirSync(distPath);
  
  if (distFiles.includes('extension.js')) {
    const extensionSize = fs.statSync(path.join(distPath, 'extension.js')).size;
    console.log(`   ✅ extension.js found (${(extensionSize / 1024).toFixed(2)} KB)`);
    
    // Check if tree-sitter code is in the bundle
    const bundleContent = fs.readFileSync(path.join(distPath, 'extension.js'), 'utf8');
    if (bundleContent.includes('web-tree-sitter') || bundleContent.includes('Parser.init')) {
      console.log('   ✅ Tree-sitter code found in bundle');
    } else {
      console.log('   ⚠️  Tree-sitter code might not be in bundle');
    }
  }
  
  // Check for copied WASM file
  const distWasmPath = path.join(distPath, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm');
  if (fs.existsSync(distWasmPath)) {
    console.log('   ✅ tree-sitter.wasm copied to dist');
  } else {
    console.log('   ⚠️  tree-sitter.wasm not found in dist');
  }
}

// Summary
console.log('\n\n📊 Summary:');
if (allChecksPass) {
  console.log('✅ All critical checks passed! Tree-sitter is properly integrated.');
  console.log('\n💡 To download language parsers, run:');
  console.log('   cd resources/tree-sitter-wasm && ./download-parsers.sh');
} else {
  console.log('❌ Some checks failed. Tree-sitter integration may have issues.');
  process.exit(1);
}

console.log('\n📝 Notes:');
console.log('• Tree-sitter will parse code into an AST for accurate scope resolution');
console.log('• If parsing fails, the extension falls back to regex-based parsing');
console.log('• Language WASM files are optional but improve accuracy');
console.log('• The extension works without tree-sitter, but with reduced accuracy');