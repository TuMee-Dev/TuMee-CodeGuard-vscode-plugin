#!/usr/bin/env node

/**
 * Export themes from the VSCode extension for CLI usage
 * This script extracts the theme configurations and writes them to a JSON file
 * that the CLI tools can read at runtime
 */

const fs = require('fs');
const path = require('path');

// Register TypeScript compiler
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2018',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    resolveJsonModule: true
  }
});

// Import the theme configs
const { THEME_CONFIGS } = require('../src/tools/colorCustomizer');

// Convert to a format suitable for CLI
const themes = {};
THEME_CONFIGS.forEach(config => {
  themes[config.name] = {
    name: config.name,
    permissions: config.permissions,
    borderBarEnabled: config.borderBarEnabled,
    mixPattern: config.mixPattern
  };
});

// Write to JSON file
const outputPath = path.join(__dirname, '..', 'resources', 'themes.json');
fs.writeFileSync(outputPath, JSON.stringify(themes, null, 2));

console.log(`Exported ${Object.keys(themes).length} themes to ${outputPath}`);
console.log('Themes:', Object.keys(themes).join(', '));