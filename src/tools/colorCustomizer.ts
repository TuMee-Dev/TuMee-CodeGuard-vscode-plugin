import * as vscode from 'vscode';
import { getExtensionWithOptionalName } from '@/utils';

export interface GuardColors {
  aiWrite: string;
  aiNoAccess: string;
  humanReadOnly: string;
  humanNoAccess: string;
  context: string;
  opacity: number;
}

// Default colors
const DEFAULT_COLORS: GuardColors = {
  aiWrite: '#FFA500',      // Yellow/Amber for AI write
  aiNoAccess: '#90EE90',   // Light green for AI no access
  humanReadOnly: '#D3D3D3', // Light grey for human read-only
  humanNoAccess: '#FF0000', // Red for human no access
  context: '#00CED1',      // Light blue/cyan for AI context
  opacity: 0.3
};

// Preset themes
const COLOR_THEMES = {
  default: {
    name: 'Default',
    colors: DEFAULT_COLORS
  },
  darkMode: {
    name: 'Dark Mode',
    colors: {
      aiWrite: '#EF5350',
      aiNoAccess: '#66BB6A',
      humanReadOnly: '#AB47BC',
      humanNoAccess: '#FFA726',
      context: '#26C6DA',
      opacity: 0.15
    }
  },
  highContrast: {
    name: 'High Contrast',
    colors: {
      aiWrite: '#FF0000',
      aiNoAccess: '#00FF00',
      humanReadOnly: '#FF00FF',
      humanNoAccess: '#FF8800',
      context: '#00FFFF',
      opacity: 0.2
    }
  },
  subtle: {
    name: 'Subtle',
    colors: {
      aiWrite: '#FFCDD2',
      aiNoAccess: '#C8E6C9',
      humanReadOnly: '#E1BEE7',
      humanNoAccess: '#FFE0B2',
      context: '#B2EBF2',
      opacity: 0.3
    }
  },
  professional: {
    name: 'Professional',
    colors: {
      aiWrite: '#D32F2F',
      aiNoAccess: '#388E3C',
      humanReadOnly: '#7B1FA2',
      humanNoAccess: '#F57C00',
      context: '#0097A7',
      opacity: 0.1
    }
  }
};

