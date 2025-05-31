/**
 * Debug the language scope mappings to see what TypeScript should be looking for
 */

const fs = require('fs');
const path = require('path');

function debugLanguageScopes() {
    console.log('=== Debugging Language Scope Mappings ===\n');
    
    try {
        // Load language scopes config
        const configPath = path.join(__dirname, '..', 'resources', 'language-scopes.json');
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        console.log('Language config loaded successfully\n');
        
        // Show JavaScript scopes (the base for TypeScript)
        console.log('JavaScript scopes:');
        console.log(JSON.stringify(config.languages.javascript.scopes, null, 2));
        
        console.log('\nTypeScript extends:', config.languages.typescript.extends);
        console.log('TypeScript scopes:');
        console.log(JSON.stringify(config.languages.typescript.scopes, null, 2));
        
        // Resolve TypeScript scopes manually (like the loader does)
        console.log('\n--- Resolving TypeScript scopes ---');
        
        // Start with JavaScript scopes
        const jsScopes = config.languages.javascript.scopes;
        const tsScopes = {};
        
        // Deep copy JS scopes first
        for (const key in jsScopes) {
            tsScopes[key] = [...jsScopes[key]];
        }
        
        // Apply TypeScript overrides/additions
        const tsOverrides = config.languages.typescript.scopes;
        for (const key in tsOverrides) {
            if (tsScopes[key]) {
                // Merge with parent scope
                tsScopes[key] = [...tsScopes[key], ...tsOverrides[key]];
            } else {
                // New scope
                tsScopes[key] = [...tsOverrides[key]];
            }
        }
        
        console.log('Resolved TypeScript scopes:');
        console.log(JSON.stringify(tsScopes, null, 2));
        
        // Check what TypeScript is looking for when resolving 'func' scope
        console.log(`\nTypeScript 'func' scope looks for: ${JSON.stringify(tsScopes.func)}`);
        console.log(`TypeScript 'block' scope looks for: ${JSON.stringify(tsScopes.block)}`);
        
        // Compare with what we found in tree-sitter
        console.log('\n--- Comparison with Tree-sitter Results ---');
        console.log('Tree-sitter found node types: function_declaration');
        console.log('TypeScript func scope includes function_declaration:', tsScopes.func.includes('function_declaration'));
        
        if (!tsScopes.func.includes('function_declaration')) {
            console.log('❌ MISMATCH! TypeScript func scope does not include function_declaration');
            console.log('This explains why the scope resolver returns null!');
        } else {
            console.log('✅ TypeScript func scope correctly includes function_declaration');
        }
        
    } catch (error) {
        console.error('Error loading language scopes:', error);
    }
}

debugLanguageScopes();