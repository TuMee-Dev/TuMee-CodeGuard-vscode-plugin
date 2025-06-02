import * as vscode from 'vscode';
import { ColorCustomizerHtmlBuilder } from './colorCustomizer/HtmlBuilder';
import { configManager, CONFIG_KEYS } from '../utils/config/configurationManager';
import type { ThemeResponse, CreateThemeResponse, ExportThemeResponse, ImportThemeResponse, SetThemeResponse } from '../utils/cli/cliWorker';
import { CLIWorker } from '../utils/cli/cliWorker';
import type { GuardColors } from './colorCustomizer/ColorConfigTypes';
import {
  COLOR_THEMES,
  DEFAULT_COLORS,
  mergeWithDefaults
} from './colorCustomizer/ColorConfigTypes';
import { getDecorationManager } from '../extension';

export class ColorCustomizerPanel {
  public static currentPanel: ColorCustomizerPanel | undefined;
  public static readonly viewType = 'guardTagColorCustomizer';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private readonly _cm = configManager();
  private readonly _cliWorker: CLIWorker;
  private _disposables: vscode.Disposable[] = [];
  private _currentTheme: string = '';
  private _isSystemTheme: boolean = false;
  private _isDeleting: boolean = false;

  public static createOrShow(context: vscode.ExtensionContext) {
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

    ColorCustomizerPanel.currentPanel = new ColorCustomizerPanel(panel, context);
  }

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this._panel = panel;
    this._extensionUri = context.extensionUri;
    this._context = context;
    this._cliWorker = CLIWorker.getInstance();

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
            void this._sendCurrentColors();
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
            void this._sendThemeList();
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


  private async _getCustomThemes(): Promise<Record<string, { name: string; colors: GuardColors }>> {
    try {
      const response = await this._cliWorker.sendRequest('getThemes', {});
      if (response.status === 'success' && response.result) {
        const themeResponse = response.result as ThemeResponse;
        return themeResponse.custom || {};
      }
    } catch (error) {
      console.error('Failed to get themes from CLI:', error);
    }
    return {};
  }

  private async _getBuiltInThemes(): Promise<Record<string, { name: string; colors: GuardColors }>> {
    try {
      const response = await this._cliWorker.sendRequest('getThemes', {});
      if (response.status === 'success' && response.result) {
        const themeResponse = response.result as ThemeResponse;
        return themeResponse.builtIn || {};
      }
    } catch (error) {
      console.error('Failed to get built-in themes from CLI:', error);
    }
    return {};
  }

