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
import { 
  parseGuardTagsCore, 
  getLinePermissionsCore,
} from '../utils/guardProcessorCore';
import { resolveSemantic, initializeScopeResolver } from '../utils/scopeResolver';
import { getColorThemes } from '../utils/themeLoader';
import { applyMixPattern, getHighlightEntireLineForMix } from '../utils/mixPatternLogic';

// Version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
const version = packageJson.version;

// CLI Document implementation
class CLIDocument {
  public readonly lines: string[];
  public readonly languageId: string;
  public readonly lineCount: number;
  private readonly content: string;

  constructor(content: string, languageId: string) {
    this.content = content;
    this.lines = content.split('\n');
    this.languageId = languageId;
    this.lineCount = this.lines.length;
  }

  getText(): string {
    return this.content;
  }

  lineAt(line: number): { text: string; firstNonWhitespaceCharacterIndex: number } {
    const text = this.lines[line] || '';
    return {
      text,
      firstNonWhitespaceCharacterIndex: text.search(/\S/)
    };
  }
}

// CLI Configuration implementation
class CLIConfiguration {
  private options: Record<string, any>;

  constructor(options: Record<string, any> = {}) {
    this.options = options;
  }

  get(key: string, defaultValue?: any): any {
    return this.options[key] !== undefined ? this.options[key] : defaultValue;
  }
}

// Simple logger for CLI
const cliLogger = {
  log: (message: string) => {
    if (process.env.DEBUG) {
      console.error(message);
    }
  }
};

// Semantic resolver for CLI
async function cliSemanticResolver(document: any, line: number, scope: string, addScopes?: string[], removeScopes?: string[]): Promise<any> {
  try {
    // Initialize scope resolver if needed
    if (!(global as any).extensionContext) {
      (global as any).extensionContext = {
        extensionPath: path.join(__dirname, '../..'),
        extensionUri: { fsPath: path.join(__dirname, '../..') }
      };
      await initializeScopeResolver((global as any).extensionContext);
    }
    
    return await resolveSemantic(document, line, scope, addScopes || [], removeScopes || []);
  } catch (error) {
    // Tree-sitter not available in CLI
    return null;
  }
}

// Language detection
function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.py': 'python',
    '.js': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescriptreact',
    '.jsx': 'javascriptreact',
    '.cs': 'csharp',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.go': 'go',
    '.rb': 'ruby',
    '.php': 'php',
    '.rs': 'rust',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.md': 'markdown'
  };
  return langMap[ext] || 'plaintext';
}

// ANSI color codes
const ANSI = {
  reset: '\x1b[0m',
  black: '\x1b[30m',
  white: '\x1b[37m',
  dim: '\x1b[2m',
  // Background colors with different intensities
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m',
    // Bright variants
    blackBright: '\x1b[100m',
    redBright: '\x1b[101m',
    greenBright: '\x1b[102m',
    yellowBright: '\x1b[103m',
    blueBright: '\x1b[104m',
    magentaBright: '\x1b[105m',
    cyanBright: '\x1b[106m',
    whiteBright: '\x1b[107m'
  }
};

