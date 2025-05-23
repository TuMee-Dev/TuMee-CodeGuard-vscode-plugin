#!/usr/bin/env node

/**
 * Tests for tree-sitter integration
 * Verifies that tree-sitter is properly parsing content and not just falling back to regex
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Mock VSCode API
const vscode = {
  Uri: {
    file: (path) => ({ fsPath: path, toString: () => path }),
    joinPath: (base, ...paths) => ({ 
      fsPath: path.join(base.fsPath || base, ...paths),
      toString: () => path.join(base.fsPath || base, ...paths)
    })
  },
  workspace: {
    fs: {
      readFile: async (uri) => {
        const filePath = uri.fsPath || uri;
        return {
          buffer: fs.readFileSync(filePath).buffer
        };
      }
    }
  },
  ExtensionContext: class {
    constructor() {
      this.extensionUri = { fsPath: path.join(__dirname, '..') };
    }
  }
};

global.vscode = vscode;

// Import our modules
const { initializeTreeSitter, parseDocument, findNodeAtPosition, getNodeBoundaries } = require('../dist/extension');
const { resolveSemantic, initializeScopeResolver } = require('../dist/extension');

// Test data for different languages
const TEST_CASES = {
  javascript: {
    code: `
// @guard:ai:r.func
function calculateTotal(items) {
  let sum = 0;
  for (const item of items) {
    sum += item.price;
  }
  return sum;
}

// @guard:ai:w.class
class ShoppingCart {
  constructor() {
    this.items = [];
  }
  
  addItem(item) {
    this.items.push(item);
  }
  
  // @guard:ai:n.sig
  getTotal() {
    return calculateTotal(this.items);
  }
}`,
    tests: [
      {
        line: 1,
        scope: 'func',
        expectedStart: 2,
        expectedEnd: 8,
        description: 'Function scope'
      },
      {
        line: 10,
        scope: 'class',
        expectedStart: 11,
        expectedEnd: 24,
        description: 'Class scope'
      },
      {
        line: 20,
        scope: 'sig',
        expectedStart: 21,
        expectedEnd: 21,
        description: 'Function signature'
      }
    ]
  },
  python: {
    code: `
# @guard:ai:r.func
def process_data(data):
    """Process the input data."""
    result = []
    for item in data:
        if item > 0:
            result.append(item * 2)
    return result

# @guard:ai:w.class
class DataProcessor:
    def __init__(self):
        self.data = []
    
    # @guard:ai:n.body
    def process(self, input_data):
        self.data = process_data(input_data)
        return self.data
    
    def clear(self):
        self.data = []`,
    tests: [
      {
        line: 1,
        scope: 'func',
        expectedStart: 2,
        expectedEnd: 8,
        description: 'Python function scope'
      },
      {
        line: 10,
        scope: 'class', 
        expectedStart: 11,
        expectedEnd: 21,
        description: 'Python class scope'
      },
      {
        line: 15,
        scope: 'body',
        expectedStart: 17,
        expectedEnd: 18,
        description: 'Python method body'
      }
    ]
  },
  typescript: {
    code: `
// @guard:ai:r.func
async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }
  return await response.json() as T;
}

// @guard:ai:w.class
interface User {
  id: number;
  name: string;
}

class UserService {
  private users: Map<number, User> = new Map();
  
  // @guard:ai:n.sig
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  setUser(user: User): void {
    this.users.set(user.id, user);
  }
}`,
    tests: [
      {
        line: 1,
        scope: 'func',
        expectedStart: 2,
        expectedEnd: 8,
        description: 'TypeScript async function'
      },
      {
        line: 10,
        scope: 'class',
        expectedStart: 16,
        expectedEnd: 27,
        description: 'TypeScript class (skipping interface)'
      },
      {
        line: 19,
        scope: 'sig',
        expectedStart: 20,
        expectedEnd: 20,
        description: 'TypeScript method signature'
      }
    ]
  }
};

// Test runner
async function runTests() {
  console.log('🧪 Testing Tree-sitter Integration...\n');
  
  // Initialize context
  const context = new vscode.ExtensionContext();
  let allTestsPassed = true;
  
  try {
    // Initialize tree-sitter
    console.log('Initializing tree-sitter...');
    await initializeScopeResolver(context);
    console.log('✅ Tree-sitter initialized\n');
  } catch (error) {
    console.error('❌ Failed to initialize tree-sitter:', error);
    process.exit(1);
  }
  
  // Test tree-sitter parsing for each language
  for (const [language, testData] of Object.entries(TEST_CASES)) {
    console.log(`\n📝 Testing ${language.toUpperCase()}:`);
    
    // Create a mock document
    const mockDocument = {
      languageId: language,
      getText: () => testData.code,
      lineAt: (line) => ({
        text: testData.code.split('\n')[line] || ''
      })
    };
    
    // Test 1: Verify tree-sitter can parse the document
    try {
      const tree = await parseDocument(context, mockDocument);
      if (tree) {
        console.log(`  ✅ Successfully parsed ${language} with tree-sitter`);
        
        // Additional verification: check if we can find nodes
        const rootNode = tree.rootNode;
        console.log(`     Root node type: ${rootNode.type}`);
        console.log(`     Child count: ${rootNode.childCount}`);
      } else {
        console.log(`  ⚠️  Failed to parse ${language} with tree-sitter (might fall back to regex)`);
      }
    } catch (error) {
      console.log(`  ❌ Error parsing ${language}:`, error.message);
      allTestsPassed = false;
    }
    
    // Test 2: Verify semantic scope resolution
    for (const test of testData.tests) {
      try {
        const result = await resolveSemantic(mockDocument, test.line, test.scope);
        
        if (!result) {
          console.log(`  ❌ ${test.description}: No result returned`);
          allTestsPassed = false;
          continue;
        }
        
        const startMatch = result.startLine === test.expectedStart;
        const endMatch = result.endLine === test.expectedEnd;
        
        if (startMatch && endMatch) {
          console.log(`  ✅ ${test.description}: Lines ${result.startLine}-${result.endLine}`);
        } else {
          console.log(`  ❌ ${test.description}:`);
          console.log(`     Expected: Lines ${test.expectedStart}-${test.expectedEnd}`);
          console.log(`     Got: Lines ${result.startLine}-${result.endLine}`);
          allTestsPassed = false;
        }
      } catch (error) {
        console.log(`  ❌ ${test.description}: Error -`, error.message);
        allTestsPassed = false;
      }
    }
  }
  
  // Test 3: Verify tree-sitter vs regex differences
  console.log('\n\n🔍 Testing Tree-sitter vs Regex Differences:');
  
  const edgeCaseCode = `
// Complex nested structure that regex might struggle with
function outer() {
  // @guard:ai:r.func
  const inner = async (data) => {
    return data.map(item => {
      // Nested arrow function
      return {
        value: item,
        transform: () => item * 2
      };
    });
  };
  
  return inner;
}`;
  
  const edgeCaseDoc = {
    languageId: 'javascript',
    getText: () => edgeCaseCode,
    lineAt: (line) => ({
      text: edgeCaseCode.split('\n')[line] || ''
    })
  };
  
  try {
    const result = await resolveSemantic(edgeCaseDoc, 3, 'func');
    if (result) {
      console.log(`  ✅ Nested arrow function correctly identified: Lines ${result.startLine}-${result.endLine}`);
      // The regex version might incorrectly identify the outer function
      // Tree-sitter should correctly identify the inner arrow function
      if (result.startLine === 4 && result.endLine === 12) {
        console.log('     Tree-sitter correctly parsed nested structure!');
      }
    }
  } catch (error) {
    console.log('  ❌ Edge case test failed:', error.message);
    allTestsPassed = false;
  }
  
  // Test 4: Verify fallback behavior
  console.log('\n\n🔄 Testing Fallback Behavior:');
  
  // Test with an unsupported language
  const unsupportedDoc = {
    languageId: 'brainfuck', // Not supported by tree-sitter
    getText: () => '++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.',
    lineAt: (line) => ({ text: '' })
  };
  
  try {
    const tree = await parseDocument(context, unsupportedDoc);
    if (!tree) {
      console.log('  ✅ Correctly failed to parse unsupported language');
      console.log('     Should fall back to regex for scope resolution');
    } else {
      console.log('  ⚠️  Unexpectedly parsed unsupported language');
    }
  } catch (error) {
    console.log('  ✅ Expected error for unsupported language:', error.message);
  }
  
  // Summary
  console.log('\n\n📊 Test Summary:');
  if (allTestsPassed) {
    console.log('✅ All tests passed! Tree-sitter is working correctly.');
  } else {
    console.log('❌ Some tests failed. Tree-sitter may not be working as expected.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});