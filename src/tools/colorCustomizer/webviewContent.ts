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
    
    // Initialize on load
    window.addEventListener('load', () => {
      PERMISSION_TYPES.forEach(perm => {
        colorLinks[perm] = true;
      });
      
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
    
    function updateMinimapColor(permission) {
      const minimapColor = getElementValue(permission + '-minimapColor');
      if (colorLinks[permission]) {
        setElementValue(permission + '-color', minimapColor);
      }
      updateColorPreview(permission);
      updatePreview();
      checkForChanges();
    }
    window.updateMinimapColor = updateMinimapColor;
    
    function updateRowColor(permission) {
      const rowColor = getElementValue(permission + '-color');
      if (colorLinks[permission]) {
        setElementValue(permission + '-minimapColor', rowColor);
      }
      updateColorPreview(permission);
      updatePreview();
      checkForChanges();
    }
    window.updateRowColor = updateRowColor;
    
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
      
      let bgColor = '';
      let borderColor = '';
      let opacity = 1.0;
      let borderOpacity = 1.0;
      
      // Check for context permissions first - they override everything else
      if (aiPerm === 'context' || aiPerm === 'contextWrite') {
        const configKey = aiPerm === 'context' ? 'contextRead' : 'contextWrite';
        const config = colors.permissions[configKey];
        if (config && config.enabled) {
          bgColor = config.color;
          opacity = config.transparency;
          borderColor = config.minimapColor || config.color;
          borderOpacity = config.borderOpacity ?? 1.0;
        }
      } else if (aiPerm && humanPerm) {
        const aiConfig = colors.permissions['ai' + capitalizeFirst(aiPerm)];
        const humanConfig = colors.permissions['human' + capitalizeFirst(humanPerm)];
        
        // Check if configs exist - this should not happen with valid permissions
        if (!aiConfig || !humanConfig) {
          console.warn('Missing config for permissions:', aiPerm, humanPerm, 'ai' + capitalizeFirst(aiPerm), 'human' + capitalizeFirst(humanPerm));
          console.warn('Available permissions:', Object.keys(colors.permissions));
          return;
        }
        
        const result = calculatePermissionColors(aiConfig, humanConfig, colors.mixPattern);
        bgColor = result.bgColor;
        opacity = result.opacity;
        borderColor = result.borderColor;
        borderOpacity = result.borderOpacity;
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
          borderOpacity = config.borderOpacity ?? 1.0;
        }
      } else if (humanPerm) {
        const config = colors.permissions['human' + capitalizeFirst(humanPerm)];
        if (config && config.enabled) {
          bgColor = config.color;
          opacity = config.transparency;
          borderColor = config.minimapColor || config.color;
          borderOpacity = config.borderOpacity ?? 1.0;
        }
      }
      
      setRgbaStyle(line, 'backgroundColor', bgColor, opacity);
      setRgbaStyle(border, 'backgroundColor', (borderColor && borderOpacity > 0) ? borderColor : '', borderOpacity);
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
        
        // Check if configs exist
        if (!aiConfig || !humanConfig) {
          console.warn('Missing config in updateExample:', perm.ai, perm.human);
          return;
        }
        
        const result = calculatePermissionColors(aiConfig, humanConfig, colors.mixPattern);
        bgColor = result.bgColor;
        opacity = result.opacity;
        borderColor = result.borderColor;
        borderOpacity = result.borderOpacity;
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
          borderOpacity = config.borderOpacity ?? 1.0;
        }
      }
      
      setRgbaStyle(elem, 'backgroundColor', bgColor, opacity);
      setBorderStyle(elem, borderColor, borderOpacity);
      
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
    
    function calculatePermissionColors(aiConfig, humanConfig, mixPattern) {
      let bgColor = '';
      let opacity = 1.0;
      let borderColor = '';
      let borderOpacity = 1.0;
      
      if (!aiConfig.enabled && !humanConfig.enabled) {
        bgColor = '';
      } else if (!aiConfig.enabled) {
        bgColor = humanConfig.color;
        opacity = humanConfig.transparency;
        borderColor = humanConfig.minimapColor || humanConfig.color;
        borderOpacity = humanConfig.borderOpacity ?? 1.0;
      } else if (!humanConfig.enabled) {
        bgColor = aiConfig.color;
        opacity = aiConfig.transparency;
        borderColor = aiConfig.minimapColor || aiConfig.color;
        borderOpacity = aiConfig.borderOpacity ?? 1.0;
      } else {
        // Both are enabled - apply mix pattern
        const pattern = mixPattern || 'average';
        
        if (pattern === 'transparentHuman') {
          // AI Priority - use AI color
          bgColor = aiConfig.color;
          opacity = aiConfig.transparency;
          borderColor = aiConfig.minimapColor || aiConfig.color;
          borderOpacity = aiConfig.borderOpacity ?? 1.0;
        } else if (pattern === 'humanPriority') {
          // Human Priority - use human color
          bgColor = humanConfig.color;
          opacity = humanConfig.transparency;
          borderColor = humanConfig.minimapColor || humanConfig.color;
          borderOpacity = humanConfig.borderOpacity ?? 1.0;
        } else if (pattern === 'aiPriority') {
          // AI Priority - use AI color
          bgColor = aiConfig.color;
          opacity = aiConfig.transparency;
          borderColor = aiConfig.minimapColor || aiConfig.color;
          borderOpacity = aiConfig.borderOpacity ?? 1.0;
        } else if (pattern === 'aiBorder') {
          // Human background, AI left border
          bgColor = humanConfig.color;
          opacity = humanConfig.transparency;
          borderColor = aiConfig.minimapColor || aiConfig.color;
          borderOpacity = aiConfig.borderOpacity ?? 1.0;
        } else if (pattern === 'humanBorder') {
          // AI background, Human left border
          bgColor = aiConfig.color;
          opacity = aiConfig.transparency;
          borderColor = humanConfig.minimapColor || humanConfig.color;
          borderOpacity = humanConfig.borderOpacity ?? 1.0;
        } else {
          // Average blend (default)
          bgColor = blendColors(aiConfig.color, humanConfig.color);
          opacity = (aiConfig.transparency + humanConfig.transparency) / 2;
          borderColor = aiConfig.minimapColor || aiConfig.color;
          borderOpacity = aiConfig.borderOpacity ?? 1.0;
        }
      }
      
      return { bgColor, opacity, borderColor, borderOpacity };
    }
    
    // Helper functions for element access
    function getElement(id) {
      return document.getElementById(id);
    }
    
    function getElementValue(id, defaultValue = '') {
      const elem = getElement(id);
      return elem ? elem.value : defaultValue;
    }
    
    function setElementValue(id, value) {
      const elem = getElement(id);
      if (elem) elem.value = value;
    }
    
    function isElementChecked(id, defaultValue = false) {
      const elem = getElement(id);
      return elem ? elem.checked : defaultValue;
    }
    
    function setElementText(id, text) {
      const elem = getElement(id);
      if (elem) elem.textContent = text;
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
        vscode.postMessage({
          command: 'applyTheme',
          theme: presetName
        });
        updateDeleteButton();
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
        // This shouldn't happen anymore since we always have a theme
        statusDiv.style.display = 'none';
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
      if (!savedColors) return;
      
      // Restore the saved colors
      updateAllColors(savedColors);
      
      // Clear any changes
      hasChanges = false;
      updateButtonStates();
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