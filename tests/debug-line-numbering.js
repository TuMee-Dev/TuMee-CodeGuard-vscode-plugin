/**
 * Debug the line numbering issue in tree-sitter scope resolution
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

const Parser = TreeSitter.Parser;
const Language = TreeSitter.Language;

async function debugLineNumbering() {
    console.log('=== Debugging Line Numbering in Tree-sitter ===\n');
    
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
        
        // Test the exact scenario from the scope resolver
        console.log('Testing guard at line 6 (0-based), function at line 7 (0-based)\n');
        
        console.log('Lines (0-based indexing):');
        console.log(`Line 5: "${lines[5]?.trim()}"`);
        console.log(`Line 6: "${lines[6]?.trim()}"`);  // Guard line
        console.log(`Line 7: "${lines[7]?.trim()}"`);  // Function line
        console.log(`Line 8: "${lines[8]?.trim()}"`);
        console.log('');
        
        const guardLine = 6; // 0-based line number of guard
        const nodeTypes = ['function_declaration', 'function_expression', 'arrow_function', 'method_definition', 'method_signature'];
        
        // Simulate the exact search logic from treeSitterScopeResolver.ts
        console.log(`Starting search from line ${guardLine + 1} (1-based)...`);
        
        for (let searchLine = guardLine + 1; searchLine < Math.min(guardLine + 5, lines.length); searchLine++) {
            console.log(`\n--- Searching line ${searchLine} (0-based) = line ${searchLine + 1} (1-based) ---`);
            console.log(`Content: "${lines[searchLine]?.trim()}"`);
            
            const searchNode = findNodeAtPosition(tree, searchLine);
            if (searchNode) {
                console.log(`Found node: ${searchNode.type}`);
                console.log(`Node position: row ${searchNode.startPosition.row} (0-based)`);
                console.log(`Node text: "${searchNode.text.substring(0, 30).replace(/\n/g, '\\n')}"`);
                
                const targetNode = findParentOfType(searchNode, nodeTypes);
                if (targetNode) {
                    console.log(`Found target function: ${targetNode.type}`);
                    console.log(`Target position: row ${targetNode.startPosition.row} (0-based)`);
                    console.log(`Guard line: ${guardLine} (0-based)`);
                    console.log(`Condition (targetNode.startPosition.row >= guardLine): ${targetNode.startPosition.row} >= ${guardLine} = ${targetNode.startPosition.row >= guardLine}`);
                    
                    if (targetNode.startPosition.row >= guardLine) {
                        console.log(`✅ CONDITION PASSES - scope resolver should find this!`);
                        
                        // Show the bounds that would be returned
                        const bounds = {
                            startLine: guardLine + 1 + 1, // line + 1 (convert 0-based to 1-based)
                            endLine: targetNode.endPosition.row + 1, // Convert to 1-based
                        };
                        console.log(`Bounds: ${bounds.startLine} - ${bounds.endLine} (1-based)`);
                    } else {
                        console.log(`❌ CONDITION FAILS - scope resolver will skip this!`);
                    }
                } else {
                    console.log(`❌ No target function found in parent chain`);
                }
            } else {
                console.log(`❌ No node found at this line`);
            }
        }
        
        // Let's also test what happens if we search the exact function line
        console.log(`\n\n--- Direct test of function line ${7} ---`);
        const functionNode = findNodeAtPosition(tree, 7);
        if (functionNode) {
            console.log(`Direct node at line 7: ${functionNode.type}`);
            console.log(`Node position: ${functionNode.startPosition.row}-${functionNode.endPosition.row}`);
            console.log(`Node text: "${functionNode.text.substring(0, 50).replace(/\n/g, '\\n')}"`);
            
            const funcParent = findParentOfType(functionNode, nodeTypes);
            if (funcParent) {
                console.log(`Parent function: ${funcParent.type} at row ${funcParent.startPosition.row}`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// Helper functions
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

debugLineNumbering().catch(console.error);