// Convert hex color to ANSI
function hexToAnsi(hexColor: string, transparency: number = 0.5): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  const ansiColors = [
    { bg: ANSI.bg.black, bgBright: ANSI.bg.blackBright, rgb: [0, 0, 0] },
    { bg: ANSI.bg.red, bgBright: ANSI.bg.redBright, rgb: [205, 49, 49] },
    { bg: ANSI.bg.green, bgBright: ANSI.bg.greenBright, rgb: [13, 188, 121] },
    { bg: ANSI.bg.yellow, bgBright: ANSI.bg.yellowBright, rgb: [229, 229, 16] },
    { bg: ANSI.bg.blue, bgBright: ANSI.bg.blueBright, rgb: [36, 114, 200] },
    { bg: ANSI.bg.magenta, bgBright: ANSI.bg.magentaBright, rgb: [188, 63, 188] },
    { bg: ANSI.bg.cyan, bgBright: ANSI.bg.cyanBright, rgb: [17, 168, 205] },
    { bg: ANSI.bg.white, bgBright: ANSI.bg.whiteBright, rgb: [229, 229, 229] }
  ];
  
  // Find closest color
  let minDistance = Infinity;
  let closestColor = ansiColors[0];
  
  for (const color of ansiColors) {
    const distance = Math.sqrt(
      Math.pow(r - color.rgb[0], 2) +
      Math.pow(g - color.rgb[1], 2) +
      Math.pow(b - color.rgb[2], 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  }
  
  return transparency >= 0.5 ? closestColor.bgBright : closestColor.bg;
}

// Load theme configuration
function loadTheme(themeName: string | null): { colors: any; mixPattern: string } | null {
  try {
    // Try to load from VSCode settings first
    const settingsPaths = [];
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    
    if (process.platform === 'darwin') {
      settingsPaths.push(
        path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'settings.json'),
        path.join(homeDir, '.config', 'Code', 'User', 'settings.json')
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
    
    // Also check workspace settings
    settingsPaths.push(path.join(process.cwd(), '.vscode', 'settings.json'));
    
    let selectedTheme = themeName;
    let customThemes: Record<string, any> = {};
    let mixPattern = 'humanBorder';
    
    // Load settings
    for (const settingsPath of settingsPaths) {
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (!selectedTheme && settings['tumee-vscode-plugin.selectedTheme']) {
          selectedTheme = settings['tumee-vscode-plugin.selectedTheme'];
        }
        if (settings['tumee-vscode-plugin.customThemes']) {
          Object.assign(customThemes, settings['tumee-vscode-plugin.customThemes']);
        }
        if (settings['tumee-vscode-plugin.mixPattern']) {
          mixPattern = settings['tumee-vscode-plugin.mixPattern'];
        }
      }
    }
    
    if (!selectedTheme) {
      selectedTheme = 'default';
    }
    
    // Check custom themes first
    if (customThemes[selectedTheme]) {
      return {
        colors: customThemes[selectedTheme].colors.permissions,
        mixPattern: customThemes[selectedTheme].colors.mixPattern || mixPattern
      };
    }
    
    // Fall back to built-in themes
    const themes = getColorThemes();
    if (themes[selectedTheme]) {
      return {
        colors: themes[selectedTheme].colors.permissions,
        mixPattern: themes[selectedTheme].colors.mixPattern || mixPattern
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Display file with colors
async function displayFile(filePath: string, options: any): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf8');
  const languageId = detectLanguage(filePath);
  const document = new CLIDocument(content, languageId);
  const lines = content.split('\n');
  
  // Parse guard tags
  const config = new CLIConfiguration({ enableDebugLogging: options.debug });
  const guardTags = await parseGuardTagsCore(document, lines, config, cliSemanticResolver, cliLogger);
  
  // Get line permissions
  const linePermissions = getLinePermissionsCore(document, guardTags, config, cliLogger);
  
  // Load theme if using colors
  let theme: any = null;
  if (options.color) {
    theme = loadTheme(options.theme);
    if (!theme && options.theme) {
      console.error(`Theme '${options.theme}' not found. Using default theme.`);
      theme = loadTheme('default');
    }
  }
  
  // Calculate max line length for padding
  const maxLineLength = Math.max(80, ...lines.map(l => l.length));
  
  // Display each line
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const perm = linePermissions.get(lineNum);
    
    let aiPerm = 'r';
    let humanPerm = 'w';
    let isContext = false;
    
    if (perm) {
      // Normalize contextWrite back to 'w' for display
      aiPerm = (perm.permissions?.ai === 'contextWrite' ? 'w' : perm.permissions?.ai) || 'r';
      humanPerm = (perm.permissions?.human === 'contextWrite' ? 'w' : perm.permissions?.human) || 'w';
      isContext = perm.isContext?.ai || perm.isContext?.human || false;
    }
    
    // Format permission block
    const contextMarker = isContext ? '*' : ' ';
    const permBlock = `[AI:${aiPerm} HU:${humanPerm} ${contextMarker}]`;
    const lineNumStr = String(lineNum).padStart(5, ' ');
    
    if (options.color && theme) {
      // Apply colors based on permissions
      let bgColor = '';
      let textColor = ANSI.black;
      let borderColor = '';
      
      const colors = theme.colors.permissions || theme.colors;
      
      // Determine colors
      let aiColor = '';
      let humanColor = '';
      let aiConfig: any = null;
      let humanConfig: any = null;
      let highlightEntireLine = false;
      
      if (isContext) {
        // Determine if this is read or write context based on the permission that has context
        // Only check the permission that actually has the context flag
        const isWriteContext = (perm?.isContext?.ai && aiPerm === 'w') || 
                               (perm?.isContext?.human && humanPerm === 'w');
        const contextColor = isWriteContext ? colors.contextWrite : colors.contextRead;
        if (options.debug) {
          console.error(`[DEBUG] Context type: ${isWriteContext ? 'write' : 'read'}, color config:`, contextColor);
        }
        if (contextColor?.enabled && contextColor.transparency > 0) {
          aiColor = humanColor = hexToAnsi(contextColor.color, contextColor.transparency);
          highlightEntireLine = contextColor.highlightEntireLine || false;
        }
      } else {
        // AI color
        const aiKey = aiPerm === 'w' ? 'aiWrite' : aiPerm === 'r' ? 'aiRead' : 'aiNoAccess';
        aiConfig = colors[aiKey];
        if (aiConfig?.enabled && aiConfig.transparency > 0) {
          aiColor = hexToAnsi(aiConfig.color, aiConfig.transparency);
        }
        
        // Human color
        const humanKey = humanPerm === 'w' ? 'humanWrite' : humanPerm === 'r' ? 'humanRead' : 'humanNoAccess';
        humanConfig = colors[humanKey];
        if (humanConfig?.enabled && humanConfig.transparency > 0) {
          humanColor = hexToAnsi(humanConfig.color, humanConfig.transparency);
        }
      }
      
      // Apply mix pattern if both colors present
      if (aiColor && humanColor) {
        const result = applyMixPattern(theme.mixPattern, {
          aiColor: aiColor,
          humanColor: humanColor
        });
        bgColor = result.backgroundColor;
        if (result.borderColor) {
          borderColor = result.borderColor;
        }
        // Determine highlightEntireLine for mixed permissions
        if (!isContext) {
          highlightEntireLine = getHighlightEntireLineForMix(theme.mixPattern, aiConfig?.highlightEntireLine || false, humanConfig?.highlightEntireLine || false);
        }
      } else {
        bgColor = aiColor || humanColor;
        // For single color, use its highlightEntireLine setting
        if (!isContext) {
          if (aiColor && aiConfig) {
            highlightEntireLine = aiConfig.highlightEntireLine || false;
          } else if (humanColor && humanConfig) {
            highlightEntireLine = humanConfig.highlightEntireLine || false;
          }
        }
      }
      
      // Set text color based on background
      if (bgColor && (bgColor.includes('41') || bgColor.includes('44') || bgColor.includes('45'))) {
        textColor = ANSI.white;
      }
      
      // Apply colors
      if (bgColor) {
        const lineContent = highlightEntireLine ? lines[i].padEnd(maxLineLength, ' ') : lines[i];
        console.log(`${lineNumStr} ${permBlock}${bgColor}${textColor} ${lineContent}${ANSI.reset}`);
      } else {
        console.log(`${lineNumStr} ${permBlock} ${lines[i]}`);
      }
    } else {
      console.log(`${lineNumStr} ${permBlock} ${lines[i]}`);
    }
  }
}

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
      await displayFile(file, options);
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