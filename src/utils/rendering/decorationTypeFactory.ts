/**
 * Factory for creating VSCode decoration types based on guard permissions
 */

import type { TextEditorDecorationType } from 'vscode';
import { window } from 'vscode';
import { DEFAULT_COLORS, COLOR_THEMES } from '../../tools/colorCustomizer/ColorConfigTypes';
import { MixPattern } from '../../types/mixPatterns';
import type { GuardColors } from '../../types/colorTypes';
import { ColorRenderingEngine } from './colorRenderingEngine';
import { DebugLogger } from '../ui/debugLogger';
import { configManager, CONFIG_KEYS } from '../config/configurationManager';

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
      permissionEnabledStates,
      permissionHighlightEntireLine
    } = this.processColorConfiguration(guardColorsComplete, opacity);

    const borderBarEnabled = guardColorsComplete?.borderBarEnabled !== false;
    const highlightEntireLine = guardColorsComplete?.highlightEntireLine ?? false;
    const mixPattern = guardColorsComplete?.mixPattern || DEFAULT_COLORS.mixPattern || MixPattern.AVERAGE;

    // Create decoration types for all permission combinations
    this.createPermissionDecorations(
      colors,
      opacity,
      permissionTransparencies,
      permissionBorderOpacities,
      permissionMinimapColors,
      permissionEnabledStates,
      permissionHighlightEntireLine,
      borderBarEnabled,
      highlightEntireLine,
      mixPattern
    );

    return this.decorationTypes;
  }

  /**
   * Load theme configuration from VSCode settings
   */
  private loadThemeConfiguration(): GuardColors {
    // Get cached colors (updated by theme manager) or default
    const cm = configManager();
    return cm.get<GuardColors>(CONFIG_KEYS.GUARD_COLORS_COMPLETE) || DEFAULT_COLORS;
  }

  /**
   * Process color configuration and extract needed data
   */
  private processColorConfiguration(guardColorsComplete: GuardColors, _opacity: number) {
    const permissionTransparencies: Record<string, number> = {};
    const permissionBorderOpacities: Record<string, number> = {};
    const permissionMinimapColors: Record<string, string> = {};
    const userColors: Record<string, string> = {};
    const permissionEnabledStates: Record<string, boolean> = {};
    const permissionHighlightEntireLine: Record<string, boolean> = {};

    // Process guardColorsComplete permissions
    if (guardColorsComplete?.permissions) {
      for (const [key, permission] of Object.entries(guardColorsComplete.permissions)) {
        if (permission.color) {
          userColors[key] = permission.color;
          permissionTransparencies[key] = permission.transparency || 0.3;
          permissionBorderOpacities[key] = permission.borderOpacity ?? 1.0;
          permissionMinimapColors[key] = permission.minimapColor || permission.color;
          permissionEnabledStates[key] = permission.enabled !== false;
          // Always default to false if not specified - do not inherit from other themes
          permissionHighlightEntireLine[key] = permission.highlightEntireLine ?? false;

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
          // Always default to false if not specified - do not inherit from other themes
          permissionHighlightEntireLine[key] = permission.highlightEntireLine ?? false;
        }
      }
    }

    return {
      colors,
      permissionTransparencies,
      permissionBorderOpacities,
      permissionMinimapColors,
      permissionEnabledStates,
      permissionHighlightEntireLine
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
    permissionHighlightEntireLine: Record<string, boolean>,
    borderBarEnabled: boolean,
    globalHighlightEntireLine: boolean,
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
        permissionHighlightEntireLine,
        borderBarEnabled,
        globalHighlightEntireLine,
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
    permissionHighlightEntireLine: Record<string, boolean>,
    borderBarEnabled: boolean,
    globalHighlightEntireLine: boolean,
    mixPattern: MixPattern
  ): void {
    // For aiRead_humanWrite (default state), use no decoration
    if (key === 'aiRead_humanWrite') {
      this.decorationTypes.set(key, window.createTextEditorDecorationType({}));
      return;
    }

    // Parse permission key to get ai and human parts
    const parts = key.split('_');
    if (parts.length !== 2) return;

    let aiPerm: string | null = null;
    let humanPerm: string | null = null;

    // Extract ai permission
    if (parts[0].startsWith('ai')) {
      if (parts[0].includes('Context')) {
        if (parts[0].includes('WriteContext')) {
          aiPerm = 'contextWrite';
        } else {
          aiPerm = 'context';
        }
      } else {
        const permission = parts[0].replace('ai', '');
        aiPerm = permission === 'NoAccess' ? 'noAccess' : permission.toLowerCase();
      }
    }

    // Extract human permission
    if (parts[1].startsWith('human')) {
      const permission = parts[1].replace('human', '');
      humanPerm = permission === 'NoAccess' ? 'noAccess' : permission.toLowerCase();
    }

    // Create color rendering engine with current colors
    const guardColors: GuardColors = {
      permissions: this.buildPermissionsFromConfig(
        permissionTransparencies,
        permissionBorderOpacities,
        permissionMinimapColors,
        permissionEnabledStates,
        permissionHighlightEntireLine,
        colors
      ),
      borderBarEnabled,
      mixPattern
    };

    const engine = new ColorRenderingEngine(guardColors);
    const result = engine.getColorForPermission({ ai: aiPerm, human: humanPerm });

    // Skip if no color result or permission disabled
    if (result.opacity === 0 && result.borderOpacity === 0) {
      return;
    }

    // Create VSCode decoration options using shared engine
    const decorationOptions = engine.toVSCodeDecorationOptions(result, borderBarEnabled);
    this.decorationTypes.set(key, window.createTextEditorDecorationType(decorationOptions));
  }

  /**
   * Build GuardColors permissions structure from processed configuration
   */
  private buildPermissionsFromConfig(
    permissionTransparencies: Record<string, number>,
    permissionBorderOpacities: Record<string, number>,
    permissionMinimapColors: Record<string, string>,
    permissionEnabledStates: Record<string, boolean>,
    permissionHighlightEntireLine: Record<string, boolean>,
    colors: Record<string, string>
  ): GuardColors['permissions'] {
    return {
      aiWrite: {
        enabled: permissionEnabledStates.aiWrite !== false,
        color: colors.aiWrite || '#000000',
        transparency: permissionTransparencies.aiWrite || 0.3,
        borderOpacity: permissionBorderOpacities.aiWrite || 1.0,
        minimapColor: permissionMinimapColors.aiWrite || colors.aiWrite || '#000000',
        highlightEntireLine: permissionHighlightEntireLine.aiWrite || false
      },
      aiRead: {
        enabled: permissionEnabledStates.aiRead !== false,
        color: colors.aiRead || '#000000',
        transparency: permissionTransparencies.aiRead || 0.3,
        borderOpacity: permissionBorderOpacities.aiRead || 1.0,
        minimapColor: permissionMinimapColors.aiRead || colors.aiRead || '#000000',
        highlightEntireLine: permissionHighlightEntireLine.aiRead || false
      },
      aiNoAccess: {
        enabled: permissionEnabledStates.aiNoAccess !== false,
        color: colors.aiNoAccess || '#000000',
        transparency: permissionTransparencies.aiNoAccess || 0.3,
        borderOpacity: permissionBorderOpacities.aiNoAccess || 1.0,
        minimapColor: permissionMinimapColors.aiNoAccess || colors.aiNoAccess || '#000000',
        highlightEntireLine: permissionHighlightEntireLine.aiNoAccess || false
      },
      humanWrite: {
        enabled: permissionEnabledStates.humanWrite !== false,
        color: colors.humanWrite || '#000000',
        transparency: permissionTransparencies.humanWrite || 0.3,
        borderOpacity: permissionBorderOpacities.humanWrite || 1.0,
        minimapColor: permissionMinimapColors.humanWrite || colors.humanWrite || '#000000',
        highlightEntireLine: permissionHighlightEntireLine.humanWrite || false
      },
      humanRead: {
        enabled: permissionEnabledStates.humanRead !== false,
        color: colors.humanRead || '#000000',
        transparency: permissionTransparencies.humanRead || 0.3,
        borderOpacity: permissionBorderOpacities.humanRead || 1.0,
        minimapColor: permissionMinimapColors.humanRead || colors.humanRead || '#000000',
        highlightEntireLine: permissionHighlightEntireLine.humanRead || false
      },
      humanNoAccess: {
        enabled: permissionEnabledStates.humanNoAccess !== false,
        color: colors.humanNoAccess || '#000000',
        transparency: permissionTransparencies.humanNoAccess || 0.3,
        borderOpacity: permissionBorderOpacities.humanNoAccess || 1.0,
        minimapColor: permissionMinimapColors.humanNoAccess || colors.humanNoAccess || '#000000',
        highlightEntireLine: permissionHighlightEntireLine.humanNoAccess || false
      },
      contextRead: {
        enabled: permissionEnabledStates.contextRead !== false,
        color: colors.contextRead || '#000000',
        transparency: permissionTransparencies.contextRead || 0.3,
        borderOpacity: permissionBorderOpacities.contextRead || 1.0,
        minimapColor: permissionMinimapColors.contextRead || colors.contextRead || '#000000',
        highlightEntireLine: permissionHighlightEntireLine.contextRead || false
      },
      contextWrite: {
        enabled: permissionEnabledStates.contextWrite !== false,
        color: colors.contextWrite || '#000000',
        transparency: permissionTransparencies.contextWrite || 0.3,
        borderOpacity: permissionBorderOpacities.contextWrite || 1.0,
        minimapColor: permissionMinimapColors.contextWrite || colors.contextWrite || '#000000',
        highlightEntireLine: permissionHighlightEntireLine.contextWrite || false
      }
    };
  }

  /**
   * Dispose all decoration types
   */
  dispose(): void {
    this.decorationTypes.forEach(decoration => decoration.dispose());
    this.decorationTypes.clear();
  }
}