/**
 * Webview content for the Color Customizer
 * This file contains the JavaScript for the color customizer webview
 */

import * as fs from 'fs';
import * as path from 'path';

export function getWebviewStyles(): string {
  try {
    // Read CSS from external file (webpack copies it to tools/colorCustomizer/styles.css)
    const cssPath = path.join(__dirname, 'tools', 'colorCustomizer', 'styles.css');
    return fs.readFileSync(cssPath, 'utf8');
  } catch (error) {
    // This should never happen in production - the CSS file must be bundled
    throw new Error(`Critical error: styles.css not found at ${path.join(__dirname, 'tools', 'colorCustomizer', 'styles.css')}. This indicates a packaging issue.`);
  }
}

export function getWebviewJavaScript(previewLines: any[]): string {
  return `const vscode = acquireVsCodeApi();
    let currentColors = null;
    let savedColors = null;
    let hasChanges = false;
    let isLoadingTheme = true; // Start as loading until we get initial colors
    let colorLinks = {};
    const PREVIEW_LINES = ${JSON.stringify(previewLines)};
    
    // Constants for code organization and DRY principles
    const PERMISSION_TYPES = ['aiWrite', 'aiRead', 'aiNoAccess', 'humanWrite', 'humanRead', 'humanNoAccess', 'contextRead', 'contextWrite'];
    const PERMISSION_FIELDS = ['enabled', 'color', 'minimapColor', 'transparency', 'borderOpacity', 'link'];
    
    // Permission configuration for dynamic generation
    const PERMISSION_CONFIG = [
      { id: 'aiWrite', title: 'AI Write', category: 'AI Permissions' },
      { id: 'aiRead', title: 'AI Read', category: 'AI Permissions' },
      { id: 'aiNoAccess', title: 'AI No Access', category: 'AI Permissions' },
      { id: 'humanWrite', title: 'Human Write', category: 'Human Permissions' },
      { id: 'humanRead', title: 'Human Read', category: 'Human Permissions' },
      { id: 'humanNoAccess', title: 'Human No Access', category: 'Human Permissions' },
      { id: 'contextRead', title: 'Context Read', category: 'Context' },
      { id: 'contextWrite', title: 'Context Write', category: 'Context' }
    ];
    
    // Helper functions for DOM manipulation
    function getPermissionElements(permission) {
      const elements = {};
      PERMISSION_FIELDS.forEach(field => {
        const elementId = permission + '-' + field;
        elements[field] = document.getElementById(elementId);
      });
      return elements;
    }
    
    function setRgbaStyle(element, property, hexColor, opacity) {
      if (!element) return;
      if (!hexColor) {
        element.style[property] = '';
        return;
      }
      const rgb = hexToRgb(hexColor);
      if (rgb) {
        element.style[property] = \`rgba(\${rgb.r}, \${rgb.g}, \${rgb.b}, \${opacity})\`;
      }
    }
    
    function setBorderStyle(element, hexColor, opacity, width = '3px') {
      if (!element) return;
      if (!hexColor) {
        element.style.borderLeft = '';
        return;
      }
      const rgb = hexToRgb(hexColor);
      if (rgb) {
        element.style.borderLeft = \`\${width} solid rgba(\${rgb.r}, \${rgb.g}, \${rgb.b}, \${opacity})\`;
      }
    }
    
    function getConfigKey(type, perm) {
      if (perm === 'context') return 'contextRead';
      if (perm === 'contextWrite') return 'contextWrite';
      return (type === 'ai' ? 'ai' : type) + capitalizeFirst(perm);
    }
    
    function processPermissions(callback) {
      PERMISSION_TYPES.forEach(permission => {
        const elements = getPermissionElements(permission);
        callback(permission, elements);
      });
    }
    
    // Generate permission section HTML dynamically
    function generatePermissionSection(config) {
      // Get colors from the current theme or use defaults
      const defaultColors = {
        aiWrite: '#FFA500', aiRead: '#808080', aiNoAccess: '#90EE90',
        humanWrite: '#0000FF', humanRead: '#D3D3D3', humanNoAccess: '#FF0000',
        contextRead: '#00CED1', contextWrite: '#1E90FF'
      };
      
      const permission = currentColors?.permissions?.[config.id];
      const color = permission?.color || defaultColors[config.id] || '#000000';
      const enabled = permission?.enabled !== false;
      const transparency = Math.round((permission?.transparency || 0.2) * 100);
      const borderOpacity = Math.round((permission?.borderOpacity || 1.0) * 100);
      
      return \`
        <div class="permission-section" onclick="focusPermission('\${config.id}')">
          <div class="permission-header">
            <div class="permission-title">\${config.title}</div>
            <div class="toggle-switch">
              <label>Enabled</label>
              <input type="checkbox" id="\${config.id}-enabled" \${enabled ? 'checked' : ''} onchange="toggleEnabled('\${config.id}')">
            </div>
          </div>
          <div class="permission-controls">
            <span class="link-icon linked" id="\${config.id}-link" onclick="toggleColorLink(event, '\${config.id}')" title="Link/unlink colors"></span>
            <div class="color-row">
              <div style="width: 20px;"></div>
              <div class="color-control">
                <div class="color-preview" id="\${config.id}-minimapColor-preview" onclick="openColorPicker('\${config.id}-minimapColor')"></div>
                <input type="color" id="\${config.id}-minimapColor" class="color-input" value="\${color}" onchange="updateMinimapColor('\${config.id}')" style="display: none;">
                <label class="color-label">Minimap/Border</label>
              </div>
              <div class="slider-control">
                <label class="color-label">Border Opacity</label>
                <input type="range" id="\${config.id}-borderOpacity" class="slider" min="0" max="100" value="\${borderOpacity}" oninput="updateSlider(this)">
                <span class="slider-value" id="\${config.id}-borderOpacity-value">\${borderOpacity}%</span>
              </div>
            </div>
            <div class="color-row">
              <div style="width: 20px;"></div>
              <div class="color-control">
                <div class="color-preview" id="\${config.id}-color-preview" onclick="openColorPicker('\${config.id}-color')"></div>
                <input type="color" id="\${config.id}-color" class="color-input" value="\${color}" onchange="updateRowColor('\${config.id}')" style="display: none;">
                <label class="color-label">Row</label>
              </div>
              <div class="slider-control">
                <label class="color-label">Row Opacity</label>
                <input type="range" id="\${config.id}-transparency" class="slider" min="0" max="100" value="\${transparency}" oninput="updateSlider(this)">
                <span class="slider-value" id="\${config.id}-transparency-value">\${transparency}%</span>
              </div>
            </div>
          </div>
        </div>\`;
    }
    
    // Generate all permission sections
    function generateAllPermissionSections() {
      return PERMISSION_CONFIG.map(config => generatePermissionSection(config)).join('');
    }
    
    // Initialize on load
    window.addEventListener('load', () => {
      PERMISSION_TYPES.forEach(perm => {
        colorLinks[perm] = true;
      });
      
      // Generate initial permission sections
      const controlContent = document.querySelector('.control-content');
      if (controlContent) {
        controlContent.innerHTML = generateAllPermissionSections();
        // Initialize color previews after a short delay
        setTimeout(() => {
          PERMISSION_TYPES.forEach(perm => {
            updateColorPreview(perm);
          });
        }, 100);
      }
      
      // Set up permission example click handlers
      setupPermissionExampleHandlers();
      
      // Initialize mix pattern dropdown to default if not set
      const mixPatternSelect = document.getElementById('mixPatternSelect');
      if (mixPatternSelect && !mixPatternSelect.value) {
        mixPatternSelect.value = 'humanBorder';
      }
      
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
        case 'restoreDefaultPermissions':
          if (message.defaultAiWrite !== undefined) {
            const aiWriteCheckbox = document.getElementById('defaultAiWrite');
            if (aiWriteCheckbox) {
              aiWriteCheckbox.checked = message.defaultAiWrite;
            }
          }
          if (message.defaultHumanWrite !== undefined) {
            const humanWriteCheckbox = document.getElementById('defaultHumanWrite');
            if (humanWriteCheckbox) {
              humanWriteCheckbox.checked = message.defaultHumanWrite;
            }
          }
          // Update preview with restored defaults
          updatePreview();
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
      const minimapColor = getElementValue(permission + '-minimapColor');
      const borderOpacity = getElementValue(permission + '-borderOpacity', '100') / 100;
      const minimapPreview = getElement(permission + '-minimapColor-preview');
      setRgbaStyle(minimapPreview, 'backgroundColor', minimapColor, borderOpacity);
      
      const rowColor = getElementValue(permission + '-color');
      const rowOpacity = getElementValue(permission + '-transparency', '20') / 100;
      const rowPreview = getElement(permission + '-color-preview');
      setRgbaStyle(rowPreview, 'backgroundColor', rowColor, rowOpacity);
    }
    
    function toggleColorLink(event, permission) {
      event.stopPropagation();
      
      // Check if controls are disabled
      const elements = getPermissionElements(permission);
      if (elements.link && elements.link.style.pointerEvents === 'none') {
        return;
      }
      
      colorLinks[permission] = !colorLinks[permission];
      elements.link.className = colorLinks[permission] ? 'link-icon linked' : 'link-icon unlinked';
      
      if (colorLinks[permission]) {
        const rowColor = getElementValue(permission + '-color');
        setElementValue(permission + '-minimapColor', rowColor);
      }
      updateColorPreview(permission);
      checkForChanges();
    }
    window.toggleColorLink = toggleColorLink;
    
    // Unified color update function
    function updateColor(permission, isRow) {
      const sourceId = permission + (isRow ? '-color' : '-minimapColor');
      const targetId = permission + (isRow ? '-minimapColor' : '-color');
      const color = getElementValue(sourceId);
      
      if (colorLinks[permission]) {
        setElementValue(targetId, color);
      }
      updateColorPreview(permission);
      updatePreview();
      checkForChanges();
    }
    
    window.updateMinimapColor = (permission) => updateColor(permission, false);
    window.updateRowColor = (permission) => updateColor(permission, true);
    
    function updateMixPattern(pattern) {
      if (!isLoadingTheme) {
        checkForChanges();
      }
      updatePreview();
    }
    window.updateMixPattern = updateMixPattern;
    
    function toggleEnabled(permission) {
      const elements = getPermissionElements(permission);
      const enabled = elements.enabled.checked;
      
      // Toggle enabled state for all permission controls
      Object.values(elements).forEach(control => {
        if (control && control !== elements.enabled) {
          if (enabled) {
            control.classList.remove('disabled');
            control.disabled = false;
          } else {
            control.classList.add('disabled');
            control.disabled = true;
          }
        }
      });
      
      const enabledCheckbox = elements.enabled;
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
      
      
      // Check mixPattern
      if (colors1.mixPattern !== colors2.mixPattern) return false;
      
      // Check permissions
      const perms1 = colors1.permissions || {};
      const perms2 = colors2.permissions || {};
      
      const permTypes = PERMISSION_TYPES;
      
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
      const buttons = document.querySelectorAll('.control-footer .btn');
      const buttonNames = ['Apply Colors', 'Reset'];
      
      buttons.forEach(button => {
        if (buttonNames.includes(button.textContent)) {
          button.disabled = !hasChanges;
          Object.assign(button.style, {
            opacity: hasChanges ? '1' : '0.5',
            cursor: hasChanges ? 'pointer' : 'not-allowed'
          });
        }
      });
    }
    
    function getDefaultPermissions() {
      const aiWriteCheckbox = document.getElementById('defaultAiWrite');
      const humanWriteCheckbox = document.getElementById('defaultHumanWrite');
      
      const aiDefault = (aiWriteCheckbox && aiWriteCheckbox.checked) ? 'write' : 'read';
      const humanDefault = (humanWriteCheckbox && humanWriteCheckbox.checked) ? 'write' : 'read';
      
      return { ai: aiDefault, human: humanDefault };
    }
    
    function updateDefaultPermissions() {
      updatePreview();
      // Save the default permissions to user preferences
      const defaults = getDefaultPermissions();
      vscode.postMessage({
        command: 'saveDefaultPermissions',
        defaultAiWrite: defaults.ai === 'write',
        defaultHumanWrite: defaults.human === 'write'
      });
    }
    window.updateDefaultPermissions = updateDefaultPermissions;
    
    function updatePreview() {
      const colors = getColors();
      currentColors = colors;
      const defaults = getDefaultPermissions();
      
      PREVIEW_LINES.forEach((config, index) => {
        // Always use both permissions - either from the line or from defaults
        const aiPerm = config.ai !== null ? config.ai : defaults.ai;
        const humanPerm = config.human !== null ? config.human : defaults.human;
        updateLine(index + 1, aiPerm, humanPerm);
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
      const result = getPermissionColorsForLine(colors, aiPerm, humanPerm);
      
      setRgbaStyle(line, 'backgroundColor', result.bgColor, result.opacity);
      setRgbaStyle(border, 'backgroundColor', (result.borderColor && result.borderOpacity > 0) ? result.borderColor : '', result.borderOpacity);
    }
    
    function updateExample(id, type, perm) {
      const elem = document.getElementById(id);
      if (!elem) return;
      
      const colors = getColors();
      const result = getPermissionColors(colors, type, perm);
      
      setRgbaStyle(elem, 'backgroundColor', result.bgColor, result.opacity);
      setBorderStyle(elem, result.borderColor, result.borderOpacity);
      
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
    
    function blendColors(hex1, hex2) {
      const rgb1 = hexToRgb(hex1);
      const rgb2 = hexToRgb(hex2);
      
      if (!rgb1 || !rgb2) return hex1 || hex2 || '#000000';
      
      const r = Math.round((rgb1.r + rgb2.r) / 2);
      const g = Math.round((rgb1.g + rgb2.g) / 2);
      const b = Math.round((rgb1.b + rgb2.b) / 2);
      
      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    
    // Unified function to get permission colors based on type and permissions
    function getPermissionColors(colors, type, perm) {
      let bgColor = '';
      let opacity = 1.0;
      let borderColor = '';
      let borderOpacity = 1.0;
      
      if (type === 'both') {
        const aiConfig = colors.permissions['ai' + capitalizeFirst(perm.ai)];
        const humanConfig = colors.permissions['human' + capitalizeFirst(perm.human)];
        
        if (!aiConfig || !humanConfig) {
          console.warn('Missing config:', perm.ai, perm.human);
          return { bgColor, opacity, borderColor, borderOpacity };
        }
        
        return calculatePermissionColors(aiConfig, humanConfig, colors.mixPattern);
      } else {
        let configKey = getConfigKey(type, perm);
        const config = colors.permissions[configKey];
        
        if (config && config.enabled) {
          bgColor = config.color;
          opacity = config.transparency;
          borderColor = config.minimapColor || config.color;
          borderOpacity = config.borderOpacity ?? 1.0;
        }
      }
      
      return { bgColor, opacity, borderColor, borderOpacity };
    }
    
    // Specialized version for lines with ai/human permissions
    function getPermissionColorsForLine(colors, aiPerm, humanPerm) {
      // Check for context permissions first
      if (aiPerm === 'context' || aiPerm === 'contextWrite') {
        return getPermissionColors(colors, 'ai', aiPerm);
      } else if (aiPerm && humanPerm) {
        return getPermissionColors(colors, 'both', { ai: aiPerm, human: humanPerm });
      } else if (aiPerm) {
        return getPermissionColors(colors, 'ai', aiPerm);
      } else if (humanPerm) {
        return getPermissionColors(colors, 'human', humanPerm);
      }
      return { bgColor: '', opacity: 1.0, borderColor: '', borderOpacity: 1.0 };
    }
    
    function calculatePermissionColors(aiConfig, humanConfig, mixPattern) {
      const getConfigColors = (config) => ({
        bgColor: config.color,
        opacity: config.transparency,
        borderColor: config.minimapColor || config.color,
        borderOpacity: config.borderOpacity ?? 1.0
      });
      
      if (!aiConfig.enabled && !humanConfig.enabled) {
        return { bgColor: '', opacity: 1.0, borderColor: '', borderOpacity: 1.0 };
      }
      if (!aiConfig.enabled) return getConfigColors(humanConfig);
      if (!humanConfig.enabled) return getConfigColors(aiConfig);
      
      // Both enabled - apply mix pattern
      const patterns = {
        'transparentHuman': aiConfig,
        'humanPriority': humanConfig,
        'aiPriority': aiConfig,
        'aiBorder': { ...humanConfig, minimapColor: aiConfig.minimapColor || aiConfig.color, borderOpacity: aiConfig.borderOpacity },
        'humanBorder': { ...aiConfig, minimapColor: humanConfig.minimapColor || humanConfig.color, borderOpacity: humanConfig.borderOpacity },
        'average': {
          color: blendColors(aiConfig.color, humanConfig.color),
          transparency: (aiConfig.transparency + humanConfig.transparency) / 2,
          minimapColor: aiConfig.minimapColor || aiConfig.color,
          borderOpacity: aiConfig.borderOpacity ?? 1.0
        }
      };
      
      const config = patterns[mixPattern || 'average'] || patterns['average'];
      return getConfigColors(config);
    }
    
    // Helper functions for element access
    const getElement = id => document.getElementById(id);
    const getElementValue = (id, defaultValue = '') => getElement(id)?.value || defaultValue;
    const setElementValue = (id, value) => { const elem = getElement(id); if (elem) elem.value = value; };
    const isElementChecked = (id, defaultValue = false) => getElement(id)?.checked || defaultValue;
    const setElementText = (id, text) => { const elem = getElement(id); if (elem) elem.textContent = text; };
    
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
      PERMISSION_TYPES.forEach(perm => {
        const elements = getPermissionElements(perm);
        
        const color = elements.color ? elements.color.value : '#000000';
        const minimapColor = elements.minimapColor ? elements.minimapColor.value : '#000000';
        
        permissions[perm] = {
          enabled: elements.enabled ? elements.enabled.checked : true,
          color: color,
          transparency: elements.transparency ? (elements.transparency.value / 100) : 0.2,
          borderOpacity: elements.borderOpacity ? (elements.borderOpacity.value / 100) : 1.0,
          minimapColor: minimapColor
        };
      });
      
      const mixPatternElem = document.getElementById('mixPatternSelect');
      const mixPattern = mixPatternElem ? mixPatternElem.value : 'humanBorder';
      
      return {
        permissions: permissions,
        mixPattern: mixPattern || 'humanBorder'
      };
    }
    
    function updateAllColors(colors) {
      if (!colors || !colors.permissions) return;
      
      // We're about to update all colors from the extension
      isLoadingTheme = true;
      currentColors = colors;
      
      // Generate or update permission sections
      const controlContent = document.querySelector('.control-content');
      if (controlContent && controlContent.innerHTML.trim() === '') {
        // First time - generate the sections
        controlContent.innerHTML = generateAllPermissionSections();
      }
      
      Object.entries(colors.permissions).forEach(([key, config]) => {
        const elements = getPermissionElements(key);
        
        if (elements.enabled) {
          elements.enabled.checked = config.enabled !== false;
          toggleEnabled(key);
        }
        
        if (elements.color) elements.color.value = config.color;
        
        if (elements.minimapColor && config.minimapColor) {
          elements.minimapColor.value = config.minimapColor;
        } else if (elements.minimapColor) {
          elements.minimapColor.value = config.color;
        }
        
        if (elements.transparency) {
          const transPercent = Math.round(config.transparency * 100);
          elements.transparency.value = transPercent;
          const valueElem = document.getElementById(key + '-transparency-value');
          if (valueElem) valueElem.textContent = transPercent + '%';
        }
        
        if (elements.borderOpacity && config.borderOpacity !== undefined) {
          const borderPercent = Math.round(config.borderOpacity * 100);
          elements.borderOpacity.value = borderPercent;
          const valueElem = document.getElementById(key + '-borderOpacity-value');
          if (valueElem) valueElem.textContent = borderPercent + '%';
        }
      });
      
      Object.keys(colors.permissions).forEach(key => {
        updateColorPreview(key);
      });
      
      updatePreview();
      
      // Update mix pattern if provided, default to humanBorder
      const mixPatternElem = document.getElementById('mixPatternSelect');
      if (mixPatternElem) {
        if (colors.mixPattern) {
          mixPatternElem.value = colors.mixPattern;
        } else if (!mixPatternElem.value) {
          mixPatternElem.value = 'humanBorder';
        }
      }
      
      // Now save the new baseline after all UI is updated
      savedColors = JSON.parse(JSON.stringify(colors));
      hasChanges = false;
      isLoadingTheme = false;
      updateButtonStates();
    }
    
    function applyPreset(presetName) {
      if (presetName) {
        isLoadingTheme = true;
        vscode.postMessage({ command: 'applyTheme', theme: presetName });
        updateDeleteButton();
      }
    }
    window.applyPreset = applyPreset;
    
    function updateDeleteButton() {
      const select = document.getElementById('themeSelect');
      const deleteBtn = document.getElementById('deleteThemeBtn');
      if (!select || !deleteBtn) return;
      
      const selectedOption = select.value && select.querySelector(\`option[value="\${select.value}"]\`);
      const isCustomTheme = selectedOption?.parentElement?.label === 'Custom Themes';
      deleteBtn.style.display = isCustomTheme ? 'block' : 'none';
    }
    
    function updateThemeStatus(isSystem) {
      const statusDiv = document.getElementById('themeStatus');
      if (!statusDiv) return;
      
      const select = document.getElementById('themeSelect');
      if (!select || !select.value) {
        statusDiv.style.display = 'none';
        return;
      }
      
      setControlsEnabled(!isSystem);
      statusDiv.innerHTML = isSystem 
        ? '🔒 Built-in theme (read-only) - Create a new theme to customize'
        : '✏️ Custom theme - You can modify all settings';
      statusDiv.style.display = 'block';
    }
    
    function setControlsEnabled(enabled) {
      // Define style rules for each selector
      const styleRules = [
        // Input controls
        { selector: 'input[type="color"], input[type="range"], input[type="checkbox"]', 
          apply: el => { el.disabled = !enabled; } },
        { selector: 'input[type="checkbox"]', 
          styles: { cursor: enabled ? 'pointer' : 'not-allowed' } },
        // Sliders
        { selector: '.slider', 
          styles: {
            cursor: enabled ? 'pointer' : 'not-allowed',
            opacity: enabled ? '1' : '0.4',
            background: enabled ? 'var(--vscode-scrollbarSlider-background)' : 'var(--vscode-input-background)'
          }},
        // Color previews
        { selector: '.color-preview', 
          styles: {
            cursor: enabled ? 'pointer' : 'not-allowed',
            opacity: enabled ? '1' : '0.5',
            filter: enabled ? 'none' : 'grayscale(0.5)'
          }},
        // Link icons
        { selector: '.link-icon', 
          styles: {
            cursor: enabled ? 'pointer' : 'not-allowed',
            opacity: enabled ? '1' : '0.4',
            pointerEvents: enabled ? 'auto' : 'none'
          }},
        // Permission sections
        { selector: '.permission-section', 
          styles: {
            cursor: enabled ? 'pointer' : 'not-allowed',
            background: 'var(--vscode-input-background)',
            opacity: enabled ? '1' : '0.7',
            borderColor: enabled ? 'transparent' : 'var(--vscode-input-border)'
          }},
        // Slider controls
        { selector: '.slider-control', 
          styles: { opacity: enabled ? '1' : '0.5' }}
      ];
      
      // Apply all style rules
      styleRules.forEach(rule => {
        const elements = document.querySelectorAll(rule.selector);
        elements.forEach(el => {
          if (rule.apply) rule.apply(el);
          if (rule.styles) Object.assign(el.style, rule.styles);
        });
      });
      
      // Control panel special handling
      const controlPanel = document.querySelector('.control-panel');
      if (controlPanel) {
        controlPanel.style.cursor = enabled ? 'auto' : 'not-allowed';
        controlPanel.classList.toggle('read-only', !enabled);
      }
    }
    
    // Theme dialog management
    function toggleThemeDialog(show) {
      const dialog = document.getElementById('themeDialog');
      const input = document.getElementById('themeNameInput');
      if (dialog) {
        dialog.classList.toggle('show', show);
        if (show && input) {
          input.value = '';
          input.focus();
        }
      }
    }
    window.addNewTheme = () => toggleThemeDialog(true);
    window.closeThemeDialog = () => toggleThemeDialog(false);
    
    function confirmNewTheme() {
      const input = document.getElementById('themeNameInput');
      const name = input?.value.trim();
      if (!name) return;
      
      vscode.postMessage({ command: 'saveAsNewTheme', name, colors: getColors() });
      toggleThemeDialog(false);
      
      setTimeout(() => {
        const select = document.getElementById('themeSelect');
        if (select) {
          select.value = name;
          updateDeleteButton();
        }
      }, 200);
    }
    
    function deleteCurrentTheme() {
      const select = document.getElementById('themeSelect');
      const themeName = select?.value;
      if (themeName) {
        vscode.postMessage({ command: 'deleteTheme', name: themeName });
      }
    }
    
    window.confirmNewTheme = confirmNewTheme;
    window.deleteCurrentTheme = deleteCurrentTheme;
    
    function updateThemeList(builtIn, custom, preserveSelection = true) {
      const select = document.getElementById('themeSelect');
      const currentValue = preserveSelection ? select.value : '';
      
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
      
      if (currentValue && preserveSelection) {
        const options = select.querySelectorAll('option');
        for (let option of options) {
          if (option.value === currentValue) {
            select.value = currentValue;
            break;
          }
        }
      }
      
      // If no theme is selected, default to 'light'
      if (!select.value && builtIn.length > 0) {
        select.value = builtIn.includes('light') ? 'light' : builtIn[0];
      }
      
      updateDeleteButton();
    }
    window.updateThemeList = updateThemeList;
    
    // Color management functions
    function saveColors() {
      const colors = getColors();
      vscode.postMessage({ command: 'saveColors', colors });
      savedColors = JSON.parse(JSON.stringify(colors));
      hasChanges = false;
      updateButtonStates();
    }
    
    function resetColors() {
      if (savedColors) {
        updateAllColors(savedColors);
        hasChanges = false;
        updateButtonStates();
      }
    }
    
    // Export functions to window
    Object.assign(window, {
      saveColors,
      resetColors,
      exportTheme: () => vscode.postMessage({ command: 'exportTheme' }),
      importTheme: () => vscode.postMessage({ command: 'importTheme' })
    });
    
    function focusPermission(permissionId) {
      const firstInput = document.querySelector('input[type="checkbox"]');
      if (firstInput && firstInput.disabled) return;
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
        'ex-contextWrite': 'contextWrite',
        'ex-mixed1': 'aiWrite',
        'ex-mixed2': 'aiRead'
      };
      
      Object.entries(exampleMap).forEach(([exampleId, permissionId]) => {
        const element = document.getElementById(exampleId);
        if (element) {
          element.addEventListener('click', () => navigateToPermission(permissionId));
        }
      });
    }
    
    function navigateToPermission(permissionId) {
      const targetSection = findPermissionSection(permissionId);
      if (!targetSection) return;
      
      // Highlight and scroll section
      const sections = document.querySelectorAll('.permission-section');
      sections.forEach(s => s.classList.remove('focused'));
      targetSection.classList.add('focused');
      targetSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Scroll preview if found
      const previewIndex = findPreviewLineForPermission(permissionId);
      if (previewIndex >= 0) {
        setTimeout(() => scrollPreviewToLine(previewIndex), 100);
      }
    }
    
    function findPermissionSection(permissionId) {
      const sections = document.querySelectorAll('.permission-section');
      for (const section of sections) {
        const checkbox = section.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.id === permissionId + '-enabled') {
          return section;
        }
      }
      return null;
    }
    
    function scrollPreviewToLine(previewIndex) {
      const startLine = document.getElementById('line' + (previewIndex + 1));
      if (!startLine) return;
      
      // Find guard block end
      let endIndex = previewIndex;
      for (let i = previewIndex + 1; i < PREVIEW_LINES.length; i++) {
        if (PREVIEW_LINES[i].content.includes('@guard:end')) {
          endIndex = i;
          break;
        }
      }
      
      const endLine = document.getElementById('line' + (endIndex + 1));
      const editorContainer = document.querySelector('.editor-container');
      const editorContent = document.querySelector('.editor-content');
      
      if (!endLine || !editorContainer || !editorContent) return;
      
      // Calculate scroll position
      const blockTop = calculateOffset(startLine, editorContent);
      const blockBottom = calculateOffset(endLine, editorContent) + endLine.offsetHeight;
      const blockHeight = blockBottom - blockTop;
      const containerHeight = editorContainer.clientHeight;
      
      const targetScroll = blockHeight <= containerHeight - 40
        ? blockTop - (containerHeight / 2) + (blockHeight / 2)  // Center
        : blockTop - 20;  // Top with padding
      
      editorContainer.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
    }
    
    function calculateOffset(element, container) {
      let offset = 0;
      while (element && element !== container) {
        offset += element.offsetTop;
        element = element.offsetParent;
      }
      return offset;
    }
    
    function findPreviewLineForPermission(permissionId) {
      const searchMap = {
        'aiWrite': 'ai:w', 'aiRead': 'ai:r', 'aiNoAccess': 'ai:n',
        'humanWrite': 'human:w', 'humanRead': 'human:r', 'humanNoAccess': 'human:n',
        'contextRead': 'context:r', 'contextWrite': 'context:w'
      };
      
      const searchTerm = searchMap[permissionId];
      if (!searchTerm) return -1;
      
      for (let i = 0; i < PREVIEW_LINES.length; i++) {
        const content = PREVIEW_LINES[i].content.toLowerCase();
        if (content.includes('// @guard:') && content.includes(searchTerm)) {
          return i;
        }
      }
      return -1;
    }
    
    // Export functions for use in HTML
    window.generateAllPermissionSections = generateAllPermissionSections;
  `;
}