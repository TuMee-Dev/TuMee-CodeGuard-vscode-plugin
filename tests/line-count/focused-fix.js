// Focused solution for the two line count bugs
// This is a simplified version of the code that only addresses the two bugs
// Bug 1: Bounded regions (with line counts) not reverting to previous permissions
// Bug 2: Empty lines at the end of sections not being highlighted

function updateCodeDecorations(document) {
  const text = document.getText();
  const lines = text.split(/\r?\n/);
  
  // Use any appropriate pattern to find guard tags
  const PATTERN = /#\s*@guard:ai:(r|w|n)(\.(\d+))?/i;
  
  // First, find all guard tags
  const guardTags = [];
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
  
  // Create a map of permissions for each line
  const linePermissions = new Array(lines.length).fill('default');
  
  // Sort guard tags by line number to ensure we process them in order
  guardTags.sort((a, b) => a.lineNumber - b.lineNumber);
  
  // STEP 1: First process all unbounded regions
  // This establishes the "parent" permission for each area of the document
  const basePermissions = new Array(lines.length).fill(null);
  
  for (let i = 0; i < guardTags.length; i++) {
    const tag = guardTags[i];
    
    // Skip bounded regions for now
    if (tag.lineCount !== undefined) continue;
    
    // For unbounded regions, apply from this line to the next guard tag
    const startLine = tag.lineNumber;
    let endLine;
    
    // Find the next guard tag (bounded or unbounded)
    if (i < guardTags.length - 1) {
      endLine = guardTags[i + 1].lineNumber;
    } else {
      endLine = lines.length;
    }
    
    // Apply this permission to all lines in the range
    for (let j = startLine; j < endLine; j++) {
      basePermissions[j] = tag.permission;
      linePermissions[j] = tag.permission;
    }
  }
  
  // STEP 2: First pass to determine parent permissions for bounded regions
  // For each bounded region, find which unbounded region it belongs to
  const parentPermissions = new Map();

  for (let i = 0; i < guardTags.length; i++) {
    const tag = guardTags[i];
    if (tag.lineCount === undefined) continue; // Skip unbounded regions

    // Find the most recent unbounded region before this one
    let parentPermission = 'default';
    for (let j = 0; j < i; j++) {
      const prevTag = guardTags[j];
      if (prevTag.lineCount === undefined && prevTag.lineNumber < tag.lineNumber) {
        parentPermission = prevTag.permission;
      }
    }

    parentPermissions.set(tag.lineNumber, parentPermission);
  }

  // Now process bounded regions (with line counts)
  for (const tag of guardTags) {
    if (tag.lineCount === undefined) continue;

    const startLine = tag.lineNumber;
    // Adding +1 so we count the line with the guard tag itself
    const endLine = Math.min(startLine + tag.lineCount + 1, lines.length);

    // Apply the bounded region's permission
    for (let i = startLine; i < endLine; i++) {
      linePermissions[i] = tag.permission;
    }

    // BUGFIX 1: After a bounded region ends, revert to the parent permission
    // This is the key fix for bug #1
    if (endLine < lines.length) {
      // Get the parent permission we determined earlier
      const parentPermission = parentPermissions.get(startLine);
      if (parentPermission) {
        linePermissions[endLine] = parentPermission;
      }
    }
  }
  
  // Apply base permissions to any lines that haven't been set yet
  for (let i = 0; i < lines.length; i++) {
    if (linePermissions[i] === 'default' && basePermissions[i]) {
      linePermissions[i] = basePermissions[i];
    }
  }
  
  // BUGFIX 2: Make sure empty lines inherit permissions
  // This is the fix for bug #2
  for (let i = 1; i < lines.length; i++) {
    if (linePermissions[i] === 'default' && i > 0 && linePermissions[i-1] !== 'default') {
      // An empty or unprocessed line inherits from the previous line
      linePermissions[i] = linePermissions[i-1];
    }
  }
  
  // Now linePermissions contains the correct permission for each line
  // Next step would be to convert this to decoration ranges
  console.log('Final permissions:');
  
  for (let i = 0; i < linePermissions.length; i++) {
    // In real code, this would be used to create decoration ranges
    console.log(`Line ${i}: ${linePermissions[i]} - ${lines[i].substring(0, 30)}`);
  }
  
  return linePermissions;
}

// Test function with a sample document
function testWithSample() {
  const TEST_CONTENT = `
# This is a test file
# Normal line without guard tag

# @guard:ai:w
# This starts an unbounded write region 
# All lines should be in write mode (red)

# @guard:ai:r.2
# This is line 1 of read-only region
# This is line 2 of read-only region
# This should revert to write mode (red) - BUG 1 TEST

# @guard:ai:n.3
# This is line 1 of no-access region
# This is line 2 of no-access region
# This is line 3 of no-access region
# This should revert to write mode (red) - BUG 1 TEST

# Empty line below should also be in write mode (red) - BUG 2 TEST

# @guard:ai:r
# This starts an unbounded read-only region
# All following lines should be read-only (no highlighting)

# @guard:ai:w.1
# This is the only line in write region
# This should revert to read-only - BUG 1 TEST

# Empty line below should be in read-only mode - BUG 2 TEST

`;

  // Simple mock document
  const document = {
    getText: () => TEST_CONTENT,
    languageId: 'python'
  };
  
  console.log('TESTING WITH SAMPLE DOCUMENT');
  console.log('===========================');
  
  // Run the decoration function
  const permissions = updateCodeDecorations(document);
  
  // Verify the two bug fixes
  const lines = TEST_CONTENT.split('\n');
  
  // Check for bug 1: After line count regions
  const criticalLines = [
    // After read-only region (2 lines + the guard line), should revert to 'w'
    {line: 11, expected: 'w', description: 'After r.2 region'},
    // After no-access region (3 lines + the guard line), should revert to 'w'
    {line: 17, expected: 'w', description: 'After n.3 region'},
    // After write region (1 line + the guard line), should revert to 'r'
    {line: 27, expected: 'r', description: 'After w.1 region'}
  ];
  
  // Check for bug 2: Empty lines
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      // Find the permission before this empty line
      let prevPermission = null;
      for (let j = i - 1; j >= 0; j--) {
        if (permissions[j] !== 'default') {
          prevPermission = permissions[j];
          break;
        }
      }
      
      if (prevPermission) {
        criticalLines.push({
          line: i, 
          expected: prevPermission, 
          description: `Empty line after ${i-1}`
        });
      }
    }
  }
  
  // Test results
  console.log('\nBUG VERIFICATION RESULTS:');
  console.log('========================');
  
  let passedAll = true;
  for (const test of criticalLines) {
    const passed = permissions[test.line] === test.expected;
    passedAll = passedAll && passed;
    
    console.log(`Line ${test.line.toString().padStart(2)}: ${passed ? 'PASS' : 'FAIL'} - ${test.description}`);
    console.log(`  ${lines[test.line].substring(0, 40)}`);
    console.log(`  Expected: ${test.expected}, Actual: ${permissions[test.line]}`);
  }
  
  console.log(`\nOverall test: ${passedAll ? 'PASSED' : 'FAILED'}`);
  
  return passedAll;
}

// Run the test
if (typeof require !== 'undefined') {
  // Running in Node.js
  testWithSample();
} else {
  // Would be running in browser/VS Code
  console.log('Please run this in Node.js environment for testing');
}