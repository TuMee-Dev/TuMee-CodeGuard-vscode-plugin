/**
 * Test the scope resolver specifically with preview.ts to see where it fails
 */

const fs = require('fs');
const path = require('path');

// Mock VSCode API
const vscode = {
  Uri: {
    file: (path) => ({ fsPath: path, toString: () => path }),
    joinPath: (base, ...paths) => ({ 
      fsPath: path.join(base.fsPath || base, ...paths),
      toString: () => path.join(base.fsPath || base, ...paths)
    })
  },
  workspace: {
    fs: {
      readFile: async (uri) => {
        const filePath = uri.fsPath || uri;
        return {
          buffer: fs.readFileSync(filePath).buffer
        };
      }
    }
  },
  ExtensionContext: class {
    constructor() {
      this.extensionUri = { fsPath: path.join(__dirname, '..') };
    }
  }
};

global.vscode = vscode;

// Mock the vscode module in require cache
require.cache['vscode'] = {
  exports: vscode
};

// Import the actual scope resolver from compiled output  
const extension = require('../dist/extension.js');
const { resolveSemantic, initializeScopeResolver } = extension;

async function testScopeResolver() {
    console.log('=== Testing Scope Resolver with preview.ts ===\n');
    
    try {
        // Create mock extension context
        const extensionPath = path.join(__dirname, '..');
        const mockContext = {
            extensionPath,
            extensionUri: { path: extensionPath },
            globalState: { get: () => undefined, update: () => {} },
            workspaceState: { get: () => undefined, update: () => {} }
        };
        
        // Initialize the scope resolver
        initializeScopeResolver(mockContext);
        console.log('✅ Scope resolver initialized');
        
        // Read preview.ts content
        const previewPath = path.join(__dirname, '..', 'examples', 'preview.ts');
        const content = fs.readFileSync(previewPath, 'utf8');
        
        // Create mock document
        const lines = content.split('\n');
        const mockDocument = {
            languageId: 'typescript',
            lineCount: lines.length,
            getText: () => content,
            lineAt: (lineNumber) => ({
                text: lines[lineNumber] || '',
                lineNumber
            })
        };
        
        console.log('Document info:');
        console.log('  Language:', mockDocument.languageId);
        console.log('  Lines:', mockDocument.lineCount);
        console.log('');
        
        // Test different scopes on lines with guard tags
        const testCases = [
            { line: 6, scope: 'block', description: 'AI write function (line 7)' },
            { line: 13, scope: 'func', description: 'Generate report function (line 14)' },
            { line: 19, scope: 'statement', description: 'AI read config (line 20)' },
            { line: 29, scope: 'func', description: 'Human write function (line 30)' },
            { line: 45, scope: 'context', description: 'AI context documentation (line 46)' }
        ];
        
        for (const testCase of testCases) {
            console.log(`\nTesting: ${testCase.description}`);
            console.log(`Line ${testCase.line + 1}: "${lines[testCase.line]?.trim()}"`);
            console.log(`Scope: ${testCase.scope}`);
            
            try {
                const result = await resolveSemantic(mockDocument, testCase.line, testCase.scope);
                
                if (result) {
                    console.log(`✅ Success: lines ${result.startLine}-${result.endLine} (type: ${result.type})`);
                } else {
                    console.log('❌ Failed: returned null');
                }
            } catch (error) {
                console.log('❌ Error:', error.message);
                console.log('   Stack:', error.stack?.split('\n')[1]?.trim());
            }
        }
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        console.error('Stack:', error.stack);
    }
}

testScopeResolver().then(() => {
    console.log('\n✅ Scope resolver test completed');
}).catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});