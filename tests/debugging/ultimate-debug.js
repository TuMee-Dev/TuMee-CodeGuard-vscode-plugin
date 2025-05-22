// Ultimate debugging script to verify line count functionality
// This script implements exactly what's in extension.ts but with 
// detailed debugging output at each step

const fs = require('fs');

// Read our test file
const pythonCode = fs.readFileSync('./final-test.py', 'utf8');
const lines = pythonCode.split('\n');

console.log('TESTING GUARD TAG LINE COUNT IN PYTHON');
console.log('=====================================');
console.log();

// Python regex pattern
const PYTHON_PATTERN = /#\s*@guard:ai:(r|w|n)(\.(\d+))?/i;

// First debug test: Does the regex correctly extract the line count?
console.log('REGEX VALIDATION:');
console.log('----------------');

// Check each line
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(PYTHON_PATTERN);
  
  if (match) {
    // Log exactly what was matched
    console.log(`Line ${i}: Found match: ${match[0]}`);
    
    // Permission
    const permission = match[1].toLowerCase();
    console.log(`  Permission: ${permission}`);
    
    // Line count - the entire second capture group (includes the dot)
    console.log(`  Raw capture group 2: ${match[2] || 'undefined'}`);
    
    // The actual line count number in group 3
    console.log(`  Raw capture group 3: ${match[3] || 'undefined'}`);
    
    // Parse the line count
    const lineCount = match[3] ? parseInt(match[3], 10) : undefined;
    console.log(`  Parsed line count: ${lineCount || 'undefined'}`);
    console.log();
  }
}

// Test the whole algorithm
console.log('\nREGION CALCULATION:');
console.log('------------------');

// Array to store guard regions
const guardRegions = [];

// First pass: Find all guard tags and determine their regions
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(PYTHON_PATTERN);
  
  if (match) {
    const permission = match[1].toLowerCase();
    
    // Extract line count
    const lineCount = match[3] ? parseInt(match[3], 10) : undefined;
    
    console.log(`Line ${i}: Found guard tag: ${match[0]}`);
    console.log(`  Permission: ${permission}, Line count: ${lineCount || 'undefined'}`);
    
    if (lineCount !== undefined) {
      // Bounded region - starts AFTER the guard tag and extends for lineCount lines
      const startLine = i + 1; // Skip guard tag line
      const endLine = Math.min(i + 1 + lineCount, lines.length);
      
      guardRegions.push({
        startLine,
        endLine,
        permission,
        lineCount
      });
      
      console.log(`  Created BOUNDED region: lines ${startLine}-${endLine-1}, permission=${permission}`);
    } else {
      // Unbounded region - extends until the next guard tag or end of file
      const startLine = i + 1;
      let endLine = lines.length;
      
      // Find next guard tag
      for (let j = startLine; j < lines.length; j++) {
        if (lines[j].match(PYTHON_PATTERN)) {
          endLine = j;
          break;
        }
      }
      
      guardRegions.push({
        startLine,
        endLine,
        permission
      });
      
      console.log(`  Created UNBOUNDED region: lines ${startLine}-${endLine-1}, permission=${permission}`);
    }
  }
}

// Create a map of permissions for each line
const linePermissions = new Array(lines.length).fill('default');

// Apply permissions from regions
console.log('\nAPPLYING PERMISSIONS:');
console.log('-------------------');

for (const region of guardRegions) {
  console.log(`Applying region: lines ${region.startLine}-${region.endLine-1}, permission=${region.permission}`);
  
  for (let i = region.startLine; i < region.endLine; i++) {
    if (i < linePermissions.length) {
      linePermissions[i] = region.permission;
    }
  }
}

// Show the final permissions
console.log('\nFINAL LINE PERMISSIONS:');
console.log('----------------------');

for (let i = 0; i < lines.length; i++) {
  // Create a visualization of the permission
  let highlight = '';
  if (linePermissions[i] === 'w') {
    highlight = '[RED]';
  } else if (linePermissions[i] === 'n') {
    highlight = '[GREEN]';
  } else if (linePermissions[i] === 'r') {
    highlight = '[none]';
  } else {
    highlight = '[none]';
  }
  
  console.log(`Line ${i}: ${highlight} ${linePermissions[i].padEnd(7)} | ${lines[i]}`);
}