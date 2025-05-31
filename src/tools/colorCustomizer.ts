import * as vscode from 'vscode';
import { ColorCustomizerHtmlBuilder } from './colorCustomizer/HtmlBuilder';
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
  highlightEntireLine?: boolean;   // Highlight entire line (true) or just text (false)
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

  // Highlight entire line including whitespace (vs text only)
  highlightEntireLine?: boolean;   // Default false for backward compatibility

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
  highlightEntireLine: false,  // Default to false for backward compatibility
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


export class ColorCustomizerPanel {
  public static currentPanel: ColorCustomizerPanel | undefined;
  public static readonly viewType = 'guardTagColorCustomizer';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _cm = configManager();
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

  // Helper methods for common operations
  private _postMessage(command: string, data?: any): void {
    void this._panel.webview.postMessage({ command, ...data });
  }

  private _showInfo(message: string): void {
    void vscode.window.showInformationMessage(message);
  }

  private _showError(message: string): void {
    void vscode.window.showErrorMessage(message);
  }

  private _getCustomThemes(): Record<string, { name: string; colors: GuardColors }> {
    return this._cm.get(CONFIG_KEYS.CUSTOM_THEMES, {} as Record<string, { name: string; colors: GuardColors }>);
  }

  private _getBuiltInThemes(): string[] {
    return Object.keys(COLOR_THEMES);
  }

  private async _saveColors(colors: GuardColors, fromTheme: boolean = false) {

    // If we're editing a system theme, prompt to create a new theme
    if (this._isSystemTheme && !fromTheme) {
      const themeName = await vscode.window.showInputBox({
        prompt: 'System themes cannot be modified. Enter a name for your custom theme:',
        placeHolder: 'My Custom Theme',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Theme name cannot be empty';
          }
          const customThemes = this._getCustomThemes();
          const themeKey = value.toLowerCase();
          if (customThemes[themeKey] || COLOR_THEMES[themeKey]) {
            return 'A theme with this name already exists';
          }
          return null;
        }
      });

