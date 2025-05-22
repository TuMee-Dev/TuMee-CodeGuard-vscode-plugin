// Final proof that our implementation works

const fs = require('fs');
const { processFile, createDecorations } = require('./final-python-line-count-real');

// Read our test file
const pythonCode = fs.readFileSync('./final-test.py', 'utf8');
const lines = pythonCode.split('\n');

// Process the file to get line permissions
const linePermissions = processFile(lines);

// Print the line permissions
console.log('LINE PERMISSIONS:');
console.log('---------------');
for (let i = 0; i < linePermissions.length; i++) {
  // Create a marker for the line
  let marker = '';
  if (linePermissions[i] === 'w') {
    marker = '[RED]';
  } else if (linePermissions[i] === 'n') {
    marker = '[GREEN]';
  } else if (linePermissions[i] === 'r') {
    marker = '[NONE]';
  } else {
    marker = '[NONE]';
  }
  
  console.log(`Line ${i}: ${marker} ${linePermissions[i].padEnd(7)} | ${lines[i]}`);
}

// Create decorations from line permissions
const { aiOnlyRanges, humanOnlyRanges } = createDecorations(linePermissions);

// Print the decoration ranges
console.log('\nDECORATION RANGES:');
console.log('----------------');
console.log('AI Only (Red):');
aiOnlyRanges.forEach(range => {
  console.log(`  Lines ${range.start}-${range.end}`);
  // Print the lines
  for (let i = range.start; i <= range.end; i++) {
    console.log(`    Line ${i}: ${lines[i]}`);
  }
});

console.log('\nHuman Only (Green):');
humanOnlyRanges.forEach(range => {
  console.log(`  Lines ${range.start}-${range.end}`);
  // Print the lines
  for (let i = range.start; i <= range.end; i++) {
    console.log(`    Line ${i}: ${lines[i]}`);
  }
});

// Test with various inputs to ensure the logic is correct
console.log('\nCHECKING EDGE CASES:');
console.log('-----------------');

// Test with a simple line count
console.log('Test: Simple line count');
console.log('Input: # @guard:ai:w.2');
let match = '# @guard:ai:w.2'.match(/#\s*@guard:ai:(r|w|n)(\.(\d+))?/i);
console.log('Match:', match);
console.log('Permission:', match[1]);
console.log('Raw count group:', match[2]);
console.log('Count group:', match[3]);
console.log('Parsed count:', match[3] ? parseInt(match[3], 10) : undefined);

// Test with a line count at the end of the string
console.log('\nTest: Line count at end of string');
console.log('Input: # @guard:ai:w.2\n');
match = '# @guard:ai:w.2\n'.match(/#\s*@guard:ai:(r|w|n)(\.(\d+))?/i);
console.log('Match:', match);
console.log('Permission:', match[1]);
console.log('Raw count group:', match[2]);
console.log('Count group:', match[3]);
console.log('Parsed count:', match[3] ? parseInt(match[3], 10) : undefined);

// Test the VS Code specific code
console.log('\nTEST VSCODE RANGE CREATION:');
console.log('------------------------');
const vscodeRangeSimulator = {
  Position: function(line, character) {
    return { line, character };
  },
  Range: function(start, end) {
    return { start, end };
  }
};

function createVSCodeRanges(linePermissions, lines) {
  // Simulate the VSCode Range creation
  const aiOnlyRanges = [];
  const humanOnlyRanges = [];
  
  let currentStart = -1;
  let currentPermission = '';
  
  for (let i = 0; i < linePermissions.length; i++) {
    const permission = linePermissions[i];
    
    if (permission !== currentPermission) {
      // End previous range if it exists
      if (currentStart >= 0) {
        const range = new vscodeRangeSimulator.Range(
          new vscodeRangeSimulator.Position(currentStart, 0),
          new vscodeRangeSimulator.Position(i - 1, lines[i - 1] ? lines[i - 1].length : 0)
        );
        
        if (currentPermission === 'w') {
          aiOnlyRanges.push({ range });
        } else if (currentPermission === 'n') {
          humanOnlyRanges.push({ range });
        }
      }
      
      // Start new range if needed
      if (permission === 'w' || permission === 'n') {
        currentStart = i;
        currentPermission = permission;
      } else {
        currentStart = -1;
        currentPermission = '';
      }
    }
  }
  
  // Handle last range if it extends to the end
  if (currentStart >= 0 && currentPermission) {
    const range = new vscodeRangeSimulator.Range(
      new vscodeRangeSimulator.Position(currentStart, 0),
      new vscodeRangeSimulator.Position(linePermissions.length - 1, lines[linePermissions.length - 1] ? lines[linePermissions.length - 1].length : 0)
    );
    
    if (currentPermission === 'w') {
      aiOnlyRanges.push({ range });
    } else if (currentPermission === 'n') {
      humanOnlyRanges.push({ range });
    }
  }
  
  return { aiOnlyRanges, humanOnlyRanges };
}

const vsCodeRanges = createVSCodeRanges(linePermissions, lines);
console.log('AI Only Ranges:');
vsCodeRanges.aiOnlyRanges.forEach(item => {
  console.log(`  Start line: ${item.range.start.line}, End line: ${item.range.end.line}`);
});

console.log('\nHuman Only Ranges:');
vsCodeRanges.humanOnlyRanges.forEach(item => {
  console.log(`  Start line: ${item.range.start.line}, End line: ${item.range.end.line}`);
});