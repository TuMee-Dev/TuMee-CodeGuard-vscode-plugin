import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWebviewStyles, getWebviewJavaScript } from './colorCustomizer/webviewContent';
import type { MixPattern } from '../types/mixPatterns';
import { DEFAULT_MIX_PATTERN } from '../types/mixPatterns';
import { getColorThemes } from '../utils/themeLoader';
import { configManager, CONFIG_KEYS } from '../utils/configurationManager';

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

// Get themes from external configuration
export const COLOR_THEMES = getColorThemes();

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

// Export themes for CLI usage
export function getBuiltInThemes(): Record<string, any> {
  const themes: Record<string, any> = {};
  // Convert COLOR_THEMES back to the format expected by CLI
  Object.entries(COLOR_THEMES).forEach(([name, theme]) => {
    themes[name] = {
      name,
      permissions: theme.colors.permissions,
      borderBarEnabled: theme.colors.borderBarEnabled,
      mixPattern: theme.colors.mixPattern
    };
  });
  return themes;
}

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

// Load preview lines from JSON resource file
function loadPreviewLines(): any[] {
  try {
    const jsonPath = path.join(__dirname, '..', 'resources', 'preview-lines.json');
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(jsonContent);
    return data.lines || [];
  } catch (error) {
    console.error('Failed to load preview lines:', error);
    // Return minimal fallback data
    return [
      { content: '// Failed to load preview data', ai: null, human: null },
      { content: '// Check resources/preview-lines.json', ai: null, human: null }
    ];
  }
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
    const cm = configManager();

    // If we're editing a system theme, prompt to create a new theme
    if (this._isSystemTheme && !fromTheme) {
      const themeName = await vscode.window.showInputBox({
        prompt: 'System themes cannot be modified. Enter a name for your custom theme:',
        placeHolder: 'My Custom Theme',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Theme name cannot be empty';
          }
          const customThemes = cm.get(CONFIG_KEYS.CUSTOM_THEMES, {} as Record<string, GuardColors>);
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
        await cm.update(CONFIG_KEYS.SELECTED_THEME, themeName);

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
      const customThemes = cm.get(CONFIG_KEYS.CUSTOM_THEMES, {} as Record<string, GuardColors>);
      if (customThemes[this._currentTheme]) {
        customThemes[this._currentTheme] = colors;
        await cm.update(CONFIG_KEYS.CUSTOM_THEMES, customThemes);

        // If this is the currently selected theme, update guardColorsComplete too
        const selectedTheme = cm.get(CONFIG_KEYS.SELECTED_THEME, '');
        if (selectedTheme === this._currentTheme) {
          await cm.update(CONFIG_KEYS.GUARD_COLORS_COMPLETE, colors);
        }

        void vscode.window.showInformationMessage(`Theme '${this._currentTheme}' updated successfully!`);
      }
      // Don't send colors back - webview already has current values
    } else if (!fromTheme) {
      await cm.update(CONFIG_KEYS.GUARD_COLORS_COMPLETE, colors);
      await cm.update(CONFIG_KEYS.SELECTED_THEME, '');
      void vscode.window.showInformationMessage('Guard tag colors saved successfully!');
    } else {
      // This is fromTheme = true case, update the config
      await cm.update(CONFIG_KEYS.GUARD_COLORS_COMPLETE, colors);
      // Send the new theme colors to update the UI
      void this._panel.webview.postMessage({
        command: 'updateColors',
        colors: colors
      });
    }
  }

  private _sendCurrentColors() {
    const cm = configManager();
    const savedColors = cm.get<GuardColors>(CONFIG_KEYS.GUARD_COLORS_COMPLETE);
    let colors: GuardColors;

    if (savedColors) {
      colors = mergeWithDefaults(savedColors);
    } else {
      // No saved colors, check if we have a selected theme
      const selectedTheme = cm.get(CONFIG_KEYS.SELECTED_THEME, 'light');
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
      const cm = configManager();
      const customThemes = cm.get(CONFIG_KEYS.CUSTOM_THEMES, {} as Record<string, GuardColors>);
      if (customThemes[themeName]) {
        theme = { name: themeName, colors: customThemes[themeName] };
        this._isSystemTheme = false;
      }
    }

    if (theme) {
      this._currentTheme = themeName;

      // Update colors without showing notification
      const cm = configManager();
      const mergedColors = mergeWithDefaults(theme.colors);
      await cm.update(CONFIG_KEYS.GUARD_COLORS_COMPLETE, mergedColors);
      await cm.update(CONFIG_KEYS.SELECTED_THEME, themeName);

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
    const cm = configManager();
    const customThemes = cm.get(CONFIG_KEYS.CUSTOM_THEMES, {} as Record<string, GuardColors>);
    customThemes[name] = colors;
    await cm.update(CONFIG_KEYS.CUSTOM_THEMES, customThemes);
    await cm.update(CONFIG_KEYS.SELECTED_THEME, name);

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

      const cm = configManager();
      const customThemes = cm.get(CONFIG_KEYS.CUSTOM_THEMES, {} as Record<string, GuardColors>);

      // Create a shallow copy to avoid proxy issues
      const updatedThemes = { ...customThemes };
      delete updatedThemes[name];
      await cm.update(CONFIG_KEYS.CUSTOM_THEMES, updatedThemes);

      // Determine next theme to select (only custom themes can be deleted)
      let nextTheme = '';
      if (this._currentTheme === name) {
        const builtInThemes = Object.keys(COLOR_THEMES);
        const originalCustomThemes = Object.keys(customThemes);
        const remainingCustomThemes = Object.keys(updatedThemes);

        if (remainingCustomThemes.length > 0) {
          // Still have custom themes - select the closest one by position
          const deletedIndex = originalCustomThemes.indexOf(name);
          const nextIndex = Math.min(deletedIndex, remainingCustomThemes.length - 1);

          // Get the theme that should be at this position after deletion
          const targetTheme = originalCustomThemes.filter(t => t !== name)[nextIndex];
          if (targetTheme && remainingCustomThemes.includes(targetTheme)) {
            nextTheme = targetTheme;
          } else {
            // Fallback to first remaining custom theme
            nextTheme = remainingCustomThemes[0];
          }
        } else {
          // No custom themes left, fall back to first built-in theme
          nextTheme = builtInThemes[0] || 'light';
        }

        // Apply the next theme
        if (nextTheme) {
          await this._applyTheme(nextTheme);
        } else {
          this._currentTheme = '';
          this._isSystemTheme = false;
          await cm.update(CONFIG_KEYS.SELECTED_THEME, '');
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
    const cm = configManager();
    await cm.update(CONFIG_KEYS.DEFAULT_AI_WRITE, defaultAiWrite);
    await cm.update(CONFIG_KEYS.DEFAULT_HUMAN_WRITE, defaultHumanWrite);
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
    const cm = configManager();
    const customThemes = cm.get(CONFIG_KEYS.CUSTOM_THEMES, {} as Record<string, GuardColors>);

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

    setTimeout(async () => {
      this._sendThemeList();

      const cm = configManager();
      let selectedTheme = cm.get(CONFIG_KEYS.SELECTED_THEME, '');

      // If no theme is selected, default to 'light'
      if (!selectedTheme) {
        selectedTheme = 'light';
      }

      // Apply the theme to ensure colors and dropdown are in sync
      await this._applyTheme(selectedTheme);

      void this._panel.webview.postMessage({
        command: 'setSelectedTheme',
        theme: selectedTheme
      });

      // Restore default permissions from user preferences
      const defaultAiWrite = cm.get(CONFIG_KEYS.DEFAULT_AI_WRITE, false);
      const defaultHumanWrite = cm.get(CONFIG_KEYS.DEFAULT_HUMAN_WRITE, true);

      void this._panel.webview.postMessage({
        command: 'restoreDefaultPermissions',
        defaultAiWrite: defaultAiWrite,
        defaultHumanWrite: defaultHumanWrite
      });
    }, 100);
  }

  // Permission section generation moved to client-side JavaScript

  private _generatePermissionSection(config: { id: string; title: string; defaultColor: string; defaultEnabled: boolean; defaultTransparency: number; defaultBorderOpacity: number }): string {
    const transparency = Math.round(config.defaultTransparency * 100);
    const borderOpacity = Math.round(config.defaultBorderOpacity * 100);

    return `
      <div class="permission-section" onclick="focusPermission('${config.id}')">
        <div class="permission-header">
          <div class="permission-title">${config.title}</div>
          <div class="toggle-switch">
            <label>Enabled</label>
            <input type="checkbox" id="${config.id}-enabled" ${config.defaultEnabled ? 'checked' : ''} onchange="toggleEnabled('${config.id}')">
          </div>
        </div>
        <div class="permission-controls">
          <span class="link-icon linked" id="${config.id}-link" onclick="toggleColorLink(event, '${config.id}')" title="Link/unlink colors"></span>
          <div class="color-row">
            <div style="width: 20px;"></div>
            <div class="color-control">
              <div class="color-preview" id="${config.id}-minimapColor-preview" onclick="openColorPicker('${config.id}-minimapColor')"></div>
              <input type="color" id="${config.id}-minimapColor" class="color-input" value="${config.defaultColor}" onchange="updateMinimapColor('${config.id}')" style="display: none;">
              <label class="color-label">Minimap/Border</label>
            </div>
            <div class="slider-control">
              <label class="color-label">Border Opacity</label>
              <input type="range" id="${config.id}-borderOpacity" class="slider" min="0" max="100" value="${borderOpacity}" oninput="updateSlider(this)">
              <span class="slider-value" id="${config.id}-borderOpacity-value">${borderOpacity}%</span>
            </div>
          </div>
          <div class="color-row">
            <div style="width: 20px;"></div>
            <div class="color-control">
              <div class="color-preview" id="${config.id}-color-preview" onclick="openColorPicker('${config.id}-color')"></div>
              <input type="color" id="${config.id}-color" class="color-input" value="${config.defaultColor}" onchange="updateRowColor('${config.id}')" style="display: none;">
              <label class="color-label">Row</label>
            </div>
            <div class="slider-control">
              <label class="color-label">Row Opacity</label>
              <input type="range" id="${config.id}-transparency" class="slider" min="0" max="100" value="${transparency}" oninput="updateSlider(this)">
              <span class="slider-value" id="${config.id}-transparency-value">${transparency}%</span>
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

  private _getHtmlForWebview(_webview: vscode.Webview) {
    // Use external module for CSS and JavaScript
    const css = getWebviewStyles();
    const previewLines = loadPreviewLines();
    const javascript = getWebviewJavaScript(previewLines);

    // Get the current theme colors for initial HTML generation
    const cm = configManager();
    const selectedTheme = cm.get(CONFIG_KEYS.SELECTED_THEME, 'light');
    const theme = COLOR_THEMES[selectedTheme] || COLOR_THEMES.light;
    const colors = theme.colors;

    // Generate permission sections with theme colors
    const permissionSections = Object.entries(colors.permissions).map(([id, perm]) => {
      const titles: Record<string, string> = {
        aiWrite: 'AI Write',
        aiRead: 'AI Read',
        aiNoAccess: 'AI No Access',
        humanWrite: 'Human Write',
        humanRead: 'Human Read',
        humanNoAccess: 'Human No Access',
        contextRead: 'Context Read',
        contextWrite: 'Context Write'
      };

      return this._generatePermissionSection({
        id,
        title: titles[id] || id,
        defaultColor: perm.color,
        defaultEnabled: perm.enabled,
        defaultTransparency: perm.transparency,
        defaultBorderOpacity: perm.borderOpacity || 1.0
      });
    }).join('');

    const lineNumbers = Array.from({ length: 65 }, (_, i) => `<div class="line-number">${i + 1}</div>`).join('');
    const codeLines = previewLines.map((line, i) => this._generateCodeLine(i, line.content)).join('');

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
                            <button class="btn-icon" id="deleteThemeBtn" onclick="deleteCurrentTheme()" title="Delete theme" style="display: none;">🗑️</button>
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
                            <button class="btn btn-primary" onclick="saveColors()" disabled>Apply Colors</button>
                            <button class="btn btn-secondary" onclick="resetColors()" disabled>Reset</button>
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