export class ColorCustomizerPanel {
  public static currentPanel: ColorCustomizerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message: { command: string; colors?: GuardColors; theme?: string }) => {
        switch (message.command) {
          case 'saveColors':
            if (message.colors) {
              void this._saveColors(message.colors);
            }
            return;
          case 'applyTheme':
            if (message.theme) {
              this._applyTheme(message.theme);
            }
            return;
          case 'getCurrentColors':
            void this._sendCurrentColors();
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (ColorCustomizerPanel.currentPanel) {
      ColorCustomizerPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'colorCustomizer',
      'Guard Tag Color Customizer',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    ColorCustomizerPanel.currentPanel = new ColorCustomizerPanel(panel, extensionUri);
  }

  private async _saveColors(colors: GuardColors) {
    const config = vscode.workspace.getConfiguration(getExtensionWithOptionalName());

    await config.update('guardColors', colors, vscode.ConfigurationTarget.Global);

    void vscode.window.showInformationMessage('Guard tag colors saved successfully!');

    // Fire a configuration change event to update decorations
    void vscode.commands.executeCommand('tumee-vscode-plugin.refreshDecorations');
  }

  private _applyTheme(themeName: string) {
    const theme = COLOR_THEMES[themeName as keyof typeof COLOR_THEMES];
    if (theme) {
      // Send theme colors back to webview
      void this._panel.webview.postMessage({
        command: 'updateColors',
        colors: theme.colors
      });
    }
  }

  private _sendCurrentColors() {
    const config = vscode.workspace.getConfiguration(getExtensionWithOptionalName());
    const savedColors = config.get<GuardColors>('guardColors') || DEFAULT_COLORS;

    void this._panel.webview.postMessage({
      command: 'updateColors',
      colors: savedColors
    });
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = 'Guard Tag Color Customizer';
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(_webview: vscode.Webview) {
    // Generate theme options
    const themeOptions = Object.entries(COLOR_THEMES).map(([key, theme]) =>
      `<button class="theme-btn" onclick="applyTheme('${key}')">${theme.name}</button>`
    ).join('');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Guard Tag Color Customizer</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                padding: 20px;
                line-height: 1.6;
            }
            
            .container {
                max-width: 600px;
                margin: 0 auto;
            }
            
            h1 {
                color: var(--vscode-foreground);
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: 10px;
            }
            
            .preset-section {
                margin-bottom: 30px;
            }
            
            .theme-buttons {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 10px;
            }
            
            .theme-btn {
                padding: 8px 16px;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .theme-btn:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            
            .custom-section {
                margin-top: 20px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                overflow: hidden;
            }
            
            .custom-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 15px;
                background-color: var(--vscode-editor-lineHighlightBackground);
                cursor: pointer;
                user-select: none;
            }
            
            .custom-header:hover {
                background-color: var(--vscode-list-hoverBackground);
            }
            
            .chevron {
                transition: transform 0.3s;
                font-size: 18px;
            }
            
            .chevron.expanded {
                transform: rotate(90deg);
            }
            
            .custom-content {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease-out;
            }
            
            .custom-content.expanded {
                max-height: 500px;
                transition: max-height 0.3s ease-in;
            }
            
            .color-grid {
                padding: 20px;
                display: grid;
                gap: 20px;
            }
            
            .color-item {
                display: grid;
                grid-template-columns: 1fr auto;
                align-items: center;
                gap: 15px;
            }
            
            .color-label {
                font-size: 14px;
                color: var(--vscode-foreground);
            }
            
            .color-input-wrapper {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .color-input {
                width: 80px;
                height: 35px;
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                cursor: pointer;
                background-color: var(--vscode-input-background);
            }
            
            .color-hex {
                font-family: monospace;
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                width: 70px;
            }
            
            .opacity-section {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid var(--vscode-panel-border);
            }
            
            .opacity-wrapper {
                display: grid;
                grid-template-columns: auto 1fr auto;
                align-items: center;
                gap: 15px;
            }
            
            .opacity-slider {
                width: 100%;
                height: 4px;
                -webkit-appearance: none;
                appearance: none;
                background: var(--vscode-scrollbarSlider-background);
                outline: none;
                border-radius: 2px;
            }
            
            .opacity-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                background: var(--vscode-button-background);
                cursor: pointer;
                border-radius: 50%;
            }
            
            .opacity-value {
                font-family: monospace;
                font-size: 14px;
                color: var(--vscode-descriptionForeground);
                min-width: 40px;
                text-align: right;
            }
            
            .action-buttons {
                margin-top: 30px;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            .btn-primary {
                padding: 10px 20px;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
            }
            
            .btn-primary:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            
            .btn-secondary {
                padding: 10px 20px;
                background-color: transparent;
                color: var(--vscode-foreground);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }
            
            .btn-secondary:hover {
                background-color: var(--vscode-list-hoverBackground);
            }
            
            .preview-section {
                margin-top: 30px;
                padding: 20px;
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
            }
            
            .preview-title {
                font-size: 14px;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 10px;
            }
            
            .preview-item {
                padding: 8px 12px;
                margin: 5px 0;
                border-radius: 4px;
                font-family: monospace;
                font-size: 13px;
                border-left: 3px solid;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎨 Guard Tag Color Customizer</h1>
            
            <div class="preset-section">
                <h3>Quick Presets</h3>
                <div class="theme-buttons">
                    ${themeOptions}
                </div>
            </div>
            
            <div class="custom-section">
                <div class="custom-header" onclick="toggleCustomSection()">
                    <h3 style="margin: 0;">Custom Colors</h3>
                    <span class="chevron" id="chevron">›</span>
                </div>
                
                <div class="custom-content" id="customContent">
                    <div class="color-grid">
                        <div class="color-item">
                            <label class="color-label">AI Write Access</label>
                            <div class="color-input-wrapper">
                                <input type="color" id="aiWrite" class="color-input" value="#FFA500" onchange="updateColorHex(this)">
                                <span class="color-hex" id="aiWrite-hex">#FFA500</span>
                            </div>
                        </div>
                        
                        <div class="color-item">
                            <label class="color-label">AI No Access</label>
                            <div class="color-input-wrapper">
                                <input type="color" id="aiNoAccess" class="color-input" value="#90EE90" onchange="updateColorHex(this)">
                                <span class="color-hex" id="aiNoAccess-hex">#90EE90</span>
                            </div>
                        </div>
                        
                        <div class="color-item">
                            <label class="color-label">Human Read-Only</label>
                            <div class="color-input-wrapper">
                                <input type="color" id="humanReadOnly" class="color-input" value="#D3D3D3" onchange="updateColorHex(this)">
                                <span class="color-hex" id="humanReadOnly-hex">#D3D3D3</span>
                            </div>
                        </div>
                        
                        <div class="color-item">
                            <label class="color-label">Human No Access</label>
                            <div class="color-input-wrapper">
                                <input type="color" id="humanNoAccess" class="color-input" value="#FF0000" onchange="updateColorHex(this)">
                                <span class="color-hex" id="humanNoAccess-hex">#FF0000</span>
                            </div>
                        </div>
                        
                        <div class="color-item">
                            <label class="color-label">Context Information</label>
                            <div class="color-input-wrapper">
                                <input type="color" id="context" class="color-input" value="#00CED1" onchange="updateColorHex(this)">
                                <span class="color-hex" id="context-hex">#00CED1</span>
                            </div>
                        </div>
                        
                        <div class="opacity-section">
                            <div class="opacity-wrapper">
                                <label class="color-label">Background Opacity</label>
                                <input type="range" id="opacity" class="opacity-slider" 
                                       min="0" max="100" value="30" 
                                       oninput="updateOpacity(this)">
                                <span class="opacity-value" id="opacity-value">30%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="preview-section">
                <div class="preview-title">Preview</div>
                <div class="preview-item" id="preview-aiWrite" style="background-color: rgba(255, 165, 0, 0.3); border-left-color: #FFA500;">
                    // @guard:ai:w - AI can write this code
                </div>
                <div class="preview-item" id="preview-aiNoAccess" style="background-color: rgba(144, 238, 144, 0.3); border-left-color: #90EE90;">
                    // @guard:human:w - AI has no access
                </div>
                <div class="preview-item" id="preview-humanReadOnly" style="background-color: rgba(211, 211, 211, 0.3); border-left-color: #D3D3D3;">
                    // @guard:human:r - Human read-only
                </div>
                <div class="preview-item" id="preview-humanNoAccess" style="background-color: rgba(255, 0, 0, 0.3); border-left-color: #FF0000;">
                    // @guard:human:n - Human no access
                </div>
                <div class="preview-item" id="preview-context" style="background-color: rgba(0, 206, 209, 0.3); border-left-color: #00CED1;">
                    // @guard:ai:context - Context for AI
                </div>
            </div>
            
            <div class="action-buttons">
                <button class="btn-secondary" onclick="resetColors()">Reset to Default</button>
                <button class="btn-primary" onclick="saveColors()">Save Colors</button>
            </div>
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            let currentOpacity = 0.3;
            
            // Request current colors when the webview loads
            window.addEventListener('load', () => {
                vscode.postMessage({ command: 'getCurrentColors' });
            });
            
            // Handle messages from the extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'updateColors':
                        updateAllColors(message.colors);
                        break;
                }
            });
            
            function toggleCustomSection() {
                const content = document.getElementById('customContent');
                const chevron = document.getElementById('chevron');
                
                content.classList.toggle('expanded');
                chevron.classList.toggle('expanded');
            }
            
            function updateColorHex(input) {
                const hexSpan = document.getElementById(input.id + '-hex');
                hexSpan.textContent = input.value.toUpperCase();
                updatePreview();
            }
            
            function updateOpacity(slider) {
                const value = slider.value;
                document.getElementById('opacity-value').textContent = value + '%';
                currentOpacity = value / 100;
                updatePreview();
            }
            
            function updatePreview() {
                const colors = getColors();
                const opacity = currentOpacity;
                
                // Update preview items
                updatePreviewItem('preview-aiWrite', colors.aiWrite, opacity);
                updatePreviewItem('preview-aiNoAccess', colors.aiNoAccess, opacity);
                updatePreviewItem('preview-humanReadOnly', colors.humanReadOnly, opacity);
                updatePreviewItem('preview-humanNoAccess', colors.humanNoAccess, opacity);
                updatePreviewItem('preview-context', colors.context, opacity);
            }
            
            function updatePreviewItem(id, color, opacity) {
                const item = document.getElementById(id);
                const rgb = hexToRgb(color);
                item.style.backgroundColor = \`rgba(\${rgb.r}, \${rgb.g}, \${rgb.b}, \${opacity})\`;
                item.style.borderLeftColor = color;
            }
            
            function hexToRgb(hex) {
                const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : null;
            }
            
            function getColors() {
                return {
                    aiWrite: document.getElementById('aiWrite').value,
                    aiNoAccess: document.getElementById('aiNoAccess').value,
                    humanReadOnly: document.getElementById('humanReadOnly').value,
                    humanNoAccess: document.getElementById('humanNoAccess').value,
                    context: document.getElementById('context').value,
                    opacity: currentOpacity
                };
            }
            
            function updateAllColors(colors) {
                document.getElementById('aiWrite').value = colors.aiWrite;
                document.getElementById('aiNoAccess').value = colors.aiNoAccess;
                document.getElementById('humanReadOnly').value = colors.humanReadOnly;
                document.getElementById('humanNoAccess').value = colors.humanNoAccess;
                document.getElementById('context').value = colors.context;
                
                document.getElementById('aiWrite-hex').textContent = colors.aiWrite.toUpperCase();
                document.getElementById('aiNoAccess-hex').textContent = colors.aiNoAccess.toUpperCase();
                document.getElementById('humanReadOnly-hex').textContent = colors.humanReadOnly.toUpperCase();
                document.getElementById('humanNoAccess-hex').textContent = colors.humanNoAccess.toUpperCase();
                document.getElementById('context-hex').textContent = colors.context.toUpperCase();
                
                if (colors.opacity !== undefined) {
                    currentOpacity = colors.opacity;
                    const opacityPercent = Math.round(colors.opacity * 100);
                    document.getElementById('opacity').value = opacityPercent;
                    document.getElementById('opacity-value').textContent = opacityPercent + '%';
                }
                
                updatePreview();
            }
            
            function applyTheme(themeName) {
                vscode.postMessage({
                    command: 'applyTheme',
                    theme: themeName
                });
            }
            
            function saveColors() {
                const colors = getColors();
                vscode.postMessage({
                    command: 'saveColors',
                    colors: colors
                });
            }
            
            function resetColors() {
                applyTheme('default');
            }
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