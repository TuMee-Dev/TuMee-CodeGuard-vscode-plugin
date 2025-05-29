/**
 * Factory for creating VSCode decoration types based on guard permissions
 */

import type { TextEditorDecorationType } from 'vscode';
import { window, ThemeColor } from 'vscode';
import { DEFAULT_COLORS, COLOR_THEMES } from '../tools/colorCustomizer';
import { MixPattern } from '../types/mixPatterns';
import type { GuardColors } from '../types/colorTypes';
import { renderMixPattern, getMixedBorderColor } from './mixPatternRenderer';
import { hexToRgba } from './colorUtils';
import { DebugLogger } from './debugLogger';
import { configManager, CONFIG_KEYS } from './configurationManager';

interface PermissionColorInfo {
  color: string;
  opacity: number;
  aiColor?: string;
  humanColor?: string;
  aiOpacity?: number;
  humanOpacity?: number;
  aiMinimapColor?: string;
  humanMinimapColor?: string;
  aiBorderOpacity?: number;
  humanBorderOpacity?: number;
  mixPattern?: MixPattern;
}

/**
 * Factory class for creating and managing decoration types
 */
export class DecorationTypeFactory {
  private decorationTypes = new Map<string, TextEditorDecorationType>();

  /**
   * Create all decoration types based on current configuration
   */
  createDecorationTypes(): Map<string, TextEditorDecorationType> {
    // Clear existing decorations
    this.decorationTypes.forEach(decoration => decoration.dispose());
    this.decorationTypes.clear();

    const guardColorsComplete = this.loadThemeConfiguration();
    const cm = configManager();
    const opacity = cm.get(CONFIG_KEYS.CODE_DECORATION_OPACITY, 0.1);

    const {
      colors,
      permissionTransparencies,
      permissionBorderOpacities,
      permissionMinimapColors,
      permissionEnabledStates
    } = this.processColorConfiguration(guardColorsComplete, opacity);

    const borderBarEnabled = guardColorsComplete?.borderBarEnabled !== false;
    const mixPattern = guardColorsComplete?.mixPattern || DEFAULT_COLORS.mixPattern || MixPattern.AVERAGE;

    // Create decoration types for all permission combinations
    this.createPermissionDecorations(
      colors,
      opacity,
      permissionTransparencies,
      permissionBorderOpacities,
      permissionMinimapColors,
      permissionEnabledStates,
      borderBarEnabled,
      mixPattern
    );

    return this.decorationTypes;
  }

  /**
   * Load theme configuration from VSCode settings
   */
  private loadThemeConfiguration(): GuardColors {
    const cm = configManager();
    const selectedTheme = cm.get(CONFIG_KEYS.SELECTED_THEME, '');

    if (selectedTheme) {
      // Check if it's a built-in theme
      const builtInTheme = COLOR_THEMES[selectedTheme];
      if (builtInTheme) {
        return builtInTheme.colors;
      }

      // Check custom themes
      const customThemes = cm.get(CONFIG_KEYS.CUSTOM_THEMES, {} as Record<string, GuardColors>);
      if (customThemes[selectedTheme]) {
        return customThemes[selectedTheme];
      }
    }

    // Fallback to guardColorsComplete or DEFAULT_COLORS
    return cm.get<GuardColors>(CONFIG_KEYS.GUARD_COLORS_COMPLETE) || DEFAULT_COLORS;
  }

  /**
   * Process color configuration and extract needed data
   */
  private processColorConfiguration(guardColorsComplete: GuardColors, opacity: number) {
    const permissionTransparencies: Record<string, number> = {};
    const permissionBorderOpacities: Record<string, number> = {};
    const permissionMinimapColors: Record<string, string> = {};
    const userColors: Record<string, string> = {};
    const permissionEnabledStates: Record<string, boolean> = {};

    // Process guardColorsComplete permissions
    if (guardColorsComplete?.permissions) {
      for (const [key, permission] of Object.entries(guardColorsComplete.permissions)) {
        if (permission.color) {
          userColors[key] = permission.color;
          permissionTransparencies[key] = permission.transparency || 0.3;
          permissionBorderOpacities[key] = permission.borderOpacity ?? 1.0;
          permissionMinimapColors[key] = permission.minimapColor || permission.color;
          permissionEnabledStates[key] = permission.enabled !== false;

          // Debug logging for write permissions
          if (key.includes('Write')) {
            DebugLogger.log(`[DEBUG] Storing ${key}: borderOpacity=${permission.borderOpacity} -> ${permissionBorderOpacities[key]}`);
          }
        }
      }
    }

    // Process combinations
    if (guardColorsComplete?.combinations) {
      Object.assign(userColors, guardColorsComplete.combinations);
    }

    // Build final colors object
    const colors: Record<string, string> = {};

    if (userColors && Object.keys(userColors).length > 0) {
      // Apply user colors ONLY for enabled permissions
      for (const [key, color] of Object.entries(userColors)) {
        const isEnabled = permissionEnabledStates[key] !== false;
        if (isEnabled) {
          colors[key] = color;
        }
      }
    } else {
      // No user configuration, use DEFAULT_COLORS from theme
      for (const [key, permission] of Object.entries(DEFAULT_COLORS.permissions)) {
        if (permission.enabled) {
          colors[key] = permission.color;
          permissionTransparencies[key] = permission.transparency;
          permissionBorderOpacities[key] = permission.borderOpacity ?? 1.0;
          permissionMinimapColors[key] = permission.minimapColor || permission.color;
          permissionEnabledStates[key] = permission.enabled;
        }
      }
    }

    return {
      colors,
      permissionTransparencies,
      permissionBorderOpacities,
      permissionMinimapColors,
      permissionEnabledStates
    };
  }

