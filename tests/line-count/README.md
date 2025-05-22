# Line Count Tests

This directory contains tests specifically for the line counting functionality in guard tags (e.g., `@guard:ai:r.3`).

## Key Test Files

- `focused-fix.js`: The main test file that demonstrates the fixed algorithm for bounded regions
- `final-test.py`: A Python test file to verify guard tag highlighting in VS Code
- `test-line-count-bugs.js`: Tests that specifically target the bounded region and empty line bugs

## Bug Fixes Tested

1. **Bounded Region Bug**: Ensure that bounded regions (with line counts) properly revert to the parent permission after the specified number of lines
2. **Empty Line Bug**: Ensure that empty lines at the end of sections are properly highlighted