      if (themeName) {
        await this._saveAsNewTheme(themeName, colors);
        const themeKey = themeName.toLowerCase();
        this._currentTheme = themeName;
        this._isSystemTheme = false;
        await this._cm.update(CONFIG_KEYS.SELECTED_THEME, themeName);

        // Update the dropdown in the webview - use lowercase key to match dropdown value
        this._postMessage('setSelectedTheme', { theme: themeKey });
        // Also update the theme type to enable controls
        this._postMessage('setThemeType', { isSystem: false });
      }
      return;
    }

    // If we have a current custom theme and not applying from theme selector
    if (this._currentTheme && !this._isSystemTheme && !fromTheme) {
      const customThemes = this._getCustomThemes();
      const themeKey = this._currentTheme.toLowerCase();
      if (customThemes[themeKey]) {
        // Keep the same structure with name field
        customThemes[themeKey] = {
          name: customThemes[themeKey].name || this._currentTheme,
          colors: colors
        };
        await this._cm.update(CONFIG_KEYS.CUSTOM_THEMES, customThemes);

        // If this is the currently selected theme, update guardColorsComplete too
        const selectedTheme = this._cm.get(CONFIG_KEYS.SELECTED_THEME, '');
        if (selectedTheme === this._currentTheme) {
          await this._cm.update(CONFIG_KEYS.GUARD_COLORS_COMPLETE, colors);
        }

        this._showInfo(`Theme '${this._currentTheme}' updated successfully!`);
      }
      // Don't send colors back - webview already has current values
    } else if (!fromTheme) {
      await this._cm.update(CONFIG_KEYS.GUARD_COLORS_COMPLETE, colors);
      await this._cm.update(CONFIG_KEYS.SELECTED_THEME, '');
      this._showInfo('Guard tag colors saved successfully!');
    } else {
      // This is fromTheme = true case, update the config
      await this._cm.update(CONFIG_KEYS.GUARD_COLORS_COMPLETE, colors);
      // Send the new theme colors to update the UI
      this._postMessage('updateColors', { colors });
    }
  }

  private _sendCurrentColors() {
    const savedColors = this._cm.get<GuardColors>(CONFIG_KEYS.GUARD_COLORS_COMPLETE);
    let colors: GuardColors;

    if (savedColors) {
      colors = mergeWithDefaults(savedColors);
    } else {
      // No saved colors, check if we have a selected theme
      const selectedTheme = this._cm.get(CONFIG_KEYS.SELECTED_THEME, 'default');
      const themeKey = selectedTheme.toLowerCase();
      
      // Check built-in themes first
      let theme = COLOR_THEMES[themeKey];
      
      // If not found, check custom themes
      if (!theme) {
        const customThemes = this._getCustomThemes();
        if (customThemes[themeKey]) {
          theme = customThemes[themeKey];
        }
      }
      
      if (theme) {
        colors = mergeWithDefaults(theme.colors);
      } else {
        colors = DEFAULT_COLORS;
      }
    }

    this._postMessage('updateColors', { colors });
  }

  private async _applyTheme(themeName: string) {
    // Always use lowercase keys for lookup
    const themeKey = themeName.toLowerCase();
    let theme = COLOR_THEMES[themeKey];
    this._isSystemTheme = !!theme;

    if (!theme) {
      const customThemes = this._getCustomThemes();
      if (customThemes[themeKey]) {
        // Custom themes already have the correct structure with name and colors
        theme = customThemes[themeKey];
        this._isSystemTheme = false;
      }
    }

    if (theme) {
      this._currentTheme = themeName;

      // Update colors without showing notification
      const mergedColors = mergeWithDefaults(theme.colors);
      await this._cm.update(CONFIG_KEYS.GUARD_COLORS_COMPLETE, mergedColors);
      await this._cm.update(CONFIG_KEYS.SELECTED_THEME, themeName);

      this._postMessage('updateColors', { colors: mergedColors });

      // Send theme type info to webview
      this._postMessage('setThemeType', { isSystem: this._isSystemTheme });
    }
  }

  private async _saveAsNewTheme(name: string, colors: GuardColors) {
    const customThemes = this._getCustomThemes();
    const themeKey = name.toLowerCase();
    // Store with same structure as built-in themes
    customThemes[themeKey] = {
      name: name,  // Display name with original casing
      colors: colors
    };
    await this._cm.update(CONFIG_KEYS.CUSTOM_THEMES, customThemes);
    await this._cm.update(CONFIG_KEYS.SELECTED_THEME, name);

    this._currentTheme = name;
    this._isSystemTheme = false;

    this._showInfo(`Theme '${name}' saved successfully!`);
    this._sendThemeList();

    // Update the dropdown selection - use lowercase key to match dropdown value
    setTimeout(() => {
      this._postMessage('setSelectedTheme', { theme: themeKey });
      this._postMessage('setThemeType', { isSystem: false });
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

      const customThemes = this._getCustomThemes();

      // Create a shallow copy to avoid proxy issues
      const updatedThemes = { ...customThemes };
      const themeKey = name.toLowerCase();
      
      // Handle legacy themes that might have wrong casing in the key
      if (!customThemes[themeKey] && customThemes[name]) {
        delete updatedThemes[name];
      } else {
        delete updatedThemes[themeKey];
      }
      
      await this._cm.update(CONFIG_KEYS.CUSTOM_THEMES, updatedThemes);

      // Determine next theme to select (only custom themes can be deleted)
      let nextTheme = '';
      if (this._currentTheme === name) {
        const builtInThemes = this._getBuiltInThemes();
        const originalCustomThemes = Object.keys(customThemes);
        const remainingCustomThemes = Object.keys(updatedThemes);

        if (remainingCustomThemes.length > 0) {
          // Still have custom themes - select the closest one by position
          // Use lowercase key for comparison since themes are stored with lowercase keys
          const deletedIndex = originalCustomThemes.indexOf(themeKey);
          const nextIndex = Math.min(deletedIndex, remainingCustomThemes.length - 1);

          // Get the theme that should be at this position after deletion
          const targetTheme = originalCustomThemes.filter(t => t !== themeKey)[nextIndex];
          if (targetTheme && remainingCustomThemes.includes(targetTheme)) {
            nextTheme = targetTheme;
          } else {
            // Fallback to first remaining custom theme
            nextTheme = remainingCustomThemes[0];
          }
        } else {
          // No custom themes left, fall back to first built-in theme
          nextTheme = builtInThemes[0] || 'default';
        }

        // Apply the next theme
        if (nextTheme) {
          await this._applyTheme(nextTheme);
        } else {
          this._currentTheme = '';
          this._isSystemTheme = false;
          await this._cm.update(CONFIG_KEYS.SELECTED_THEME, '');
        }
      }

      this._showInfo(`Theme '${name}' deleted successfully!`);

      // Send the theme list update first
      this._sendThemeList();

      // Then send the deletion notification with a slight delay to ensure theme list is processed
      setTimeout(() => {
        // Include whether the next theme is a system theme
        const isNextThemeSystem = nextTheme && !!COLOR_THEMES[nextTheme.toLowerCase()];
        this._postMessage('themeDeleted', { 
          deletedTheme: name, 
          nextTheme,
          isSystemTheme: isNextThemeSystem
        });
      }, 50);
    } finally {
      this._isDeleting = false;
    }
  }

  private async _saveDefaultPermissions(defaultAiWrite: boolean, defaultHumanWrite: boolean) {
    await this._cm.update(CONFIG_KEYS.DEFAULT_AI_WRITE, defaultAiWrite);
    await this._cm.update(CONFIG_KEYS.DEFAULT_HUMAN_WRITE, defaultHumanWrite);
  }

  private async _exportTheme() {
    const colors = await this._getCurrentColorsFromWebview();
    if (colors) {
      const json = JSON.stringify(colors, null, 2);
      void vscode.env.clipboard.writeText(json);
      this._showInfo('Theme copied to clipboard as JSON!');
    }
  }

  private async _importTheme() {
    try {
      const json = await vscode.env.clipboard.readText();

      if (!json || json.trim().length === 0) {
        this._showError('Clipboard is empty! Please copy a theme JSON first.');
        return;
      }

      const colors = JSON.parse(json) as GuardColors;

      if (!colors.permissions) {
        this._showError('Invalid theme format: missing permissions object');
        return;
      }

      const mergedColors = mergeWithDefaults(colors);
      this._postMessage('updateColors', { colors: mergedColors });
      this._showInfo('Theme imported from clipboard!');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      this._showError(`Failed to import theme: ${errorMessage}`);
      console.error('Import theme error:', e);
    }
  }

  private async _getCurrentColorsFromWebview(): Promise<GuardColors | undefined> {
    this._postMessage('requestCurrentColors');

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
    const customThemes = this._getCustomThemes();
    const builtInThemeKeys = this._getBuiltInThemes();
    const customThemeNames = Object.keys(customThemes);

    // Create arrays with both key and display name for built-in themes
    const builtInThemesWithNames = builtInThemeKeys.map(key => ({
      key: key,
      name: COLOR_THEMES[key]?.name || key
    }));

    // For custom themes, use the name field from the theme data
    const customThemesWithNames = customThemeNames.map(key => ({
      key: key,
      name: customThemes[key].name || key  // Use name field or fallback to key
    }));

    this._postMessage('updateThemeList', {
      builtIn: builtInThemesWithNames,
      custom: customThemesWithNames
    });
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = 'Guard Tag Color Customizer';
    const selectedTheme = this._cm.get(CONFIG_KEYS.SELECTED_THEME, 'default');
    this._panel.webview.html = ColorCustomizerHtmlBuilder.getHtmlForWebview(webview, selectedTheme, this._cm);

    setTimeout(async () => {
      this._sendThemeList();

      let selectedTheme = this._cm.get(CONFIG_KEYS.SELECTED_THEME, '');

      // If no theme is selected, default to 'default'
      if (!selectedTheme) {
        selectedTheme = 'default';
      }

      // Apply the theme to ensure colors and dropdown are in sync
      await this._applyTheme(selectedTheme);

      this._postMessage('setSelectedTheme', { theme: selectedTheme });

      // Restore default permissions from user preferences
      const defaultAiWrite = this._cm.get(CONFIG_KEYS.DEFAULT_AI_WRITE, false);
      const defaultHumanWrite = this._cm.get(CONFIG_KEYS.DEFAULT_HUMAN_WRITE, true);

      this._postMessage('restoreDefaultPermissions', {
        defaultAiWrite,
        defaultHumanWrite
      });
    }, 100);
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