  /**
   * Get the color information for a permission combination
   */
  private getPermissionColor(
    key: string,
    colors: Record<string, string>,
    opacity: number
  ): PermissionColorInfo {
    // Check if there's a custom color for this exact combination
    const customColor = colors[key];
    if (customColor && typeof customColor === 'string') {
      return { color: customColor, opacity };
    }

    // Parse the permission key
    const parts = key.split('_');
    const aiPart = parts[0];
    const humanPart = parts[1];

    // Extract permissions
    const aiPermission = aiPart.replace('Context', '').replace('ai', '').toLowerCase();
    const humanPermission = humanPart.replace('human', '').toLowerCase();
    const isContext = aiPart.includes('Context');

    // Get base colors
    const aiColors = {
      write: colors.aiWrite,
      read: colors.aiRead,
      noaccess: colors.aiNoAccess
    };
    const humanColors = {
      write: colors.humanWrite,
      read: colors.humanRead,
      noaccess: colors.humanNoAccess
    };

    // Debug log for no access combinations
    if (key.includes('NoAccess')) {
      DebugLogger.log(`[DEBUG] ${key}: aiNoAccess color = ${colors.aiNoAccess}, humanNoAccess color = ${colors.humanNoAccess}`);
      DebugLogger.log('[DEBUG] Available colors:', colors);
    }

    const contextColors = {
      write: colors.contextWrite,
      read: colors.contextRead
    };

    let baseColor: string = '#000000'; // Default fallback color
    let effectiveOpacity = opacity;

    // Determine color based on context and permissions
    if (isContext) {
      baseColor = contextColors[aiPermission as keyof typeof contextColors] || contextColors.read || '#20B2AA';
    } else if (aiPermission === 'noaccess' && humanPermission === 'noaccess') {
      // Both no access - prioritize AI color
      baseColor = aiColors.noaccess || '#DC143C';
    } else if (aiPermission === 'noaccess') {
      baseColor = aiColors.noaccess || '#DC143C';
    } else if (humanPermission === 'noaccess') {
      baseColor = humanColors.noaccess || '#228B22';
    } else if (aiPermission === 'write') {
      baseColor = aiColors.write || '#FFD700';
    } else if (humanPermission === 'read') {
      baseColor = humanColors.read || '#4169E1';
    } else {
      // Default case (ai:read, human:write) - use transparent
      baseColor = '#000000';
      effectiveOpacity = 0;
    }

    return { color: baseColor, opacity: effectiveOpacity };
  }

  /**
   * Create decoration types for all permission combinations
   */
  private createPermissionDecorations(
    colors: Record<string, string>,
    opacity: number,
    permissionTransparencies: Record<string, number>,
    permissionBorderOpacities: Record<string, number>,
    permissionMinimapColors: Record<string, string>,
    permissionEnabledStates: Record<string, boolean>,
    borderBarEnabled: boolean,
    mixPattern: MixPattern
  ): void {
    // Define all permission combinations
    const permissionCombinations = [
      'aiRead_humanRead', 'aiRead_humanWrite', 'aiRead_humanNoAccess',
      'aiWrite_humanRead', 'aiWrite_humanWrite', 'aiWrite_humanNoAccess',
      'aiNoAccess_humanRead', 'aiNoAccess_humanWrite', 'aiNoAccess_humanNoAccess',
      'aiReadContext_humanRead', 'aiReadContext_humanWrite', 'aiReadContext_humanNoAccess',
      'aiWriteContext_humanRead', 'aiWriteContext_humanWrite', 'aiWriteContext_humanNoAccess'
    ];

    for (const key of permissionCombinations) {
      this.createSingleDecorationTypeByKey(
        key,
        colors,
        opacity,
        permissionTransparencies,
        permissionBorderOpacities,
        permissionMinimapColors,
        permissionEnabledStates,
        borderBarEnabled,
        mixPattern
      );
    }
  }

