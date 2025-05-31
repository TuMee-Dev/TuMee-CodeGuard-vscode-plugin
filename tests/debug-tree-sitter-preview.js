const TreeSitter = require('web-tree-sitter');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Web-tree-sitter needs some browser APIs
if (typeof global.document === 'undefined') {
  const dom = new JSDOM();
  global.document = dom.window.document;
  global.window = dom.window;
}

// Extract the actual Parser class
const Parser = TreeSitter.Parser;
const Language = TreeSitter.Language;

async function debugTreeSitterParsing() {
    console.log('=== Tree-sitter Debug for preview.ts ===\n');
    
    try {
        // Initialize parser
        await Parser.init();
        const parser = new Parser();
        
        // Load TypeScript language
        const wasmPath = path.join(__dirname, '..', 'resources', 'tree-sitter-wasm', 'tree-sitter-typescript.wasm');
        console.log('Loading WASM from:', wasmPath);
        
        if (!fs.existsSync(wasmPath)) {
            console.error('WASM file not found!');
            return;
        }
        
        const wasmBytes = fs.readFileSync(wasmPath);
        const LanguageObj = await Language.load(wasmBytes);
        parser.setLanguage(LanguageObj);
        
        // Read preview.ts content
        const previewPath = path.join(__dirname, '..', 'examples', 'preview.ts');
        const content = fs.readFileSync(previewPath, 'utf8');
        console.log('File size:', content.length, 'bytes');
        console.log('Lines:', content.split('\n').length);
        console.log('');
        
        // Try parsing
        console.log('Attempting to parse...');
        const startTime = Date.now();
        const tree = parser.parse(content);
        const parseTime = Date.now() - startTime;
        
        console.log('Parse time:', parseTime, 'ms');
        console.log('Parse successful:', tree !== null);
        
        if (tree) {
            console.log('\nTree info:');
            console.log('Root node type:', tree.rootNode.type);
            console.log('Root node children:', tree.rootNode.childCount);
            console.log('Has errors:', tree.rootNode.hasError || false);
            
            // Check for error nodes
            const errorNodes = [];
            function findErrors(node) {
                if (node.type === 'ERROR' || node.hasError) {
                    errorNodes.push({
                        type: node.type,
                        text: content.substring(node.startIndex, node.endIndex),
                        startLine: node.startPosition.row + 1,
                        endLine: node.endPosition.row + 1,
                        startIndex: node.startIndex,
                        endIndex: node.endIndex
                    });
                }
                for (let i = 0; i < node.childCount; i++) {
                    findErrors(node.child(i));
                }
            }
            findErrors(tree.rootNode);
            
            if (errorNodes.length > 0) {
                console.log('\nFound', errorNodes.length, 'error nodes:');
                errorNodes.forEach((error, i) => {
                    console.log(`\nError ${i + 1}:`);
                    console.log('  Type:', error.type);
                    console.log('  Lines:', error.startLine, '-', error.endLine);
                    console.log('  Text:', JSON.stringify(error.text));
                });
            } else {
                console.log('\nNo error nodes found!');
            }
            
            // Print tree structure
            console.log('\nTree structure (first 3 levels):');
            function printNode(node, indent = '', maxDepth = 3, currentDepth = 0) {
                if (currentDepth >= maxDepth) return;
                
                const text = node.text ? node.text.substring(0, 50).replace(/\n/g, '\\n') : '';
                console.log(`${indent}${node.type} [${node.startPosition.row}:${node.startPosition.column} - ${node.endPosition.row}:${node.endPosition.column}]${text ? ' "' + text + '..."' : ''}`);
                
                for (let i = 0; i < node.childCount && i < 5; i++) {
                    printNode(node.child(i), indent + '  ', maxDepth, currentDepth + 1);
                }
                if (node.childCount > 5) {
                    console.log(`${indent}  ... (${node.childCount - 5} more children)`);
                }
            }
            printNode(tree.rootNode);
            
            // Test parsing specific problematic lines
            console.log('\nTesting individual lines:');
            const problematicLines = [
                'const sharedData = await loadSharedConfiguration();',
                'function processDataWithAI(userData) {',
                'function generateReport(data: ReportData): string {',
                'const apiKey = process.env.SECRET_API_KEY;'
            ];
            
            for (const line of problematicLines) {
                const lineTree = parser.parse(line);
                const hasError = lineTree.rootNode.hasError || false;
                console.log(`\n"${line}"`);
                console.log('  Has error:', hasError);
                if (hasError) {
                    console.log('  Root type:', lineTree.rootNode.type);
                    console.log('  Children:', lineTree.rootNode.childCount);
                }
            }
            
        } else {
            console.log('\nParsing failed completely!');
        }
        
    } catch (error) {
        console.error('\nError during parsing:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Also test with different parsers to see if it's a TypeScript-specific issue
async function testDifferentParsers() {
    console.log('\n\n=== Testing Different Parsers ===\n');
    
    await Parser.init();
    const parser = new Parser();
    
    const parsersToTest = [
        { name: 'JavaScript', file: 'tree-sitter-javascript.wasm' },
        { name: 'TypeScript', file: 'tree-sitter-typescript.wasm' },
        { name: 'TSX', file: 'tree-sitter-tsx.wasm' }
    ];
    
    for (const parserInfo of parsersToTest) {
        console.log(`\nTesting ${parserInfo.name} parser:`);
        
        try {
            const wasmPath = path.join(__dirname, '..', 'resources', 'tree-sitter-wasm', parserInfo.file);
            if (!fs.existsSync(wasmPath)) {
                console.log('  WASM file not found:', wasmPath);
                continue;
            }
            
            const wasmBytes = fs.readFileSync(wasmPath);
            const LanguageObj = await Language.load(wasmBytes);
            parser.setLanguage(LanguageObj);
            
            // Test with a simple TypeScript snippet
            const testCode = `
                const x = await foo();
                function bar(data: Type): string {
                    return data.toString();
                }
            `;
            
            const tree = parser.parse(testCode);
            console.log('  Parse successful:', tree !== null);
            if (tree) {
                console.log('  Has errors:', tree.rootNode.hasError || false);
                console.log('  Root type:', tree.rootNode.type);
            }
            
        } catch (error) {
            console.log('  Error:', error.message);
        }
    }
}

// Run tests
debugTreeSitterParsing().then(() => {
    return testDifferentParsers();
}).catch(console.error);