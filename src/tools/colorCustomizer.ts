import * as vscode from 'vscode';
import { getWebviewStyles, getWebviewJavaScript } from './colorCustomizer/webviewContent';

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
}

// Default colors (Light theme)
const DEFAULT_COLORS: GuardColors = {
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
  borderBarEnabled: true
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
    borderBarEnabled: true
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
    borderBarEnabled: true
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
    borderBarEnabled: true
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
    borderBarEnabled: true
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
    borderBarEnabled: true
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
    borderBarEnabled: true
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
    borderBarEnabled: true
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
    borderBarEnabled: true
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
    borderBarEnabled: true
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
    borderBarEnabled: true
  }
];

// Convert theme configs to old format for compatibility
const COLOR_THEMES: Record<string, { name: string; colors: GuardColors }> = {};
THEME_CONFIGS.forEach(theme => {
  COLOR_THEMES[theme.name] = {
    name: theme.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
    colors: {
      permissions: theme.permissions as GuardColors['permissions'],
      borderBarEnabled: theme.borderBarEnabled
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
      async (message: { command: string; colors?: GuardColors; theme?: string; name?: string }) => {
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
        void vscode.window.showInformationMessage(`Theme '${this._currentTheme}' updated successfully!`);
      }
    } else {
      await config.update('guardColorsComplete', colors, vscode.ConfigurationTarget.Global);
      if (!fromTheme) {
        await config.update('selectedTheme', '', vscode.ConfigurationTarget.Global);
        void vscode.window.showInformationMessage('Guard tag colors saved successfully!');
      }
    }

    this._sendCurrentColors();
  }

  private _sendCurrentColors() {
    const config = vscode.workspace.getConfiguration('tumee-vscode-plugin');
    const colors = config.get<GuardColors>('guardColorsComplete') || DEFAULT_COLORS;

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
      await config.update('guardColorsComplete', theme.colors, vscode.ConfigurationTarget.Global);
      await config.update('selectedTheme', themeName, vscode.ConfigurationTarget.Global);

      void this._panel.webview.postMessage({
        command: 'updateColors',
        colors: theme.colors
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
    const config = vscode.workspace.getConfiguration('tumee-vscode-plugin');
    const customThemes = config.get<Record<string, GuardColors>>('customThemes', {});
    delete customThemes[name];
    await config.update('customThemes', customThemes, vscode.ConfigurationTarget.Global);

    // If we deleted the current theme, clear selection
    if (this._currentTheme === name) {
      this._currentTheme = '';
      this._isSystemTheme = false;
      await config.update('selectedTheme', '', vscode.ConfigurationTarget.Global);
    }

    void vscode.window.showInformationMessage(`Theme '${name}' deleted successfully!`);
    this._sendThemeList();

    // Reset dropdown to default
    void this._panel.webview.postMessage({
      command: 'themeDeleted',
      deletedTheme: name
    });
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
      const selectedTheme = config.get<string>('selectedTheme');
      if (selectedTheme) {
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
      }
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
    const lineNumbers = Array.from({ length: 50 }, (_, i) => `<div class="line-number">${i + 1}</div>`).join('');
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
                <h1>Guard Tag Theme Designer</h1>
                
                <div class="preset-selector">
                    <h2>Themes</h2>
                    <div class="theme-controls">
                        <select id="themeSelect" onchange="applyPreset(this.value)">
                            <option value="">Choose a theme...</option>
                            ${Object.keys(COLOR_THEMES).map(key =>
    `<option value="${key}">${COLOR_THEMES[key].name}</option>`).join('')}
                        </select>
                        <button class="btn-icon" onclick="addNewTheme()" title="Add new theme">➕</button>
                        <button class="btn-icon" id="deleteThemeBtn" onclick="deleteCurrentTheme()" title="Delete theme" style="display: none;">🗑️</button>
                    </div>
                    <div id="themeStatus" class="theme-status" style="display: none; margin-top: 8px; font-size: 12px; color: var(--vscode-descriptionForeground);"></div>
                </div>
                
                ${permissionSections}
                
                <div class="buttons">
                    <div class="button-row">
                        <button class="btn btn-primary" onclick="saveColors()">Apply Colors</button>
                        <button class="btn btn-secondary" onclick="resetColors()">Reset</button>
                    </div>
                    <div class="button-row" style="margin-top: 10px;">
                        <button class="btn btn-secondary" onclick="exportTheme()">Export to Clipboard</button>
                        <button class="btn btn-secondary" onclick="importTheme()">Import from Clipboard</button>
                    </div>
                </div>
            </div>
            
            <div class="preview-panel">
                <div class="preview-scrollable">
                    <h1>Live Preview</h1>
                    
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

  // Deprecated - moved to webviewContent.ts
  private _getStyles(): string {
    return `
      * { box-sizing: border-box; }
      
      body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-background);
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
      
      .main-container {
        display: flex;
        height: 100vh;
      }
      
      .control-panel {
        flex: 0 0 480px;
        background: var(--vscode-sideBar-background);
        border-right: 1px solid var(--vscode-panel-border);
        overflow-y: auto;
        padding: 20px;
        padding-bottom: 200px;
      }
      
      .preview-panel {
        flex: 1;
        background: var(--vscode-editor-background);
        padding: 20px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      h1 { margin: 0 0 16px 0; font-size: 20px; font-weight: 500; }
      h2 { margin: 20px 0 10px 0; font-size: 14px; text-transform: uppercase; opacity: 0.8; letter-spacing: 0.5px; }
      h3 { margin: 15px 0 10px 0; font-size: 13px; font-weight: 500; }
      
      .preset-selector { margin-bottom: 20px; }
      
      .theme-controls {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      
      .theme-controls select {
        flex: 1;
        padding: 8px;
        background: var(--vscode-dropdown-background);
        color: var(--vscode-dropdown-foreground);
        border: 1px solid var(--vscode-dropdown-border);
        border-radius: 4px;
      }
      
      .btn-icon {
        width: 32px;
        height: 32px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
        border-radius: 4px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        cursor: pointer;
        transition: all 0.2s;
        font-size: 16px;
      }
      
      .btn-icon:hover {
        background: var(--vscode-list-hoverBackground);
        transform: scale(1.05);
      }
      
      .btn-icon:active { transform: scale(0.95); }
      
      .permission-section {
        margin-bottom: 20px;
        padding: 15px;
        background: var(--vscode-input-background);
        border-radius: 4px;
        border: 2px solid transparent;
        transition: border-color 0.2s;
        cursor: pointer;
      }
      
      .permission-section:focus-within,
      .permission-section.focused {
        border-color: var(--vscode-focusBorder);
        background: var(--vscode-list-hoverBackground);
      }
      
      .permission-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 15px;
      }
      
      .toggle-switch {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }
      
      .toggle-switch input[type="checkbox"] {
        width: 40px;
        height: 20px;
        -webkit-appearance: none;
        appearance: none;
        background-color: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 20px;
        position: relative;
        cursor: pointer;
        transition: background-color 0.3s;
      }
      
      .toggle-switch input[type="checkbox"]:checked {
        background-color: var(--vscode-button-background);
      }
      
      .toggle-switch input[type="checkbox"]::before {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        top: 1px;
        left: 1px;
        background: var(--vscode-foreground);
        transition: transform 0.3s;
      }
      
      .toggle-switch input[type="checkbox"]:checked::before {
        transform: translateX(20px);
      }
      
      .disabled { opacity: 0.5; pointer-events: none; }
      
      .permission-title { font-size: 14px; font-weight: 500; }
      
      .permission-controls {
        display: flex;
        flex-direction: column;
        gap: 8px;
        position: relative;
      }
      
      .color-row {
        display: grid;
        grid-template-columns: 20px auto auto auto;
        align-items: center;
        gap: 10px;
      }
      
      .link-icon {
        position: absolute;
        left: 0;
        top: 28px;
        width: 20px;
        height: 20px;
        cursor: pointer;
        font-size: 16px;
        user-select: none;
        transition: opacity 0.2s;
      }
      
      .link-icon.linked::before { content: '🔒'; }
      .link-icon.unlinked::before { content: '✂️'; }
      
      .color-control {
        display: grid;
        grid-template-columns: 32px 80px;
        align-items: center;
        gap: 6px;
      }
      
      .color-input {
        width: 32px;
        height: 24px;
        border: 1px solid var(--vscode-input-border);
        border-radius: 3px;
        cursor: pointer;
      }
      
      .color-preview {
        width: 32px;
        height: 24px;
        border: 1px solid var(--vscode-input-border);
        border-radius: 3px;
        cursor: pointer;
        display: inline-block;
        background-color: var(--vscode-editor-background);
      }
      
      .color-label { font-size: 11px; white-space: nowrap; }
      
      .slider-control {
        display: grid;
        grid-template-columns: 100px 100px 40px;
        align-items: center;
        gap: 6px;
      }
      
      .slider {
        flex: 1;
        max-width: 100px;
        height: 4px;
        border-radius: 2px;
        background: var(--vscode-scrollbarSlider-background);
        outline: none;
        -webkit-appearance: none;
      }
      
      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--vscode-button-background);
        cursor: pointer;
      }
      
      .slider-value {
        font-family: monospace;
        font-size: 10px;
        min-width: 35px;
        text-align: right;
      }
      
      .code-preview {
        font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
        font-size: 9px;
        line-height: 14px;
        flex: 1;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      
      .editor-container {
        display: flex;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
      }
      
      .line-numbers {
        background: var(--vscode-editorGutter-background);
        padding: 5px 0;
        border-right: 1px solid var(--vscode-editorWidget-border);
        user-select: none;
        flex-shrink: 0;
      }
      
      .code-line {
        position: relative;
        height: 14px;
        white-space: nowrap;
        display: flex;
        margin: 0;
        overflow: visible;
      }
      
      .line-border {
        width: 3px;
        height: 14px;
        flex-shrink: 0;
      }
      
      .line-content {
        flex: 1;
        padding-left: 12px;
        height: 14px;
        line-height: 14px;
        margin: 0;
        white-space: pre;
        overflow: visible;
      }
      
      .line-number {
        display: block;
        width: 40px;
        color: var(--vscode-editorLineNumber-foreground);
        text-align: right;
        padding-right: 16px;
        padding-left: 8px;
        user-select: none;
        font-size: 9px;
        opacity: 0.6;
        height: 14px;
        line-height: 14px;
      }
      
      .editor-content {
        flex: 1;
        padding: 5px 0;
        overflow: visible;
        min-width: 0;
      }
      
      .buttons {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 480px;
        background: var(--vscode-sideBar-background);
        padding: 20px;
        border-top: 1px solid var(--vscode-panel-border);
        flex-direction: column;
        z-index: 100;
      }
      
      .button-row {
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: center;
      }
      
      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
      }
      
      .btn-primary {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }
      
      .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
      
      .btn-secondary {
        background: var(--vscode-secondaryButton-background);
        color: var(--vscode-secondaryButton-foreground);
      }
      
      .btn-secondary:hover { background: var(--vscode-list-hoverBackground); }
      
      input[type="text"] {
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        padding: 8px;
        border-radius: 4px;
        font-size: 13px;
      }
      
      input[type="text"]:focus { outline: 1px solid var(--vscode-focusBorder); }
      
      .overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        align-items: center;
        justify-content: center;
      }
      
      .overlay.show { display: flex; }
      
      .dialog {
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        padding: 24px;
        min-width: 300px;
        max-width: 400px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      }
      
      .dialog h3 { margin: 0 0 16px 0; font-size: 16px; font-weight: 500; }
      .dialog input[type="text"] { width: 100%; margin-bottom: 16px; }
      
      .dialog-buttons {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }
      
      .preview-scrollable {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        padding-bottom: 10px;
      }
      
      .permission-examples-section {
        flex-shrink: 0;
        padding-top: 10px;
        border-top: 1px solid var(--vscode-panel-border);
      }
      
      .permission-example {
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 12px;
        text-align: center;
        border: 1px solid var(--vscode-panel-border);
      }
      
      .split-context {
        display: flex;
        padding: 0;
        overflow: hidden;
      }
      
      .context-half {
        flex: 1;
        padding: 6px 5px;
        font-size: 12px;
        text-align: center;
      }
      
      .context-half:not(:first-child) {
        border-left: 1px solid var(--vscode-panel-border);
      }
    `;
  }

  // Deprecated - moved to webviewContent.ts
  private _getJavaScript(): string {
    return `
      const vscode = acquireVsCodeApi();
      let currentColors = null;
      let colorLinks = {};
      const PREVIEW_LINES = ${JSON.stringify(ColorCustomizerPanel.PREVIEW_LINES)};
      
      // Initialize on load
      window.addEventListener('load', () => {
        const permissions = ['aiWrite', 'aiRead', 'aiNoAccess', 'humanWrite', 'humanRead', 'humanNoAccess', 'contextRead', 'contextWrite'];
        permissions.forEach(perm => {
          colorLinks[perm] = true;
        });
        
        const themeNameInput = document.getElementById('themeNameInput');
        if (themeNameInput) {
          themeNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              confirmNewTheme();
            } else if (e.key === 'Escape') {
              closeThemeDialog();
            }
          });
        }
        
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            const dialog = document.getElementById('themeDialog');
            if (dialog && dialog.classList.contains('show')) {
              closeThemeDialog();
            }
          }
        });
      });
      
      // Handle messages from the extension
      window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
          case 'updateColors':
            updateAllColors(message.colors);
            break;
          case 'updateThemeList':
            updateThemeList(message.builtIn, message.custom);
            break;
          case 'requestCurrentColors':
            vscode.postMessage({
              command: 'currentColors',
              colors: getColors()
            });
            break;
          case 'setSelectedTheme':
            if (message.theme) {
              const themeSelect = document.getElementById('themeSelect');
              if (themeSelect) {
                themeSelect.value = message.theme;
                updateDeleteButton();
              }
            }
            break;
          case 'setThemeType':
            updateThemeStatus(message.isSystem);
            break;
          case 'themeDeleted':
            const themeSelect = document.getElementById('themeSelect');
            if (themeSelect && themeSelect.value === message.deletedTheme) {
              themeSelect.value = '';
              updateDeleteButton();
              updateThemeStatus(false);
            }
            // Request updated theme list from extension
            vscode.postMessage({ command: 'requestThemeList' });
            break;
        }
      });
      
      function openColorPicker(inputId) {
        document.getElementById(inputId).click();
      }
      window.openColorPicker = openColorPicker;
      
      function updateColorPreview(permission) {
        const minimapColor = document.getElementById(permission + '-minimapColor').value;
        const borderOpacity = (document.getElementById(permission + '-borderOpacity').value / 100) || 1;
        const minimapPreview = document.getElementById(permission + '-minimapColor-preview');
        if (minimapPreview) {
          const rgb = hexToRgb(minimapColor);
          if (rgb) {
            minimapPreview.style.backgroundColor = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + borderOpacity + ')';
          }
        }
        
        const rowColor = document.getElementById(permission + '-color').value;
        const rowOpacity = (document.getElementById(permission + '-transparency').value / 100) || 1;
        const rowPreview = document.getElementById(permission + '-color-preview');
        if (rowPreview) {
          const rgb = hexToRgb(rowColor);
          if (rgb) {
            rowPreview.style.backgroundColor = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + rowOpacity + ')';
          }
        }
      }
      
      function toggleColorLink(event, permission) {
        event.stopPropagation();
        colorLinks[permission] = !colorLinks[permission];
        const icon = document.getElementById(permission + '-link');
        icon.className = colorLinks[permission] ? 'link-icon linked' : 'link-icon unlinked';
        
        if (colorLinks[permission]) {
          const rowColor = document.getElementById(permission + '-color').value;
          document.getElementById(permission + '-minimapColor').value = rowColor;
        }
        updateColorPreview(permission);
      }
      window.toggleColorLink = toggleColorLink;
      
      function updateMinimapColor(permission) {
        const minimapColor = document.getElementById(permission + '-minimapColor').value;
        if (colorLinks[permission]) {
          document.getElementById(permission + '-color').value = minimapColor;
        }
        updateColorPreview(permission);
        updatePreview();
      }
      window.updateMinimapColor = updateMinimapColor;
      
      function updateRowColor(permission) {
        const rowColor = document.getElementById(permission + '-color').value;
        if (colorLinks[permission]) {
          document.getElementById(permission + '-minimapColor').value = rowColor;
        }
        updateColorPreview(permission);
        updatePreview();
      }
      window.updateRowColor = updateRowColor;
      
      function toggleEnabled(permission) {
        const enabled = document.getElementById(permission + '-enabled').checked;
        
        const controls = [
          document.getElementById(permission + '-color'),
          document.getElementById(permission + '-minimapColor'),
          document.getElementById(permission + '-transparency'),
          document.getElementById(permission + '-borderOpacity'),
          document.getElementById(permission + '-link')
        ];
        
        controls.forEach(control => {
          if (control) {
            if (enabled) {
              control.classList.remove('disabled');
              control.disabled = false;
            } else {
              control.classList.add('disabled');
              control.disabled = true;
            }
          }
        });
        
        const enabledCheckbox = document.getElementById(permission + '-enabled');
        if (enabledCheckbox) {
          const permissionSection = enabledCheckbox.closest('.permission-section');
          if (permissionSection) {
            const sliderControls = permissionSection.querySelectorAll('.slider-control, .color-control');
            sliderControls.forEach(control => {
              if (enabled) {
                control.classList.remove('disabled');
              } else {
                control.classList.add('disabled');
              }
            });
          }
        }
        
        updatePreview();
      }
      window.toggleEnabled = toggleEnabled;
      
      function updateSlider(slider) {
        const value = slider.value;
        document.getElementById(slider.id + '-value').textContent = value + '%';
        
        const permission = slider.id.split('-')[0];
        updateColorPreview(permission);
        updatePreview();
      }
      window.updateSlider = updateSlider;
      
      function updatePreview() {
        const colors = getColors();
        currentColors = colors;
        
        PREVIEW_LINES.forEach((config, index) => {
          updateLine(index + 1, config.ai, config.human);
        });
        
        updateExample('ex-aiWrite', 'ai', 'write');
        updateExample('ex-aiRead', 'ai', 'read');
        updateExample('ex-aiNoAccess', 'ai', 'noAccess');
        updateExample('ex-humanWrite', 'human', 'write');
        updateExample('ex-humanRead', 'human', 'read');
        updateExample('ex-humanNoAccess', 'human', 'noAccess');
        updateExample('ex-mixed1', 'both', { ai: 'write', human: 'read' });
        updateExample('ex-mixed2', 'both', { ai: 'read', human: 'write' });
        updateExample('ex-contextRead', 'ai', 'context');
        updateExample('ex-contextWrite', 'ai', 'contextWrite');
      }
      
      function updateLine(lineNum, aiPerm, humanPerm) {
        const line = document.getElementById('line' + lineNum);
        if (!line) return;
        
        const border = line.querySelector('.line-border');
        if (!border) return;
        
        const colors = getColors();
        
        let bgColor = '';
        let borderColor = '';
        let opacity = 1.0;
        let borderOpacity = 1.0;
        
        if (aiPerm && humanPerm) {
          const aiConfig = colors.permissions['ai' + capitalizeFirst(aiPerm)];
          const humanConfig = colors.permissions['human' + capitalizeFirst(humanPerm)];
          
          if (!aiConfig.enabled && !humanConfig.enabled) {
            bgColor = '';
          } else if (!aiConfig.enabled) {
            bgColor = humanConfig.color;
            opacity = humanConfig.transparency;
            borderColor = humanConfig.minimapColor || humanConfig.color;
            borderOpacity = humanConfig.borderOpacity || 1.0;
          } else if (!humanConfig.enabled) {
            bgColor = aiConfig.color;
            opacity = aiConfig.transparency;
            borderColor = aiConfig.minimapColor || aiConfig.color;
            borderOpacity = aiConfig.borderOpacity || 1.0;
          } else {
            bgColor = aiConfig.color;
            opacity = aiConfig.transparency;
            borderColor = aiConfig.minimapColor || aiConfig.color;
            borderOpacity = aiConfig.borderOpacity || 1.0;
          }
        } else if (aiPerm) {
          let configKey;
          if (aiPerm === 'context') {
            configKey = 'contextRead';
          } else if (aiPerm === 'contextWrite') {
            configKey = 'contextWrite';
          } else {
            configKey = 'ai' + capitalizeFirst(aiPerm);
          }
          
          const config = colors.permissions[configKey];
          if (config && config.enabled) {
            bgColor = config.color;
            opacity = config.transparency;
            borderColor = config.minimapColor || config.color;
            borderOpacity = config.borderOpacity || 1.0;
          }
        } else if (humanPerm) {
          const config = colors.permissions['human' + capitalizeFirst(humanPerm)];
          if (config && config.enabled) {
            bgColor = config.color;
            opacity = config.transparency;
            borderColor = config.minimapColor || config.color;
            borderOpacity = config.borderOpacity || 1.0;
          }
        }
        
        if (bgColor) {
          const rgb = hexToRgb(bgColor);
          if (rgb) {
            line.style.backgroundColor = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + opacity + ')';
          }
        } else {
          line.style.backgroundColor = '';
        }
        
        if (colors.borderBarEnabled && borderColor) {
          const rgb = hexToRgb(borderColor);
          if (rgb) {
            border.style.backgroundColor = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + borderOpacity + ')';
          }
        } else {
          border.style.backgroundColor = '';
        }
      }
      
      function updateExample(id, type, perm) {
        const elem = document.getElementById(id);
        if (!elem) return;
        
        const colors = getColors();
        
        let bgColor = '';
        let opacity = 1.0;
        let borderColor = '';
        let borderOpacity = 1.0;
        
        if (type === 'both') {
          const aiConfig = colors.permissions['ai' + capitalizeFirst(perm.ai)];
          const humanConfig = colors.permissions['human' + capitalizeFirst(perm.human)];
          
          if (!aiConfig.enabled && !humanConfig.enabled) {
            bgColor = '';
          } else if (!aiConfig.enabled) {
            bgColor = humanConfig.color;
            opacity = humanConfig.transparency;
            borderColor = humanConfig.minimapColor || humanConfig.color;
            borderOpacity = humanConfig.borderOpacity || 1.0;
          } else if (!humanConfig.enabled) {
            bgColor = aiConfig.color;
            opacity = aiConfig.transparency;
            borderColor = aiConfig.minimapColor || aiConfig.color;
            borderOpacity = aiConfig.borderOpacity || 1.0;
          } else {
            bgColor = aiConfig.color;
            opacity = aiConfig.transparency;
            borderColor = aiConfig.minimapColor || aiConfig.color;
            borderOpacity = aiConfig.borderOpacity || 1.0;
          }
        } else {
          let configKey;
          if (perm === 'context') {
            configKey = 'contextRead';
          } else if (perm === 'contextWrite') {
            configKey = 'contextWrite';
          } else if (type === 'ai') {
            configKey = 'ai' + capitalizeFirst(perm);
          } else {
            configKey = type + capitalizeFirst(perm);
          }
          
          const config = colors.permissions[configKey];
          if (config && config.enabled) {
            bgColor = config.color;
            opacity = config.transparency;
            borderColor = config.minimapColor || config.color;
            borderOpacity = config.borderOpacity || 1.0;
          }
        }
        
        if (bgColor) {
          const rgb = hexToRgb(bgColor);
          const borderRgb = hexToRgb(borderColor);
          if (rgb && borderRgb) {
            elem.style.backgroundColor = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + opacity + ')';
            elem.style.borderLeft = '3px solid rgba(' + borderRgb.r + ', ' + borderRgb.g + ', ' + borderRgb.b + ', ' + borderOpacity + ')';
          }
        } else {
          elem.style.backgroundColor = '';
          elem.style.borderLeft = '';
        }
        
        if (!elem.classList.contains('context-half')) {
          elem.style.padding = '8px 12px';
          elem.style.borderRadius = '4px';
          elem.style.fontSize = '12px';
        }
      }
      
      function capitalizeFirst(str) {
        if (str === 'noAccess') return 'NoAccess';
        return str.charAt(0).toUpperCase() + str.slice(1);
      }
      
      function hexToRgb(hex) {
        if (!hex) return null;
        
        hex = hex.trim();
        const result = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/i.exec(hex);
        
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      }
      
      function getColors() {
        const permissions = {};
        const permTypes = ['aiWrite', 'aiRead', 'aiNoAccess', 'humanWrite', 'humanRead', 'humanNoAccess', 'contextRead', 'contextWrite'];
        
        permTypes.forEach(perm => {
          const enabledElem = document.getElementById(perm + '-enabled');
          const borderOpacityElem = document.getElementById(perm + '-borderOpacity');
          const colorElem = document.getElementById(perm + '-color');
          const transElem = document.getElementById(perm + '-transparency');
          const minimapElem = document.getElementById(perm + '-minimapColor');
          
          const color = colorElem ? colorElem.value : '#000000';
          const minimapColor = minimapElem ? minimapElem.value : '#000000';
          
          permissions[perm] = {
            enabled: enabledElem ? enabledElem.checked : true,
            color: color,
            transparency: transElem ? (transElem.value / 100) : 0.2,
            borderOpacity: borderOpacityElem ? (borderOpacityElem.value / 100) : 1.0,
            minimapColor: minimapColor
          };
        });
        
        return {
          permissions: permissions,
          borderBarEnabled: true
        };
      }
      
      function updateAllColors(colors) {
        if (!colors || !colors.permissions) return;
        
        Object.entries(colors.permissions).forEach(([key, config]) => {
          const enabledElem = document.getElementById(key + '-enabled');
          if (enabledElem) {
            enabledElem.checked = config.enabled !== false;
            toggleEnabled(key);
          }
          
          const colorInput = document.getElementById(key + '-color');
          if (colorInput) colorInput.value = config.color;
          
          const minimapInput = document.getElementById(key + '-minimapColor');
          if (minimapInput && config.minimapColor) {
            minimapInput.value = config.minimapColor;
          } else if (minimapInput) {
            minimapInput.value = config.color;
          }
          
          const transInput = document.getElementById(key + '-transparency');
          if (transInput) {
            const transPercent = Math.round(config.transparency * 100);
            transInput.value = transPercent;
            document.getElementById(key + '-transparency-value').textContent = transPercent + '%';
          }
          
          const borderInput = document.getElementById(key + '-borderOpacity');
          if (borderInput && config.borderOpacity !== undefined) {
            const borderPercent = Math.round(config.borderOpacity * 100);
            borderInput.value = borderPercent;
            const borderValueElem = document.getElementById(key + '-borderOpacity-value');
            if (borderValueElem) {
              borderValueElem.textContent = borderPercent + '%';
            }
          }
        });
        
        Object.keys(colors.permissions).forEach(key => {
          updateColorPreview(key);
        });
        
        updatePreview();
      }
      
      function applyPreset(presetName) {
        if (presetName) {
          vscode.postMessage({
            command: 'applyTheme',
            theme: presetName
          });
          updateDeleteButton();
        } else {
          // Clear theme status when no theme selected
          updateThemeStatus(false);
          const statusDiv = document.getElementById('themeStatus');
          if (statusDiv) {
            statusDiv.style.display = 'none';
          }
        }
      }
      window.applyPreset = applyPreset;
      
      function updateDeleteButton() {
        const select = document.getElementById('themeSelect');
        const deleteBtn = document.getElementById('deleteThemeBtn');
        if (!select || !deleteBtn) return;
        
        const selectedValue = select.value;
        if (!selectedValue) {
          deleteBtn.style.display = 'none';
          return;
        }
        
        const selectedOption = select.querySelector('option[value="' + selectedValue + '"]');
        if (selectedOption && selectedOption.parentElement && selectedOption.parentElement.label === 'Custom Themes') {
          deleteBtn.style.display = 'block';
        } else {
          deleteBtn.style.display = 'none';
        }
      }
      
      function updateThemeStatus(isSystem) {
        const statusDiv = document.getElementById('themeStatus');
        if (!statusDiv) return;
        
        const select = document.getElementById('themeSelect');
        if (!select || !select.value) {
          statusDiv.style.display = 'none';
          return;
        }
        
        if (isSystem) {
          statusDiv.innerHTML = '🔒 System theme (read-only) - Click "Apply Colors" to create a custom copy';
          statusDiv.style.display = 'block';
        } else {
          statusDiv.innerHTML = '✏️ Custom theme - Changes will be saved to this theme';
          statusDiv.style.display = 'block';
        }
      }
      
      function addNewTheme() {
        const dialog = document.getElementById('themeDialog');
        const input = document.getElementById('themeNameInput');
        if (dialog && input) {
          dialog.classList.add('show');
          input.value = '';
          input.focus();
        }
      }
      window.addNewTheme = addNewTheme;
      
      function closeThemeDialog() {
        const dialog = document.getElementById('themeDialog');
        if (dialog) {
          dialog.classList.remove('show');
        }
      }
      window.closeThemeDialog = closeThemeDialog;
      
      function confirmNewTheme() {
        const input = document.getElementById('themeNameInput');
        const name = input ? input.value.trim() : '';
        
        if (!name) return;
        
        const colors = getColors();
        vscode.postMessage({
          command: 'saveAsNewTheme',
          name: name,
          colors: colors
        });
        
        closeThemeDialog();
        
        setTimeout(() => {
          const select = document.getElementById('themeSelect');
          if (select) {
            select.value = name;
            updateDeleteButton();
          }
        }, 200);
      }
      window.confirmNewTheme = confirmNewTheme;
      
      function deleteCurrentTheme() {
        const select = document.getElementById('themeSelect');
        if (!select || !select.value) return;
        
        const themeName = select.value;
        
        if (confirm('Delete theme "' + themeName + '"?')) {
          vscode.postMessage({
            command: 'deleteTheme',
            name: themeName
          });
          
          select.value = '';
          updateDeleteButton();
        }
      }
      window.deleteCurrentTheme = deleteCurrentTheme;
      
      function updateThemeList(builtIn, custom) {
        const select = document.getElementById('themeSelect');
        const currentValue = select.value;
        
        select.innerHTML = '';
        
        const builtInGroup = document.createElement('optgroup');
        builtInGroup.label = 'Built-in Themes';
        builtIn.forEach(theme => {
          const option = document.createElement('option');
          option.value = theme;
          option.textContent = theme;
          builtInGroup.appendChild(option);
        });
        select.appendChild(builtInGroup);
        
        if (custom && custom.length > 0) {
          const customGroup = document.createElement('optgroup');
          customGroup.label = 'Custom Themes';
          custom.forEach(theme => {
            const option = document.createElement('option');
            option.value = theme;
            option.textContent = theme;
            customGroup.appendChild(option);
          });
          select.appendChild(customGroup);
        }
        
        if (currentValue) {
          const options = select.querySelectorAll('option');
          for (let option of options) {
            if (option.value === currentValue) {
              select.value = currentValue;
              break;
            }
          }
        }
        
        updateDeleteButton();
      }
      window.updateThemeList = updateThemeList;
      
      function saveColors() {
        const colors = getColors();
        vscode.postMessage({
          command: 'saveColors',
          colors: colors
        });
      }
      window.saveColors = saveColors;
      
      function resetColors() {
        applyPreset('light');
      }
      window.resetColors = resetColors;
      
      function exportTheme() {
        vscode.postMessage({ command: 'exportTheme' });
      }
      window.exportTheme = exportTheme;
      
      function importTheme() {
        vscode.postMessage({ command: 'importTheme' });
      }
      window.importTheme = importTheme;
      
      let focusedPermission = null;
      
      function focusPermission(permission) {
        focusedPermission = permission;
        
        document.querySelectorAll('.permission-section').forEach(section => {
          section.classList.remove('focused');
        });
        
        event.currentTarget.classList.add('focused');
        updatePreviewForPermission(permission);
      }
      window.focusPermission = focusPermission;
      
      function updatePreviewForPermission(permission) {
        let targetLine = null;
        
        const lineMap = {
          'aiWrite': 'line3',
          'aiRead': 'line10',
          'aiNoAccess': 'line16',
          'humanWrite': 'line22',
          'humanRead': 'line29',
          'humanNoAccess': 'line35',
          'contextRead': 'line41',
          'contextWrite': 'line47'
        };
        
        targetLine = document.getElementById(lineMap[permission]);
        
        if (targetLine) {
          const editorContainer = document.querySelector('.editor-container');
          if (editorContainer) {
            const editorContent = document.querySelector('.editor-content');
            const linePosition = targetLine.offsetTop - editorContent.offsetTop;
            const containerHeight = editorContainer.clientHeight;
            const scrollTop = linePosition - (containerHeight / 2) + 10;
            editorContainer.scrollTop = Math.max(0, scrollTop);
          }
          
          targetLine.style.outline = '2px solid var(--vscode-focusBorder)';
          setTimeout(() => {
            targetLine.style.outline = '';
          }, 1000);
        }
      }
      
      function initializeDisabledStates() {
        const permissions = ['aiWrite', 'aiRead', 'aiNoAccess', 'humanWrite', 'humanRead', 'humanNoAccess', 'contextRead', 'contextWrite'];
        permissions.forEach(permission => {
          const checkbox = document.getElementById(permission + '-enabled');
          if (checkbox && !checkbox.checked) {
            toggleEnabled(permission);
          }
        });
      }
      
      setTimeout(() => {
        initializeDisabledStates();
        
        const permissions = ['aiWrite', 'aiRead', 'aiNoAccess', 'humanWrite', 'humanRead', 'humanNoAccess', 'contextRead', 'contextWrite'];
        permissions.forEach(perm => updateColorPreview(perm));
        
        setTimeout(updatePreview, 100);
      }, 50);
    `;
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