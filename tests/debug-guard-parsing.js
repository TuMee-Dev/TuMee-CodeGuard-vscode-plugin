const fs = require('fs');
const path = require('path');
const { TreeSitterParser } = require('../dist/utils/treeSitterParser');

async function debugGuardParsing() {
    const parser = new TreeSitterParser();
    const testFile = path.join(__dirname, 'debug-multiple-guards.py');
    const content = fs.readFileSync(testFile, 'utf8');
    
    console.log('=== Parsing Python file with multiple guards ===\n');
    
    // Parse the file
    const tree = await parser.parseContent(content, 'python');
    
    // Walk through the tree and find all comments
    const cursor = tree.walk();
    const guards = [];
    const classes = [];
    
    function visitNode(node) {
        if (node.type === 'comment') {
            const text = content.substring(node.startIndex, node.endIndex);
            if (text.includes('@guard:')) {
                guards.push({
                    text: text,
                    line: node.startPosition.row + 1,
                    startIndex: node.startIndex,
                    endIndex: node.endIndex
                });
                console.log(`Found guard at line ${node.startPosition.row + 1}: ${text}`);
            }
        }
        
        if (node.type === 'class_definition') {
            const nameNode = node.childForFieldName('name');
            const className = nameNode ? content.substring(nameNode.startIndex, nameNode.endIndex) : 'Unknown';
            classes.push({
                name: className,
                startLine: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1,
                startIndex: node.startIndex,
                endIndex: node.endIndex
            });
            console.log(`Found class '${className}' at lines ${node.startPosition.row + 1}-${node.endPosition.row + 1}`);
        }
        
        for (let i = 0; i < node.childCount; i++) {
            visitNode(node.child(i));
        }
    }
    
    visitNode(tree.rootNode);
    
    console.log('\n=== Guard Stack Simulation ===');
    
    // Simulate guard processing
    const lines = content.split('\n');
    const guardStack = [];
    const activeGuards = new Map(); // line -> guards
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        
        // Check for guard tags
        const guardMatch = line.match(/@guard:(\w+):([rwx])(?:\.(\w+))?/);
        if (guardMatch) {
            const [, owner, permissions, scope] = guardMatch;
            const guard = { owner, permissions, scope, startLine: lineNum };
            
            console.log(`\nLine ${lineNum}: Found guard - owner: ${owner}, perms: ${permissions}, scope: ${scope || 'none'}`);
            
            if (scope === 'class') {
                // Find the next class after this guard
                const nextClass = classes.find(c => c.startLine > lineNum);
                if (nextClass) {
                    guard.endLine = nextClass.endLine;
                    console.log(`  Scope resolution: class '${nextClass.name}' (lines ${nextClass.startLine}-${nextClass.endLine})`);
                    
                    // Add guard to all lines in the class
                    for (let j = nextClass.startLine; j <= nextClass.endLine; j++) {
                        if (!activeGuards.has(j)) activeGuards.set(j, []);
                        activeGuards.get(j).push(guard);
                    }
                } else {
                    console.log(`  WARNING: No class found after guard at line ${lineNum}`);
                }
            }
            
            guardStack.push(guard);
        }
    }
    
    console.log('\n=== Active Guards by Line ===');
    for (const [line, guards] of activeGuards.entries()) {
        console.log(`Line ${line}: ${guards.map(g => `${g.owner}:${g.permissions}`).join(', ')}`);
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total guards found: ${guards.length}`);
    console.log(`Total classes found: ${classes.length}`);
    console.log(`Guards with class scope: ${guardStack.filter(g => g.scope === 'class').length}`);
}

debugGuardParsing().catch(console.error);