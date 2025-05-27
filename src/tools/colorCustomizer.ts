import * as vscode from 'vscode';
import { getWebviewStyles, getWebviewJavaScript } from './colorCustomizer/webviewContent';
import { MixPattern, DEFAULT_MIX_PATTERN } from '../types/mixPatterns';

export interface PermissionColorConfig {
  enabled: boolean;                // Whether to use own color or other's
  color: string;                   // Base color
  transparency: number;            // Transparency level (0-1)
  borderOpacity?: number;          // Optional border opacity (0-1)
  minimapColor?: string;           // Optional custom minimap color
}

export interface GuardColors {
  // Per-permission configurations
  permissions: {
    aiWrite: PermissionColorConfig;
    aiRead: PermissionColorConfig;
    aiNoAccess: PermissionColorConfig;
    humanWrite: PermissionColorConfig;
    humanRead: PermissionColorConfig;
    humanNoAccess: PermissionColorConfig;
    contextRead: PermissionColorConfig;
    contextWrite: PermissionColorConfig;
  };

  // Global border bar toggle only
  borderBarEnabled: boolean;       // Enable border bar
  
  // Mix pattern for when both AI and human permissions are non-default
  mixPattern?: MixPattern;

  // Optional custom colors for specific combinations
  combinations?: {
    aiRead_humanRead?: string;
    aiRead_humanWrite?: string;
    aiRead_humanNoAccess?: string;
    aiWrite_humanRead?: string;
    aiWrite_humanWrite?: string;
    aiWrite_humanNoAccess?: string;
    aiNoAccess_humanRead?: string;
    aiNoAccess_humanWrite?: string;
    aiNoAccess_humanNoAccess?: string;
    aiReadContext_humanRead?: string;
    aiReadContext_humanWrite?: string;
    aiReadContext_humanNoAccess?: string;
    aiWriteContext_humanRead?: string;
    aiWriteContext_humanWrite?: string;
    aiWriteContext_humanNoAccess?: string;
  };
}

// Theme definition interface
interface ThemeDefinition {
  name: string;
  permissions: {
    [key: string]: { enabled: boolean; color: string; transparency: number };
  };
  borderBarEnabled: boolean;
  mixPattern?: MixPattern;
}

// Default colors (Light theme)
export const DEFAULT_COLORS: GuardColors = {
  permissions: {
    aiWrite: { enabled: true, color: '#FFA500', transparency: 0.2 },
    aiRead: { enabled: true, color: '#808080', transparency: 0.15 },
    aiNoAccess: { enabled: true, color: '#90EE90', transparency: 0.2 },
    humanWrite: { enabled: false, color: '#0000FF', transparency: 0.2 },
    humanRead: { enabled: true, color: '#D3D3D3', transparency: 0.3 },
    humanNoAccess: { enabled: true, color: '#FF0000', transparency: 0.25 },
    contextRead: { enabled: true, color: '#00CED1', transparency: 0.15 },
    contextWrite: { enabled: true, color: '#1E90FF', transparency: 0.15 }
  },
  borderBarEnabled: true,
  mixPattern: DEFAULT_MIX_PATTERN
};