  private async _saveColors(colors: GuardColors, fromTheme: boolean = false) {

    // If we're editing a system theme, prompt to create a new theme
    if (this._isSystemTheme && !fromTheme) {
      const themeName = await vscode.window.showInputBox({
        prompt: 'System themes cannot be modified. Enter a name for your custom theme:',
        placeHolder: 'My Custom Theme',
        validateInput: async (value) => {
          if (!value || value.trim().length === 0) {
            return 'Theme name cannot be empty';
          }
          const customThemes = await this._getCustomThemes();
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
      const customThemes = await this._getCustomThemes();
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
      
      // Refresh all editor decorations immediately
      const decorationManager = getDecorationManager();
      if (decorationManager) {
        decorationManager.handleColorConfigurationChange(this._context);
      }
      
      this._showInfo('Guard tag colors saved successfully!');
    } else {
      // This is fromTheme = true case, update the config
      await this._cm.update(CONFIG_KEYS.GUARD_COLORS_COMPLETE, colors);
      
      // Refresh all editor decorations immediately
      const decorationManager = getDecorationManager();
      if (decorationManager) {
        decorationManager.handleColorConfigurationChange(this._context);
      }
      
      // Send the new theme colors to update the UI
      this._postMessage('updateColors', { colors });
    }
  }

  private async _sendCurrentColors() {
    const savedColors = this._cm.get<GuardColors>(CONFIG_KEYS.GUARD_COLORS_COMPLETE);
    let colors: GuardColors;

    if (savedColors) {
      colors = mergeWithDefaults(savedColors);
    } else {
      // No saved colors, get current theme from CLI
      try {
        const response = await this._cliWorker.sendRequest('getCurrentTheme', {});
        if (response.status === 'success' && response.result) {
          const currentTheme = response.result as any;
          colors = mergeWithDefaults(currentTheme.colors);
        } else {
          colors = DEFAULT_COLORS;
        }
      } catch (error) {
        console.error('Failed to get current theme from CLI:', error);
        colors = DEFAULT_COLORS;
      }
    }

    this._postMessage('updateColors', { colors });
  }

  private async _applyTheme(themeName: string) {
    const themeKey = themeName.toLowerCase();

    try {
      // Use CLI to set current theme
      const response = await this._cliWorker.sendRequest('setCurrentTheme', {
        themeId: themeKey
      });

      if (response.status === 'success' && response.result) {
        const setThemeResponse = response.result as SetThemeResponse;
        if (setThemeResponse.colors) {
          this._currentTheme = themeName;

          // Determine if this is a built-in theme  
          this._isSystemTheme = !!COLOR_THEMES[themeKey];

          // Update colors from CLI response
          const mergedColors = mergeWithDefaults(setThemeResponse.colors as Partial<GuardColors>);
          await this._cm.update(CONFIG_KEYS.GUARD_COLORS_COMPLETE, mergedColors);
          await this._cm.update(CONFIG_KEYS.SELECTED_THEME, themeName);

          // Refresh all editor decorations immediately
          const decorationManager = getDecorationManager();
          if (decorationManager) {
            decorationManager.handleColorConfigurationChange(this._context);
          }

          this._postMessage('updateColors', { colors: mergedColors });
          this._postMessage('setThemeType', { isSystem: this._isSystemTheme });
        }
      } else {
        this._showError(`Failed to apply theme: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to apply theme via CLI:', error);

      // Fallback to local theme application
      let theme = COLOR_THEMES[themeKey];
      this._isSystemTheme = !!theme;

      if (!theme) {
        try {
          const customThemes = await this._getCustomThemes();
          if (customThemes[themeKey]) {
            theme = customThemes[themeKey];
            this._isSystemTheme = false;
          }
        } catch (customError) {
          console.error('Failed to get custom themes:', customError);
        }
      }

      if (theme) {
        this._currentTheme = themeName;

        // Update colors without showing notification
        const mergedColors = mergeWithDefaults(theme.colors);
        await this._cm.update(CONFIG_KEYS.GUARD_COLORS_COMPLETE, mergedColors);
        await this._cm.update(CONFIG_KEYS.SELECTED_THEME, themeName);

        this._postMessage('updateColors', { colors: mergedColors });
        this._postMessage('setThemeType', { isSystem: this._isSystemTheme });
      }
    }
  }

  private async _saveAsNewTheme(name: string, colors: GuardColors) {
    try {
      const response = await this._cliWorker.sendRequest('createTheme', {
        name: name,
        colors: colors
      });

      if (response.status === 'success') {
        const createResponse = response.result as CreateThemeResponse;
        const _themeId = createResponse.themeId || name.toLowerCase();

        // Update local state
        this._currentTheme = name;
        this._isSystemTheme = false;

        // Set as current theme
        void this._cliWorker.sendRequest('setCurrentTheme', {
          themeId: _themeId
        });

        this._showInfo(`Theme '${name}' saved successfully!`);
        void this._sendThemeList();

        // Update the dropdown selection
        setTimeout(() => {
          this._postMessage('setSelectedTheme', { theme: _themeId });
          this._postMessage('setThemeType', { isSystem: false });
        }, 100);
      } else {
        this._showError(`Failed to create theme: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to create theme via CLI:', error);
      this._showError(`Failed to create theme: ${error instanceof Error ? error.message : 'CLI unavailable'}`);

      // Fallback to local storage for backwards compatibility
      const customThemes = await this._getCustomThemes();
      const themeKey = name.toLowerCase();
      customThemes[themeKey] = {
        name: name,
        colors: colors
      };
      await this._cm.update(CONFIG_KEYS.CUSTOM_THEMES, customThemes);
      await this._cm.update(CONFIG_KEYS.SELECTED_THEME, name);

      this._currentTheme = name;
      this._isSystemTheme = false;
      this._showInfo(`Theme '${name}' saved locally!`);
      void this._sendThemeList();
    }
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

      const customThemes = await this._getCustomThemes();

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
        const builtInThemes = await this._getBuiltInThemes();
        const builtInThemeKeys = Object.keys(builtInThemes);
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
          nextTheme = builtInThemeKeys[0] || 'default';
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
      void this._sendThemeList();

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
    try {
      // Get current theme ID from state
      const currentThemeId = this._currentTheme.toLowerCase() || 'current';

      const response = await this._cliWorker.sendRequest('exportTheme', {
        themeId: currentThemeId
      });

      if (response.status === 'success' && response.result) {
        const exportResponse = response.result as ExportThemeResponse;
        const json = JSON.stringify(exportResponse.exportData, null, 2);
        void vscode.env.clipboard.writeText(json);
        this._showInfo('Theme copied to clipboard as JSON!');
      } else {
        this._showError(`Failed to export theme: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to export theme via CLI:', error);
      // Fallback to local export
      const colors = await this._getCurrentColorsFromWebview();
      if (colors) {
        const exportData = {
          name: this._currentTheme || 'Custom Theme',
          colors: colors,
          exportedAt: new Date().toISOString(),
          version: '1.0.0'
        };
        const json = JSON.stringify(exportData, null, 2);
        void vscode.env.clipboard.writeText(json);
        this._showInfo('Theme copied to clipboard as JSON (local export)!');
      }
    }
  }

  private async _importTheme() {
    try {
      const json = await vscode.env.clipboard.readText();

      if (!json || json.trim().length === 0) {
        this._showError('Clipboard is empty! Please copy a theme JSON first.');
        return;
      }

      const exportData = JSON.parse(json) as any;

      // Check if it's a proper export format or just colors
      if (exportData.exportedAt && exportData.version && exportData.colors) {
        // This is a proper CLI export format
        try {
          const response = await this._cliWorker.sendRequest('importTheme', {
            exportData: exportData
          });

          if (response.status === 'success' && response.result) {
            const importResponse = response.result as ImportThemeResponse;
            const themeId = importResponse.themeId;
            if (themeId) {
              void this._applyTheme(themeId);
              void this._sendThemeList();
            }
            this._showInfo('Theme imported successfully!');
          } else {
            this._showError(`Failed to import theme: ${response.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('Failed to import theme via CLI:', error);
          // Fallback to local import
          const mergedColors = mergeWithDefaults(exportData.colors as Partial<GuardColors>);
          this._postMessage('updateColors', { colors: mergedColors });
          this._showInfo('Theme imported locally from clipboard!');
        }
      } else if (exportData.permissions as any) {
        // This is just GuardColors format (legacy)
        const mergedColors = mergeWithDefaults(exportData as Partial<GuardColors>);
        this._postMessage('updateColors', { colors: mergedColors });
        this._showInfo('Theme colors applied from clipboard!');
      } else {
        this._showError('Invalid theme format: missing permissions object or export data');
      }
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

  private async _sendThemeList() {
    try {
      const customThemes = await this._getCustomThemes();
      const builtInThemes = await this._getBuiltInThemes();
      const customThemeNames = Object.keys(customThemes);
      const builtInThemeKeys = Object.keys(builtInThemes);

      // Create arrays with both key and display name for built-in themes
      const builtInThemesWithNames = builtInThemeKeys.map(key => ({
        key: key,
        name: builtInThemes[key]?.name || key
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
    } catch (error) {
      console.error('Failed to send theme list:', error);
      // Fallback to local themes
      const builtInThemeKeys = Object.keys(COLOR_THEMES);
      const builtInThemesWithNames = builtInThemeKeys.map(key => ({
        key: key,
        name: COLOR_THEMES[key]?.name || key
      }));

      this._postMessage('updateThemeList', {
        builtIn: builtInThemesWithNames,
        custom: []
      });
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = 'Guard Tag Color Customizer';
    const selectedTheme = this._cm.get(CONFIG_KEYS.SELECTED_THEME, 'default');
    this._panel.webview.html = ColorCustomizerHtmlBuilder.getHtmlForWebview(webview, selectedTheme, this._cm);

    setTimeout(() => {
      void this._sendThemeList();

      let selectedTheme = this._cm.get(CONFIG_KEYS.SELECTED_THEME, '');

      // If no theme is selected, default to 'default'
      if (!selectedTheme) {
        selectedTheme = 'default';
      }

      // Apply the theme to ensure colors and dropdown are in sync
      void this._applyTheme(selectedTheme);

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
    ColorCustomizerPanel.createOrShow(context);
  });
}