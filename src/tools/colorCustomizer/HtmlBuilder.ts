/**
 * HTML generation for the Color Customizer webview
 * Handles all HTML template generation and formatting
 */

import * as vscode from 'vscode';
import { GuardColors } from '../colorCustomizer';
import { COLOR_THEMES } from '../colorCustomizer';
import { getWebviewStyles, getWebviewJavaScript } from './webviewContent';
import { CONFIG_KEYS } from '../../utils/configurationManager';
import * as fs from 'fs';
import * as path from 'path';

export class ColorCustomizerHtmlBuilder {
  /**
   * Generate the complete HTML content for the webview
   */
  public static getHtmlForWebview(
    webview: vscode.Webview,
    selectedTheme: string,
    configManager: { get: <T>(key: string, defaultValue?: T) => T }
  ): string {
    // Use external module for CSS and JavaScript
    const css = getWebviewStyles();
    const previewLines = this.loadPreviewLines();
    const javascript = getWebviewJavaScript(previewLines);

    // Get the current theme colors for initial HTML generation
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

      return this.generatePermissionSection({
        id,
        title: titles[id] || id,
        defaultColor: perm.color,
        defaultEnabled: perm.enabled,
        defaultTransparency: perm.transparency,
        defaultBorderOpacity: perm.borderOpacity || 1.0,
        defaultHighlightEntireLine: perm.highlightEntireLine
      });
    }).join('');

    const lineNumbers = Array.from({ length: 65 }, (_, i) => `<div class="line-number">${i + 1}</div>`).join('');
    const codeLines = previewLines.map((line: any, i: number) => this.generateCodeLine(i, line.content)).join('');

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

  /**
   * Generate HTML for a permission section
   */
  private static generatePermissionSection(config: {
    id: string;
    title: string;
    defaultColor: string;
    defaultEnabled: boolean;
    defaultTransparency: number;
    defaultBorderOpacity: number;
    defaultHighlightEntireLine?: boolean;
  }): string {
    const transparency = Math.round(config.defaultTransparency * 100);
    const borderOpacity = Math.round(config.defaultBorderOpacity * 100);
    const highlightEntireLine = config.defaultHighlightEntireLine ?? false;

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
          <div class="color-row">
            <div style="width: 20px;"></div>
            <div class="color-control">
              <div style="width: 30px;"></div>
            </div>
            <div class="slider-control">
              <div class="toggle-switch" onclick="event.stopPropagation()" style="width: auto; min-width: 200px;">
                <label style="white-space: nowrap;">Highlight Entire Line</label>
                <input type="checkbox" id="${config.id}-highlightEntireLine" ${highlightEntireLine ? 'checked' : ''} onchange="updateHighlightEntireLine('${config.id}')" style="flex-shrink: 0;">
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  /**
   * Generate HTML for a code preview line
   */
  private static generateCodeLine(index: number, content: string): string {
    return `
      <div class="code-line" id="line${index + 1}">
        <div class="line-border"></div>
        <div class="line-content">${this.escapeHtml(content)}</div>
      </div>`;
  }

  /**
   * Escape HTML special characters
   */
  private static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Load preview lines from JSON resource file
   */
  private static loadPreviewLines(): any[] {
    try {
      const jsonPath = path.join(__dirname, 'resources', 'preview-lines.json');
      const jsonContent = fs.readFileSync(jsonPath, 'utf8');
      const data = JSON.parse(jsonContent);
      // Return only the content lines, not the hardcoded permissions
      return data.lines.map((line: any) => ({ content: line.content })) || [];
    } catch (error) {
      console.error('Failed to load preview lines:', error);
      // Return minimal fallback data
      return [
        { content: '// Failed to load preview data' },
        { content: '// Check resources/preview-lines.json' }
      ];
    }
  }
}