// Theme configurations as data
const THEME_CONFIGS: ThemeDefinition[] = [
  {
    name: 'light',
    permissions: {
      aiWrite: { enabled: true, color: '#FFA500', transparency: 0.2 },
      aiRead: { enabled: true, color: '#808080', transparency: 0.15 },
      aiNoAccess: { enabled: true, color: '#90EE90', transparency: 0.2 },
      humanWrite: { enabled: false, color: '#0000FF', transparency: 0.2 },
      humanRead: { enabled: true, color: '#D3D3D3', transparency: 0.3 },
      humanNoAccess: { enabled: true, color: '#FF0000', transparency: 0.25 },
      contextRead: { enabled: true, color: '#00CED1', transparency: 0.15 },
      contextWrite: { enabled: true, color: '#1E90FF', transparency: 0.15 }
    },
    borderBarEnabled: true,
    mixPattern: MixPattern.HUMAN_BORDER
  },
  {
    name: 'dark',
    permissions: {
      aiWrite: { enabled: true, color: '#FF8C00', transparency: 0.4 },
      aiRead: { enabled: true, color: '#696969', transparency: 0.3 },
      aiNoAccess: { enabled: true, color: '#32CD32', transparency: 0.35 },
      humanWrite: { enabled: false, color: '#4169E1', transparency: 0.4 },
      humanRead: { enabled: true, color: '#A9A9A9', transparency: 0.5 },
      humanNoAccess: { enabled: true, color: '#DC143C', transparency: 0.4 },
      contextRead: { enabled: true, color: '#20B2AA', transparency: 0.3 },
      contextWrite: { enabled: true, color: '#4682B4', transparency: 0.3 }
    },
    borderBarEnabled: true,
    mixPattern: MixPattern.HUMAN_BORDER
  },
  {
    name: 'highContrast',
    permissions: {
      aiWrite: { enabled: true, color: '#FFFF00', transparency: 1.0 },
      aiRead: { enabled: true, color: '#C0C0C0', transparency: 1.0 },
      aiNoAccess: { enabled: true, color: '#00FF00', transparency: 1.0 },
      humanWrite: { enabled: true, color: '#0000FF', transparency: 1.0 },
      humanRead: { enabled: true, color: '#808080', transparency: 1.0 },
      humanNoAccess: { enabled: true, color: '#FF0000', transparency: 1.0 },
      contextRead: { enabled: true, color: '#00FFFF', transparency: 1.0 },
      contextWrite: { enabled: true, color: '#FF00FF', transparency: 1.0 }
    },
    borderBarEnabled: true,
    mixPattern: MixPattern.HUMAN_BORDER
  },
  {
    name: 'colorblind',
    permissions: {
      aiWrite: { enabled: true, color: '#E69F00', transparency: 0.4 },
      aiRead: { enabled: true, color: '#999999', transparency: 0.3 },
      aiNoAccess: { enabled: true, color: '#009E73', transparency: 0.4 },
      humanWrite: { enabled: false, color: '#0072B2', transparency: 0.4 },
      humanRead: { enabled: true, color: '#CC79A7', transparency: 0.5 },
      humanNoAccess: { enabled: true, color: '#D55E00', transparency: 0.4 },
      contextRead: { enabled: true, color: '#56B4E9', transparency: 0.3 },
      contextWrite: { enabled: true, color: '#F0E442', transparency: 0.3 }
    },
    borderBarEnabled: true,
    mixPattern: MixPattern.HUMAN_BORDER
  },
  {
    name: 'ocean',
    permissions: {
      aiWrite: { enabled: true, color: '#00CED1', transparency: 0.4 },
      aiRead: { enabled: true, color: '#4682B4', transparency: 0.3 },
      aiNoAccess: { enabled: true, color: '#20B2AA', transparency: 0.4 },
      humanWrite: { enabled: false, color: '#1E90FF', transparency: 0.4 },
      humanRead: { enabled: true, color: '#87CEEB', transparency: 0.5 },
      humanNoAccess: { enabled: true, color: '#000080', transparency: 0.4 },
      contextRead: { enabled: true, color: '#48D1CC', transparency: 0.3 },
      contextWrite: { enabled: true, color: '#00BFFF', transparency: 0.3 }
    },
    borderBarEnabled: true,
    mixPattern: MixPattern.HUMAN_BORDER
  },
  {
    name: 'sunset',
    permissions: {
      aiWrite: { enabled: true, color: '#FF6347', transparency: 0.4 },
      aiRead: { enabled: true, color: '#FFA07A', transparency: 0.3 },
      aiNoAccess: { enabled: true, color: '#FFD700', transparency: 0.4 },
      humanWrite: { enabled: false, color: '#FF1493', transparency: 0.4 },
      humanRead: { enabled: true, color: '#FF69B4', transparency: 0.5 },
      humanNoAccess: { enabled: true, color: '#8B0000', transparency: 0.4 },
      contextRead: { enabled: true, color: '#FF8C00', transparency: 0.3 },
      contextWrite: { enabled: true, color: '#FFA500', transparency: 0.3 }
    },
    borderBarEnabled: true,
    mixPattern: MixPattern.HUMAN_BORDER
  },
  {
    name: 'matrix',
    permissions: {
      aiWrite: { enabled: true, color: '#00FF00', transparency: 0.5 },
      aiRead: { enabled: true, color: '#32CD32', transparency: 0.4 },
      aiNoAccess: { enabled: true, color: '#008000', transparency: 0.5 },
      humanWrite: { enabled: false, color: '#00FF00', transparency: 0.4 },
      humanRead: { enabled: true, color: '#90EE90', transparency: 0.5 },
      humanNoAccess: { enabled: true, color: '#006400', transparency: 0.4 },
      contextRead: { enabled: true, color: '#7FFF00', transparency: 0.3 },
      contextWrite: { enabled: true, color: '#9ACD32', transparency: 0.3 }
    },
    borderBarEnabled: true,
    mixPattern: MixPattern.HUMAN_BORDER
  },
  {
    name: 'neon',
    permissions: {
      aiWrite: { enabled: true, color: '#FF1493', transparency: 0.6 },
      aiRead: { enabled: true, color: '#00FFFF', transparency: 0.5 },
      aiNoAccess: { enabled: true, color: '#FFFF00', transparency: 0.6 },
      humanWrite: { enabled: false, color: '#FF00FF', transparency: 0.5 },
      humanRead: { enabled: true, color: '#00FF00', transparency: 0.6 },
      humanNoAccess: { enabled: true, color: '#FF4500', transparency: 0.5 },
      contextRead: { enabled: true, color: '#7FFF00', transparency: 0.5 },
      contextWrite: { enabled: true, color: '#FF69B4', transparency: 0.5 }
    },
    borderBarEnabled: true,
    mixPattern: MixPattern.HUMAN_BORDER
  },
  {
    name: 'pastel',
    permissions: {
      aiWrite: { enabled: true, color: '#FFB6C1', transparency: 0.5 },
      aiRead: { enabled: true, color: '#E6E6FA', transparency: 0.4 },
      aiNoAccess: { enabled: true, color: '#98FB98', transparency: 0.5 },
      humanWrite: { enabled: false, color: '#87CEFA', transparency: 0.5 },
      humanRead: { enabled: true, color: '#DDA0DD', transparency: 0.6 },
      humanNoAccess: { enabled: true, color: '#F0E68C', transparency: 0.5 },
      contextRead: { enabled: true, color: '#B0E0E6', transparency: 0.4 },
      contextWrite: { enabled: true, color: '#F5DEB3', transparency: 0.4 }
    },
    borderBarEnabled: true,
    mixPattern: MixPattern.HUMAN_BORDER
  },
  {
    name: 'cyberpunk',
    permissions: {
      aiWrite: { enabled: true, color: '#FF0080', transparency: 0.7 },
      aiRead: { enabled: true, color: '#00D9FF', transparency: 0.6 },
      aiNoAccess: { enabled: true, color: '#FFD300', transparency: 0.7 },
      humanWrite: { enabled: false, color: '#FF0080', transparency: 0.5 },
      humanRead: { enabled: true, color: '#00D9FF', transparency: 0.6 },
      humanNoAccess: { enabled: true, color: '#FF3131', transparency: 0.5 },
      contextRead: { enabled: true, color: '#9D00FF', transparency: 0.5 },
      contextWrite: { enabled: true, color: '#00FF88', transparency: 0.5 }
    },
    borderBarEnabled: true,
    mixPattern: MixPattern.AVERAGE
  }
];

