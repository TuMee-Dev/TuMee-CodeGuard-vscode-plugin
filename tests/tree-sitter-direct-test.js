#!/usr/bin/env node

/**
 * Direct test of tree-sitter parser to ensure it's actually being used
 * This test bypasses the extension and tests the parser directly
 */

const Parser = require('web-tree-sitter');
const { JSDOM } = require('jsdom');

// Web-tree-sitter needs some browser APIs
if (typeof global.document === 'undefined') {
  const dom = new JSDOM();
  global.document = dom.window.document;
  global.window = dom.window;
}
const path = require('path');
const fs = require('fs');

async function testTreeSitterDirectly() {
  console.log('🌳 Direct Tree-sitter Parser Test\n');
  
  try {
    // Initialize tree-sitter
    console.log('Initializing Parser...');
    await Parser.init();
    const parser = new Parser();
    console.log('✅ Parser initialized\n');
    
    // Test JavaScript parsing
    console.log('📝 Testing JavaScript parsing:');
    
    // Try to load JavaScript grammar
    const jsWasmPath = path.join(__dirname, '..', 'resources', 'tree-sitter-wasm', 'tree-sitter-javascript.wasm');
    
    if (!fs.existsSync(jsWasmPath)) {
      console.log(`⚠️  JavaScript WASM file not found at: ${jsWasmPath}`);
      console.log('   Run: cd resources/tree-sitter-wasm && ./download-parsers.sh');
      console.log('   to download language parsers\n');
      
      // Try with a simple example that would work differently with regex vs tree-sitter
      console.log('Testing without language parser (will show parser capabilities)...\n');
    } else {
      try {
        const jsWasm = fs.readFileSync(jsWasmPath);
        const JavaScript = await Parser.Language.load(jsWasm);
        parser.setLanguage(JavaScript);
        console.log('✅ JavaScript language loaded\n');
        
        // Parse some code
        const code = `
function outer() {
  // This is a comment
  const inner = (x) => {
    return x * 2;
  };
  
  /* Multi-line
     comment */
  return inner(5);
}

class Example {
  constructor() {
    this.value = 42;
  }
  
  method() {
    return this.value;
  }
}`;
        
        const tree = parser.parse(code);
        console.log('✅ Code parsed successfully!\n');
        
        // Explore the AST
        console.log('🌲 Abstract Syntax Tree:');
        console.log(`Root: ${tree.rootNode.type}`);
        console.log(`Children: ${tree.rootNode.childCount}`);
        
        // Find all functions
        console.log('\n🔍 Finding all functions:');
        const functions = findNodesOfType(tree.rootNode, ['function_declaration', 'arrow_function', 'method_definition']);
        
        for (const func of functions) {
          const name = getNodeName(func) || '<anonymous>';
          console.log(`  - ${func.type} "${name}" at lines ${func.startPosition.row + 1}-${func.endPosition.row + 1}`);
        }
        
        // Find all classes
        console.log('\n🔍 Finding all classes:');
        const classes = findNodesOfType(tree.rootNode, ['class_declaration']);
        
        for (const cls of classes) {
          const name = getNodeName(cls);
          console.log(`  - ${cls.type} "${name}" at lines ${cls.startPosition.row + 1}-${cls.endPosition.row + 1}`);
          
          // Find methods in the class
          const methods = findNodesOfType(cls, ['method_definition']);
          for (const method of methods) {
            const methodName = getNodeName(method);
            console.log(`    • method "${methodName}" at line ${method.startPosition.row + 1}`);
          }
        }
        
        // Test a specific query
        console.log('\n🎯 Testing specific scope resolution:');
        
        // Find the arrow function (line 3)
        const nodeAtLine3 = findNodeAtLine(tree.rootNode, 3);
        console.log(`  Node at line 4: ${nodeAtLine3?.type}`);
        
        const arrowFunc = findParentOfType(nodeAtLine3, ['arrow_function']);
        if (arrowFunc) {
          console.log(`  ✅ Found arrow function: lines ${arrowFunc.startPosition.row + 1}-${arrowFunc.endPosition.row + 1}`);
        }
        
        // Demonstrate tree-sitter's advantage over regex
        console.log('\n💡 Tree-sitter advantages over regex:');
        console.log('  1. Correctly handles nested functions');
        console.log('  2. Ignores functions in comments');
        console.log('  3. Understands language syntax precisely');
        console.log('  4. Can differentiate between function declarations, expressions, and arrow functions');
        
      } catch (error) {
        console.error('❌ Failed to load JavaScript language:', error.message);
      }
    }
    
    // Test tree-sitter's ability to handle syntax errors
    console.log('\n\n🚨 Testing error recovery:');
    
    const brokenCode = `
function incomplete(x) {
  if (x > 0) {
    return x * 2
  // Missing closing brace
}

function complete() {
  return 42;
}`;
    
    try {
      const tree = parser.parse(brokenCode);
      console.log('✅ Parsed code with syntax errors');
      
      const functions = findNodesOfType(tree.rootNode, ['function_declaration']);
      console.log(`  Found ${functions.length} functions despite syntax error`);
      
      for (const func of functions) {
        const name = getNodeName(func);
        const hasError = containsError(func);
        console.log(`  - ${name}: ${hasError ? 'contains errors' : 'parsed correctly'}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to parse broken code:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Helper functions
function findNodesOfType(node, types) {
  const results = [];
  
  function traverse(n) {
    if (types.includes(n.type)) {
      results.push(n);
    }
    for (let i = 0; i < n.childCount; i++) {
      traverse(n.child(i));
    }
  }
  
  traverse(node);
  return results;
}

function getNodeName(node) {
  // Try to find an identifier child
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === 'identifier' || child.type === 'property_identifier') {
      return child.text;
    }
  }
  return null;
}

function findNodeAtLine(node, line) {
  if (node.startPosition.row <= line && node.endPosition.row >= line) {
    // Check children for more specific match
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      const childMatch = findNodeAtLine(child, line);
      if (childMatch) return childMatch;
    }
    return node;
  }
  return null;
}

function findParentOfType(node, types) {
  let current = node;
  while (current) {
    if (types.includes(current.type)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function containsError(node) {
  if (node.type === 'ERROR' || node.isMissing) {
    return true;
  }
  for (let i = 0; i < node.childCount; i++) {
    if (containsError(node.child(i))) {
      return true;
    }
  }
  return false;
}

// Run the test
testTreeSitterDirectly().then(() => {
  console.log('\n✅ Direct tree-sitter test completed!');
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});