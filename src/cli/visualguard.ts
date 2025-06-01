#!/usr/bin/env node

/**
 * VisualGuard CLI - Production command-line tool for TuMee VSCode Plugin
 * 
 * This tool provides command-line access to the guard processing functionality
 * of the TuMee VSCode plugin, allowing users to visualize permissions without
 * needing to open VSCode.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { displayFile } from './displayEngine';
import { getColorThemes } from '../utils/themeLoader';

// Version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
const version = packageJson.version;

// List available themes
function listThemes(): void {
  console.log('Available Themes:');
  console.log('=================\n');
  
  // Built-in themes
  const themes = getColorThemes();
  console.log('Built-in Themes:');
  Object.keys(themes).forEach(name => {
    console.log(`  ${name}`);
  });
  
  // Try to load custom themes
  try {
    const settingsPaths = [];
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    
    if (process.platform === 'darwin') {
      settingsPaths.push(
        path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'settings.json')
      );
    } else if (process.platform === 'win32') {
      settingsPaths.push(
        path.join(process.env.APPDATA || '', 'Code', 'User', 'settings.json')
      );
    } else {
      settingsPaths.push(
        path.join(homeDir, '.config', 'Code', 'User', 'settings.json')
      );
    }
    
    let customThemes: Record<string, any> = {};
    for (const settingsPath of settingsPaths) {
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (settings['tumee-vscode-plugin.customThemes']) {
          Object.assign(customThemes, settings['tumee-vscode-plugin.customThemes']);
        }
      }
    }
    
    if (Object.keys(customThemes).length > 0) {
      console.log('\nCustom Themes:');
      Object.keys(customThemes).forEach(name => {
        console.log(`  ${name}`);
      });
    }
  } catch (error) {
    // Ignore errors loading custom themes
  }
}

// Main CLI program
const program = new Command();

program
  .name('visualguard')
  .description('Visualize guard permissions for files using TuMee VSCode Plugin')
  .version(version)
  .option('-c, --color', 'Enable colored output', true)
  .option('--no-color', 'Disable colored output')
  .option('-t, --theme <name>', 'Use specific theme')
  .option('-d, --debug', 'Enable debug output')
  .option('--tree-sitter-debug', 'Show tree-sitter node types for each line')
  .option('--list-themes', 'List available themes');

program
  .arguments('[file]')
  .action(async (file: string) => {
    const options = program.opts();
    if (options.listThemes) {
      listThemes();
      process.exit(0);
    }
    
    if (!file) {
      program.help();
      process.exit(1);
    }
    
    if (!fs.existsSync(file)) {
      console.error(`Error: File not found: ${file}`);
      process.exit(1);
    }
    
    try {
      await displayFile(file, {
        color: options.color,
        theme: options.theme,
        debug: options.debug,
        treeSitterDebug: options.treeSitterDebug
      });
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      if (options.debug) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Parse arguments
program.parse(process.argv);

// If no arguments provided, show help
if (process.argv.length === 2) {
  program.help();
  process.exit(0);
}