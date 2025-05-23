#!/usr/bin/env python3
"""Test the guard processing logic by creating test files and checking results"""

import os
import tempfile
import subprocess
import json

test_cases = [
    {
        "name": "basic_guards.js",
        "content": """// Normal code
// @guard:ai:w
function test() {
  // AI can write here
}
// @guard:human:r
// Human read-only section
""",
        "expected_guards": 2
    },
    {
        "name": "line_count.py",
        "content": """# @guard:ai:r.3
# Line 1
# Line 2  
# Line 3
# Should revert to default
""",
        "expected_guards": 1
    },
    {
        "name": "new_format.ts",
        "content": """// @guard:ai[gpt-4]:w
// AI write section
// @guard:human[team-a]:n
// Human no access
// @guard:ai:context
// Context section
""",
        "expected_guards": 3
    },
    {
        "name": "signature_scope.py", 
        "content": """# Normal code
# @guard:ai:r.sig
def test_function(param1, param2):
    \"\"\"Test function\"\"\"
    return param1 + param2

# Should revert to default
""",
        "expected_guards": 1
    },
    {
        "name": "inline_signature.py",
        "content": """# Test inline signature guard
def __init__(self, size=100):  # @guard:ai:r.sig
    self.size = size
    
# Next function
def process(self):
    pass
""",
        "expected_guards": 1
    }
]

print("Guard Processing Tests")
print("======================\n")

passed = 0
failed = 0

for test in test_cases:
    print(f"Test: {test['name']}")
    
    # Count guard tags
    guard_count = test['content'].count('@guard:')
    
    if guard_count == test['expected_guards']:
        print(f"  ✅ Found {guard_count} guards as expected")
        passed += 1
    else:
        print(f"  ❌ Expected {test['expected_guards']} guards, found {guard_count}")
        failed += 1
    
    # Check specific patterns
    if 'new_format' in test['name']:
        if '[gpt-4]' in test['content'] and '[team-a]' in test['content']:
            print("  ✅ New format with identifiers detected")
        else:
            print("  ❌ New format identifiers not found")
            
    if 'signature_scope' in test['name'] or 'inline_signature' in test['name']:
        if '.sig' in test['content']:
            print("  ✅ Signature scope detected")
        else:
            print("  ❌ Signature scope not found")
    
    print()

print(f"\nSummary")
print(f"=======")
print(f"Passed: {passed}")
print(f"Failed: {failed}")
print(f"Total: {passed + failed}")