// Convert theme configs to old format for compatibility
export const COLOR_THEMES: Record<string, { name: string; colors: GuardColors }> = {};
THEME_CONFIGS.forEach(theme => {
  COLOR_THEMES[theme.name] = {
    name: theme.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
    colors: {
      permissions: theme.permissions as GuardColors['permissions'],
      borderBarEnabled: theme.borderBarEnabled,
      mixPattern: theme.mixPattern
    }
  };
});

// Helper function to merge colors with defaults
function mergeWithDefaults(colors: Partial<GuardColors> | undefined): GuardColors {
  const merged = JSON.parse(JSON.stringify(DEFAULT_COLORS)) as GuardColors;

  if (colors?.permissions) {
    Object.keys(colors.permissions).forEach(key => {
      const permKey = key as keyof GuardColors['permissions'];
      if (merged.permissions[permKey] && colors.permissions && colors.permissions[permKey]) {
        Object.assign(merged.permissions[permKey], colors.permissions[permKey]);
      }
    });
  }

  if (colors?.borderBarEnabled !== undefined) {
    merged.borderBarEnabled = colors.borderBarEnabled;
  }
  
  if (colors?.mixPattern !== undefined) {
    merged.mixPattern = colors.mixPattern;
  }

  if (colors?.combinations) {
    merged.combinations = colors.combinations;
  }

  return merged;
}

export class ColorCustomizerPanel {
  public static currentPanel: ColorCustomizerPanel | undefined;
  public static readonly viewType = 'guardTagColorCustomizer';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _currentTheme: string = '';
  private _isSystemTheme: boolean = false;
  private _isDeleting: boolean = false;

  // Permission section configuration
  private static readonly PERMISSION_SECTIONS = [
    { id: 'aiWrite', title: 'AI Write', category: 'AI Permissions', defaultColor: '#FFA500', defaultEnabled: true },
    { id: 'aiRead', title: 'AI Read', category: 'AI Permissions', defaultColor: '#808080', defaultEnabled: true },
    { id: 'aiNoAccess', title: 'AI No Access', category: 'AI Permissions', defaultColor: '#90EE90', defaultEnabled: true },
    { id: 'humanWrite', title: 'Human Write', category: 'Human Permissions', defaultColor: '#0000FF', defaultEnabled: false },
    { id: 'humanRead', title: 'Human Read', category: 'Human Permissions', defaultColor: '#D3D3D3', defaultEnabled: true },
    { id: 'humanNoAccess', title: 'Human No Access', category: 'Human Permissions', defaultColor: '#FF0000', defaultEnabled: true },
    { id: 'contextRead', title: 'Context Read', category: 'Context', defaultColor: '#00CED1', defaultEnabled: true },
    { id: 'contextWrite', title: 'Context Write', category: 'Context', defaultColor: '#1E90FF', defaultEnabled: true }
  ];

