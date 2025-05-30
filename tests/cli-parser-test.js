#!/usr/bin/env node

/**
 * Command-line test for guard parser
 * Usage: node tests/cli-parser-test.js <filepath>
 * 
 * This script uses the SAME guard parsing logic as the VS Code plugin
 * to ensure perfect synchronization with the CodeGuard CLI tool.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { execSync } = require('child_process');

// Ensure the extension is compiled
try {
  execSync('npm run compile', { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
} catch (error) {
  console.error('Failed to compile extension:', error.message);
  process.exit(1);
}

// Mock vscode module before loading any modules that depend on it
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === 'vscode') {
    // Return a comprehensive mock for tree-sitter and scope resolver
    return {
      workspace: {
        getConfiguration: (namespace) => ({
          get: (key, defaultValue) => {
            // Try to load from VSCode settings file
            try {
              const os = require('os');
              const platform = os.platform();
              const homeDir = os.homedir();
              let settingsPath;
              if (platform === 'darwin') {
                settingsPath = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'settings.json');
              } else if (platform === 'win32') {
                settingsPath = path.join(process.env.APPDATA || '', 'Code', 'User', 'settings.json');
              } else {
                settingsPath = path.join(homeDir, '.config', 'Code', 'User', 'settings.json');
              }
              if (fs.existsSync(settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                const fullKey = namespace ? `${namespace}.${key}` : key;
                return settings[fullKey] !== undefined ? settings[fullKey] : defaultValue;
              }
            } catch (e) {
              // Fall back to default
            }
            return defaultValue;
          },
          update: async () => {} // Mock update
        }),
        fs: {
          readFile: async (uri) => {
            const fs = require('fs');
            const filePath = typeof uri === 'string' ? uri : (uri.fsPath || uri.path || uri.toString());
            const buffer = fs.readFileSync(filePath);
            return { buffer };
          }
        }
      },
      Uri: {
        joinPath: (base, ...segments) => {
          const basePath = typeof base === 'string' ? base : (base.fsPath || base.path || base.extensionUri?.fsPath || base.toString());
          const fullPath = path.join(basePath, ...segments);
          return { 
            toString: () => fullPath,
            fsPath: fullPath,
            path: fullPath
          };
        }
      },
      window: {
        showErrorMessage: () => {},
        showWarningMessage: () => {}
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

// We need to use TypeScript directly since webpack bundles everything
// Register TypeScript compiler
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2018',
    lib: ['es2018'],
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    moduleResolution: 'node',
    resolveJsonModule: true,
    strict: false,
    skipLibCheck: true,
    paths: {
      '@/*': [path.join(__dirname, '..', 'src', '*')]
    }
  }
});

// Import the pure guard processing core directly from TypeScript source
const { 
  parseGuardTagsCore, 
  getLinePermissionsCore,
  parseGuardTag,
  isLineAComment
} = require('../src/utils/guardProcessorCore');

// Import the semantic resolver
const { resolveSemantic, initializeScopeResolver } = require('../src/utils/scopeResolver');

// Import the theme loader
const { getColorThemes } = require('../src/utils/themeLoader');

// Simple document implementation for CLI
class CLIDocument {
  constructor(content, languageId) {
    this.content = content;
    this.lines = content.split('\n');
    this.languageId = languageId;
    this.lineCount = this.lines.length;
  }

  getText() {
    return this.content;
  }

  lineAt(line) {
    const text = this.lines[line] || '';
    return {
      text,
      firstNonWhitespaceCharacterIndex: text.search(/\S/)
    };
  }
}

// Simple configuration implementation
class CLIConfiguration {
  constructor(options = {}) {
    this.options = options;
  }

  get(key, defaultValue) {
    return this.options[key] !== undefined ? this.options[key] : defaultValue;
  }
}

// We need to initialize tree-sitter for the CLI
const { initializeTreeSitter } = require('../src/utils/treeSitterParser');

// Create a semantic resolver that works without VSCode
async function cliSemanticResolver(document, line, scope, addScopes, removeScopes) {
  // Initialize tree-sitter if not already done
  if (!global.extensionContext) {
    // Create a minimal extension context for tree-sitter
    global.extensionContext = {
      extensionPath: path.join(__dirname, '..'),
      extensionUri: { fsPath: path.join(__dirname, '..') }
    };
    
    try {
      // Initialize both the scope resolver and tree-sitter
      await initializeScopeResolver(global.extensionContext);
    } catch (error) {
      // Silently fail - tree-sitter not available in CLI
      return null;
    }
  }
  
  // Now use the real semantic resolver
  try {
    return await resolveSemantic(document, line, scope, addScopes, removeScopes);
  } catch (error) {
    // Silently fail - tree-sitter not available in CLI
    return null;
  }
}

// Simple logger for CLI
const cliLogger = {
  log: (message) => {
    // Only log if debug is enabled
    if (process.env.DEBUG) {
      console.error(message);
    }
  }
};

// Wrapper functions that match the old API
async function parseGuardTagsChunked(document, lines) {
  const config = new CLIConfiguration({ enableDebugLogging: process.env.DEBUG === 'true' });
  return parseGuardTagsCore(document, lines, config, cliSemanticResolver, cliLogger);
}

function getLinePermissions(document, guardTags) {
  const config = new CLIConfiguration({ enableDebugLogging: process.env.DEBUG === 'true' });
  return getLinePermissionsCore(document, guardTags, config, cliLogger);
}

// For createGuardRegions, we'll need to implement a simple version
function createGuardRegions(guardTags, totalLines) {
  // Simple implementation that converts guard tags to regions
  return guardTags;
}


/**
 * Detect language from file extension
 */
