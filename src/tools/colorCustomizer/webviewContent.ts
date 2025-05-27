/**
 * Webview content for the Color Customizer
 * This file contains the CSS and JavaScript for the color customizer webview
 */

export function getWebviewStyles(): string {
  return `* { box-sizing: border-box; }
    
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
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .control-header {
      flex-shrink: 0;
      padding: 20px 20px 0 20px;
    }
    
    .control-content {
      flex: 1;
      overflow-y: auto;
      padding: 0 20px;
      padding-bottom: 20px;
    }
    
    .control-footer {
      flex-shrink: 0;
      padding: 0 20px 20px 20px;
      background: var(--vscode-sideBar-background);
      border-top: 1px solid var(--vscode-panel-border);
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
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .permission-title { 
      font-size: 14px; 
      font-weight: 500; 
    }
    
    .toggle-switch {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .toggle-switch label {
      font-size: 12px;
      opacity: 0.8;
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
    
    .color-preview {
      width: 32px;
      height: 32px;
      border-radius: 4px;
      border: 1px solid var(--vscode-panel-border);
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .color-preview:hover { transform: scale(1.05); }
    .color-input { display: none; }
    
    .color-label {
      font-size: 12px;
      white-space: nowrap;
      min-width: 80px;
    }
    
    .slider-control {
      display: grid;
      grid-template-columns: 100px 100px 40px;
      align-items: center;
      gap: 6px;
    }
    
    .slider-control.disabled { opacity: 0.5; pointer-events: none; }
    .color-control.disabled { opacity: 0.5; pointer-events: none; }
    
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
    
    .disabled { 
      opacity: 0.5; 
      pointer-events: none; 
    }
    
    /* Read-only mode styles */
    .control-panel.read-only {
      position: relative;
    }
    
    .control-panel.read-only::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--vscode-editor-background);
      opacity: 0.1;
      pointer-events: none;
    }
    
    .control-panel.read-only .permission-section {
      background: var(--vscode-editor-background) !important;
    }
    
    .control-panel.read-only .slider::-webkit-slider-thumb {
      background: var(--vscode-input-border) !important;
    }
    
    .buttons {
      margin-top: 20px;
    }
    
    .button-row {
      display: flex;
      gap: 10px;
    }
    
    .btn {
      flex: 1;
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn:hover { transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }
    
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    
    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
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
    }
    
    .editor-content {
      flex: 1;
      padding: 5px 0;
      overflow: visible;
      min-width: 0;
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
    
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    }
    
    .overlay.show {
      opacity: 1;
      pointer-events: all;
    }
    
    .dialog {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 24px;
      min-width: 400px;
      transform: translateY(20px);
      transition: transform 0.3s;
    }
    
    .overlay.show .dialog {
      transform: translateY(0);
    }
    
    .dialog h3 {
      margin: 0 0 16px 0;
    }
    
    .dialog input[type="text"] {
      width: 100%;
      padding: 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 4px;
      font-size: 14px;
    }
    
    .dialog input[type="text"]:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }
    
    .dialog-buttons {
      display: flex;
      gap: 10px;
      margin-top: 20px;
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
      position: relative;
      z-index: 1;
    }
    
    .permission-example {
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      text-align: center;
      border: 1px solid var(--vscode-panel-border);
      cursor: pointer;
      transition: background-color 0.2s, box-shadow 0.2s;
      user-select: none;
      position: relative;
    }
    
    .permission-example:hover {
      background-color: var(--vscode-list-hoverBackground);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
    }
    
    .permission-example:active {
      background-color: var(--vscode-list-activeSelectionBackground);
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

export function getWebviewJavaScript(previewLines: any[]): string {
  return `const vscode = acquireVsCodeApi();
    let currentColors = null;
    let savedColors = null;
    let hasChanges = false;
    let isLoadingTheme = true; // Start as loading until we get initial colors
    let colorLinks = {};
    const PREVIEW_LINES = ${JSON.stringify(previewLines)};
    
    // Initialize on load
    window.addEventListener('load', () => {
      const permissions = ['aiWrite', 'aiRead', 'aiNoAccess', 'humanWrite', 'humanRead', 'humanNoAccess', 'contextRead', 'contextWrite'];
      permissions.forEach(perm => {
        colorLinks[perm] = true;
      });
      
      // Set up permission example click handlers
      setupPermissionExampleHandlers();
      
      // Don't initialize button states here - wait for colors to load
      // updateButtonStates();
      
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
      
      // Add event listener for delete button
      const deleteBtn = document.getElementById('deleteThemeBtn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.preventDefault();
          deleteCurrentTheme();
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
          console.log('Received updateThemeList:', message.builtIn, message.custom);
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
          console.log('Received themeDeleted:', message);
          const themeSelect = document.getElementById('themeSelect');
          if (themeSelect) {
            // Update the dropdown to show the next theme if provided
            if (message.nextTheme) {
              console.log('Setting next theme:', message.nextTheme);
              // The theme list will be updated, and the new theme is already applied
              // Just update the UI to reflect the change
              setTimeout(() => {
                themeSelect.value = message.nextTheme;
                updateDeleteButton();
              }, 100);
            } else {
              console.log('No next theme, clearing selection');
              themeSelect.value = '';
              updateDeleteButton();
              updateThemeStatus(false);
            }
          }
          break;
      }
    });
    
    function openColorPicker(inputId) {
      const input = document.getElementById(inputId);
      if (input && !input.disabled) {
        input.click();
      }
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
      
      // Check if controls are disabled
      const icon = document.getElementById(permission + '-link');
      if (icon && icon.style.pointerEvents === 'none') {
        return;
      }
      
      colorLinks[permission] = !colorLinks[permission];
      icon.className = colorLinks[permission] ? 'link-icon linked' : 'link-icon unlinked';
      
      if (colorLinks[permission]) {
        const rowColor = document.getElementById(permission + '-color').value;
        document.getElementById(permission + '-minimapColor').value = rowColor;
      }
      updateColorPreview(permission);
      checkForChanges();
    }
    window.toggleColorLink = toggleColorLink;
    
    function updateMinimapColor(permission) {
      const minimapColor = document.getElementById(permission + '-minimapColor').value;
      if (colorLinks[permission]) {
        document.getElementById(permission + '-color').value = minimapColor;
      }
      updateColorPreview(permission);
      updatePreview();
      checkForChanges();
    }
    window.updateMinimapColor = updateMinimapColor;
    
    function updateRowColor(permission) {
      const rowColor = document.getElementById(permission + '-color').value;
      if (colorLinks[permission]) {
        document.getElementById(permission + '-minimapColor').value = rowColor;
      }
      updateColorPreview(permission);
      updatePreview();
      checkForChanges();
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
      checkForChanges();
    }
    window.toggleEnabled = toggleEnabled;
    
    function updateSlider(slider) {
      const value = slider.value;
      document.getElementById(slider.id + '-value').textContent = value + '%';
      
      const permission = slider.id.split('-')[0];
      updateColorPreview(permission);
      updatePreview();
      checkForChanges();
    }
    window.updateSlider = updateSlider;
    
    function checkForChanges() {
      if (!savedColors || isLoadingTheme) {
        // No baseline to compare against yet, or we're loading a theme
        hasChanges = false;
        updateButtonStates();
        return;
      }
      
      const currentColors = getColors();
      hasChanges = !colorsEqual(currentColors, savedColors);
      updateButtonStates();
    }
    
    function colorsEqual(colors1, colors2) {
      if (!colors1 || !colors2) return false;
      
      // Check borderBarEnabled
      if (colors1.borderBarEnabled !== colors2.borderBarEnabled) return false;
      
      // Check permissions
      const perms1 = colors1.permissions || {};
      const perms2 = colors2.permissions || {};
      
      const permTypes = ['aiWrite', 'aiRead', 'aiNoAccess', 'humanWrite', 'humanRead', 'humanNoAccess', 'contextRead', 'contextWrite'];
      
      for (const perm of permTypes) {
        const p1 = perms1[perm];
        const p2 = perms2[perm];
        
        if (!p1 || !p2) return false;
        
        if (p1.enabled !== p2.enabled ||
            p1.color !== p2.color ||
            Math.abs(p1.transparency - p2.transparency) > 0.001 ||
            Math.abs(p1.borderOpacity - p2.borderOpacity) > 0.001 ||
            p1.minimapColor !== p2.minimapColor) {
          return false;
        }
      }
      
      return true;
    }
    
    function updateButtonStates() {
      // Find buttons more specifically to avoid selecting dialog buttons
      const buttons = document.querySelectorAll('.control-footer .btn');
      
      buttons.forEach(button => {
        if (button.textContent === 'Apply Colors') {
          button.disabled = !hasChanges;
          button.style.opacity = hasChanges ? '1' : '0.5';
          button.style.cursor = hasChanges ? 'pointer' : 'not-allowed';
        } else if (button.textContent === 'Reset') {
          button.disabled = !hasChanges;
          button.style.opacity = hasChanges ? '1' : '0.5';
          button.style.cursor = hasChanges ? 'pointer' : 'not-allowed';
        }
      });
    }
    
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
      
      // We're about to update all colors from the extension
      isLoadingTheme = true;
      
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
      
      // Now save the new baseline after all UI is updated
      savedColors = JSON.parse(JSON.stringify(colors));
      hasChanges = false;
      isLoadingTheme = false;
      updateButtonStates();
    }
    
    function applyPreset(presetName) {
      if (presetName) {
        isLoadingTheme = true;
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
        // Re-enable controls when no theme is selected
        setControlsEnabled(true);
        return;
      }
      
      // Enable/disable all controls based on theme type
      setControlsEnabled(!isSystem);
      
      if (isSystem) {
        statusDiv.innerHTML = '🔒 Built-in theme (read-only) - Create a new theme to customize';
        statusDiv.style.display = 'block';
      } else {
        statusDiv.innerHTML = '✏️ Custom theme - You can modify all settings';
        statusDiv.style.display = 'block';
      }
    }
    
    function setControlsEnabled(enabled) {
      // Enable/disable all input controls
      const inputs = document.querySelectorAll('input[type="color"], input[type="range"], input[type="checkbox"]');
      const colorPreviews = document.querySelectorAll('.color-preview');
      const linkIcons = document.querySelectorAll('.link-icon');
      const sliders = document.querySelectorAll('.slider');
      
      inputs.forEach(input => {
        input.disabled = !enabled;
        if (input.type === 'checkbox') {
          input.style.cursor = enabled ? 'pointer' : 'not-allowed';
        }
      });
      
      // Update sliders with visual feedback
      sliders.forEach(slider => {
        slider.style.cursor = enabled ? 'pointer' : 'not-allowed';
        slider.style.opacity = enabled ? '1' : '0.4';
        if (!enabled) {
          slider.style.background = 'var(--vscode-input-background)';
        } else {
          slider.style.background = 'var(--vscode-scrollbarSlider-background)';
        }
      });
      
      // Update color preview interactivity
      colorPreviews.forEach(preview => {
        preview.style.cursor = enabled ? 'pointer' : 'not-allowed';
        preview.style.opacity = enabled ? '1' : '0.5';
        if (!enabled) {
          preview.style.filter = 'grayscale(0.5)';
        } else {
          preview.style.filter = 'none';
        }
      });
      
      // Update link icons
      linkIcons.forEach(icon => {
        icon.style.cursor = enabled ? 'pointer' : 'not-allowed';
        icon.style.opacity = enabled ? '1' : '0.4';
        icon.style.pointerEvents = enabled ? 'auto' : 'none';
      });
      
      // Remove this - Apply Colors state should only be controlled by hasChanges
      // Don't enable/disable based on theme type
      
      // Update visual feedback for permission sections
      const sections = document.querySelectorAll('.permission-section');
      sections.forEach(section => {
        section.style.cursor = enabled ? 'pointer' : 'not-allowed';
        if (!enabled) {
          section.style.background = 'var(--vscode-input-background)';
          section.style.opacity = '0.7';
          section.style.borderColor = 'var(--vscode-input-border)';
        } else {
          section.style.background = 'var(--vscode-input-background)';
          section.style.opacity = '1';
          section.style.borderColor = 'transparent';
        }
      });
      
      // Update slider controls and labels
      const sliderControls = document.querySelectorAll('.slider-control');
      sliderControls.forEach(control => {
        if (!enabled) {
          control.style.opacity = '0.5';
        } else {
          control.style.opacity = '1';
        }
      });
      
      // Make the entire control panel look disabled
      const controlPanel = document.querySelector('.control-panel');
      if (controlPanel) {
        controlPanel.style.cursor = enabled ? 'auto' : 'not-allowed';
        if (!enabled) {
          controlPanel.classList.add('read-only');
        } else {
          controlPanel.classList.remove('read-only');
        }
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
      
      // Send delete request to extension which will handle confirmation
      vscode.postMessage({
        command: 'deleteTheme',
        name: themeName
      });
      
      // Don't clear the dropdown here - wait for the response
      // The extension will tell us what to do based on whether the user confirmed
    }
    window.deleteCurrentTheme = deleteCurrentTheme;
    
    function updateThemeList(builtIn, custom, preserveSelection = true) {
      const select = document.getElementById('themeSelect');
      const currentValue = preserveSelection ? select.value : '';
      
      select.innerHTML = '<option value="">Choose a theme...</option>';
      
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
      
      if (currentValue && preserveSelection) {
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
      
      // After saving, update the saved colors and reset change state
      savedColors = JSON.parse(JSON.stringify(colors));
      hasChanges = false;
      updateButtonStates();
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
    
    function focusPermission(permissionId) {
      // Check if controls are enabled (not in read-only mode)
      const firstInput = document.querySelector('input[type="checkbox"]');
      if (firstInput && firstInput.disabled) {
        return; // Don't allow focus in read-only mode
      }
      
      document.querySelectorAll('.permission-section').forEach(section => {
        section.classList.remove('focused');
      });
      
      // Find and focus the clicked section
      const sections = document.querySelectorAll('.permission-section');
      sections.forEach(section => {
        const checkbox = section.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.id === permissionId + '-enabled') {
          section.classList.add('focused');
        }
      });
      
      // Navigate to the corresponding preview
      navigateToPermission(permissionId);
    }
    window.focusPermission = focusPermission;
    
    function setupPermissionExampleHandlers() {
      const exampleMap = {
        'ex-aiWrite': 'aiWrite',
        'ex-aiRead': 'aiRead',
        'ex-aiNoAccess': 'aiNoAccess',
        'ex-humanWrite': 'humanWrite',
        'ex-humanRead': 'humanRead',
        'ex-humanNoAccess': 'humanNoAccess',
        'ex-contextRead': 'contextRead',
        'ex-contextWrite': 'contextWrite'
      };
      
      Object.entries(exampleMap).forEach(([exampleId, permissionId]) => {
        const element = document.getElementById(exampleId);
        if (element) {
          element.addEventListener('click', () => {
            navigateToPermission(permissionId);
          });
        }
      });
      
      // Handle mixed examples
      const mixed1 = document.getElementById('ex-mixed1');
      if (mixed1) {
        mixed1.addEventListener('click', () => {
          navigateToPermission('aiWrite');
        });
      }
      
      const mixed2 = document.getElementById('ex-mixed2');
      if (mixed2) {
        mixed2.addEventListener('click', () => {
          navigateToPermission('aiRead');
        });
      }
    }
    
    function navigateToPermission(permissionId) {
      // Find the permission section
      const sections = document.querySelectorAll('.permission-section');
      let targetSection = null;
      
      sections.forEach(section => {
        const checkbox = section.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.id === permissionId + '-enabled') {
          targetSection = section;
        }
      });
      
      if (targetSection) {
        // Scroll the permission section into view
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight the section
        sections.forEach(s => s.classList.remove('focused'));
        targetSection.classList.add('focused');
        
        // Also scroll the corresponding preview block into view if possible
        const previewIndex = findPreviewLineForPermission(permissionId);
        if (previewIndex >= 0) {
          setTimeout(() => {
            // Find the entire guard block
            const startLine = document.getElementById('line' + (previewIndex + 1));
            if (!startLine) return;
            
            // Find the end of the guard block (look for @guard:end)
            let endIndex = previewIndex;
            for (let i = previewIndex + 1; i < PREVIEW_LINES.length; i++) {
              if (PREVIEW_LINES[i].content.includes('@guard:end')) {
                endIndex = i;
                break;
              }
            }
            
            const endLine = document.getElementById('line' + (endIndex + 1));
            if (!endLine) return;
            
            // The scrollable container is .editor-container
            const editorContainer = document.querySelector('.editor-container');
            if (!editorContainer) return;
            
            // Get the editor content element that contains the lines
            const editorContent = document.querySelector('.editor-content');
            if (!editorContent) return;
            
            // Calculate the block's position and height
            let blockTop = 0;
            let element = startLine;
            while (element && element !== editorContent) {
              blockTop += element.offsetTop;
              element = element.offsetParent;
            }
            
            let blockBottom = 0;
            element = endLine;
            while (element && element !== editorContent) {
              blockBottom += element.offsetTop;
              element = element.offsetParent;
            }
            blockBottom += endLine.offsetHeight;
            
            const blockHeight = blockBottom - blockTop;
            const containerHeight = editorContainer.clientHeight;
            
            // If block fits in viewport, center it. Otherwise, show from top with some padding
            let targetScroll;
            if (blockHeight <= containerHeight - 40) {
              // Center the block
              targetScroll = blockTop - (containerHeight / 2) + (blockHeight / 2);
            } else {
              // Show from top with 20px padding
              targetScroll = blockTop - 20;
            }
            
            // Smooth scroll to the calculated position
            editorContainer.scrollTo({
              top: Math.max(0, targetScroll),
              behavior: 'smooth'
            });
          }, 100); // Short delay to ensure DOM is ready
        }
      }
    }
    
    function findPreviewLineForPermission(permissionId) {
      // Find the first guard comment line for this permission type
      for (let i = 0; i < PREVIEW_LINES.length; i++) {
        const line = PREVIEW_LINES[i];
        const content = line.content.toLowerCase();
        
        // Look for guard comments
        if (content.includes('// @guard:')) {
          if (permissionId === 'aiWrite' && content.includes('ai:w')) return i;
          if (permissionId === 'aiRead' && content.includes('ai:r')) return i;
          if (permissionId === 'aiNoAccess' && content.includes('ai:n')) return i;
          if (permissionId === 'humanWrite' && content.includes('human:w')) return i;
          if (permissionId === 'humanRead' && content.includes('human:r')) return i;
          if (permissionId === 'humanNoAccess' && content.includes('human:n')) return i;
          if (permissionId === 'contextRead' && content.includes('context:r')) return i;
          if (permissionId === 'contextWrite' && content.includes('context:w')) return i;
        }
      }
      return -1;
    }
  `;
}