import * as vscode from 'vscode';

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

// Default colors (Light theme)
const DEFAULT_COLORS: GuardColors = {
  permissions: {
    aiWrite: {
      enabled: true,
      color: '#FFA500',
      transparency: 0.2
    },
    aiRead: {
      enabled: true,
      color: '#808080',
      transparency: 0.15
    },
    aiNoAccess: {
      enabled: true,
      color: '#90EE90',
      transparency: 0.2
    },
    humanWrite: {
      enabled: false,
      color: '#0000FF',
      transparency: 0.2
    },
    humanRead: {
      enabled: false,
      color: '#D3D3D3',
      transparency: 0.3
    },
    humanNoAccess: {
      enabled: false,
      color: '#FF0000',
      transparency: 0.25
    },
    contextRead: {
      enabled: true,
      color: '#00CED1',
      transparency: 0.15
    },
    contextWrite: {
      enabled: true,
      color: '#1E90FF',
      transparency: 0.15
    }
  },
  borderBarEnabled: true
};

// Preset themes
const COLOR_THEMES = {
  light: {
    name: 'Light',
    colors: {
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
    }
  },
  dark: {
    name: 'Dark',
    colors: {
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
    }
  },
  highContrast: {
    name: 'High Contrast',
    colors: {
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
    }
  },
  colorblind: {
    name: 'Colorblind Safe',
    colors: {
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
    }
  },
  ocean: {
    name: 'Ocean Breeze',
    colors: {
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
    }
  },
  sunset: {
    name: 'Sunset Glow',
    colors: {
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
    }
  },
  matrix: {
    name: 'Matrix',
    colors: {
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
    }
  },
  neon: {
    name: 'Neon Nights',
    colors: {
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
    }
  },
  pastel: {
    name: 'Pastel Dreams',
    colors: {
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
    }
  },
  cyberpunk: {
    name: 'Cyberpunk 2077',
    colors: {
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
  }
};

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

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (ColorCustomizerPanel.currentPanel) {
      ColorCustomizerPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
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

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
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
              this._applyTheme(message.theme);
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
            this._exportTheme();
            return;
          case 'importTheme':
            await this._importTheme();
            return;
        }
      },
      null,
      this._disposables
    );
  }

  private async _saveColors(colors: GuardColors) {
    const config = vscode.workspace.getConfiguration('guardTags');
    await config.update('colors', colors, vscode.ConfigurationTarget.Global);
    void vscode.window.showInformationMessage('Guard tag colors saved successfully!');
    
    // Immediately send back the saved colors to verify
    this._sendCurrentColors();
  }

  private _sendCurrentColors() {
    const config = vscode.workspace.getConfiguration('guardTags');
    const colors = config.get<GuardColors>('colors');

    void this._panel.webview.postMessage({
      command: 'updateColors',
      colors: mergeWithDefaults(colors)
    });
  }

  private async _applyTheme(themeName: string) {
    // Check built-in themes first
    let theme = COLOR_THEMES[themeName as keyof typeof COLOR_THEMES];
    
    // If not built-in, check custom themes
    if (!theme) {
      const config = vscode.workspace.getConfiguration('guardTags');
      const customThemes = config.get<Record<string, GuardColors>>('customThemes', {});
      if (customThemes[themeName]) {
        theme = { name: themeName, colors: customThemes[themeName] };
      }
    }
    
    if (theme) {
      void this._panel.webview.postMessage({
        command: 'updateColors',
        colors: theme.colors
      });
    }
  }
  
  private async _saveAsNewTheme(name: string, colors: GuardColors) {
    const config = vscode.workspace.getConfiguration('guardTags');
    const customThemes = config.get<Record<string, GuardColors>>('customThemes', {});
    customThemes[name] = colors;
    await config.update('customThemes', customThemes, vscode.ConfigurationTarget.Global);
    void vscode.window.showInformationMessage(`Theme '${name}' saved successfully!`);
    
    // Update theme list
    this._sendThemeList();
  }
  
  private async _deleteTheme(name: string) {
    const config = vscode.workspace.getConfiguration('guardTags');
    const customThemes = config.get<Record<string, GuardColors>>('customThemes', {});
    delete customThemes[name];
    await config.update('customThemes', customThemes, vscode.ConfigurationTarget.Global);
    void vscode.window.showInformationMessage(`Theme '${name}' deleted successfully!`);
    
    // Update theme list
    this._sendThemeList();
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
      
      // Validate it has at least the permissions object
      if (!colors.permissions) {
        void vscode.window.showErrorMessage('Invalid theme format: missing permissions object');
        return;
      }
      
      // Merge with defaults to ensure all properties exist
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
    // Request current colors from webview
    void this._panel.webview.postMessage({ command: 'requestCurrentColors' });
    
    // Wait for response (simplified - in production would use proper promise)
    return new Promise((resolve) => {
      const disposable = this._panel.webview.onDidReceiveMessage(
        message => {
          if (message.command === 'currentColors') {
            disposable.dispose();
            resolve(message.colors);
          }
        }
      );
      
      // Timeout after 1 second
      setTimeout(() => {
        disposable.dispose();
        resolve(undefined);
      }, 1000);
    });
  }
  
  private _sendThemeList() {
    const config = vscode.workspace.getConfiguration('guardTags');
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
    
    // Send theme list and current colors after a short delay to ensure webview is ready
    setTimeout(() => {
      this._sendThemeList();
      this._sendCurrentColors();
    }, 100);
  }

  private _generatePermissionSections(): string {
    const sections = [
      { id: 'aiWrite', title: 'AI Write', category: 'AI Permissions', defaultColor: '#FFA500', defaultEnabled: true },
      { id: 'aiRead', title: 'AI Read', category: 'AI Permissions', defaultColor: '#808080', defaultEnabled: true },
      { id: 'aiNoAccess', title: 'AI No Access', category: 'AI Permissions', defaultColor: '#90EE90', defaultEnabled: true },
      { id: 'humanWrite', title: 'Human Write', category: 'Human Permissions', defaultColor: '#0000FF', defaultEnabled: false },
      { id: 'humanRead', title: 'Human Read', category: 'Human Permissions', defaultColor: '#D3D3D3', defaultEnabled: true },
      { id: 'humanNoAccess', title: 'Human No Access', category: 'Human Permissions', defaultColor: '#FF0000', defaultEnabled: true },
      { id: 'contextRead', title: 'Context Read', category: 'Context', defaultColor: '#00CED1', defaultEnabled: true },
      { id: 'contextWrite', title: 'Context Write', category: 'Context', defaultColor: '#1E90FF', defaultEnabled: true }
    ];

    let html = '';

    sections.forEach(section => {
      html += `
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
                                <input type="color" id="${section.id}-minimapColor" class="color-input" value="${section.defaultColor}" onchange="updateMinimapColor('${section.id}')">
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
                                <input type="color" id="${section.id}-color" class="color-input" value="${section.defaultColor}" onchange="updateRowColor('${section.id}')">
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
    });

    return html;
  }

  private _getHtmlForWebview(_webview: vscode.Webview) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Guard Tag Theme Designer</title>
        <style>
            * {
                box-sizing: border-box;
            }
            
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
                padding-bottom: 200px; /* Extra space to ensure last item can scroll fully into view */
            }
            
            .preview-panel {
                flex: 1;
                background: var(--vscode-editor-background);
                padding: 20px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            
            h1 {
                margin: 0 0 16px 0;
                font-size: 20px;
                font-weight: 500;
            }
            
            h2 {
                margin: 20px 0 10px 0;
                font-size: 14px;
                text-transform: uppercase;
                opacity: 0.8;
                letter-spacing: 0.5px;
            }
            
            h3 {
                margin: 15px 0 10px 0;
                font-size: 13px;
                font-weight: 500;
            }
            
            .preset-selector {
                margin-bottom: 20px;
            }
            
            .preset-selector select {
                width: 100%;
                padding: 8px;
                background: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 4px;
            }
            
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
            
            .disabled {
                opacity: 0.5;
                pointer-events: none;
            }
            
            .permission-title {
                font-size: 14px;
                font-weight: 500;
            }
            
            .mode-selector {
                display: flex;
                gap: 10px;
            }
            
            .mode-selector label {
                display: flex;
                align-items: center;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }
            
            .mode-selector label:hover {
                background: var(--vscode-list-hoverBackground);
            }
            
            .mode-selector input[type="radio"] {
                margin-right: 4px;
            }
            
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
            
            .link-icon.linked::before {
                content: '🔒';
            }
            
            .link-icon.unlinked::before {
                content: '✂️';
            }
            
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
            
            .color-label {
                font-size: 11px;
                white-space: nowrap;
            }
            
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
            
            .global-controls {
                margin-bottom: 20px;
                padding: 15px;
                background: var(--vscode-input-background);
                border-radius: 4px;
            }
            
            .toggle-control {
                display: flex;
                align-items: center;
                margin: 10px 0;
            }
            
            .toggle-control input[type="checkbox"] {
                margin-right: 8px;
            }
            
            /* Preview Styles */
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
            
            .btn-primary:hover {
                background: var(--vscode-button-hoverBackground);
            }
            
            .btn-secondary {
                background: var(--vscode-secondaryButton-background);
                color: var(--vscode-secondaryButton-foreground);
            }
            
            .btn-secondary:hover {
                background: var(--vscode-list-hoverBackground);
            }
            
            input[type="text"] {
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                padding: 8px;
                border-radius: 4px;
                font-size: 13px;
            }
            
            input[type="text"]:focus {
                outline: 1px solid var(--vscode-focusBorder);
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
                border-left: 3px solid transparent;
            }
            
            .context-half:not(:first-child) {
                border-left: 1px solid var(--vscode-panel-border);
            }
        </style>
    </head>
    <body>
        <div class="main-container">
            <div class="control-panel">
                <h1>Guard Tag Theme Designer</h1>
                
                <div class="preset-selector">
                    <h2>Presets</h2>
                    <select id="themeSelect" onchange="applyPreset(this.value)">
                        <option value="">Choose a preset...</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="highContrast">High Contrast</option>
                        <option value="colorblind">Colorblind Safe</option>
                        <option value="ocean">Ocean Breeze</option>
                        <option value="sunset">Sunset Glow</option>
                        <option value="matrix">Matrix</option>
                        <option value="neon">Neon Nights</option>
                        <option value="pastel">Pastel Dreams</option>
                        <option value="cyberpunk">Cyberpunk 2077</option>
                    </select>
                </div>
                
                ${this._generatePermissionSections()}
                
                <div class="buttons">
                    <div class="button-row">
                        <button class="btn btn-primary" onclick="saveColors()">Save Current</button>
                        <button class="btn btn-secondary" onclick="resetColors()">Reset</button>
                    </div>
                    <div class="button-row" style="margin-top: 10px;">
                        <input type="text" id="newThemeName" placeholder="New theme name..." style="flex: 1; margin-right: 10px;">
                        <button class="btn btn-primary" onclick="saveAsNewTheme()">Save as Theme</button>
                    </div>
                    <div class="button-row" style="margin-top: 10px;">
                        <button class="btn btn-secondary" onclick="exportTheme()">Export</button>
                        <button class="btn btn-secondary" onclick="importTheme()">Import</button>
                    </div>
                </div>
            </div>
            
            <div class="preview-panel">
                <div class="preview-scrollable">
                    <h1>Live Preview</h1>
                    
                    <div class="code-preview">
                    <div class="editor-container">
                        <div class="line-numbers">
                            <div class="line-number">1</div>
                            <div class="line-number">2</div>
                            <div class="line-number">3</div>
                            <div class="line-number">4</div>
                            <div class="line-number">5</div>
                            <div class="line-number">6</div>
                            <div class="line-number">7</div>
                            <div class="line-number">8</div>
                            <div class="line-number">9</div>
                            <div class="line-number">10</div>
                            <div class="line-number">11</div>
                            <div class="line-number">12</div>
                            <div class="line-number">13</div>
                            <div class="line-number">14</div>
                            <div class="line-number">15</div>
                            <div class="line-number">16</div>
                            <div class="line-number">17</div>
                            <div class="line-number">18</div>
                            <div class="line-number">19</div>
                            <div class="line-number">20</div>
                            <div class="line-number">21</div>
                            <div class="line-number">22</div>
                            <div class="line-number">23</div>
                            <div class="line-number">24</div>
                            <div class="line-number">25</div>
                            <div class="line-number">26</div>
                            <div class="line-number">27</div>
                            <div class="line-number">28</div>
                            <div class="line-number">29</div>
                            <div class="line-number">30</div>
                            <div class="line-number">31</div>
                            <div class="line-number">32</div>
                            <div class="line-number">33</div>
                            <div class="line-number">34</div>
                            <div class="line-number">35</div>
                            <div class="line-number">36</div>
                            <div class="line-number">37</div>
                            <div class="line-number">38</div>
                            <div class="line-number">39</div>
                            <div class="line-number">40</div>
                            <div class="line-number">41</div>
                            <div class="line-number">42</div>
                            <div class="line-number">43</div>
                            <div class="line-number">44</div>
                            <div class="line-number">45</div>
                            <div class="line-number">46</div>
                            <div class="line-number">47</div>
                            <div class="line-number">48</div>
                            <div class="line-number">49</div>
                            <div class="line-number">50</div>
                        </div>
                        <div class="editor-content">
                            <div class="code-line" id="line1">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:ai:w</div>
                            </div>
                            <div class="code-line" id="line2">
                                <div class="line-border"></div>
                                <div class="line-content">function generateReport(data: ReportData): string {</div>
                            </div>
                            <div class="code-line" id="line3">
                                <div class="line-border"></div>
                                <div class="line-content">    const formatted = formatData(data);</div>
                            </div>
                            <div class="code-line" id="line4">
                                <div class="line-border"></div>
                                <div class="line-content">    return createReportTemplate(formatted);</div>
                            </div>
                            <div class="code-line" id="line5">
                                <div class="line-border"></div>
                                <div class="line-content">}</div>
                            </div>
                            <div class="code-line" id="line6">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:end</div>
                            </div>
                            <div class="code-line" id="line7">
                                <div class="line-border"></div>
                                <div class="line-content"></div>
                            </div>
                            <div class="code-line" id="line8">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:ai:r</div>
                            </div>
                            <div class="code-line" id="line9">
                                <div class="line-border"></div>
                                <div class="line-content">const config = await loadConfiguration();</div>
                            </div>
                            <div class="code-line" id="line10">
                                <div class="line-border"></div>
                                <div class="line-content">const theme = config.get('theme', 'light');</div>
                            </div>
                            <div class="code-line" id="line11">
                                <div class="line-border"></div>
                                <div class="line-content">applyTheme(theme);</div>
                            </div>
                            <div class="code-line" id="line12">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:end</div>
                            </div>
                            <div class="code-line" id="line13">
                                <div class="line-border"></div>
                                <div class="line-content"></div>
                            </div>
                            <div class="code-line" id="line14">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:ai:n</div>
                            </div>
                            <div class="code-line" id="line15">
                                <div class="line-border"></div>
                                <div class="line-content">const apiKey = process.env.SECRET_API_KEY;</div>
                            </div>
                            <div class="code-line" id="line16">
                                <div class="line-border"></div>
                                <div class="line-content">const dbPassword = process.env.DB_PASSWORD;</div>
                            </div>
                            <div class="code-line" id="line17">
                                <div class="line-border"></div>
                                <div class="line-content">const encryptionKey = generateSecureKey();</div>
                            </div>
                            <div class="code-line" id="line18">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:end</div>
                            </div>
                            <div class="code-line" id="line19">
                                <div class="line-border"></div>
                                <div class="line-content"></div>
                            </div>
                            <div class="code-line" id="line20">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:human:w</div>
                            </div>
                            <div class="code-line" id="line21">
                                <div class="line-border"></div>
                                <div class="line-content">function handleUserInput(input: UserInput): void {</div>
                            </div>
                            <div class="code-line" id="line22">
                                <div class="line-border"></div>
                                <div class="line-content">    validateInput(input);</div>
                            </div>
                            <div class="code-line" id="line23">
                                <div class="line-border"></div>
                                <div class="line-content">    processUserAction(input.action, input.data);</div>
                            </div>
                            <div class="code-line" id="line24">
                                <div class="line-border"></div>
                                <div class="line-content">}</div>
                            </div>
                            <div class="code-line" id="line25">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:end</div>
                            </div>
                            <div class="code-line" id="line26">
                                <div class="line-border"></div>
                                <div class="line-content"></div>
                            </div>
                            <div class="code-line" id="line27">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:human:r</div>
                            </div>
                            <div class="code-line" id="line28">
                                <div class="line-border"></div>
                                <div class="line-content">const userPreferences = getUserPreferences();</div>
                            </div>
                            <div class="code-line" id="line29">
                                <div class="line-border"></div>
                                <div class="line-content">const displayLanguage = userPreferences.language || 'en';</div>
                            </div>
                            <div class="code-line" id="line30">
                                <div class="line-border"></div>
                                <div class="line-content">initializeUI(displayLanguage);</div>
                            </div>
                            <div class="code-line" id="line31">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:end</div>
                            </div>
                            <div class="code-line" id="line32">
                                <div class="line-border"></div>
                                <div class="line-content"></div>
                            </div>
                            <div class="code-line" id="line33">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:human:n</div>
                            </div>
                            <div class="code-line" id="line34">
                                <div class="line-border"></div>
                                <div class="line-content">const privateUserData = await fetchPrivateData();</div>
                            </div>
                            <div class="code-line" id="line35">
                                <div class="line-border"></div>
                                <div class="line-content">const personalInfo = decryptUserInfo(privateUserData);</div>
                            </div>
                            <div class="code-line" id="line36">
                                <div class="line-border"></div>
                                <div class="line-content">storeSecurely(personalInfo);</div>
                            </div>
                            <div class="code-line" id="line37">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:end</div>
                            </div>
                            <div class="code-line" id="line38">
                                <div class="line-border"></div>
                                <div class="line-content"></div>
                            </div>
                            <div class="code-line" id="line39">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:ai:context</div>
                            </div>
                            <div class="code-line" id="line40">
                                <div class="line-border"></div>
                                <div class="line-content">// API Reference: POST /api/reports</div>
                            </div>
                            <div class="code-line" id="line41">
                                <div class="line-border"></div>
                                <div class="line-content">// Expected payload: { data: ReportData, format: 'pdf' | 'excel' }</div>
                            </div>
                            <div class="code-line" id="line42">
                                <div class="line-border"></div>
                                <div class="line-content">// Returns: { url: string, expiresAt: Date }</div>
                            </div>
                            <div class="code-line" id="line43">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:end</div>
                            </div>
                            <div class="code-line" id="line44">
                                <div class="line-border"></div>
                                <div class="line-content"></div>
                            </div>
                            <div class="code-line" id="line45">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:ai:context:w</div>
                            </div>
                            <div class="code-line" id="line46">
                                <div class="line-border"></div>
                                <div class="line-content">// TODO: Update this section with new authentication flow</div>
                            </div>
                            <div class="code-line" id="line47">
                                <div class="line-border"></div>
                                <div class="line-content">// Need to document OAuth2 integration steps</div>
                            </div>
                            <div class="code-line" id="line48">
                                <div class="line-border"></div>
                                <div class="line-content">// Include examples for refresh token handling</div>
                            </div>
                            <div class="code-line" id="line49">
                                <div class="line-border"></div>
                                <div class="line-content">// @guard:end</div>
                            </div>
                            <div class="code-line" id="line50">
                                <div class="line-border"></div>
                                <div class="line-content"></div>
                            </div>
                        </div>
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
        
        <script>
            const vscode = acquireVsCodeApi();
            let currentColors = null;
            let colorLinks = {};
            
            // Initialize on load
            window.addEventListener('load', () => {
                // Initialize all color links as linked
                const permissions = ['aiWrite', 'aiRead', 'aiNoAccess', 'humanWrite', 'humanRead', 'humanNoAccess', 'contextRead', 'contextWrite'];
                permissions.forEach(perm => {
                    colorLinks[perm] = true;
                });
                
                // Colors will be sent automatically by the extension
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
                }
            });
            
            function toggleColorLink(event, permission) {
                event.stopPropagation();
                colorLinks[permission] = !colorLinks[permission];
                const icon = document.getElementById(permission + '-link');
                icon.className = colorLinks[permission] ? 'link-icon linked' : 'link-icon unlinked';
                
                // When locking, sync row color to minimap/border color
                if (colorLinks[permission]) {
                    const rowColor = document.getElementById(permission + '-color').value;
                    document.getElementById(permission + '-minimapColor').value = rowColor;
                }
            }
            window.toggleColorLink = toggleColorLink;
            
            function updateMinimapColor(permission) {
                const minimapColor = document.getElementById(permission + '-minimapColor').value;
                // If linked, update row color too
                if (colorLinks[permission]) {
                    document.getElementById(permission + '-color').value = minimapColor;
                }
                updatePreview();
            }
            window.updateMinimapColor = updateMinimapColor;
            
            function updateRowColor(permission) {
                const rowColor = document.getElementById(permission + '-color').value;
                // If linked, update minimap color too
                if (colorLinks[permission]) {
                    document.getElementById(permission + '-minimapColor').value = rowColor;
                }
                updatePreview();
            }
            window.updateRowColor = updateRowColor;
            
            function toggleEnabled(permission) {
                const enabled = document.getElementById(permission + '-enabled').checked;
                
                // Enable/disable the color controls
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
                
                // Also disable/enable the labels
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
                updatePreview();
            }
            window.updateSlider = updateSlider;
            
            function updatePreview() {
                const colors = getColors();
                currentColors = colors;
                console.log('updatePreview called with colors:', colors);
                
                // Update code preview lines based on guard tags
                const lineConfigs = [
                    { line: 1, ai: 'write', human: null },  // @guard:ai:w
                    { line: 2, ai: 'write', human: null },  // function generateReport
                    { line: 3, ai: 'write', human: null },  // const formatted = formatData
                    { line: 4, ai: 'write', human: null },  // return createReportTemplate
                    { line: 5, ai: 'write', human: null },  // }
                    { line: 6, ai: 'write', human: null },  // @guard:end
                    { line: 7, ai: null, human: null },  // empty
                    { line: 8, ai: 'read', human: null },  // @guard:ai:r
                    { line: 9, ai: 'read', human: null },  // const config = await loadConfiguration
                    { line: 10, ai: 'read', human: null },  // const theme = config.get
                    { line: 11, ai: 'read', human: null },  // applyTheme(theme)
                    { line: 12, ai: 'read', human: null },  // @guard:end
                    { line: 13, ai: null, human: null },  // empty
                    { line: 14, ai: 'noAccess', human: null },  // @guard:ai:n
                    { line: 15, ai: 'noAccess', human: null },  // const apiKey
                    { line: 16, ai: 'noAccess', human: null },  // const dbPassword
                    { line: 17, ai: 'noAccess', human: null },  // const encryptionKey
                    { line: 18, ai: 'noAccess', human: null },  // @guard:end
                    { line: 19, ai: null, human: null },  // empty
                    { line: 20, ai: null, human: 'write' },  // @guard:human:w
                    { line: 21, ai: null, human: 'write' },  // function handleUserInput
                    { line: 22, ai: null, human: 'write' },  // validateInput
                    { line: 23, ai: null, human: 'write' },  // processUserAction
                    { line: 24, ai: null, human: 'write' },  // }
                    { line: 25, ai: null, human: 'write' },  // @guard:end
                    { line: 26, ai: null, human: null },  // empty
                    { line: 27, ai: null, human: 'read' },  // @guard:human:r
                    { line: 28, ai: null, human: 'read' },  // const userPreferences
                    { line: 29, ai: null, human: 'read' },  // const displayLanguage
                    { line: 30, ai: null, human: 'read' },  // initializeUI
                    { line: 31, ai: null, human: 'read' },  // @guard:end
                    { line: 32, ai: null, human: null },  // empty
                    { line: 33, ai: null, human: 'noAccess' },  // @guard:human:n
                    { line: 34, ai: null, human: 'noAccess' },  // const privateUserData
                    { line: 35, ai: null, human: 'noAccess' },  // const personalInfo
                    { line: 36, ai: null, human: 'noAccess' },  // storeSecurely
                    { line: 37, ai: null, human: 'noAccess' },  // @guard:end
                    { line: 38, ai: null, human: null },  // empty
                    { line: 39, ai: 'context', human: null },  // @guard:ai:context
                    { line: 40, ai: 'context', human: null },  // API Reference
                    { line: 41, ai: 'context', human: null },  // Expected payload
                    { line: 42, ai: 'context', human: null },  // Returns
                    { line: 43, ai: 'context', human: null },  // @guard:end
                    { line: 44, ai: null, human: null },  // empty
                    { line: 45, ai: 'contextWrite', human: null },  // @guard:ai:context:w
                    { line: 46, ai: 'contextWrite', human: null },  // TODO: Update
                    { line: 47, ai: 'contextWrite', human: null },  // Need to document
                    { line: 48, ai: 'contextWrite', human: null },  // Include examples
                    { line: 49, ai: 'contextWrite', human: null },  // @guard:end
                    { line: 50, ai: null, human: null }  // empty
                ];
                
                lineConfigs.forEach(config => {
                    updateLine(config.line, config.ai, config.human);
                });
                
                // Update examples
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
                const border = line.querySelector('.line-border');
                const colors = getColors();
                
                let bgColor = '';
                let borderColor = '';
                let opacity = 1.0;
                let borderOpacity = 1.0;
                
                // Determine which permission takes precedence
                if (aiPerm && humanPerm) {
                    // Both permissions - check modes
                    const aiConfig = colors.permissions['ai' + capitalizeFirst(aiPerm)];
                    const humanConfig = colors.permissions['human' + capitalizeFirst(humanPerm)];
                    
                    if (!aiConfig.enabled && !humanConfig.enabled) {
                        // Both disabled = no highlight
                        bgColor = '';
                    } else if (!aiConfig.enabled) {
                        // AI disabled, use human color
                        bgColor = humanConfig.color;
                        opacity = humanConfig.transparency;
                        borderColor = humanConfig.minimapColor || humanConfig.color;
                        borderOpacity = humanConfig.borderOpacity || 1.0;
                    } else if (!humanConfig.enabled) {
                        // Human disabled, use AI color
                        bgColor = aiConfig.color;
                        opacity = aiConfig.transparency;
                        borderColor = aiConfig.minimapColor || aiConfig.color;
                        borderOpacity = aiConfig.borderOpacity || 1.0;
                    } else {
                        // Both enabled - use AI color as default
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
                    // If human permission is disabled and there's no AI permission on this line,
                    // don't show any color (transparency mode only applies when both permissions exist)
                }
                
                // Apply background color
                if (bgColor) {
                    const rgb = hexToRgb(bgColor);
                    if (rgb) {
                        line.style.backgroundColor = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + opacity + ')';
                    }
                } else {
                    line.style.backgroundColor = '';
                }
                
                // Apply border bar
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
                const colors = getColors();
                
                let bgColor = '';
                let opacity = 1.0;
                let borderColor = '';
                let borderOpacity = 1.0;
                
                if (type === 'both') {
                    // Mixed permissions
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
                
                // Don't override styles for context-half elements
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
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
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
                    permissions[perm] = {
                        enabled: enabledElem ? enabledElem.checked : true,
                        color: document.getElementById(perm + '-color').value,
                        transparency: document.getElementById(perm + '-transparency').value / 100,
                        borderOpacity: borderOpacityElem ? borderOpacityElem.value / 100 : 1.0,
                        minimapColor: document.getElementById(perm + '-minimapColor').value
                    };
                });
                
                return {
                    permissions: permissions,
                    borderBarEnabled: true
                };
            }
            
            function updateAllColors(colors) {
                if (!colors || !colors.permissions) return;
                
                // Update each permission
                Object.entries(colors.permissions).forEach(([key, config]) => {
                    // Set enabled state
                    const enabledElem = document.getElementById(key + '-enabled');
                    if (enabledElem) {
                        enabledElem.checked = config.enabled !== false;
                        // Delay to ensure DOM is ready
                        // Trigger the toggleEnabled to update UI state
                        toggleEnabled(key);
                    }
                    
                    // Set color
                    const colorInput = document.getElementById(key + '-color');
                    if (colorInput) colorInput.value = config.color;
                    
                    // Set minimap color
                    const minimapInput = document.getElementById(key + '-minimapColor');
                    if (minimapInput && config.minimapColor) {
                        minimapInput.value = config.minimapColor;
                    } else if (minimapInput) {
                        minimapInput.value = config.color; // Default to row color
                    }
                    
                    // Set transparency
                    const transInput = document.getElementById(key + '-transparency');
                    if (transInput) {
                        const transPercent = Math.round(config.transparency * 100);
                        transInput.value = transPercent;
                        document.getElementById(key + '-transparency-value').textContent = transPercent + '%';
                    }
                    
                    // Set border opacity
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
                
                updatePreview();
            }
            
            function applyPreset(presetName) {
                if (presetName) {
                    vscode.postMessage({
                        command: 'applyTheme',
                        theme: presetName
                    });
                }
            }
            window.applyPreset = applyPreset;
            
            function updateThemeList(builtIn, custom) {
                const select = document.getElementById('themeSelect');
                const currentValue = select.value;
                
                // Clear existing options
                select.innerHTML = '';
                
                // Add built-in themes
                const builtInGroup = document.createElement('optgroup');
                builtInGroup.label = 'Built-in Themes';
                builtIn.forEach(theme => {
                    const option = document.createElement('option');
                    option.value = theme;
                    option.textContent = theme; // Will be formatted by the extension
                    builtInGroup.appendChild(option);
                });
                select.appendChild(builtInGroup);
                
                // Add custom themes if any
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
                
                // Restore selection if it still exists
                if (currentValue) {
                    const options = select.querySelectorAll('option');
                    for (let option of options) {
                        if (option.value === currentValue) {
                            select.value = currentValue;
                            break;
                        }
                    }
                }
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
            
            function saveAsNewTheme() {
                const nameInput = document.getElementById('newThemeName');
                const name = nameInput.value.trim();
                if (!name) {
                    alert('Please enter a theme name');
                    return;
                }
                
                const colors = getColors();
                vscode.postMessage({
                    command: 'saveAsNewTheme',
                    name: name,
                    colors: colors
                });
                
                nameInput.value = '';
            }
            window.saveAsNewTheme = saveAsNewTheme;
            
            function exportTheme() {
                vscode.postMessage({ command: 'exportTheme' });
            }
            window.exportTheme = exportTheme;
            
            function importTheme() {
                console.log('Import button clicked');
                vscode.postMessage({ command: 'importTheme' });
            }
            window.importTheme = importTheme;
            
            let focusedPermission = null;
            
            function focusPermission(permission) {
                focusedPermission = permission;
                
                // Update all permission sections visual state
                document.querySelectorAll('.permission-section').forEach(section => {
                    section.classList.remove('focused');
                });
                
                // Find the clicked section
                event.currentTarget.classList.add('focused');
                
                // Update preview to show this permission in context
                updatePreviewForPermission(permission);
            }
            window.focusPermission = focusPermission;
            
            function updatePreviewForPermission(permission) {
                // Scroll the relevant line into view
                let targetLine = null;
                
                if (permission === 'aiWrite') {
                    targetLine = document.getElementById('line3');
                } else if (permission === 'aiRead') {
                    targetLine = document.getElementById('line10');
                } else if (permission === 'aiNoAccess') {
                    targetLine = document.getElementById('line16');
                } else if (permission === 'humanWrite') {
                    targetLine = document.getElementById('line22');
                } else if (permission === 'humanRead') {
                    targetLine = document.getElementById('line29');
                } else if (permission === 'humanNoAccess') {
                    targetLine = document.getElementById('line35');
                } else if (permission === 'contextRead') {
                    targetLine = document.getElementById('line41');
                } else if (permission === 'contextWrite') {
                    targetLine = document.getElementById('line47');
                }
                
                if (targetLine) {
                    // Get the editor container to scroll within it
                    const editorContainer = document.querySelector('.editor-container');
                    if (editorContainer) {
                        // Calculate position relative to editor-content parent
                        const editorContent = document.querySelector('.editor-content');
                        const linePosition = targetLine.offsetTop - editorContent.offsetTop;
                        const containerHeight = editorContainer.clientHeight;
                        const scrollTop = linePosition - (containerHeight / 2) + 10; // Center the line with small offset
                        editorContainer.scrollTop = Math.max(0, scrollTop);
                    }
                    
                    // Briefly highlight the line
                    targetLine.style.outline = '2px solid var(--vscode-focusBorder)';
                    setTimeout(() => {
                        targetLine.style.outline = '';
                    }, 1000);
                }
            }
            
            // Initialize disabled state for all permissions on load
            function initializeDisabledStates() {
                const permissions = ['aiWrite', 'aiRead', 'aiNoAccess', 'humanWrite', 'humanRead', 'humanNoAccess', 'contextRead', 'contextWrite'];
                permissions.forEach(permission => {
                    const checkbox = document.getElementById(permission + '-enabled');
                    if (checkbox && !checkbox.checked) {
                        toggleEnabled(permission);
                    }
                });
            }
            
            // Run initialization when DOM is ready
            initializeDisabledStates();
            // Don't update preview here - wait for colors to load
        </script>
    </body>
    </html>`;
  }

  public dispose() {
    ColorCustomizerPanel.currentPanel = undefined;

    // Clean up our resources
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