  /**
   * Create a single decoration type for a permission key
   */
  private createSingleDecorationTypeByKey(
    key: string,
    colors: Record<string, string>,
    opacity: number,
    permissionTransparencies: Record<string, number>,
    permissionBorderOpacities: Record<string, number>,
    permissionMinimapColors: Record<string, string>,
    permissionEnabledStates: Record<string, boolean>,
    borderBarEnabled: boolean,
    mixPattern: MixPattern
  ): void {
    const colorInfo = this.getPermissionColor(key, colors, opacity);
    const { color } = colorInfo;

    // Get effective opacity - need to look up by permission type, not full key
    let effectiveOpacity = colorInfo.opacity;

    // For context types, look up transparency by contextRead/contextWrite
    if (key.includes('Context')) {
      if (key.includes('WriteContext')) {
        effectiveOpacity = permissionTransparencies.contextWrite || colorInfo.opacity;
      } else if (key.includes('ReadContext')) {
        effectiveOpacity = permissionTransparencies.contextRead || colorInfo.opacity;
      }
    } else {
      // For non-context, use the key directly
      effectiveOpacity = permissionTransparencies[key] || colorInfo.opacity;
    }

    // Check if this permission is enabled
    const isPermissionEnabled = permissionEnabledStates[key] !== false;

    // Skip creating decoration if permission is disabled (unless it's the default state)
    if (!isPermissionEnabled && key !== 'aiRead_humanWrite') {
      return;
    }

    // For aiRead_humanWrite (default state), use no decoration
    if (key === 'aiRead_humanWrite') {
      this.decorationTypes.set(key, window.createTextEditorDecorationType({}));
      return;
    }

    // Get mixed permission information
    const parts = key.split('_');
    const aiPart = parts[0].replace('Context', '');
    const humanPart = parts[1];

    const aiKey = aiPart;
    const humanKey = humanPart;
    const isMixed = colors[aiKey] && colors[humanKey];
    const mixedColor = isMixed ? colors[humanKey] : undefined;

    // Create decoration options
    const decorationOptions: any = {};

    // Handle minimap and border colors
    const minimapColor = permissionMinimapColors[key] || color;
    const borderOpacity = permissionBorderOpacities[key] ?? 1.0;

    if (borderBarEnabled && borderOpacity > 0 && isPermissionEnabled) {
      decorationOptions.borderWidth = '0 0 0 3px';
      decorationOptions.borderStyle = 'solid';
      decorationOptions.borderColor = minimapColor ? hexToRgba(minimapColor, borderOpacity) : 'rgba(0, 0, 0, 0)';
    }

    // Only add overview ruler if border opacity > 0 AND permission is enabled
    if (borderOpacity > 0 && isPermissionEnabled) {
      decorationOptions.overviewRulerColor = minimapColor ? hexToRgba(minimapColor, borderOpacity) : 'rgba(0, 0, 0, 0)';
      decorationOptions.overviewRulerLane = 2;
    } else {
      delete decorationOptions.overviewRulerColor;
      delete decorationOptions.overviewRulerLane;
    }

    // Only add background color if transparency > 0
    if (effectiveOpacity > 0) {
      if (isMixed && mixedColor) {
        // For mixed permissions, use the mix pattern renderer
        DebugLogger.log(`[DEBUG] ${key}: Creating mixed decoration with pattern=${colorInfo.mixPattern}`);

        const mixResult = renderMixPattern(colorInfo.mixPattern || mixPattern, {
          aiColor: color,
          humanColor: mixedColor,
          aiOpacity: colorInfo.aiOpacity || effectiveOpacity,
          humanOpacity: colorInfo.humanOpacity || effectiveOpacity,
          aiMinimapColor: colorInfo.aiMinimapColor,
          humanMinimapColor: colorInfo.humanMinimapColor,
          aiBorderOpacity: colorInfo.aiBorderOpacity,
          humanBorderOpacity: colorInfo.humanBorderOpacity
        });

        if (mixResult.backgroundColor) {
          decorationOptions.backgroundColor = mixResult.backgroundColor;
        }
        if (mixResult.borderColor && borderBarEnabled) {
          decorationOptions.borderColor = mixResult.borderColor;
        }
      } else {
        // Single color decoration
        decorationOptions.backgroundColor = color ? hexToRgba(color, effectiveOpacity) : 'rgba(0, 0, 0, 0)';
      }
    }

    this.decorationTypes.set(key, window.createTextEditorDecorationType(decorationOptions));
  }

  /**
   * Dispose all decoration types
   */
  dispose(): void {
    this.decorationTypes.forEach(decoration => decoration.dispose());
    this.decorationTypes.clear();
  }
}