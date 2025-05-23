#!/usr/bin/env node

/**
 * Example showing how tree-sitter improves guard tag parsing
 * This demonstrates real-world cases where tree-sitter is superior to regex
 */

console.log('🌳 Tree-sitter vs Regex: Real Examples\n');

// Example 1: Nested Functions
console.log('📋 Example 1: Nested Functions');
console.log('─'.repeat(50));
console.log(`
Code:
\`\`\`javascript
function outer() {
  console.log('outer');
  
  // @guard:ai:r.func
  const inner = (x) => {
    return x * 2;
  };
  
  return inner;
}
\`\`\`

With Regex:
- Might incorrectly select the outer function (lines 1-10)
- Can't distinguish between outer and inner functions

With Tree-sitter:
- Correctly identifies the arrow function (lines 5-7)
- Understands that the guard tag applies to 'inner', not 'outer'
`);

// Example 2: Comments with Code
console.log('\n📋 Example 2: Comments Containing Code');
console.log('─'.repeat(50));
console.log(`
Code:
\`\`\`javascript
/*
  Old implementation:
  function oldProcess() {
    return 'deprecated';
  }
*/

// @guard:ai:n.func  
function newProcess() {
  return 'current';
}
\`\`\`

With Regex:
- Might find the commented function first
- Could apply guard to wrong function

With Tree-sitter:
- Ignores the commented code entirely
- Correctly applies guard to 'newProcess' only
`);

// Example 3: Complex Signatures
console.log('\n📋 Example 3: Multi-line Type Signatures');
console.log('─'.repeat(50));
console.log(`
Code:
\`\`\`typescript
// @guard:ai:r.sig
async function fetchData<T extends BaseType>(
  url: string,
  options: RequestOptions & {
    retry?: number;
    timeout?: number;
  }
): Promise<ApiResponse<T>> {
  // implementation
}
\`\`\`

With Regex:
- Might only capture the first line
- Can't handle complex generic constraints

With Tree-sitter:
- Captures the entire signature (lines 2-8)
- Understands TypeScript syntax perfectly
`);

// Example 4: Python Decorators
console.log('\n📋 Example 4: Python Decorators and Docstrings');
console.log('─'.repeat(50));
console.log(`
Code:
\`\`\`python
@cache
@validate_input
# @guard:ai:w.body
def process_data(data: List[Dict]) -> Dict:
    """
    Process input data.
    
    Args:
        data: List of dictionaries
    
    Returns:
        Processed dictionary
    """
    result = {}
    for item in data:
        result.update(item)
    return result
\`\`\`

With Regex:
- Might include decorators and docstring in body
- Hard to detect where function body actually starts

With Tree-sitter:
- Correctly identifies body starts after docstring
- Excludes decorators and docstring from body scope
`);

// Example 5: Class Methods
console.log('\n📋 Example 5: Class with Various Method Types');
console.log('─'.repeat(50));
console.log(`
Code:
\`\`\`javascript
class DataProcessor {
  constructor(config) {
    this.config = config;
  }
  
  // @guard:ai:n.method
  async process(data) {
    return this.transform(data);
  }
  
  get status() {
    return this._status;
  }
  
  static validate(input) {
    return true;
  }
}
\`\`\`

With Regex:
- Might not distinguish between methods, getters, and static methods
- Could incorrectly include constructor

With Tree-sitter:
- Correctly identifies 'process' as the target method
- Understands different method types in the class
`);

// Summary
console.log('\n📊 Summary: Why Tree-sitter Matters');
console.log('─'.repeat(50));
console.log(`
1. Accuracy: Tree-sitter understands code structure, not just patterns
2. Context: It knows the difference between code and comments
3. Robustness: Handles complex, multi-line constructs correctly
4. Language-aware: Each language gets its own precise parser
5. Error recovery: Even with syntax errors, it can parse most of the code

The extension uses tree-sitter first, then falls back to regex if needed,
ensuring the best possible accuracy while maintaining compatibility.
`);

console.log('✨ Run the extension and try these examples to see the difference!');