function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const langMap = {
    '.py': 'python',
    '.js': 'javascript',
    '.ts': 'typescript',
    '.cs': 'csharp',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.go': 'go',
    '.rb': 'ruby',
    '.php': 'php'
  };
  return langMap[ext] || 'unknown';
}

/**
 * Map permission codes to full names
 */
function mapPermission(permission) {
  const map = {
    'r': 'read-only',
    'w': 'write',
    'n': 'none',
    'context': 'read-only'
  };
  return map[permission] || 'read-only';
}

/**
 * Generate debug output format showing permissions for each line
 */
async function generateDebugOutput(filePath, content, useColor = false, themeName = null) {
  const languageId = detectLanguage(filePath);
  const document = new CLIDocument(content, languageId);
  const lines = content.split('\n');
  
  // Use the plugin's guard parser
  const guardTags = await parseGuardTagsChunked(document, lines);
  
  // Get line permissions using the plugin's logic
  const linePermissions = getLinePermissions(document, guardTags);
  
  // Load theme colors once if using color
  const themeColors = useColor ? loadThemeColors(themeName) : null;
  const themeConfig = useColor ? loadFullThemeConfig(themeName) : null;
  
  // Check for overlapping guards (mixed permissions)
  const mixedLines = new Set();
  for (let i = 0; i < guardTags.length; i++) {
    for (let j = i + 1; j < guardTags.length; j++) {
      const g1 = guardTags[i];
      const g2 = guardTags[j];
      // Check if guards overlap and target the same entity (ai or human)
      if (g1.target === g2.target && 
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
  
  // Function to convert hex color to nearest ANSI color with transparency support
  function hexToAnsi(hexColor, transparency = 0.5) {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Map to nearest basic ANSI colors based on RGB values
    // Normal colors for low transparency (light tint), bright colors for high transparency (solid)
    const ansiColors = [
      { name: 'black', bg: '\x1b[40m', bgBright: '\x1b[100m', rgb: [0, 0, 0] },
      { name: 'red', bg: '\x1b[41m', bgBright: '\x1b[101m', rgb: [205, 49, 49] },
      { name: 'green', bg: '\x1b[42m', bgBright: '\x1b[102m', rgb: [13, 188, 121] },
      { name: 'yellow', bg: '\x1b[43m', bgBright: '\x1b[103m', rgb: [229, 229, 16] },
      { name: 'blue', bg: '\x1b[44m', bgBright: '\x1b[104m', rgb: [36, 114, 200] },
      { name: 'magenta', bg: '\x1b[45m', bgBright: '\x1b[105m', rgb: [188, 63, 188] },
      { name: 'cyan', bg: '\x1b[46m', bgBright: '\x1b[106m', rgb: [17, 168, 205] },
      { name: 'white', bg: '\x1b[47m', bgBright: '\x1b[107m', rgb: [229, 229, 229] }
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
  
  // Load theme configuration using the extension's theme system
  function loadThemeColors(overrideTheme = null) {
    // Get the selected theme name from VSCode settings
    let selectedTheme = overrideTheme;
    
    if (!selectedTheme) {
      // Use the VSCode mock to get configuration
      const vscode = Module.prototype.require('vscode');
      selectedTheme = vscode.workspace.getConfiguration('tumee-vscode-plugin').get('selectedTheme');
      
      if (!selectedTheme) {
        console.error('Error: No theme selected in VSCode settings');
        process.exit(1);
      }
    }
    
    // First check custom themes
    const customThemes = Module.prototype.require('vscode').workspace.getConfiguration('tumee-vscode-plugin').get('customThemes') || {};
    
    if (customThemes[selectedTheme]) {
      // Custom theme
      if (process.env.DEBUG) {
        console.error(`Using custom theme: ${selectedTheme}`);
      }
      return mapThemeToAnsi(customThemes[selectedTheme].permissions);
    }
    
    // Fall back to built-in themes
    const themes = getColorThemes();
    if (themes[selectedTheme]) {
      if (process.env.DEBUG) {
        console.error(`Using built-in theme: ${selectedTheme}`);
      }
      return mapThemeToAnsi(themes[selectedTheme].colors.permissions);
    }
    
    // Theme not found
    console.error(`Error: Theme '${selectedTheme}' not found.`);
    console.error(`Available built-in themes: ${Object.keys(themes).join(', ')}`);
    console.error(`Available custom themes: ${Object.keys(customThemes).join(', ')}`);
    process.exit(1);
  }
  
  // Get built-in theme colors using the theme loader
  function getBuiltInTheme(themeName) {
    const themes = getColorThemes();
    if (themes[themeName]) {
      return themes[themeName].colors.permissions;
    }
    
    // If theme not found, show error
    console.error(`Error: Theme '${themeName}' not found.`);
    console.error(`Available themes: ${Object.keys(themes).join(', ')}`);
    process.exit(1);
  }
  
  // Map theme colors to ANSI codes
  function mapThemeToAnsi(themeColors) {
    const mapping = {};
    // Also store transparency values for border color calculation
    const transparencies = {};
    
    for (const [key, value] of Object.entries(themeColors)) {
      if (value && value.color && value.enabled !== false && value.transparency > 0) {
        // Pass transparency to get appropriate ANSI variant
        mapping[key] = hexToAnsi(value.color, value.transparency);
        transparencies[key] = value.transparency;
        if (process.env.DEBUG && (key === 'aiRead' || key === 'aiWrite' || key === 'humanRead')) {
          console.error(`${key}: enabled=${value.enabled}, transparency=${value.transparency}, borderOpacity=${value.borderOpacity}, color=${value.color} -> ${mapping[key]}`);
        }
      } else {
        mapping[key] = '\x1b[2m'; // Dim for disabled
        transparencies[key] = 0;
        if (process.env.DEBUG && key === 'aiRead') {
          console.error(`aiRead: DISABLED (enabled=${value?.enabled}, transparency=${value?.transparency})`);
        }
      }
    }
    
    // Store transparencies on the mapping object for later use
    mapping._transparencies = transparencies;
    return mapping;
  }
  
  // Load full theme configuration with enabled/transparency info
  function loadFullThemeConfig(overrideTheme = null) {
    // Get the selected theme name from VSCode settings
    let selectedTheme = overrideTheme;
    
    if (!selectedTheme) {
      // Use the VSCode mock to get configuration
      const vscode = Module.prototype.require('vscode');
      selectedTheme = vscode.workspace.getConfiguration('tumee-vscode-plugin').get('selectedTheme');
      
      if (!selectedTheme) {
        console.error('Error: No theme selected in VSCode settings');
        process.exit(1);
      }
    }
    
    // Get mix pattern from settings
    const vscode = Module.prototype.require('vscode');
    const mixPattern = vscode.workspace.getConfiguration('tumee-vscode-plugin').get('mixPattern') || 'humanBorder';
    
    // First check custom themes
    const customThemes = vscode.workspace.getConfiguration('tumee-vscode-plugin').get('customThemes') || {};
    
    if (customThemes[selectedTheme]) {
      // Custom theme
      return {
        permissions: customThemes[selectedTheme].permissions,
        mixPattern: customThemes[selectedTheme].mixPattern || mixPattern
      };
    }
    
    // Fall back to built-in themes
    const themes = getColorThemes();
    if (themes[selectedTheme]) {
      return {
        permissions: themes[selectedTheme].colors.permissions,
        mixPattern: themes[selectedTheme].colors.mixPattern || mixPattern
      };
    }
    
    // Theme not found
    console.error(`Error: Theme '${selectedTheme}' not found.`);
    process.exit(1);
  }
  
  // ANSI color codes
  const colors = {
    reset: '\x1b[0m',
    // Text colors for readability
    black: '\x1b[30m',   // Black text
    white: '\x1b[37m',   // White text
    dim: '\x1b[2m',      // Dim text
  };
  
  // Generate output
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1; // 1-based line numbers
    const perm = linePermissions.get(lineNum);
    
    let aiPerm = 'r';  // default
    let humanPerm = 'w';  // default
    let isContext = false;
    
    if (perm) {
      
      // Extract AI and Human permissions
      aiPerm = perm.permissions?.ai || 'r';
      humanPerm = perm.permissions?.human || 'w';
      isContext = perm.isContext?.ai || perm.isContext?.human || false;
    }
    
    // Format the permission block: [AI:X HU:Y *]
    // Always same width with * for context, space for normal
    const contextMarker = isContext ? '*' : ' ';
    const permBlock = `[AI:${aiPerm} HU:${humanPerm} ${contextMarker}]`;
    
    // Output the line with line number (padded to 5 digits)
    const lineNumStr = String(lineNum).padStart(5, ' ');
    
    if (useColor) {
      
      // Check if this line has mixed permissions (from overlapping guards)
      const isMixed = mixedLines.has(lineNum);
      
      // Determine colors based on permissions
      let bgColor = '';
      let borderColor = '';
      let textColor = colors.black;
      let borderChar = '▒'; // Character to show in the border position
      
      // Get AI and Human colors separately
      let aiColor = '';
      let humanColor = '';
      
      if (isContext) {
        aiColor = humanColor = themeColors.contextRead || themeColors.contextWrite;
      } else {
        // Determine AI color
        if (aiPerm === 'w') {
          aiColor = themeColors.aiWrite;
        } else if (aiPerm === 'r') {
          aiColor = themeColors.aiRead;
        } else if (aiPerm === 'n') {
          aiColor = themeColors.aiNoAccess;
        }
        
        // Determine Human color
        if (humanPerm === 'w') {
          humanColor = themeColors.humanWrite;
        } else if (humanPerm === 'r') {
          humanColor = themeColors.humanRead;
        } else if (humanPerm === 'n') {
          humanColor = themeColors.humanNoAccess;
        }
      }
      
      // Debug what we got from themeColors
      if (lineNum === 3 && process.env.DEBUG) {
        console.error(`Line 3: aiColor='${aiColor}', humanColor='${humanColor}'`);
      }
      
      // Get the actual permission configs to check if enabled
      let aiPermConfig = null;
      let humanPermConfig = null;
      
      if (themeConfig && themeConfig.permissions) {
        if (isContext) {
          aiPermConfig = humanPermConfig = themeConfig.permissions.contextRead || themeConfig.permissions.contextWrite;
        } else {
          // Get AI permission config
          if (aiPerm === 'w') {
            aiPermConfig = themeConfig.permissions.aiWrite;
          } else if (aiPerm === 'r') {
            aiPermConfig = themeConfig.permissions.aiRead;
          } else if (aiPerm === 'n') {
            aiPermConfig = themeConfig.permissions.aiNoAccess;
          }
          
          // Get Human permission config
          if (humanPerm === 'w') {
            humanPermConfig = themeConfig.permissions.humanWrite;
          } else if (humanPerm === 'r') {
            humanPermConfig = themeConfig.permissions.humanRead;
          } else if (humanPerm === 'n') {
            humanPermConfig = themeConfig.permissions.humanNoAccess;
          }
        }
      }
      
      // Check if colors are actually enabled with transparency > 0
      // Only set color if it's not the dim ANSI code
      const aiEnabled = aiColor && aiColor !== '\x1b[2m';
      const humanEnabled = humanColor && humanColor !== '\x1b[2m';
      
      // Clear colors if they're disabled
      if (!aiEnabled) aiColor = '';
      if (!humanEnabled) humanColor = '';
      
      // Debug color assignment
      if (lineNum === 1 && process.env.DEBUG) {
        console.error(`Line 1 colors: aiPerm=${aiPerm}, humanPerm=${humanPerm}`);
        console.error(`  aiColor='${aiColor}', humanColor='${humanColor}'`);
        console.error(`  Before mix: aiEnabled=${aiEnabled}, humanEnabled=${humanEnabled}`);
      }
      
      if (aiEnabled && humanEnabled) {
        // Both colors enabled - use mix pattern
        const mixPattern = themeConfig ? themeConfig.mixPattern : 'humanBorder';
        
        // Get the original hex colors and transparencies
        let bgHex, bgTransparency, borderHex, borderTransparency;
        
        switch (mixPattern) {
          case 'aiBorder':
            bgColor = humanColor;
            borderColor = aiColor;
            // For border bar, use border opacity if available
            if (themeConfig && themeConfig.permissions) {
              bgHex = humanPermConfig?.color;
              bgTransparency = humanPermConfig?.transparency || 0.5;
              borderHex = aiPermConfig?.color;
              borderTransparency = aiPermConfig?.borderOpacity || aiPermConfig?.transparency || 0.5;
            }
            break;
          case 'humanBorder':
            bgColor = aiColor;
            borderColor = humanColor;
            // For border bar, use border opacity if available
            if (themeConfig && themeConfig.permissions) {
              bgHex = aiPermConfig?.color;
              bgTransparency = aiPermConfig?.transparency || 0.5;
              borderHex = humanPermConfig?.color;
              borderTransparency = humanPermConfig?.borderOpacity || humanPermConfig?.transparency || 0.5;
            }
            break;
          case 'aiPriority':
            bgColor = borderColor = aiColor;
            if (themeConfig && themeConfig.permissions) {
              bgHex = borderHex = aiPermConfig?.color;
              bgTransparency = aiPermConfig?.transparency || 0.5;
              borderTransparency = aiPermConfig?.borderOpacity || aiPermConfig?.transparency || 0.5;
            }
            break;
          case 'humanPriority':
            bgColor = borderColor = humanColor;
            if (themeConfig && themeConfig.permissions) {
              bgHex = borderHex = humanPermConfig?.color;
              bgTransparency = humanPermConfig?.transparency || 0.5;
              borderTransparency = humanPermConfig?.borderOpacity || humanPermConfig?.transparency || 0.5;
            }
            break;
          case 'average':
            // For average, both get the same blended color (we can't blend ANSI easily)
            // So we'll just use AI color for simplicity
            bgColor = borderColor = aiColor;
            if (themeConfig && themeConfig.permissions) {
              bgHex = borderHex = aiPermConfig?.color;
              bgTransparency = aiPermConfig?.transparency || 0.5;
              borderTransparency = aiPermConfig?.borderOpacity || aiPermConfig?.transparency || 0.5;
            }
            break;
          default:
            bgColor = aiColor;
            borderColor = humanColor;
            if (themeConfig && themeConfig.permissions) {
              bgHex = aiPermConfig?.color;
              bgTransparency = aiPermConfig?.transparency || 0.5;
              borderHex = humanPermConfig?.color;
              borderTransparency = humanPermConfig?.borderOpacity || humanPermConfig?.transparency || 0.5;
            }
        }
        
        // If ANSI colors are the same but transparencies differ, use different variants
        if (bgColor === borderColor && bgHex && borderHex && bgTransparency !== borderTransparency) {
          // Recalculate border color with its actual transparency to get different variant
          borderColor = hexToAnsi(borderHex, borderTransparency);
          if (process.env.DEBUG && lineNum <= 5) {
            console.error(`  Recalculated border: transparency=${borderTransparency} -> ${borderColor}`);
          }
        }
      } else if (aiEnabled) {
        bgColor = borderColor = aiColor;
        // Handle single color case
        if (themeConfig && themeConfig.permissions && aiPermConfig) {
          const borderTransparency = aiPermConfig.borderOpacity || aiPermConfig.transparency || 0.5;
          if (borderTransparency !== aiPermConfig.transparency) {
            borderColor = hexToAnsi(aiPermConfig.color, borderTransparency);
          }
        }
      } else if (humanEnabled) {
        bgColor = borderColor = humanColor;
        // Handle single color case
        if (themeConfig && themeConfig.permissions && humanPermConfig) {
          const borderTransparency = humanPermConfig.borderOpacity || humanPermConfig.transparency || 0.5;
          if (borderTransparency !== humanPermConfig.transparency) {
            borderColor = hexToAnsi(humanPermConfig.color, borderTransparency);
          }
        }
      }
      
      // Set text color based on background
      if (bgColor) {
        textColor = bgColor.includes('41') || bgColor.includes('44') || bgColor.includes('45') ? colors.white : colors.black;
      }
      
      // Handle mixed permissions - use a special border character
      if (isMixed) {
        //borderChar = '█'; // Block character for better visibility
        borderChar = '▒'; // Use a lighter block character for mixed
      }
      
      // Apply colors separately to border and content
      if (bgColor || borderColor) {
        // Debug first few lines
        if (lineNum <= 5 && process.env.DEBUG) {
          console.error(`Line ${lineNum}: aiEnabled=${aiEnabled}, humanEnabled=${humanEnabled}`);
          console.error(`  bgColor='${bgColor}', borderColor='${borderColor}'`);
          console.error(`  mixPattern=${themeConfig?.mixPattern}`);
        }
        
        // Format: line# [perms]|content (where | is the colored border char)
        if (borderColor && bgColor && borderColor !== bgColor) {
          // Different colors for border and background
          console.log(`${lineNumStr} ${permBlock}${borderColor}${borderChar}${colors.reset}${bgColor}${textColor}${lines[i]}${colors.reset}`);
        } else if (bgColor) {
          // Same color for both or no border color
          console.log(`${lineNumStr} ${permBlock}${bgColor}${textColor}${borderChar}${lines[i]}${colors.reset}`);
        } else if (borderColor) {
          // Only border color
          console.log(`${lineNumStr} ${permBlock}${borderColor}${borderChar}${colors.reset} ${lines[i]}`);
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

/**
 * Build validation package using the plugin's guard processing
 */
async function buildValidationPackage(filePath, content) {
  const languageId = detectLanguage(filePath);
  const document = new CLIDocument(content, languageId);
  const lines = content.split('\n');
  
  // Use the plugin's guard parser
  const guardTags = await parseGuardTagsChunked(document, lines);
  
  // Create guard regions using the plugin's logic
  const guardRegions = createGuardRegions(guardTags, lines.length);
  
  // Convert to validation format
  const validationRegions = guardRegions.map((tag, index) => ({
    index: index,
    guard: `@guard:${tag.target}:${tag.permission}`,
    parsed_guard: {
      raw: `@guard:${tag.target}:${tag.permission}`,
      target: tag.target,
      identifiers: tag.identifier ? tag.identifier.split(',') : ['*'],
      permission: mapPermission(tag.permission),
      scope: tag.scope || 'file',
      scope_modifiers: []
    },
    declaration_line: tag.lineNumber,
    start_line: tag.scopeStart || tag.lineNumber,
    end_line: tag.scopeEnd || lines.length,
    content_hash: '', // Simplified for testing
    content_preview: lines[tag.lineNumber - 1].trim().substring(0, 50) + '...'
  }));
  
  // Compute line coverage
  const lineCoverage = [];
  for (let line = 1; line <= lines.length; line++) {
    const applicableGuards = validationRegions
      .filter(r => line >= r.start_line && line <= r.end_line)
      .map(r => r.index);
    
    if (applicableGuards.length > 0) {
      lineCoverage.push({
        line,
        guards: applicableGuards
      });
    }
  }
  
  const fileHash = crypto.createHash('sha256').update(content).digest('hex');
  
  return {
    validation_request: {
      file_path: path.resolve(filePath),
      file_hash: fileHash,
      total_lines: lines.length,
      timestamp: new Date().toISOString(),
      plugin_version: '1.0.0',
      plugin_name: 'CodeGuard VS Code Plugin',
      guard_regions: validationRegions,
      line_coverage: lineCoverage,
      validation_metadata: {
        parser_used: 'tree-sitter',
        language: languageId,
        encoding: 'utf-8',
        supports_overlapping: true
      }
    }
  };
}

/**
 * Execute validation
 */
async function validateWithTool(validationPackage) {
  const tempFile = path.join(__dirname, `temp_validation_${Date.now()}.json`);
  
  try {
    // Write validation package to temp file
    await fs.promises.writeFile(tempFile, JSON.stringify(validationPackage, null, 2));
    
    // Execute codeguard CLI
    const command = `codeguard validate-sections --json-file "${tempFile}"`;
    console.log(`Executing: ${command}\n`);
    
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
      return { exitCode: 0, stdout, stderr };
    } catch (error) {
      return { 
        exitCode: error.code || 1, 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      };
    }
  } finally {
    // Cleanup temp file
    try {
      await fs.promises.unlink(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Format and display results
 */
function displayResults(result, validationPackage) {
  console.log('='.repeat(60));
  console.log('VALIDATION RESULTS');
  console.log('='.repeat(60));
  
  console.log(`\nExit Code: ${result.exitCode}`);
  
  if (result.stderr) {
    console.log(`\nStderr:\n${result.stderr}`);
  }
  
  // Try to parse JSON response
  try {
    const response = JSON.parse(result.stdout);
    
    if (response.validation_result) {
      const vr = response.validation_result;
      console.log(`\nStatus: ${vr.status}`);
      console.log(`Tool Version: ${vr.tool_version}`);
      console.log(`Plugin Version: ${vr.plugin_version}`);
      
      if (vr.statistics) {
        console.log('\nStatistics:');
        console.log(`  Total Lines: ${vr.statistics.total_lines}`);
        console.log(`  Plugin Guard Regions: ${vr.statistics.plugin_guard_regions}`);
        console.log(`  Tool Guard Regions: ${vr.statistics.tool_guard_regions}`);
        console.log(`  Matching Regions: ${vr.statistics.matching_regions}`);
        console.log(`  Discrepancy Count: ${vr.statistics.discrepancy_count}`);
      }
      
      if (vr.discrepancies && vr.discrepancies.length > 0) {
        console.log('\nDiscrepancies:');
        vr.discrepancies.slice(0, 5).forEach((d, i) => {
          console.log(`\n  ${i + 1}. ${d.type} (${d.severity})`);
          console.log(`     ${d.message}`);
          if (d.plugin_region && d.tool_region) {
            console.log(`     Plugin: [${d.plugin_region.start_line}-${d.plugin_region.end_line}]`);
            console.log(`     Tool:   [${d.tool_region.start_line}-${d.tool_region.end_line}]`);
          }
        });
        if (vr.discrepancies.length > 5) {
          console.log(`\n  ... and ${vr.discrepancies.length - 5} more discrepancies`);
        }
      }
      
      // Show summary
      console.log('\n' + '='.repeat(60));
      if (result.exitCode === 0) {
        console.log('✅ SUCCESS: Parser output matches tool perfectly!');
      } else if (result.exitCode === 1) {
        console.log(`❌ MISMATCH: Found ${vr.statistics.discrepancy_count} discrepancies`);
        console.log('\nThis indicates the plugin parser and tool parser are out of sync.');
        console.log('Please investigate the discrepancies above.');
      } else {
        console.log('❌ ERROR: Validation failed');
      }
    }
  } catch (e) {
    console.log('\nRaw output:');
    console.log(result.stdout.substring(0, 1000));
    if (result.stdout.length > 1000) {
      console.log('... (truncated)');
    }
  }
  
  // Show our parsed guards for debugging
  console.log('\n' + '='.repeat(60));
  console.log('PARSED GUARD REGIONS:');
  console.log('='.repeat(60));
  validationPackage.validation_request.guard_regions.forEach(r => {
    console.log(`${r.index}. ${r.guard} [${r.start_line}-${r.end_line}] declared at line ${r.declaration_line}`);
  });
}

/**
 * List available themes
 */
function listThemes() {
  console.log('Available Themes:');
  console.log('=================\n');
  
  // Built-in themes from the actual extension
  console.log('Built-in Themes:');
  try {
    const colorCustomizerPath = path.join(__dirname, '..', 'src', 'tools', 'colorCustomizer.ts');
    const content = fs.readFileSync(colorCustomizerPath, 'utf8');
    
    // Extract theme names from THEME_CONFIGS
    const themeMatches = content.matchAll(/{\s*name:\s*['"](\w+)['"]/g);
    const themes = [];
    for (const match of themeMatches) {
      themes.push(match[1]);
    }
    
    if (themes.length > 0) {
      themes.forEach(name => {
        console.log(`  ${name.padEnd(12)}`);
      });
    } else {
      console.log('  default      - Red for AI no access, Green for human no access');
      console.log('  (Unable to parse themes from extension)');
    }
  } catch (e) {
    // Fallback if we can't read the file
    console.log('  default      - Red for AI no access, Green for human no access');
    console.log('  (Unable to load themes from extension)');
  }
  
  // Try to load custom themes from VSCode settings
  try {
    const os = require('os');
    const platform = os.platform();
    const homeDir = os.homedir();
    
    const settingsPaths = [];
    if (platform === 'darwin') {
      settingsPaths.push(
        path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'settings.json'),
        path.join(homeDir, '.config', 'Code', 'User', 'settings.json')
      );
    } else if (platform === 'win32') {
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
    
    let customThemes = {};
    let currentTheme = 'default';
    
    for (const settingsPath of settingsPaths) {
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (settings['tumee-vscode-plugin.customThemes']) {
          Object.assign(customThemes, settings['tumee-vscode-plugin.customThemes']);
        }
        if (settings['tumee-vscode-plugin.currentTheme']) {
          currentTheme = settings['tumee-vscode-plugin.currentTheme'];
        }
      }
    }
    
    if (Object.keys(customThemes).length > 0) {
      console.log('\nCustom Themes:');
      for (const themeName of Object.keys(customThemes)) {
        console.log(`  ${themeName}${themeName === currentTheme ? ' (current)' : ''}`);
      }
    }
    
    console.log(`\nCurrent VSCode theme: ${currentTheme}`);
    
  } catch (e) {
    // Ignore errors
  }
  
  console.log('\nUsage:');
  console.log('  ./visualguard.sh --theme <name> <file>');
  console.log('  ./visualguard.sh --theme colorblind examples/api-key-manager.js');
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Check for list themes flag first
  if (args.includes('--list-themes')) {
    listThemes();
    process.exit(0);
  }
  
  // Parse command line options
  let outputFormat = 'json';
  let filePath = null;
  let themeName = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output-format' && i + 1 < args.length) {
      outputFormat = args[i + 1];
      i++; // Skip next arg
    } else if (args[i] === '--theme' && i + 1 < args.length) {
      themeName = args[i + 1];
      i++; // Skip next arg
    } else if (!args[i].startsWith('--')) {
      filePath = args[i];
    }
  }
  
  if (!filePath) {
    console.log('Usage: node tests/cli-parser-test.js [options] <filepath>');
    console.log('\nOptions:');
    console.log('  --output-format <format>  Output format: json (default), debug, or color');
    console.log('  --theme <name>           Theme name (default, inverted, colorblind, ocean, etc.)');
    console.log('\nOutput formats:');
    console.log('  json   - Validate with CodeGuard CLI and show results');
    console.log('  debug  - Show line-by-line permissions with context markers (no colors)');
    console.log('  color  - Show line-by-line with colored backgrounds (terminal colors)');
    console.log('\nThemes:');
    console.log('  The color output will use your VSCode theme settings if available.');
    console.log('  Override with --theme to test different themes.');
    console.log('\nExamples:');
    console.log('  node tests/cli-parser-test.js examples/api-key-manager.py');
    console.log('  node tests/cli-parser-test.js --output-format debug examples/api-key-manager.py');
    console.log('  node tests/cli-parser-test.js --output-format color examples/api-key-manager.js');
    console.log('  node tests/cli-parser-test.js --output-format color --theme inverted examples/api-key-manager.js');
    console.log('\nNote: The visualguard.sh script defaults to color output.');
    console.log('      Use ./visualguard.sh --no-color <file> to disable colors.');
    console.log('\nThis test uses the SAME guard processing engine as the VS Code plugin.');
    process.exit(1);
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  console.log(`Testing parser with file: ${filePath}`);
  console.log(`Language detected: ${detectLanguage(filePath)}`);
  console.log('Using plugin guard processing engine...\n');
  
  try {
    // Read file content
    const content = await fs.promises.readFile(filePath, 'utf8');
    
    if (outputFormat === 'debug') {
      // Generate debug output
      await generateDebugOutput(filePath, content, false, themeName);
      process.exit(0);
    } else if (outputFormat === 'color') {
      // Generate colored debug output
      await generateDebugOutput(filePath, content, true, themeName);
      process.exit(0);
    } else {
      // Original JSON validation flow
      // Build validation package using the plugin's guard processor
      const validationPackage = await buildValidationPackage(filePath, content);
      
      console.log(`Found ${validationPackage.validation_request.guard_regions.length} guard regions`);
      
      // Validate with tool
      const result = await validateWithTool(validationPackage);
      
      // Display results
      displayResults(result, validationPackage);
      
      // Exit with same code as validation
      process.exit(result.exitCode === 0 || result.exitCode === 1 ? 0 : result.exitCode);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run main function
main().catch(console.error);