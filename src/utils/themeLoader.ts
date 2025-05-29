/**
 * Theme configuration loader for TuMee VSCode Plugin
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GuardColors, PermissionColorConfig } from '../tools/colorCustomizer';
import { MixPattern } from '../types/mixPatterns';

export interface ThemeConfig {
  displayName: string;
  permissions: Record<string, {
    color: string;
    transparency: number;
    enabled?: boolean;
  }>;
  mixPattern?: string;
}

export interface ThemesConfiguration {
  version: string;
  defaultMixPattern?: string;
  themes: Record<string, ThemeConfig>;
}

let cachedThemes: ThemesConfiguration | null = null;
let resolvedThemes: Record<string, { name: string; colors: GuardColors }> | null = null;

/**
 * Load theme configuration from JSON file
 */
export function loadThemeConfiguration(): ThemesConfiguration {
  if (cachedThemes) {
    return cachedThemes;
  }

  try {
    // In production, __dirname is dist/utils, so we need to go up one level
    // In development, it might be src/utils
    let themesPath = path.join(__dirname, '..', 'resources', 'themes.json');

    // If not found in the expected location, try the dist location
    if (!fs.existsSync(themesPath)) {
      themesPath = path.join(__dirname, '..', '..', 'dist', 'resources', 'themes.json');
    }

    // If still not found, try relative to process.cwd() for CLI usage
    if (!fs.existsSync(themesPath)) {
      themesPath = path.join(process.cwd(), 'dist', 'resources', 'themes.json');
    }

    const themesData = fs.readFileSync(themesPath, 'utf8');
    cachedThemes = JSON.parse(themesData) as ThemesConfiguration;
    return cachedThemes;
  } catch (error) {
    console.error('Failed to load themes configuration:', error);
    // Return minimal fallback
    return {
      version: '1.0.0',
      themes: {}
    };
  }
}

/**
 * Convert theme config to GuardColors format
 */
function convertThemeToGuardColors(themeId: string, theme: ThemeConfig, defaultMixPattern: string): { name: string; colors: GuardColors } {
  const permissions: Record<string, PermissionColorConfig> = {};

  // Convert each permission
  for (const [permId, config] of Object.entries(theme.permissions)) {
    permissions[permId] = {
      enabled: config.enabled !== false, // Default to true if not specified
      color: config.color,
      transparency: config.transparency,
      borderOpacity: 1.0, // Default border opacity
      minimapColor: config.color // Default minimap color to main color
    };
  }

  const colors: GuardColors = {
    permissions: permissions as any, // Type assertion needed due to specific permission keys
    borderBarEnabled: true,
    mixPattern: (theme.mixPattern as MixPattern) || (defaultMixPattern as MixPattern) || MixPattern.HUMAN_BORDER
  };

  return {
    name: theme.displayName || themeId,
    colors
  };
}

/**
 * Get all themes in COLOR_THEMES format
 */
export function getColorThemes(): Record<string, { name: string; colors: GuardColors }> {
  if (resolvedThemes) {
    return resolvedThemes;
  }

  const config = loadThemeConfiguration();
  resolvedThemes = {};

  for (const [themeId, theme] of Object.entries(config.themes)) {
    resolvedThemes[themeId] = convertThemeToGuardColors(
      themeId,
      theme,
      config.defaultMixPattern || 'humanBorder'
    );
  }

  return resolvedThemes;
}

/**
 * Clear cached themes (useful for testing or hot reload)
 */
export function clearThemeCache(): void {
  cachedThemes = null;
  resolvedThemes = null;
}