/**
 * Webview-compatible Color Rendering Engine
 * Mirrors the TypeScript ColorRenderingEngine for consistent webview preview rendering
 */

// Helper function for RGB to hex conversion
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join('');
}

// Shared color rendering logic for webview preview
function createColorRenderingEngine(colors) {
  return {
    /**
     * Get color result for a permission state
     */
    getColorForPermission: function(permissions) {
      const { ai, human } = permissions;

      // Handle single permission states
      if (ai && !human) {
        return this.getSinglePermissionColor('ai', ai);
      }
      if (human && !ai) {
        return this.getSinglePermissionColor('human', human);
      }

      // Handle mixed permissions
      if (ai && human) {
        return this.getMixedPermissionColor(ai, human);
      }

      // Default state (no permissions)
      return {
        opacity: 0,
        borderOpacity: 0,
        highlightEntireLine: false
      };
    },

    /**
     * Get color for single permission (ai or human only)
     */
    getSinglePermissionColor: function(type, permission) {
      let configKey;
      
      if (permission === 'contextRead') {
        configKey = 'contextRead';
      } else if (permission === 'contextWrite') {
        configKey = 'contextWrite';
      } else {
        configKey = type + this.capitalizeFirst(permission);
      }

      const config = colors.permissions[configKey];
      
      
      if (!config || !config.enabled) {
        return {
          opacity: 0,
          borderOpacity: 0,
          highlightEntireLine: false
        };
      }

      const result = {
        backgroundColor: config.color,
        borderColor: config.minimapColor || config.color,
        opacity: config.transparency,
        borderOpacity: config.borderOpacity || 1.0,
        highlightEntireLine: config.highlightEntireLine || false
      };
      
      
      return result;
    },

    /**
     * Get color for mixed permissions (both ai and human)
     */
    getMixedPermissionColor: function(aiPerm, humanPerm) {
      const aiConfigKey = this.getConfigKey('ai', aiPerm);
      const humanConfigKey = this.getConfigKey('human', humanPerm);
      
      const aiConfig = colors.permissions[aiConfigKey];
      const humanConfig = colors.permissions[humanConfigKey];

      if (!aiConfig || !humanConfig) {
        return {
          opacity: 0,
          borderOpacity: 0,
          highlightEntireLine: false
        };
      }

      // Handle disabled permissions
      if (!aiConfig.enabled && !humanConfig.enabled) {
        return {
          opacity: 0,
          borderOpacity: 0,
          highlightEntireLine: false
        };
      }

      if (!aiConfig.enabled) {
        return this.configToColorResult(humanConfig);
      }

      if (!humanConfig.enabled) {
        return this.configToColorResult(aiConfig);
      }

      // Both enabled - apply mix pattern
      const mixPattern = colors.mixPattern || 'average';
      const mixResult = this.applyMixPattern(mixPattern, {
        aiColor: aiConfig.color,
        humanColor: humanConfig.color,
        aiOpacity: aiConfig.transparency,
        humanOpacity: humanConfig.transparency
      });

      const result = {
        opacity: mixResult.opacity,
        borderOpacity: mixResult.borderOpacity,
        highlightEntireLine: this.getHighlightEntireLineForMix(mixPattern, aiConfig, humanConfig)
      };

      if (mixResult.backgroundColor) {
        result.backgroundColor = mixResult.backgroundColor;
      }

      if (mixResult.borderColor) {
        result.borderColor = mixResult.borderColor;
      } else {
        // Use AI minimap for regular border
        result.borderColor = aiConfig.minimapColor || aiConfig.color;
        result.borderOpacity = aiConfig.borderOpacity || 1.0;
      }

      return result;
    },

    /**
     * Apply mix pattern for overlapping permissions
     */
    applyMixPattern: function(pattern, config) {
      switch (pattern) {
        case 'average':
          const blendedColor = this.blendColors(config.aiColor, config.humanColor);
          const avgOpacity = (config.aiOpacity + config.humanOpacity) / 2;
          return {
            backgroundColor: blendedColor,
            opacity: avgOpacity,
            borderOpacity: avgOpacity
          };

        case 'humanPriority':
          return {
            backgroundColor: config.humanColor,
            opacity: config.humanOpacity,
            borderOpacity: config.humanOpacity
          };

        case 'aiPriority':
          return {
            backgroundColor: config.aiColor,
            opacity: config.aiOpacity,
            borderOpacity: config.aiOpacity
          };

        case 'aiBorder':
          return {
            backgroundColor: config.humanColor,
            borderColor: config.aiColor,
            opacity: config.humanOpacity,
            borderOpacity: config.aiOpacity
          };

        case 'humanBorder':
          return {
            backgroundColor: config.aiColor,
            borderColor: config.humanColor,
            opacity: config.aiOpacity,
            borderOpacity: config.humanOpacity
          };

        default:
          return {
            backgroundColor: this.blendColors(config.aiColor, config.humanColor),
            opacity: (config.aiOpacity + config.humanOpacity) / 2,
            borderOpacity: (config.aiOpacity + config.humanOpacity) / 2
          };
      }
    },

    /**
     * Blend two hex colors
     */
    blendColors: function(hex1, hex2) {
      const r1 = parseInt(hex1.slice(1, 3), 16);
      const g1 = parseInt(hex1.slice(3, 5), 16);
      const b1 = parseInt(hex1.slice(5, 7), 16);

      const r2 = parseInt(hex2.slice(1, 3), 16);
      const g2 = parseInt(hex2.slice(3, 5), 16);
      const b2 = parseInt(hex2.slice(5, 7), 16);

      const r = Math.round((r1 + r2) / 2);
      const g = Math.round((g1 + g2) / 2);
      const b = Math.round((b1 + b2) / 2);

      return rgbToHex(r, g, b);
    },

    /**
     * Determine highlightEntireLine setting for mixed permissions
     */
    getHighlightEntireLineForMix: function(mixPattern, aiConfig, humanConfig) {
      switch (mixPattern) {
        case 'humanPriority':
        case 'humanBorder':
          return humanConfig.highlightEntireLine || false;
        case 'aiPriority':
        case 'aiBorder':
          return aiConfig.highlightEntireLine || false;
        default:
          // For average pattern, use AI's setting as default
          return aiConfig.highlightEntireLine || false;
      }
    },

    /**
     * Convert config to color result
     */
    configToColorResult: function(config) {
      return {
        backgroundColor: config.color,
        borderColor: config.minimapColor || config.color,
        opacity: config.transparency,
        borderOpacity: config.borderOpacity || 1.0,
        highlightEntireLine: config.highlightEntireLine || false
      };
    },

    /**
     * Get config key for permission type and value
     */
    getConfigKey: function(type, permission) {
      if (permission === 'contextRead') {
        return 'contextRead';
      } else if (permission === 'contextWrite') {
        return 'contextWrite';
      } else {
        return type + this.capitalizeFirst(permission);
      }
    },

    /**
     * Capitalize first letter, handle special cases
     */
    capitalizeFirst: function(str) {
      if (str === 'noAccess') return 'NoAccess';
      return str.charAt(0).toUpperCase() + str.slice(1);
    }
  };
}

