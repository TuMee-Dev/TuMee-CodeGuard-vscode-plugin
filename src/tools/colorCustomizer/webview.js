const vscode = acquireVsCodeApi();
let currentColors = null;
let colorLinks = {};
const PREVIEW_LINES = __PREVIEW_LINES_PLACEHOLDER__;

// Cache for parsed guard tags to avoid repeated calls to extension
const parseCache = new Map();

// Use pre-parsed guard data from extension instead of parsing in webview
function callExtensionParseGuardTag(content) {
  // Preview lines now include pre-parsed guard data from the extension
  // This eliminates the need to duplicate parseGuardTag logic in the webview
  const currentLine = PREVIEW_LINES.find(line => line.content === content);
  return currentLine ? currentLine.parsed : null;
}

// Initialize on load
window.addEventListener('load', () => {
  const permissions = ['aiWrite', 'aiRead', 'aiNoAccess', 'humanWrite', 'humanRead', 'humanNoAccess', 'contextRead', 'contextWrite'];
  permissions.forEach(perm => {
    colorLinks[perm] = true;
  });
  
  // Set up permission example click handlers
  setupPermissionExampleHandlers();
  
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
      if (themeSelect) {
        // Set the dropdown to the next theme that was selected by the extension
        if (message.nextTheme) {
          themeSelect.value = message.nextTheme;
        } else {
          themeSelect.value = '';
        }
        updateDeleteButton();
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
  updatePreview();
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
  
  // Get default permissions from checkboxes
  const defaultAiWrite = document.getElementById('defaultAiWrite');
  const defaultHumanWrite = document.getElementById('defaultHumanWrite');
  
  const defaults = {
    ai: (defaultAiWrite && defaultAiWrite.checked) ? 'write' : 'read',
    human: (defaultHumanWrite && defaultHumanWrite.checked) ? 'write' : 'read'
  };
  
  // Use real guard parsing instead of hardcoded permissions
  const activeGuards = { ai: null, human: null };
  
  PREVIEW_LINES.forEach((line, index) => {
    const content = line.content || '';
    // Call real parseGuardTag from extension instead of duplicating logic
    const parsed = callExtensionParseGuardTag(content);
    
    // Debug line 51 specifically
    if (index === 50) {
      console.log('Line 51 content:', content, 'Parsed:', parsed);
    }
    
    // Update active guards based on parsed tags
    if (parsed) {
      // Handle AI guards (both regular and context)
      if (parsed.aiPermission || parsed.aiIsContext) {
        activeGuards.ai = {
          permission: parsed.aiPermission === 'contextWrite' ? 'contextWrite' :
                     parsed.aiIsContext ? 'context' :
                     parsed.aiPermission === 'r' ? 'read' : 
                     parsed.aiPermission === 'w' ? 'write' : 
                     parsed.aiPermission === 'n' ? 'noAccess' : parsed.aiPermission,
          scope: parsed.scope || 'block', // Default to block scope, not file
          lineCount: parsed.lineCount,
          startLine: index,
          isContext: parsed.aiIsContext || false
        };
      }
      // Handle Human guards (both regular and context)
      if (parsed.humanPermission || parsed.humanIsContext) {
        activeGuards.human = {
          permission: parsed.humanPermission === 'contextWrite' ? 'contextWrite' :
                     parsed.humanIsContext ? 'context' :
                     parsed.humanPermission === 'r' ? 'read' : 
                     parsed.humanPermission === 'w' ? 'write' : 
                     parsed.humanPermission === 'n' ? 'noAccess' : parsed.humanPermission,
          scope: parsed.scope || 'block', // Default to block scope, not file
          lineCount: parsed.lineCount,
          startLine: index,
          isContext: parsed.humanIsContext || false
        };
      }
    }
    
    // Determine current permissions
    let aiPerm = defaults.ai;
    let humanPerm = defaults.human;
    
    // Apply active guards based on scope type
    ['ai', 'human'].forEach(target => {
      const guard = activeGuards[target];
      if (!guard) return;
      
      // Handle line count guards
      if (guard.lineCount) {
        if (index >= guard.startLine + guard.lineCount) {
          activeGuards[target] = null;
        } else if (target === 'ai') {
          aiPerm = guard.permission;
        } else {
          humanPerm = guard.permission;
        }
        return;
      }
      
      // Handle block scope
      if (guard.scope === 'block') {
        // Block scope only applies to the next non-empty code block
        let inBlock = false;
        let blockEnded = false;
        
        // Check if we're still in the block
        for (let j = guard.startLine + 1; j <= index; j++) {
          const checkLine = PREVIEW_LINES[j];
          const checkContent = (checkLine.content || '').trim();
          
          // Skip initial empty lines
          if (!inBlock && checkContent === '') continue;
          
          // First non-empty line starts the block
          if (!inBlock && checkContent !== '') {
            inBlock = true;
          }
          
          // Empty line after being in block ends it
          if (inBlock && checkContent === '') {
            blockEnded = true;
            break;
          }
          
          // Another guard tag ends current block
          if (inBlock && checkContent.includes('@guard:')) {
            blockEnded = true;
            break;
          }
        }
        
        if (blockEnded || (index > guard.startLine && !inBlock)) {
          activeGuards[target] = null;
        } else if (index === guard.startLine || inBlock) {
          if (target === 'ai') {
            aiPerm = guard.permission;
          } else {
            humanPerm = guard.permission;
          }
        }
      }
      // File scope continues indefinitely
      else if (guard.scope === 'file') {
        if (target === 'ai') {
          aiPerm = guard.permission;
        } else {
          humanPerm = guard.permission;
        }
      }
    });
    
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
  
  // Enable Apply button when changes are detected
  checkForChanges();
  
  // Update currentColors AFTER checking for changes
  currentColors = colors;
}

// Track original colors to detect changes
let originalColors = null;

function checkForChanges() {
  const applyButton = document.querySelector('button[onclick="saveColors()"]');
  const resetButton = document.querySelector('button[onclick="resetColors()"]');
  
  if (!applyButton || !resetButton) return;
  
  // Get current colors fresh from the UI
  const freshColors = getColors();
  
  // Compare against original colors - need to normalize the format
  let hasChanges = false;
  if (originalColors) {
    // Check mix pattern first
    if (originalColors.mixPattern !== freshColors.mixPattern) {
      hasChanges = true;
    }
    
    // Compare each permission's colors
    if (!hasChanges && originalColors.permissions) {
      for (const [key, original] of Object.entries(originalColors.permissions)) {
        const current = freshColors.permissions[key];
        if (!current) continue;
        
        // Check if any values differ
        if (original.enabled !== current.enabled ||
            original.color !== current.color ||
            original.minimapColor !== current.minimapColor ||
            Math.abs((original.transparency || 0.2) - current.transparency) > 0.001 ||
            Math.abs((original.borderOpacity || 1.0) - current.borderOpacity) > 0.001 ||
            (original.highlightEntireLine || false) !== (current.highlightEntireLine || false)) {
          hasChanges = true;
          console.log(`Change detected in ${key}:`, original, current);
          break;
        }
      }
    }
  }
  
  if (hasChanges) {
    applyButton.disabled = false;
    applyButton.style.opacity = '1';
    applyButton.style.cursor = 'pointer';
    
    resetButton.disabled = false;
    resetButton.style.opacity = '1';
    resetButton.style.cursor = 'pointer';
  } else {
    applyButton.disabled = true;
    applyButton.style.opacity = '0.5';
    applyButton.style.cursor = 'not-allowed';
    
    resetButton.disabled = true;
    resetButton.style.opacity = '0.5';
    resetButton.style.cursor = 'not-allowed';
  }
}

function updateLine(lineNum, aiPerm, humanPerm) {
  const line = document.getElementById('line' + lineNum);
  if (!line) return;
  
  const border = line.querySelector('.line-border');
  const content = line.querySelector('.line-content');
  if (!border) return;
  
  const colors = getColors();
  
  // Check if contextRead and contextWrite are the same object
  if (aiPerm === 'contextWrite' || humanPerm === 'contextWrite') {
    const lineContent = document.getElementById('line' + lineNum)?.textContent || '';
    console.log('Line ' + lineNum + ' checking colors:', {
      lineContent: lineContent.trim(),
      aiPerm,
      contextReadColor: colors.permissions.contextRead?.color,
      contextWriteColor: colors.permissions.contextWrite?.color,
      contextReadEnabled: colors.permissions.contextRead?.enabled,
      contextWriteEnabled: colors.permissions.contextWrite?.enabled
    });
  }
  
  const engine = createColorRenderingEngine(colors);
  
  const result = engine.getColorForPermission({
    ai: aiPerm,
    human: humanPerm
  });
  
  applyColorResultToLine(line, content, border, result, colors.borderBarEnabled);
}

function updateExample(id, type, perm) {
  const elem = document.getElementById(id);
  if (!elem) return;
  
  const colors = getColors();
  const engine = createColorRenderingEngine(colors);
  
  let permissions = { ai: null, human: null };
  
  if (type === 'both') {
    permissions.ai = perm.ai;
    permissions.human = perm.human;
  } else if (type === 'ai') {
    permissions.ai = perm;
  } else if (type === 'human') {
    permissions.human = perm;
  }
  
  const result = engine.getColorForPermission(permissions);
  applyColorResultToExample(elem, result);
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
    const highlightEntireLineElem = document.getElementById(perm + '-highlightEntireLine');
    
    const color = colorElem ? colorElem.value : '#000000';
    const minimapColor = minimapElem ? minimapElem.value : '#000000';
    
    permissions[perm] = {
      enabled: enabledElem ? enabledElem.checked : true,
      color: color,
      transparency: transElem ? (transElem.value / 100) : 0.2,
      borderOpacity: borderOpacityElem ? (borderOpacityElem.value / 100) : 1.0,
      minimapColor: minimapColor,
      highlightEntireLine: highlightEntireLineElem ? highlightEntireLineElem.checked : false
    };
  });
  
  const mixPatternSelect = document.getElementById('mixPatternSelect');
  const mixPattern = mixPatternSelect ? mixPatternSelect.value : 'average';
  
  return {
    permissions: permissions,
    borderBarEnabled: true,
    mixPattern: mixPattern
  };
}

function updateAllColors(colors) {
  if (!colors || !colors.permissions) return;
  
  // Store original colors BEFORE modifying the UI
  if (!originalColors) {
    originalColors = JSON.parse(JSON.stringify(colors));
  }
  
  Object.entries(colors.permissions).forEach(([key, config]) => {
    const enabledElem = document.getElementById(key + '-enabled');
    if (enabledElem) {
      enabledElem.checked = config.enabled !== false;
      toggleEnabled(key);
    }
    
    const colorInput = document.getElementById(key + '-color');
    if (colorInput) {
      colorInput.value = config.color;
      // Debug logging for context colors
      if (key === 'contextRead' || key === 'contextWrite') {
        console.log(`Setting ${key} color to:`, config.color);
      }
    }
    
    const minimapInput = document.getElementById(key + '-minimapColor');
    if (minimapInput && config.minimapColor) {
      minimapInput.value = config.minimapColor;
      // Set link state based on whether colors match
      colorLinks[key] = config.color === config.minimapColor;
    } else if (minimapInput) {
      minimapInput.value = config.color;
      colorLinks[key] = true; // Default to linked if no separate minimap color
    }
    
    // Update the link icon to match the state
    const icon = document.getElementById(key + '-link');
    if (icon) {
      icon.className = colorLinks[key] ? 'link-icon linked' : 'link-icon unlinked';
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
    
    const highlightEntireLineInput = document.getElementById(key + '-highlightEntireLine');
    if (highlightEntireLineInput && config.highlightEntireLine !== undefined) {
      highlightEntireLineInput.checked = config.highlightEntireLine;
    }
  });
  
  Object.keys(colors.permissions).forEach(key => {
    updateColorPreview(key);
  });
  
  // Set mix pattern from loaded colors
  if (colors.mixPattern) {
    const mixPatternSelect = document.getElementById('mixPatternSelect');
    if (mixPatternSelect) {
      mixPatternSelect.value = colors.mixPattern;
    }
  }
  
  updatePreview();
  
  // Set currentColors to match what's in the UI after all updates
  currentColors = getColors();
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

function updateMixPattern(pattern) {
  updatePreview();
}
window.updateMixPattern = updateMixPattern;

function updateHighlightEntireLine(permission) {
  updatePreview();
}
window.updateHighlightEntireLine = updateHighlightEntireLine;

function updateDefaultPermissions() {
  updatePreview();
}
window.updateDefaultPermissions = updateDefaultPermissions;

// Removed duplicated functions - now using shared ColorRenderingEngine

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
    // Ensure the click handler is attached
    deleteBtn.onclick = deleteCurrentTheme;
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
    // Generate a smart default name
    const defaultName = generateDefaultThemeName();
    input.value = defaultName;
    dialog.classList.add('show');
    input.focus();
    input.select(); // Select the text so user can easily replace it
  }
}

function generateDefaultThemeName() {
  const themeSelect = document.getElementById('themeSelect');
  const currentTheme = themeSelect ? themeSelect.value : '';
  
  // Get all existing theme names from the dropdown
  const existingNames = new Set();
  if (themeSelect) {
    const options = themeSelect.querySelectorAll('option');
    options.forEach(option => {
      if (option.value) existingNames.add(option.value);
    });
  }
  
  let baseName = '';
  if (currentTheme) {
    // If current theme name already ends with a number, extract the base
    const numberMatch = currentTheme.match(/^(.+?) \d+$/);
    
    if (numberMatch) {
      baseName = numberMatch[1];
    } else {
      baseName = currentTheme;
    }
  } else {
    baseName = 'My Theme';
  }
  
  // Find the first available number
  let counter = 1;
  let proposedName = `${baseName} ${counter}`;
  
  while (existingNames.has(proposedName)) {
    counter++;
    proposedName = `${baseName} ${counter}`;
  }
  
  return proposedName;
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
  
  // VSCode webview doesn't support confirm() - send delete request
  // Theme dropdown will be cleared only after successful deletion
  vscode.postMessage({
    command: 'deleteTheme',
    name: themeName
  });
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
  
  // Update original colors after saving
  originalColors = JSON.parse(JSON.stringify(colors));
  checkForChanges(); // This will disable the buttons
}
window.saveColors = saveColors;

function resetColors() {
  // Reset to original colors
  if (originalColors) {
    updateAllColors(originalColors);
    checkForChanges(); // This will disable the buttons
  }
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
    'contextWrite': 'line51'
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

// Permission example navigation functions
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
    'contextRead': ':context', 'contextWrite': ':context:w'
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

setTimeout(() => {
  initializeDisabledStates();
  setupPermissionExampleHandlers(); // Add this to set up click handlers
  
  const permissions = ['aiWrite', 'aiRead', 'aiNoAccess', 'humanWrite', 'humanRead', 'humanNoAccess', 'contextRead', 'contextWrite'];
  permissions.forEach(perm => updateColorPreview(perm));
  
  setTimeout(updatePreview, 100);
}, 50);