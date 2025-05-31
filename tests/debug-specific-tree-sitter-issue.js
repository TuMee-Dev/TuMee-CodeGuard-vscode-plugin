/**
 * Specific debug test to identify why tree-sitter "fails" on preview.ts
 * We'll simulate the exact condition in the scope resolver
 */

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

async function debugSpecificIssue() {
    console.log('=== Debugging Specific Tree-sitter Issue ===\n');
    
    try {
        // Initialize parser
        await Parser.init();
        const parser = new Parser();
        
        // Load TypeScript language
        const wasmPath = path.join(__dirname, '..', 'resources', 'tree-sitter-wasm', 'tree-sitter-typescript.wasm');
        const wasmBytes = fs.readFileSync(wasmPath);
        const LanguageObj = await Language.load(wasmBytes);
        parser.setLanguage(LanguageObj);
        
        // Read preview.ts content
        const previewPath = path.join(__dirname, '..', 'examples', 'preview.ts');
        const content = fs.readFileSync(previewPath, 'utf8');
        const lines = content.split('\n');
        
        // Parse the document
        const tree = parser.parse(content);
        console.log('Parse successful:', tree !== null);
        
        // Test the specific lines that have guard tags
        const testCases = [
            { line: 6, guardText: '// @guard:ai:w @guard:human:r', nextLine: 'function processDataWithAI(userData) {', scope: 'func' },
            { line: 13, guardText: '// @guard:ai:w', nextLine: 'function generateReport(data: ReportData): string {', scope: 'func' },
            { line: 29, guardText: '// @guard:human:w', nextLine: 'function handleUserInput(input: UserInput): void {', scope: 'func' },
        ];
        
        for (const testCase of testCases) {
            console.log(`\n--- Testing line ${testCase.line + 1} ---`);
            console.log(`Guard: ${testCase.guardText}`);
            console.log(`Next line: ${testCase.nextLine}`);
            console.log(`Expected scope: ${testCase.scope}`);
            
            // Simulate the scope resolver logic for func scope
            const nodeTypes = ['function_declaration', 'function_expression', 'arrow_function', 'method_definition', 'method_signature'];
            
            // Search forward from the guard line to find the next function
            console.log(`\nSearching forward from line ${testCase.line + 1}...`);
            let foundFunction = false;
            
            for (let searchLine = testCase.line + 1; searchLine < lines.length; searchLine++) {
                if (searchLine >= testCase.line + 3) break; // Limit search to avoid flooding
                
                console.log(`  Checking line ${searchLine + 1}: "${lines[searchLine]?.trim()}"`);
                
                // Find node at this position
                const searchNode = findNodeAtPosition(tree, searchLine);
                if (searchNode) {
                    console.log(`    Node type: ${searchNode.type}`);
                    console.log(`    Node text (first 50 chars): "${searchNode.text.substring(0, 50).replace(/\n/g, '\\n')}"`);
                    
                    // Look for function node
                    const targetNode = findParentOfType(searchNode, nodeTypes);
                    if (targetNode && targetNode.startPosition.row >= testCase.line) {
                        console.log(`    ✅ Found function: ${targetNode.type} at line ${targetNode.startPosition.row + 1}`);
                        console.log(`    Function bounds: ${targetNode.startPosition.row + 1} - ${targetNode.endPosition.row + 1}`);
                        foundFunction = true;
                        break;
                    } else if (targetNode) {
                        console.log(`    ❌ Found function but it's before guard line: ${targetNode.type} at line ${targetNode.startPosition.row + 1}`);
                    } else {
                        console.log(`    ❌ No function found in parent chain`);
                    }
                } else {
                    console.log(`    ❌ No node found at this line`);
                }
            }
            
            if (!foundFunction) {
                console.log(`    ❌ NO FUNCTION FOUND - This would cause scope resolver to return null!`);
            }
        }
        
        // Also test block scope which is used in the first few examples
        console.log(`\n\n--- Testing block scope on line 1 (ai:r guard) ---`);
        const blockNodeTypes = ['if_statement', 'for_statement', 'while_statement', 'try_statement', 'switch_statement', 'statement_block', 'object', 'object_expression', 'array', 'array_expression'];
        
        console.log(`Guard line 1: "${lines[1]?.trim()}"`);
        console.log(`Next line 2: "${lines[2]?.trim()}"`);
        
        for (let searchLine = 2; searchLine < 10; searchLine++) {
            console.log(`  Checking line ${searchLine + 1}: "${lines[searchLine]?.trim()}"`);
            
            const searchNode = findNodeAtPosition(tree, searchLine);
            if (searchNode) {
                console.log(`    Node type: ${searchNode.type}`);
                
                // Check if this node itself is a block type
                if (blockNodeTypes.includes(searchNode.type)) {
                    console.log(`    ✅ Found block node: ${searchNode.type}`);
                    break;
                }
                
                // Check children for blocks
                let foundBlock = false;
                for (const child of searchNode.children) {
                    if (child && blockNodeTypes.includes(child.type)) {
                        console.log(`    ✅ Found block in children: ${child.type}`);
                        foundBlock = true;
                        break;
                    }
                }
                
                if (!foundBlock) {
                    console.log(`    ❌ No block found`);
                }
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// Helper functions (copied from tree-sitter parser)
function findNodeAtPosition(tree, line, column = 0) {
    const point = { row: line, column };
    return tree.rootNode.descendantForPosition(point);
}

function findParentOfType(node, types) {
    let current = node;
    while (current) {
        if (types.includes(current.type)) {
            return current;
        }
        current = current.parent;
    }
    return null;
}

debugSpecificIssue().catch(console.error);