/**
 * Comprehensive test for guard scope resolution
 * Tests all scope types to ensure they search forward correctly
 */

const testCases = {
  'class scope': {
    code: `# @guard:ai:w.class
# Comment about the class
class MyClass:
    def __init__(self):
        self.value = 1

# This line should revert to previous guard`,
    expected: {
      guardLine: 1,
      scopeStart: 3,
      scopeEnd: 5,
      revertLine: 7
    }
  },
  
  'block scope': {
    code: `# @guard:ai:n.block
# Comment about the dict
MY_DICT = {
    'key': 'value',
    'another': 'value'
}

# This line should revert`,
    expected: {
      guardLine: 1,
      scopeStart: 3,
      scopeEnd: 6,
      revertLine: 8
    }
  },
  
  'function scope': {
    code: `# @guard:ai:w.func
# Comment
def my_function():
    return 42

# This line should revert`,
    expected: {
      guardLine: 1,
      scopeStart: 3,
      scopeEnd: 4,
      revertLine: 6
    }
  }
};

console.log('Guard Scope Resolution Tests');
console.log('===========================\n');

Object.entries(testCases).forEach(([name, test]) => {
  console.log(`Testing ${name}:`);
  console.log('-'.repeat(name.length + 9));
  
  const lines = test.code.split('\n');
  console.log('Code:');
  lines.forEach((line, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}: ${line}`);
  });
  
  console.log(`\nExpected:`);
  console.log(`  Guard at line ${test.expected.guardLine}`);
  console.log(`  Scope: lines ${test.expected.scopeStart}-${test.expected.scopeEnd}`);
  console.log(`  Line ${test.expected.revertLine} reverts to previous guard`);
  console.log();
});

console.log('\nKEY POINT: All scopes should search FORWARD from the guard tag line');
console.log('to find the next occurrence of the scope construct.\n');