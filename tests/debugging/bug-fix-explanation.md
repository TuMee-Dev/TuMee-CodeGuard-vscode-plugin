# Bug Fix Explanation

## The Bugs

### Bug 1: Bounded regions not reverting to correct permissions

When using guard tags with line counts (e.g., `# @guard:ai:r.3`), the code should apply the specified permission to exactly N lines, then revert to whatever permission was in place before the bounded region began.

**The issue:** When a bounded region ended, the code was not correctly determining what permission should apply next. It was tracking based on which unbounded region the bounded region *started* in, not what should apply at the *end* line.

**Example:**
```python
# @guard:ai:w
# This starts an unbounded write region (red highlight)

# @guard:ai:r.2
# This should be read-only for 2 lines
# This is the last read-only line
# This should revert to write mode (red) - but it wasn't!
```

### Bug 2: Empty lines at the end of sections not getting proper highlighting

Empty lines at the end of a section were not inheriting the correct permission from their surrounding context.

**Example:**
```python
# @guard:ai:w
# This is highlighted in red

# This empty line should also be red, but it wasn't!

# @guard:ai:r
```

## The Solution

The fix addresses both bugs with a fundamental change to how permissions are calculated:

1. **First pass - establish base permissions:**
   - Process all unbounded regions first (those without line counts)
   - Create a map of what permission applies at each line in the document
   - This establishes the "baseline" permission state throughout the document

2. **Second pass - determine proper parent permissions:**
   - For each bounded region, look at the basePermissions map to determine what permission should apply after it ends
   - This ensures that bounded regions revert to the correct permission regardless of where they start or end

3. **Third pass - apply bounded regions:**
   - Apply permissions for all bounded regions
   - When a bounded region ends, explicitly set the permission to what's in the basePermissions map
   - Also apply this permission to all following lines until the next guard tag

## Key Code Changes

The critical change was replacing this logic:

```javascript
// For each bounded region that starts within this unbounded region,
// record that after the bounded region ends, we should revert to this permission
for (const bounded of boundedRegions) {
  if (bounded.startLine >= startLine && bounded.startLine < endLine) {
    afterBoundedRegions.set(bounded.endLine, tag.permission);
  }
}
```

With this more accurate approach:

```javascript
// Apply each unbounded region's permission to create a baseline
for (let i = 0; i < unboundedTags.length; i++) {
  const tag = unboundedTags[i];
  const startLine = tag.lineNumber;
  const endLine = i < unboundedTags.length - 1 ? unboundedTags[i + 1].lineNumber : lines.length;
  
  for (let j = startLine; j < endLine; j++) {
    basePermissions[j] = tag.permission;
  }
}

// For each bounded region, determine what permission should apply after it ends
// by looking directly at the basePermissions map
for (const region of boundedRegions) {
  const endLine = region.endLine;
  
  if (endLine < lines.length && basePermissions[endLine] !== null) {
    afterBoundedRegions.set(endLine, basePermissions[endLine]);
  }
}
```

This ensures that we correctly identify what permission should apply after a bounded region, regardless of what unbounded regions were defined before or after it.

## Verification

The fix was verified with a series of test files that contain carefully crafted examples of both bugs:

- Bounded regions inside unbounded regions to check proper reversion
- Empty lines at section boundaries to check consistent highlighting
- Multiple nested and sequential bounded regions to test complex interactions

All tests confirmed that the fix resolves both issues.