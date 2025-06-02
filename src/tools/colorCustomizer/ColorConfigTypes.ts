import type { MixPattern } from '../../types/mixPatterns';
import { DEFAULT_MIX_PATTERN } from '../../types/mixPatterns';
import { getColorThemes } from '../../utils/rendering/themeLoader';

export interface PermissionColorConfig {
  enabled: boolean;                // Whether to use own color or other's
  color: string;                   // Base color
  transparency: number;            // Transparency level (0-1)
  borderOpacity?: number;          // Optional border opacity (0-1)
  minimapColor?: string;           // Optional custom minimap color
  highlightEntireLine?: boolean;   // Highlight entire line (true) or just text (false)
}

export interface GuardColors {
  // Per-permission configurations
  permissions: {
    aiWrite: PermissionColorConfig;
    aiRead: PermissionColorConfig;
    aiNoAccess: PermissionColorConfig;
    humanWrite: PermissionColorConfig;
    humanRead: PermissionColorConfig;
    humanNoAccess: PermissionColorConfig;
    contextRead: PermissionColorConfig;
    contextWrite: PermissionColorConfig;
  };

  // Global border bar toggle only
  borderBarEnabled: boolean;       // Enable border bar

  // Highlight entire line including whitespace (vs text only)
  highlightEntireLine?: boolean;   // Default false for backward compatibility

  // Mix pattern for when both AI and human permissions are non-default
  mixPattern?: MixPattern;

  // Optional custom colors for specific combinations
  combinations?: {
    aiRead_humanRead?: string;
    aiRead_humanWrite?: string;
    aiRead_humanNoAccess?: string;
    aiWrite_humanRead?: string;
    aiWrite_humanWrite?: string;
    aiWrite_humanNoAccess?: string;
    aiNoAccess_humanRead?: string;
    aiNoAccess_humanWrite?: string;
    aiNoAccess_humanNoAccess?: string;
    aiReadContext_humanRead?: string;
    aiReadContext_humanWrite?: string;
    aiReadContext_humanNoAccess?: string;
    aiWriteContext_humanRead?: string;
    aiWriteContext_humanWrite?: string;
    aiWriteContext_humanNoAccess?: string;
  };
}

// Get themes from external configuration
export const COLOR_THEMES = getColorThemes();

// Default colors (Light theme)
export const DEFAULT_COLORS: GuardColors = {
  permissions: {
    aiWrite: { enabled: true, color: '#FFA500', transparency: 0.2 },
    aiRead: { enabled: true, color: '#808080', transparency: 0.15 },
    aiNoAccess: { enabled: true, color: '#90EE90', transparency: 0.2 },
    humanWrite: { enabled: false, color: '#0000FF', transparency: 0.2 },
    humanRead: { enabled: true, color: '#D3D3D3', transparency: 0.3 },
    humanNoAccess: { enabled: true, color: '#FF0000', transparency: 0.25 },
    contextRead: { enabled: true, color: '#00CED1', transparency: 0.15 },
    contextWrite: { enabled: true, color: '#1E90FF', transparency: 0.15 }
  },
  borderBarEnabled: true,
  highlightEntireLine: false,  // Default to false for backward compatibility
  mixPattern: DEFAULT_MIX_PATTERN
};

// Export themes for CLI usage
export function getBuiltInThemes(): Record<string, { name: string; colors: GuardColors }> {
  const themes: Record<string, { name: string; colors: GuardColors }> = {};
  // Convert COLOR_THEMES back to the format expected by CLI
  Object.entries(COLOR_THEMES).forEach(([name, theme]) => {
    themes[name] = {
      name: theme.name,
      colors: theme.colors
    };
  });
  return themes;
}

// Helper function to merge colors with defaults
export function mergeWithDefaults(colors: Partial<GuardColors> | undefined): GuardColors {
  const merged = JSON.parse(JSON.stringify(DEFAULT_COLORS)) as GuardColors;

  if (colors?.permissions) {
    Object.keys(colors.permissions).forEach(key => {
      const permKey = key as keyof GuardColors['permissions'];
      if (merged.permissions[permKey] && colors.permissions && colors.permissions[permKey]) {
        Object.assign(merged.permissions[permKey], colors.permissions[permKey]);
      }
    });
  }

  if (colors?.borderBarEnabled !== undefined) {
    merged.borderBarEnabled = colors.borderBarEnabled;
  }

  if (colors?.mixPattern !== undefined) {
    merged.mixPattern = colors.mixPattern;
  }

  if (colors?.combinations) {
    merged.combinations = colors.combinations;
  }

  return merged;
}