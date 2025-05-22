// This is a corrected fix for both bugs
// Bug 1: Bounded regions (line counts) not reverting to proper permissions
// Bug 2: Empty lines at the end of sections not highlighted

/**
 * The key fix is to determine the parent permission for each bounded region
 * by directly looking at what unbounded region would apply at that position.
 */
function updateCodeDecorations(document) {
  if (!document) return;
  
  const activeEditor = window.activeTextEditor;
  if (!activeEditor) return;

  const text = document.getText();
  const lines = text.split(/\r?\n/);
  
  // Direct line-by-line permission mapping - clean approach
  const linePermissions = new Array(lines.length).fill('default');
  
  // Find all guard tags and store their positions and permissions
  const guardTags = [];
  
  // Use appropriate pattern based on file type
  const PATTERN = /#\s*@guard:ai:(r|w|n)(\.(\d+))?/i; // Example: Python pattern
  
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(PATTERN);
    if (match) {
      const permission = match[1].toLowerCase();
      const lineCount = match[3] ? parseInt(match[3], 10) : undefined;
      
      guardTags.push({
        lineNumber: i,
        permission,
        lineCount
      });
    }
  }
  
  if (guardTags.length === 0) return;
  
  // Sort guard tags by line number
  guardTags.sort((a, b) => a.lineNumber - b.lineNumber);
  
  // ===== STEP 1: Create a map of base permissions from unbounded regions =====
  
  // Array to hold the permission that applies at each line from unbounded regions
  const basePermissions = new Array(lines.length).fill(null);
  
  // First process all unbounded regions to establish the base permission state
  const unboundedTags = guardTags.filter(tag => tag.lineCount === undefined);
  
  for (let i = 0; i < unboundedTags.length; i++) {
    const tag = unboundedTags[i];
    const startLine = tag.lineNumber;
    
    // The end is either the next unbounded tag or the end of file
    let endLine;
    if (i < unboundedTags.length - 1) {
      endLine = unboundedTags[i + 1].lineNumber;
    } else {
      endLine = lines.length;
    }
    
    // Apply this unbounded permission to all lines in range
    for (let j = startLine; j < endLine; j++) {
      basePermissions[j] = tag.permission;
    }
  }
  
  // ===== STEP 2: Directly compute what permission should apply at each line =====
  
  // First apply base permissions from unbounded regions
  for (let i = 0; i < lines.length; i++) {
    if (basePermissions[i] !== null) {
      linePermissions[i] = basePermissions[i];
    }
  }
  
  // Then apply bounded regions, and carefully determine what happens after they end
  const boundedTags = guardTags.filter(tag => tag.lineCount !== undefined);
  
  for (const tag of boundedTags) {
    const startLine = tag.lineNumber;
    // +1 is critical: it ensures we count the guard tag line itself as line 1
    const endLine = Math.min(startLine + tag.lineCount + 1, lines.length);
    
    // Apply permission to all lines within the bounded region
    for (let i = startLine; i < endLine; i++) {
      linePermissions[i] = tag.permission;
    }
    
    // BUGFIX 1: After bounded region ends, find the correct permission to apply
    if (endLine < lines.length) {
      // To fix bug 1, we directly determine what permission should apply at the end line
      // We look at all unbounded regions and find which one would be active at this position
      
      let effectivePermission = 'default';
      for (const unboundedTag of unboundedTags) {
        if (unboundedTag.lineNumber <= endLine) {
          // Find the next unbounded tag after this one
          const nextIndex = unboundedTags.indexOf(unboundedTag) + 1;
          const nextLine = nextIndex < unboundedTags.length ? 
                           unboundedTags[nextIndex].lineNumber : lines.length;
          
          // If the end line falls within this unbounded region's range,
          // this is the permission that should apply
          if (endLine < nextLine) {
            effectivePermission = unboundedTag.permission;
            break;
          }
        }
      }
      
      // Apply the correct permission at the end line
      linePermissions[endLine] = effectivePermission;
      
      // BUGFIX 2: Ensure empty lines after a bounded region get proper highlighting
      // Apply the same permission to all lines until the next guard tag
      let nextGuardTagLine = lines.length;
      for (const nextTag of guardTags) {
        if (nextTag.lineNumber > endLine) {
          nextGuardTagLine = nextTag.lineNumber;
          break;
        }
      }
      
      for (let i = endLine + 1; i < nextGuardTagLine; i++) {
        // Only change lines that haven't been explicitly set by another rule
        if (linePermissions[i] === 'default') {
          linePermissions[i] = effectivePermission;
        }
      }
    }
  }
  
  // The rest of the function (converting linePermissions to decoration ranges) stays the same
  console.log("Line permissions after all processing:");
  for (let i = 0; i < linePermissions.length; i++) {
    console.log(`Line ${i}: ${linePermissions[i]} - ${lines[i].substring(0, 30)}`);
  }
  
  return linePermissions; // For testing purposes
}

// Example test function 
function testFix() {
  const testDocument = {
    getText: () => `
# Test file
# No guard tag line

# @guard:ai:w
# This starts an unbounded write region
# Should be 'w' permission (red)

# @guard:ai:r.2
# This is line 1 of read region (r)
# This is line 2 of read region (r)
# This should revert to 'w' - BUG 1 TEST

# Empty line should be 'w' too - BUG 2 TEST

# @guard:ai:n
# This starts an unbounded no-access region
# All following should be 'n' (green)

# @guard:ai:w.1
# Just this ONE line should be 'w' (red)
# This should be 'n' - BUG 1 TEST

# Empty line should be 'n' too - BUG 2 TEST

`,
    languageId: 'python'
  };
  
  // Execute the function
  const permissions = updateCodeDecorations(testDocument);
  
  // Verify bug 1: Line after bounded region should revert to parent permission
  const testPoints = [
    { line: 12, expected: 'w', description: "After r.2 region, should be 'w'" },
    { line: 23, expected: 'n', description: "After w.1 region, should be 'n'" }
  ];
  
  // Verify bug 2: Empty lines should have correct permission
  const emptyLines = [14, 25]; 
  for (const line of emptyLines) {
    testPoints.push({
      line,
      expected: permissions[line-1], // Should match the previous line
      description: `Empty line ${line} should match previous line`
    });
  }
  
  // Check the results
  console.log("\nTEST RESULTS:");
  let allPassed = true;
  
  for (const test of testPoints) {
    const result = permissions[test.line] === test.expected;
    allPassed = allPassed && result;
    
    console.log(`${result ? 'PASS' : 'FAIL'} - ${test.description}`);
    if (!result) {
      console.log(`  Line ${test.line}: Expected '${test.expected}', got '${permissions[test.line]}'`);
    }
  }
  
  console.log(`\nOverall: ${allPassed ? 'ALL TESTS PASSED' : 'TESTS FAILED'}`);
  return allPassed;
}