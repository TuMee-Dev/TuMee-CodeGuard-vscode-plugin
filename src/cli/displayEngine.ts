/**
 * CLI Display Engine - Extracted from tests/cli-parser-test.js
 * This is the real implementation that handles colored output with borders
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseGuardTagsCore, getLinePermissionsCore } from '../core/processor';
import { resolveSemantic, initializeScopeResolver } from '../utils/scopeResolver';
import { getColorThemes } from '../utils/themeLoader';
import { CLI_BORDER_CHAR, CLI_MIXED_BORDER_CHAR, ANSI } from '../core/constants';
import { parseDocument, findNodeAtPosition } from '../core/parser';

// CLI Document implementation
export class CLIDocument {
  public readonly lines: string[];
  public readonly languageId: string;
  public readonly lineCount: number;
  public readonly text: string;
  private readonly content: string;

  constructor(content: string, languageId: string) {
    this.content = content;
    this.text = content;
    this.lines = content.split('\n');
    this.languageId = languageId;
    this.lineCount = this.lines.length;
  }

  getText(): string {
    return this.content;
  }

  lineAt(line: number): { text: string; firstNonWhitespaceCharacterIndex: number; lineNumber: number } {
    const text = this.lines[line] || '';
    return {
      text,
      firstNonWhitespaceCharacterIndex: text.search(/\S/),
      lineNumber: line
    };
  }
}

// CLI Configuration implementation
export class CLIConfiguration {
  private options: Record<string, any>;

  constructor(options: Record<string, any> = {}) {
    this.options = options;
  }

  get(key: string, defaultValue?: any): any {
    return this.options[key] !== undefined ? this.options[key] : defaultValue;
  }
}

// Simple logger for CLI
export const cliLogger = {
  log: (message: string) => {
    if (process.env.DEBUG) {
      console.error(message);
    }
  },
  warn: (message: string) => {
    if (process.env.DEBUG) {
      console.error(`[WARN] ${message}`);
    }
  },
  error: (message: string) => {
    if (process.env.DEBUG) {
      console.error(`[ERROR] ${message}`);
    }
  }
};

// Semantic resolver for CLI
export async function cliSemanticResolver(document: any, line: number, scope: string, addScopes?: string[], removeScopes?: string[]): Promise<any> {
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
export function detectLanguage(filePath: string): string {
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

// Convert hex color to ANSI with transparency support
export function hexToAnsi(hexColor: string, transparency: number = 0.5): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Map to nearest basic ANSI colors based on RGB values
  // Normal colors for low transparency (light tint), bright colors for high transparency (solid)
  const ansiColors = [
    { name: 'black', bg: ANSI.bg.black, bgBright: ANSI.bg.blackBright, rgb: [0, 0, 0] },
    { name: 'red', bg: ANSI.bg.red, bgBright: ANSI.bg.redBright, rgb: [205, 49, 49] },
    { name: 'green', bg: ANSI.bg.green, bgBright: ANSI.bg.greenBright, rgb: [13, 188, 121] },
    { name: 'yellow', bg: ANSI.bg.yellow, bgBright: ANSI.bg.yellowBright, rgb: [229, 229, 16] },
    { name: 'blue', bg: ANSI.bg.blue, bgBright: ANSI.bg.blueBright, rgb: [36, 114, 200] },
    { name: 'magenta', bg: ANSI.bg.magenta, bgBright: ANSI.bg.magentaBright, rgb: [188, 63, 188] },
    { name: 'cyan', bg: ANSI.bg.cyan, bgBright: ANSI.bg.cyanBright, rgb: [17, 168, 205] },
    { name: 'white', bg: ANSI.bg.white, bgBright: ANSI.bg.whiteBright, rgb: [229, 229, 229] }
  ];
  
  // Find closest color using Euclidean distance
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
  
  // Use bright color for high transparency (>=50% opacity), normal for low (<50%)
  return transparency >= 0.5 ? closestColor.bgBright : closestColor.bg;
}

// Load theme configuration
export function loadTheme(themeName: string | null): { colors: any; mixPattern: string; permissions: any } | null {
  try {
    let selectedTheme = themeName || 'default';
    
    
    // Fall back to built-in themes
    const themes = getColorThemes();
    
    if (themes[selectedTheme]) {
      const themeData = themes[selectedTheme];
      
      const result = {
        colors: mapThemeToAnsi(themeData.colors.permissions),
        mixPattern: themeData.colors.mixPattern || 'humanBorder',
        permissions: themeData.colors.permissions
      };
      return result;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Map theme colors to ANSI codes
function mapThemeToAnsi(themeColors: any): any {
  const mapping: any = {};
  
  for (const [key, value] of Object.entries(themeColors)) {
    const config = value as any;
    if (config && config.color && config.enabled !== false && config.transparency > 0) {
      // Pass transparency to get appropriate ANSI variant
      mapping[key] = hexToAnsi(config.color, config.transparency);
    } else {
      mapping[key] = ANSI.dim; // Dim for disabled
    }
  }
  
  return mapping;
}

// Main display function - extracted from generateDebugOutput
export async function displayFile(filePath: string, options: { color?: boolean; theme?: string; debug?: boolean; treeSitterDebug?: boolean }): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf8');
  const languageId = detectLanguage(filePath);
  const document = new CLIDocument(content, languageId);
  const lines = content.split('\n');
  
  // Create mock extension context for CLI
  const mockExtensionContext = {
    globalState: { get: () => undefined, update: () => Promise.resolve() },
    workspaceState: { get: () => undefined, update: () => Promise.resolve() },
    extensionPath: path.join(__dirname, '..'),
    asAbsolutePath: (relativePath: string) => path.join(__dirname, '..', relativePath)
  };

  // Parse guard tags  
  const config = new CLIConfiguration({ enableDebugLogging: options.debug });
  const guardTags = await parseGuardTagsCore(document, lines, config, mockExtensionContext, cliLogger);
  
  // Get line permissions
  const linePermissions = getLinePermissionsCore(document, guardTags, config, cliLogger);
  
  // Load theme if using colors
  let theme: any = null;
  if (options.color) {
    if (options.debug) {
      console.error(`[DEBUG] Loading theme: ${options.theme || 'default'}`);
    }
    theme = loadTheme(options.theme || null);
    if (options.debug) {
      console.error(`[DEBUG] Theme loaded:`, theme ? 'SUCCESS' : 'FAILED');
      if (theme) {
        console.error(`[DEBUG] Theme colors:`, Object.keys(theme.colors || {}));
        console.error(`[DEBUG] Mix pattern:`, theme.mixPattern);
      }
    }
    if (!theme && options.theme) {
      console.error(`Theme '${options.theme}' not found. Using default theme.`);
      theme = loadTheme('default');
    }
  }
  
  // Check for overlapping guards (mixed permissions) - simplified for now
  const mixedLines = new Set<number>();
  for (let i = 0; i < guardTags.length; i++) {
    for (let j = i + 1; j < guardTags.length; j++) {
      const g1 = guardTags[i];
      const g2 = guardTags[j];
      // Check if guards overlap (basic check)
      if (g1.scopeStart !== undefined && g1.scopeEnd !== undefined &&
          g2.scopeStart !== undefined && g2.scopeEnd !== undefined &&
          g1.scopeStart <= g2.scopeEnd && g2.scopeStart <= g1.scopeEnd) {
        // Mark all overlapping lines as mixed
        const overlapStart = Math.max(g1.scopeStart, g2.scopeStart);
        const overlapEnd = Math.min(g1.scopeEnd, g2.scopeEnd);
        for (let line = overlapStart; line <= overlapEnd; line++) {
          mixedLines.add(line); // Already 1-based
        }
      }
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
    let permBlock = `[AI:${aiPerm} HU:${humanPerm} ${contextMarker}]`;
    
    // Add tree-sitter debug info if requested
    if (options.treeSitterDebug) {
      let nodeType = 'unknown';
      try {
        // Create a mock extension context for CLI use
        const mockContext = {
          globalState: { get: () => undefined, update: () => Promise.resolve() },
          workspaceState: { get: () => undefined, update: () => Promise.resolve() },
          extensionPath: path.join(__dirname, '..'),
          asAbsolutePath: (relativePath: string) => path.join(__dirname, '..', relativePath)
        };
        
        // Get tree-sitter node type for this line FOR DEBUG DISPLAY ONLY
        const tree = await parseDocument(mockContext as any, document);
        if (tree) {
          const node = findNodeAtPosition(tree, lineNum - 1);
          if (node) {
            nodeType = node.type;
          }
        }
      } catch (error) {
        nodeType = 'error';
      }
      // Clean format: {nodeType}[AI:x HU:y  ] with 18 char width for nodeType
      // THIS IS DISPLAY ONLY - does not affect permissions
      const truncatedNodeType = nodeType.substring(0, 18).padEnd(18, ' ');
      permBlock = `{${truncatedNodeType}}[AI:${aiPerm} HU:${humanPerm} ${contextMarker}]`;
    }
    
    const lineNumStr = String(lineNum).padStart(5, ' ');
    
    if (options.color && theme) {
      // Check if this line has mixed permissions
      const isMixed = mixedLines.has(lineNum);
      
      // Determine colors based on permissions
      let bgColor = '';
      let borderColor = '';
      let textColor = ANSI.black;
      let borderChar = isMixed ? CLI_MIXED_BORDER_CHAR : CLI_BORDER_CHAR;
      
      // Get AI and Human colors separately
      let aiColor = '';
      let humanColor = '';
      let aiConfig: any = null;
      let humanConfig: any = null;
      let highlightEntireLine = false;
      
      if (isContext) {
        // Determine if this is read or write context based on the permission that has context
        const isWriteContext = (perm?.isContext?.ai && aiPerm === 'w') || 
                               (perm?.isContext?.human && humanPerm === 'w');
        const contextColor = isWriteContext ? theme.colors.contextWrite : theme.colors.contextRead;
        if (contextColor && contextColor !== ANSI.dim) {
          aiColor = humanColor = contextColor;
          highlightEntireLine = theme.permissions?.contextWrite?.highlightEntireLine || 
                               theme.permissions?.contextRead?.highlightEntireLine || false;
        }
      } else {
        // AI color
        const aiKey = aiPerm === 'w' ? 'aiWrite' : aiPerm === 'r' ? 'aiRead' : 'aiNoAccess';
        aiConfig = theme.permissions?.[aiKey];
        if (aiConfig?.enabled && aiConfig.transparency > 0) {
          aiColor = theme.colors[aiKey];
        }
        
        // Human color
        const humanKey = humanPerm === 'w' ? 'humanWrite' : humanPerm === 'r' ? 'humanRead' : 'humanNoAccess';
        humanConfig = theme.permissions?.[humanKey];
        if (humanConfig?.enabled && humanConfig.transparency > 0) {
          humanColor = theme.colors[humanKey];
        }
      }
      
      // Apply mix pattern if both colors present
      if (aiColor && humanColor && aiColor !== ANSI.dim && humanColor !== ANSI.dim) {
        // Both colors enabled - use mix pattern
        const mixPattern = theme.mixPattern;
        
        switch (mixPattern) {
          case 'aiBorder':
            bgColor = humanColor;
            borderColor = aiColor;
            // For border bar, use border opacity if available
            if (aiConfig?.borderOpacity !== undefined && aiConfig.borderOpacity !== aiConfig.transparency) {
              borderColor = hexToAnsi(aiConfig.color, aiConfig.borderOpacity);
            }
            break;
          case 'humanBorder':
            bgColor = aiColor;
            borderColor = humanColor;
            // For border bar, use border opacity if available
            if (humanConfig?.borderOpacity !== undefined && humanConfig.borderOpacity !== humanConfig.transparency) {
              borderColor = hexToAnsi(humanConfig.color, humanConfig.borderOpacity);
            }
            break;
          case 'aiPriority':
            bgColor = borderColor = aiColor;
            break;
          case 'humanPriority':
            bgColor = borderColor = humanColor;
            break;
          case 'average':
            // For average, both get the same blended color (we can't blend ANSI easily)
            // So we'll just use AI color for simplicity
            bgColor = borderColor = aiColor;
            break;
          default:
            bgColor = aiColor;
            borderColor = humanColor;
        }
        
        // Determine highlightEntireLine for mixed permissions
        if (!isContext) {
          highlightEntireLine = (aiConfig?.highlightEntireLine || false) || (humanConfig?.highlightEntireLine || false);
        }
      } else {
        bgColor = aiColor || humanColor;
        borderColor = bgColor;
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
      if (bgColor && bgColor !== ANSI.dim) {
        const lineContent = highlightEntireLine ? lines[i].padEnd(maxLineLength, ' ') : lines[i];
        
        // Format: line# [perms]|content (where | is the colored border char)
        if (borderColor && bgColor && borderColor !== bgColor) {
          // Different colors for border and background
          console.log(`${lineNumStr} ${permBlock}${borderColor}${borderChar}${ANSI.reset}${bgColor}${textColor}${lineContent}${ANSI.reset}`);
        } else if (bgColor) {
          // Same color for both or no border color
          console.log(`${lineNumStr} ${permBlock}${bgColor}${textColor}${borderChar}${lineContent}${ANSI.reset}`);
        } else if (borderColor) {
          // Only border color
          console.log(`${lineNumStr} ${permBlock}${borderColor}${borderChar}${ANSI.reset} ${lineContent}`);
        }
      } else {
        // Default state - no colors
        console.log(`${lineNumStr} ${permBlock} ${lines[i]}`);
      }
    } else {
      console.log(`${lineNumStr} ${permBlock} ${lines[i]}`);
    }
  }
}