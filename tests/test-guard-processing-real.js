// Test the actual guard processing with real code

const path = require('path');

// Mock vscode types
global.vscode = {
  Position: class Position {
    constructor(line, character) {
      this.line = line;
      this.character = character;
    }
  },
  Range: class Range {
    constructor(start, end) {
      this.start = start;
      this.end = end;
    }
  },
  TextDocument: class TextDocument {
    constructor(content, languageId = 'python') {
      this.content = content;
      this.languageId = languageId;
      this.lines = content.split('\n');
      this.lineCount = this.lines.length;
    }
    getText() {
      return this.content;
    }
  }
};

// Import the actual functions
const { parseGuardTags, getLinePermissions } = require('../dist/extension.js');

const testCode = `# Test file for Python scope resolution

# @guard:hu:w
# Human can write base configuration

# @guard:ai:w
# AI can optimize this configuration class
class Config:
    def __init__(self):
        self.app_name = 'API Key Manager'
        self.version = '2.0.0'
        self.environment = os.getenv('ENV', 'development')

# @guard:ai:n
# Production API keys - AI must not access
PRODUCTION_KEYS = {
    'stripe': 'sk_live_4eC39HqLyjWDarjtT1zdp7dc',
    'openai': 'sk-proj-abc123def456ghi789',
    'aws_access': 'AKIAIOSFODNN7EXAMPLE',
    'aws_secret': 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
}`;

async function runTest() {
  console.log('Testing actual guard processing implementation');
  console.log('=============================================\n');

  const document = new vscode.TextDocument(testCode, 'python');
  const lines = testCode.split('\n');
  
  try {
    // Parse guard tags
    console.log('Parsing guard tags...');
    const guardTags = await parseGuardTags(document, lines);
    
    console.log('\nFound guard tags:');
    guardTags.forEach(tag => {
      console.log(`  Line ${tag.lineNumber}: ${tag.target}:${tag.permission} (scope: ${tag.scope || 'none'}, start: ${tag.scopeStart}, end: ${tag.scopeEnd})`);
    });

    // Get line permissions
    console.log('\nCalculating line permissions...');
    const linePermissions = getLinePermissions(document, guardTags);
    
    console.log('\nLine permissions:');
    for (let i = 1; i <= document.lineCount; i++) {
      const perm = linePermissions.get(i);
      const lineContent = lines[i-1].substring(0, 50);
      if (perm) {
        console.log(`  Line ${i}: ${perm.target}:${perm.permission} - "${lineContent}"`);
      } else {
        console.log(`  Line ${i}: [no guard] - "${lineContent}"`);
      }
    }

    // Check critical lines
    console.log('\n\nCritical line checks:');
    console.log('======================');
    
    const line12 = linePermissions.get(12);
    const line13 = linePermissions.get(13);
    const line14 = linePermissions.get(14);
    
    console.log(`Line 12 (last code in class): ${line12 ? `${line12.target}:${line12.permission}` : 'NO GUARD'} - Expected: ai:w`);
    console.log(`Line 13 (blank after class): ${line13 ? `${line13.target}:${line13.permission}` : 'NO GUARD'} - Expected: human:w`);
    console.log(`Line 14 (@guard:ai:n line): ${line14 ? `${line14.target}:${line14.permission}` : 'NO GUARD'} - Expected: ai:n`);
    
    // Check if the issue is fixed
    const line13Fixed = line13 && line13.target === 'human' && line13.permission === 'w';
    console.log(`\n\nTEST RESULT: ${line13Fixed ? 'PASSED ✓' : 'FAILED ✗'}`);
    
    if (!line13Fixed) {
      console.log('\nThe blank line (13) is still not reverting to human:w!');
    }

  } catch (error) {
    console.error('Error during test:', error);
  }
}

runTest();