// Function to apply color result to DOM elements
function applyColorResultToLine(line, content, border, result, borderBarEnabled) {
  // Clear any existing background colors
  line.style.backgroundColor = '';
  if (content) {
    content.style.backgroundColor = '';
  }

  if (result.backgroundColor && result.opacity > 0) {
    const rgb = hexToRgb(result.backgroundColor);
    if (rgb) {
      const bgColorRgba = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + result.opacity + ')';
      
      // Debug: log what color is being applied
      if (line.id && (line.textContent.includes('context:w') || line.id === 'line51')) {
        console.log(`Applying color to ${line.id}:`, result.backgroundColor, '→', bgColorRgba);
      }
      
      if (result.highlightEntireLine) {
        // Apply background to entire line
        line.style.backgroundColor = bgColorRgba;
      } else if (content) {
        // Apply background only to content
        content.style.backgroundColor = bgColorRgba;
      }
    }
  }

  if (borderBarEnabled && result.borderColor && result.borderOpacity > 0) {
    const rgb = hexToRgb(result.borderColor);
    if (rgb) {
      border.style.backgroundColor = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + result.borderOpacity + ')';
    }
  } else {
    border.style.backgroundColor = '';
  }
}

function applyColorResultToExample(elem, result) {
  if (result.backgroundColor && result.opacity > 0) {
    const rgb = hexToRgb(result.backgroundColor);
    if (rgb) {
      elem.style.backgroundColor = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + result.opacity + ')';
    }
    
    // Apply border
    if (result.borderColor && result.borderOpacity > 0) {
      const borderRgb = hexToRgb(result.borderColor);
      if (borderRgb) {
        elem.style.borderLeft = '3px solid rgba(' + borderRgb.r + ', ' + borderRgb.g + ', ' + borderRgb.b + ', ' + result.borderOpacity + ')';
      }
    } else {
      elem.style.borderLeft = '';
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