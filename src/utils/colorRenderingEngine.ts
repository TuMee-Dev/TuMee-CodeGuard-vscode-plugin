/**
 * Unified Color Rendering Engine
 * Eliminates duplication between webview preview, VSCode decorations, and CLI rendering
 */

import { GuardColors, PermissionColorConfig } from '../tools/colorCustomizer';
import { MixPattern } from '../types/mixPatterns';
import { hexToRgba, rgbToHex } from './colorUtils';

export interface PermissionState {
  ai: string | null;
  human: string | null;
}

export interface ColorResult {
  backgroundColor?: string;
  borderColor?: string;
  opacity: number;
  borderOpacity: number;
  highlightEntireLine: boolean;
}

export interface MixPatternConfig {
  aiColor: string;
  humanColor: string;
  aiOpacity: number;
  humanOpacity: number;
}

/**
 * Unified permission-to-color resolution
 * Used by webview preview, VSCode decorations, and CLI rendering
 */
export class ColorRenderingEngine {
  private colors: GuardColors;

  constructor(colors: GuardColors) {
    this.colors = colors;
  }

  /**
   * Get color result for a permission state
   */
  getColorForPermission(permissions: PermissionState): ColorResult {
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
  }

  /**
   * Get color for single permission (ai or human only)
   */
  private getSinglePermissionColor(type: 'ai' | 'human', permission: string): ColorResult {
    let configKey: string;
    
    if (permission === 'context') {
      configKey = 'contextRead';
    } else if (permission === 'contextWrite') {
      configKey = 'contextWrite';
    } else {
      configKey = type + this.capitalizeFirst(permission);
    }

    const config = this.colors.permissions[configKey as keyof typeof this.colors.permissions];
    
    if (!config || !config.enabled) {
      return {
        opacity: 0,
        borderOpacity: 0,
        highlightEntireLine: false
      };
    }

    return {
      backgroundColor: config.color,
      borderColor: config.minimapColor || config.color,
      opacity: config.transparency,
      borderOpacity: config.borderOpacity || 1.0,
      highlightEntireLine: config.highlightEntireLine || false
    };
  }

  /**
   * Get color for mixed permissions (both ai and human)
   */
  private getMixedPermissionColor(aiPerm: string, humanPerm: string): ColorResult {
    const aiConfigKey = this.getConfigKey('ai', aiPerm);
    const humanConfigKey = this.getConfigKey('human', humanPerm);
    
    const aiConfig = this.colors.permissions[aiConfigKey as keyof typeof this.colors.permissions];
    const humanConfig = this.colors.permissions[humanConfigKey as keyof typeof this.colors.permissions];

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
    const mixPattern = this.colors.mixPattern || MixPattern.AVERAGE;
    const mixResult = this.applyMixPattern(mixPattern, {
      aiColor: aiConfig.color,
      humanColor: humanConfig.color,
      aiOpacity: aiConfig.transparency,
      humanOpacity: humanConfig.transparency
    });

    const result: ColorResult = {
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
  }

  /**
   * Apply mix pattern for overlapping permissions
   */
  private applyMixPattern(pattern: MixPattern, config: MixPatternConfig): {
    backgroundColor?: string;
    borderColor?: string;
    opacity: number;
    borderOpacity: number;
  } {
    switch (pattern) {
      case MixPattern.AVERAGE:
        const blendedColor = this.blendColors(config.aiColor, config.humanColor);
        const avgOpacity = (config.aiOpacity + config.humanOpacity) / 2;
        return {
          backgroundColor: blendedColor,
          opacity: avgOpacity,
          borderOpacity: avgOpacity
        };

      case MixPattern.HUMAN_PRIORITY:
        return {
          backgroundColor: config.humanColor,
          opacity: config.humanOpacity,
          borderOpacity: config.humanOpacity
        };

      case MixPattern.AI_PRIORITY:
        return {
          backgroundColor: config.aiColor,
          opacity: config.aiOpacity,
          borderOpacity: config.aiOpacity
        };

      case MixPattern.AI_BORDER:
        return {
          backgroundColor: config.humanColor,
          borderColor: config.aiColor,
          opacity: config.humanOpacity,
          borderOpacity: config.aiOpacity
        };

      case MixPattern.HUMAN_BORDER:
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
  }

  /**
   * Blend two hex colors
   */
  private blendColors(hex1: string, hex2: string): string {
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
  }

  /**
   * Determine highlightEntireLine setting for mixed permissions
   */
  private getHighlightEntireLineForMix(
    mixPattern: MixPattern,
    aiConfig: PermissionColorConfig,
    humanConfig: PermissionColorConfig
  ): boolean {
    switch (mixPattern) {
      case MixPattern.HUMAN_PRIORITY:
      case MixPattern.HUMAN_BORDER:
        return humanConfig.highlightEntireLine || false;
      case MixPattern.AI_PRIORITY:
      case MixPattern.AI_BORDER:
        return aiConfig.highlightEntireLine || false;
      default:
        // For average pattern, use AI's setting as default
        return aiConfig.highlightEntireLine || false;
    }
  }

  /**
   * Convert config to color result
   */
  private configToColorResult(config: PermissionColorConfig): ColorResult {
    return {
      backgroundColor: config.color,
      borderColor: config.minimapColor || config.color,
      opacity: config.transparency,
      borderOpacity: config.borderOpacity || 1.0,
      highlightEntireLine: config.highlightEntireLine || false
    };
  }

  /**
   * Get config key for permission type and value
   */
  private getConfigKey(type: 'ai' | 'human', permission: string): string {
    if (permission === 'context') {
      return 'contextRead';
    } else if (permission === 'contextWrite') {
      return 'contextWrite';
    } else {
      return type + this.capitalizeFirst(permission);
    }
  }

  /**
   * Capitalize first letter, handle special cases
   */
  private capitalizeFirst(str: string): string {
    if (str === 'noAccess') return 'NoAccess';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Convert color result to CSS styles for webview preview
   */
  toCssStyles(result: ColorResult): {
    backgroundColor?: string;
    borderLeft?: string;
  } {
    const styles: { backgroundColor?: string; borderLeft?: string } = {};

    if (result.backgroundColor && result.opacity > 0) {
      styles.backgroundColor = hexToRgba(result.backgroundColor, result.opacity);
    }

    if (result.borderColor && result.borderOpacity > 0) {
      styles.borderLeft = `3px solid ${hexToRgba(result.borderColor, result.borderOpacity)}`;
    }

    return styles;
  }

  /**
   * Convert color result to VSCode decoration options
   */
  toVSCodeDecorationOptions(result: ColorResult, borderBarEnabled: boolean): { [key: string]: unknown } {
    const options: { [key: string]: unknown } = {
      isWholeLine: result.highlightEntireLine
    };

    if (result.backgroundColor && result.opacity > 0) {
      options.backgroundColor = hexToRgba(result.backgroundColor, result.opacity);
    }

    if (borderBarEnabled && result.borderColor && result.borderOpacity > 0) {
      const borderColor = hexToRgba(result.borderColor, result.borderOpacity);
      options.borderWidth = '0 0 0 3px';
      options.borderStyle = 'solid';
      options.borderColor = borderColor;
      options.overviewRulerColor = borderColor;
      options.overviewRulerLane = 2;
    }

    return options;
  }

  /**
   * Convert hex color to ANSI terminal color for CLI rendering
   */
  static hexToAnsi(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `\x1b[48;2;${r};${g};${b}m`;
  }
}