  // Preview code lines configuration
  private static readonly PREVIEW_LINES = [
    { content: '// Mixed Permission Example - Shows current mix pattern', ai: null, human: null },
    { content: '// @guard:ai:r,human:r', ai: 'read', human: 'read' },
    { content: 'const sharedData = await loadSharedConfiguration();', ai: 'read', human: 'read' },
    { content: 'const settings = parseSettings(sharedData);', ai: 'read', human: 'read' },
    { content: 'console.log("Both AI and human can read this");', ai: 'read', human: 'read' },
    { content: '// @guard:end', ai: 'read', human: 'read' },
    { content: '', ai: null, human: null },
    { content: '// @guard:ai:w,human:r', ai: 'write', human: 'read' },
    { content: 'function processDataWithAI(userData) {', ai: 'write', human: 'read' },
    { content: '    // AI can modify, humans can only read', ai: 'write', human: 'read' },
    { content: '    return aiModel.enhance(userData);', ai: 'write', human: 'read' },
    { content: '}', ai: 'write', human: 'read' },
    { content: '// @guard:end', ai: 'write', human: 'read' },
    { content: '', ai: null, human: null },
    { content: '// Individual Permission Examples', ai: null, human: null },
    { content: '// @guard:ai:w', ai: 'write', human: null },
    { content: 'function generateReport(data: ReportData): string {', ai: 'write', human: null },
    { content: '    const formatted = formatData(data);', ai: 'write', human: null },
    { content: '    return createReportTemplate(formatted);', ai: 'write', human: null },
    { content: '}', ai: 'write', human: null },
    { content: '// @guard:end', ai: 'write', human: null },
    { content: '', ai: null, human: null },
    { content: '// @guard:ai:r', ai: 'read', human: null },
    { content: 'const config = await loadConfiguration();', ai: 'read', human: null },
    { content: 'const theme = config.get(\'theme\', \'light\');', ai: 'read', human: null },
    { content: 'applyTheme(theme);', ai: 'read', human: null },
    { content: '// @guard:end', ai: 'read', human: null },
    { content: '', ai: null, human: null },
    { content: '// @guard:ai:n', ai: 'noAccess', human: null },
    { content: 'const apiKey = process.env.SECRET_API_KEY;', ai: 'noAccess', human: null },
    { content: 'const dbPassword = process.env.DB_PASSWORD;', ai: 'noAccess', human: null },
    { content: 'const encryptionKey = generateSecureKey();', ai: 'noAccess', human: null },
    { content: '// @guard:end', ai: 'noAccess', human: null },
    { content: '', ai: null, human: null },
    { content: '// @guard:human:w', ai: null, human: 'write' },
    { content: 'function handleUserInput(input: UserInput): void {', ai: null, human: 'write' },
    { content: '    validateInput(input);', ai: null, human: 'write' },
    { content: '    processUserAction(input.action, input.data);', ai: null, human: 'write' },
    { content: '}', ai: null, human: 'write' },
    { content: '// @guard:end', ai: null, human: 'write' },
    { content: '', ai: null, human: null },
    { content: '// @guard:human:r', ai: null, human: 'read' },
    { content: 'const userPreferences = getUserPreferences();', ai: null, human: 'read' },
    { content: 'const displayLanguage = userPreferences.language || \'en\';', ai: null, human: 'read' },
    { content: 'initializeUI(displayLanguage);', ai: null, human: 'read' },
    { content: '// @guard:end', ai: null, human: 'read' },
    { content: '', ai: null, human: null },
    { content: '// @guard:human:n', ai: null, human: 'noAccess' },
    { content: 'const privateUserData = await fetchPrivateData();', ai: null, human: 'noAccess' },
    { content: 'const personalInfo = decryptUserInfo(privateUserData);', ai: null, human: 'noAccess' },
    { content: 'storeSecurely(personalInfo);', ai: null, human: 'noAccess' },
    { content: '// @guard:end', ai: null, human: 'noAccess' },
    { content: '', ai: null, human: null },
    { content: '// @guard:ai:context', ai: 'context', human: null },
    { content: '// API Reference: POST /api/reports', ai: 'context', human: null },
    { content: '// Expected payload: { data: ReportData, format: \'pdf\' | \'excel\' }', ai: 'context', human: null },
    { content: '// Returns: { url: string, expiresAt: Date }', ai: 'context', human: null },
    { content: '// @guard:end', ai: 'context', human: null },
    { content: '', ai: null, human: null },
    { content: '// @guard:ai:context:w', ai: 'contextWrite', human: null },
    { content: '// TODO: Update this section with new authentication flow', ai: 'contextWrite', human: null },
    { content: '// Need to document OAuth2 integration steps', ai: 'contextWrite', human: null },
    { content: '// Include examples for refresh token handling', ai: 'contextWrite', human: null },
    { content: '// @guard:end', ai: 'contextWrite', human: null },
    { content: '', ai: null, human: null }
  ];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ColorCustomizerPanel.currentPanel) {
      ColorCustomizerPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      ColorCustomizerPanel.viewType,
      'Guard Tag Color Customizer',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    ColorCustomizerPanel.currentPanel = new ColorCustomizerPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message: { command: string; colors?: GuardColors; theme?: string; name?: string; defaultAiWrite?: boolean; defaultHumanWrite?: boolean }) => {
        switch (message.command) {
          case 'saveColors':
            if (message.colors) {
              await this._saveColors(message.colors);
            }
            return;
          case 'getCurrentColors':
            this._sendCurrentColors();
            return;
          case 'applyTheme':
            if (message.theme) {
              await this._applyTheme(message.theme);
            }
            return;
          case 'saveAsNewTheme':
            if (message.name && message.colors) {
              await this._saveAsNewTheme(message.name, message.colors);
            }
            return;
          case 'deleteTheme':
            if (message.name) {
              await this._deleteTheme(message.name);
            }
            return;
          case 'exportTheme':
            void this._exportTheme();
            return;
          case 'importTheme':
            await this._importTheme();
            return;
          case 'requestThemeList':
            this._sendThemeList();
            return;
          case 'saveDefaultPermissions':
            await this._saveDefaultPermissions(message.defaultAiWrite || false, message.defaultHumanWrite || false);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  private async _saveColors(colors: GuardColors, fromTheme: boolean = false) {
    const config = vscode.workspace.getConfiguration('tumee-vscode-plugin');

    // If we're editing a system theme, prompt to create a new theme
    if (this._isSystemTheme && !fromTheme) {
      const themeName = await vscode.window.showInputBox({
        prompt: 'System themes cannot be modified. Enter a name for your custom theme:',
        placeHolder: 'My Custom Theme',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Theme name cannot be empty';
          }
          const customThemes = config.get<Record<string, GuardColors>>('customThemes', {});
          if (customThemes[value]) {
            return 'A theme with this name already exists';
          }
          return null;
        }
      });

      if (themeName) {
        await this._saveAsNewTheme(themeName, colors);
        this._currentTheme = themeName;
        this._isSystemTheme = false;
        await config.update('selectedTheme', themeName, vscode.ConfigurationTarget.Global);

        // Update the dropdown in the webview
        void this._panel.webview.postMessage({
          command: 'setSelectedTheme',
          theme: themeName
        });
      }
      return;
    }

    // If we have a current custom theme and not applying from theme selector
    if (this._currentTheme && !this._isSystemTheme && !fromTheme) {
      const customThemes = config.get<Record<string, GuardColors>>('customThemes', {});
      if (customThemes[this._currentTheme]) {
        customThemes[this._currentTheme] = colors;
        await config.update('customThemes', customThemes, vscode.ConfigurationTarget.Global);
        
        // If this is the currently selected theme, update guardColorsComplete too
        const selectedTheme = config.get<string>('selectedTheme');
        if (selectedTheme === this._currentTheme) {
          await config.update('guardColorsComplete', colors, vscode.ConfigurationTarget.Global);
        }
        
        void vscode.window.showInformationMessage(`Theme '${this._currentTheme}' updated successfully!`);
      }
      // Don't send colors back - webview already has current values
    } else if (!fromTheme) {
      await config.update('guardColorsComplete', colors, vscode.ConfigurationTarget.Global);
      await config.update('selectedTheme', '', vscode.ConfigurationTarget.Global);
      void vscode.window.showInformationMessage('Guard tag colors saved successfully!');
    } else {
      // This is fromTheme = true case, update the config
      await config.update('guardColorsComplete', colors, vscode.ConfigurationTarget.Global);
      // Send the new theme colors to update the UI
      void this._panel.webview.postMessage({
        command: 'updateColors',
        colors: colors
      });
    }
  }

  private _sendCurrentColors() {
    const config = vscode.workspace.getConfiguration('tumee-vscode-plugin');
    const savedColors = config.get<GuardColors>('guardColorsComplete');
    let colors: GuardColors;
    
    if (savedColors) {
      colors = mergeWithDefaults(savedColors);
    } else {
      // No saved colors, check if we have a selected theme
      const selectedTheme = config.get<string>('selectedTheme') || 'light';
      const theme = COLOR_THEMES[selectedTheme];
      if (theme) {
        colors = mergeWithDefaults(theme.colors);
      } else {
        colors = DEFAULT_COLORS;
      }
    }

    void this._panel.webview.postMessage({
      command: 'updateColors',
      colors: colors
    });
  }

  private async _applyTheme(themeName: string) {
    let theme = COLOR_THEMES[themeName];
    this._isSystemTheme = !!theme;

    if (!theme) {
      const config = vscode.workspace.getConfiguration('tumee-vscode-plugin');
      const customThemes = config.get<Record<string, GuardColors>>('customThemes', {});
      if (customThemes[themeName]) {
        theme = { name: themeName, colors: customThemes[themeName] };
        this._isSystemTheme = false;
      }
    }

    if (theme) {
      this._currentTheme = themeName;

      // Update colors without showing notification
      const config = vscode.workspace.getConfiguration('tumee-vscode-plugin');
      const mergedColors = mergeWithDefaults(theme.colors);
      await config.update('guardColorsComplete', mergedColors, vscode.ConfigurationTarget.Global);
      await config.update('selectedTheme', themeName, vscode.ConfigurationTarget.Global);

      void this._panel.webview.postMessage({
        command: 'updateColors',
        colors: mergedColors
      });

      // Send theme type info to webview
      void this._panel.webview.postMessage({
        command: 'setThemeType',
        isSystem: this._isSystemTheme
      });
    }
  }

  private async _saveAsNewTheme(name: string, colors: GuardColors) {
    const config = vscode.workspace.getConfiguration('tumee-vscode-plugin');
    const customThemes = config.get<Record<string, GuardColors>>('customThemes', {});
    customThemes[name] = colors;
    await config.update('customThemes', customThemes, vscode.ConfigurationTarget.Global);
    await config.update('selectedTheme', name, vscode.ConfigurationTarget.Global);

    this._currentTheme = name;
    this._isSystemTheme = false;

    void vscode.window.showInformationMessage(`Theme '${name}' saved successfully!`);
    this._sendThemeList();

    // Update the dropdown selection
    setTimeout(() => {
      void this._panel.webview.postMessage({
        command: 'setSelectedTheme',
        theme: name
      });
      void this._panel.webview.postMessage({
        command: 'setThemeType',
        isSystem: false
      });
    }, 100);
  }

  private async _deleteTheme(name: string) {
    // Prevent multiple simultaneous deletions
    if (this._isDeleting) {
      return;
    }
    
    this._isDeleting = true;
    
    try {
      // Show confirmation dialog
      const choice = await vscode.window.showWarningMessage(
        `Are you sure you want to delete the theme "${name}"?`,
        'Delete',
        'Cancel'
      );
      
      if (choice !== 'Delete') {
        return;
      }
      
      const config = vscode.workspace.getConfiguration('tumee-vscode-plugin');
      const customThemes = config.get<Record<string, GuardColors>>('customThemes', {});
      
      // Get list of all themes before deletion
      const allThemes = [...Object.keys(COLOR_THEMES), ...Object.keys(customThemes)];
      const currentIndex = allThemes.indexOf(name);
      
      // Create a shallow copy to avoid proxy issues
      const updatedThemes = { ...customThemes };
      delete updatedThemes[name];
      await config.update('customThemes', updatedThemes, vscode.ConfigurationTarget.Global);

      // Determine next theme to select
      let nextTheme = '';
      if (this._currentTheme === name) {
        // Remove the deleted theme from the list
        const remainingThemes = allThemes.filter(t => t !== name);
        
        if (remainingThemes.length > 0) {
          // Select the next theme in the list, or the previous one if we deleted the last theme
          const nextIndex = Math.min(currentIndex, remainingThemes.length - 1);
          nextTheme = remainingThemes[nextIndex];
        }
        
        // Apply the next theme or clear if no themes left
        if (nextTheme) {
          await this._applyTheme(nextTheme);
        } else {
          this._currentTheme = '';
          this._isSystemTheme = false;
          await config.update('selectedTheme', '', vscode.ConfigurationTarget.Global);
        }
      }

      void vscode.window.showInformationMessage(`Theme '${name}' deleted successfully!`);
      
      // Send the theme list update first
      this._sendThemeList();
      
      // Then send the deletion notification with a slight delay to ensure theme list is processed
      setTimeout(() => {
        void this._panel.webview.postMessage({
          command: 'themeDeleted',
          deletedTheme: name,
          nextTheme: nextTheme
        });
      }, 50);
    } finally {
      this._isDeleting = false;
    }
  }

  private async _saveDefaultPermissions(defaultAiWrite: boolean, defaultHumanWrite: boolean) {
    const config = vscode.workspace.getConfiguration('tumee-vscode-plugin');
    await config.update('defaultAiWrite', defaultAiWrite, vscode.ConfigurationTarget.Global);
    await config.update('defaultHumanWrite', defaultHumanWrite, vscode.ConfigurationTarget.Global);
  }

  private async _exportTheme() {
    const colors = await this._getCurrentColorsFromWebview();
    if (colors) {
      const json = JSON.stringify(colors, null, 2);
      void vscode.env.clipboard.writeText(json);
      void vscode.window.showInformationMessage('Theme copied to clipboard as JSON!');
    }
  }

  private async _importTheme() {
    try {
      const json = await vscode.env.clipboard.readText();

      if (!json || json.trim().length === 0) {
        void vscode.window.showErrorMessage('Clipboard is empty! Please copy a theme JSON first.');
        return;
      }

      const colors = JSON.parse(json) as GuardColors;

      if (!colors.permissions) {
        void vscode.window.showErrorMessage('Invalid theme format: missing permissions object');
        return;
      }

      const mergedColors = mergeWithDefaults(colors);
      void this._panel.webview.postMessage({
        command: 'updateColors',
        colors: mergedColors
      });
      void vscode.window.showInformationMessage('Theme imported from clipboard!');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      void vscode.window.showErrorMessage(`Failed to import theme: ${errorMessage}`);
      console.error('Import theme error:', e);
    }
  }

  private async _getCurrentColorsFromWebview(): Promise<GuardColors | undefined> {
    void this._panel.webview.postMessage({ command: 'requestCurrentColors' });

    return new Promise((resolve) => {
      const disposable = this._panel.webview.onDidReceiveMessage(
        (message: { command: string; colors?: GuardColors }) => {
          if (message.command === 'currentColors') {
            disposable.dispose();
            resolve(message.colors);
          }
        }
      );

      setTimeout(() => {
        disposable.dispose();
        resolve(undefined);
      }, 1000);
    });
  }

  private _sendThemeList() {
    const config = vscode.workspace.getConfiguration('tumee-vscode-plugin');
    const customThemes = config.get<Record<string, GuardColors>>('customThemes', {});

    const builtInThemes = Object.keys(COLOR_THEMES);
    const customThemeNames = Object.keys(customThemes);

    void this._panel.webview.postMessage({
      command: 'updateThemeList',
      builtIn: builtInThemes,
      custom: customThemeNames
    });
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = 'Guard Tag Color Customizer';
    this._panel.webview.html = this._getHtmlForWebview(webview);

    setTimeout(() => {
      this._sendThemeList();
      this._sendCurrentColors();

      const config = vscode.workspace.getConfiguration('tumee-vscode-plugin');
      let selectedTheme = config.get<string>('selectedTheme');
      
      // If no theme is selected, default to 'light'
      if (!selectedTheme) {
        selectedTheme = 'light';
        // Save the default theme selection
        void config.update('selectedTheme', selectedTheme, vscode.ConfigurationTarget.Global);
      }
      
      this._currentTheme = selectedTheme;
      this._isSystemTheme = !!COLOR_THEMES[selectedTheme];

      void this._panel.webview.postMessage({
        command: 'setSelectedTheme',
        theme: selectedTheme
      });

      void this._panel.webview.postMessage({
        command: 'setThemeType',
        isSystem: this._isSystemTheme
      });

      // Restore default permissions from user preferences
      const defaultAiWrite = config.get<boolean>('defaultAiWrite', false);
      const defaultHumanWrite = config.get<boolean>('defaultHumanWrite', true);
      
      void this._panel.webview.postMessage({
        command: 'restoreDefaultPermissions',
        defaultAiWrite: defaultAiWrite,
        defaultHumanWrite: defaultHumanWrite
      });
    }, 100);
  }

  private _generatePermissionSection(section: typeof ColorCustomizerPanel.PERMISSION_SECTIONS[0]): string {
    return `
      <div class="permission-section" onclick="focusPermission('${section.id}')">
        <div class="permission-header">
          <div class="permission-title">${section.title}</div>
          <div class="toggle-switch">
            <label>Enabled</label>
            <input type="checkbox" id="${section.id}-enabled" ${section.defaultEnabled ? 'checked' : ''} onchange="toggleEnabled('${section.id}')">
          </div>
        </div>
        <div class="permission-controls">
          <span class="link-icon linked" id="${section.id}-link" onclick="toggleColorLink(event, '${section.id}')" title="Link/unlink colors"></span>
          <div class="color-row">
            <div style="width: 20px;"></div>
            <div class="color-control">
              <div class="color-preview" id="${section.id}-minimapColor-preview" onclick="openColorPicker('${section.id}-minimapColor')"></div>
              <input type="color" id="${section.id}-minimapColor" class="color-input" value="${section.defaultColor}" onchange="updateMinimapColor('${section.id}')" style="display: none;">
              <label class="color-label">Minimap/Border</label>
            </div>
            <div class="slider-control">
              <label class="color-label">Border Opacity</label>
              <input type="range" id="${section.id}-borderOpacity" class="slider" min="0" max="100" value="100" oninput="updateSlider(this)">
              <span class="slider-value" id="${section.id}-borderOpacity-value">100%</span>
            </div>
          </div>
          <div class="color-row">
            <div style="width: 20px;"></div>
            <div class="color-control">
              <div class="color-preview" id="${section.id}-color-preview" onclick="openColorPicker('${section.id}-color')"></div>
              <input type="color" id="${section.id}-color" class="color-input" value="${section.defaultColor}" onchange="updateRowColor('${section.id}')" style="display: none;">
              <label class="color-label">Row</label>
            </div>
            <div class="slider-control">
              <label class="color-label">Row Opacity</label>
              <input type="range" id="${section.id}-transparency" class="slider" min="0" max="100" value="100" oninput="updateSlider(this)">
              <span class="slider-value" id="${section.id}-transparency-value">100%</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  private _generateCodeLine(index: number, content: string): string {
    return `
      <div class="code-line" id="line${index + 1}">
        <div class="line-border"></div>
        <div class="line-content">${this._escapeHtml(content)}</div>
      </div>`;
  }

  private _escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Use external module for CSS and JavaScript
    const css = getWebviewStyles();
    const javascript = getWebviewJavaScript(ColorCustomizerPanel.PREVIEW_LINES);
    
    const permissionSections = ColorCustomizerPanel.PERMISSION_SECTIONS.map(s => this._generatePermissionSection(s)).join('');
    const lineNumbers = Array.from({ length: 65 }, (_, i) => `<div class="line-number">${i + 1}</div>`).join('');
    const codeLines = ColorCustomizerPanel.PREVIEW_LINES.map((line, i) => this._generateCodeLine(i, line.content)).join('');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Guard Tag Theme Designer</title>
        <style>${css}</style>
    </head>
    <body>
        <div class="main-container">
            <div class="control-panel">
                <div class="control-header">
                    <h1>Guard Tag Theme Designer</h1>
                    
                    <div class="preset-selector">
                        <h2>Themes</h2>
                        <div class="theme-controls">
                            <select id="themeSelect" onchange="applyPreset(this.value)" style="width: 45%;">
                                ${Object.keys(COLOR_THEMES).map(key =>
    `<option value="${key}">${COLOR_THEMES[key].name}</option>`).join('')}
                            </select>
                            <select id="mixPatternSelect" onchange="updateMixPattern(this.value)" style="width: 45%; margin-left: 5px;">
                                <option value="aiBorder">AI Border</option>
                                <option value="aiPriority">AI Priority</option>
                                <option value="average">Average Blend</option>
                                <option value="humanBorder">Human Border</option>
                                <option value="humanPriority">Human Priority</option>
                            </select>
                            <button class="btn-icon" onclick="addNewTheme()" title="Add new theme">➕</button>
                            <button class="btn-icon" id="deleteThemeBtn" title="Delete theme" style="display: none;">🗑️</button>
                        </div>
                        <div id="themeStatus" class="theme-status" style="display: none; margin-top: 8px; font-size: 12px; color: var(--vscode-descriptionForeground);"></div>
                    </div>
                </div>
                
                <div class="control-content">
                    ${permissionSections}
                </div>
                
                <div class="control-footer">
                    <div class="buttons">
                        <div class="button-row">
                            <button class="btn btn-primary" onclick="saveColors()" disabled style="opacity: 0.5; cursor: not-allowed;">Apply Colors</button>
                            <button class="btn btn-secondary" onclick="resetColors()" disabled style="opacity: 0.5; cursor: not-allowed;">Reset</button>
                        </div>
                        <div class="button-row" style="margin-top: 10px;">
                            <button class="btn btn-secondary" onclick="exportTheme()">Export to Clipboard</button>
                            <button class="btn btn-secondary" onclick="importTheme()">Import from Clipboard</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="preview-panel">
                <div class="preview-scrollable">
                    <h1>Live Preview</h1>
                    
                    <div class="preview-controls">
                        <label>
                            <input type="checkbox" id="defaultAiWrite" onchange="updateDefaultPermissions()">
                            <span>AI Write</span>
                        </label>
                        <label>
                            <input type="checkbox" id="defaultHumanWrite" checked onchange="updateDefaultPermissions()">
                            <span>Human Write</span>
                        </label>
                    </div>
                    
                    <div class="code-preview">
                        <div class="editor-container">
                            <div class="line-numbers">${lineNumbers}</div>
                            <div class="editor-content">${codeLines}</div>
                        </div>
                    </div>
                </div>
                
                <div class="permission-examples-section">
                    <h2>Permission Examples</h2>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                        <div class="permission-example" id="ex-aiWrite">AI Write</div>
                        <div class="permission-example" id="ex-aiRead">AI Read</div>
                        <div class="permission-example" id="ex-aiNoAccess">AI No Access</div>
                        <div class="permission-example" id="ex-humanWrite">Human Write</div>
                        <div class="permission-example" id="ex-humanRead">Human Read</div>
                        <div class="permission-example" id="ex-humanNoAccess">Human No Access</div>
                        <div class="permission-example" id="ex-mixed1">AI Write + Human Read</div>
                        <div class="permission-example" id="ex-mixed2">AI Read + Human Write</div>
                        <div class="permission-example split-context">
                            <div class="context-half" id="ex-contextRead">Context R</div>
                            <div class="context-half" id="ex-contextWrite">Context W</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Theme name dialog overlay -->
        <div id="themeDialog" class="overlay">
            <div class="dialog">
                <h3>New Theme Name</h3>
                <input type="text" id="themeNameInput" placeholder="Enter theme name..." autofocus>
                <div class="dialog-buttons">
                    <button class="btn btn-secondary" onclick="closeThemeDialog()">Cancel</button>
                    <button class="btn btn-primary" onclick="confirmNewTheme()">Create</button>
                </div>
            </div>
        </div>
        
        <script>${javascript}</script>
    </body>
    </html>`;
  }



  public dispose() {
    ColorCustomizerPanel.currentPanel = undefined;
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

// Register the command
export function registerColorCustomizerCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('tumee-vscode-plugin.customizeColors', () => {
    ColorCustomizerPanel.createOrShow(context.extensionUri);
  });
}