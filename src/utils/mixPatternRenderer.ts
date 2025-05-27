import { MixPattern } from '../types/mixPatterns';

export interface ColorConfig {
  aiColor: string;
  humanColor: string;
  aiOpacity: number;
  humanOpacity: number;
  aiMinimapColor?: string;
  humanMinimapColor?: string;
  aiBorderOpacity?: number;
  humanBorderOpacity?: number;
}

export interface MixPatternResult {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderStyle?: string;
  opacity?: number;
  // For patterns that can't be represented with basic CSS, we'll fall back to a solid color
  fallbackToSolid?: boolean;
}

/**
 * Converts hex color to rgba
 */
function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith('#')) return `rgba(0, 0, 0, ${alpha})`;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Blends two hex colors
 */
function blendColors(hex1: string, hex2: string): string {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);

  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);

  const r = Math.round((r1 + r2) / 2);
  const g = Math.round((g1 + g2) / 2);
  const b = Math.round((b1 + b2) / 2);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Renders a mix pattern for lines with both AI and human permissions
 */
export function renderMixPattern(pattern: MixPattern, config: ColorConfig): MixPatternResult {
  switch (pattern) {
    case MixPattern.AVERAGE:
      return {
        backgroundColor: hexToRgba(
          blendColors(config.aiColor, config.humanColor),
          (config.aiOpacity + config.humanOpacity) / 2
        )
      };

    case MixPattern.HUMAN_PRIORITY:
      // Human color only
      return {
        backgroundColor: hexToRgba(config.humanColor, config.humanOpacity)
      };

    case MixPattern.AI_PRIORITY:
      // AI color only
      return {
        backgroundColor: hexToRgba(config.aiColor, config.aiOpacity)
      };

    case MixPattern.AI_BORDER:
      // Human background with AI left border
      return {
        backgroundColor: hexToRgba(config.humanColor, config.humanOpacity),
        borderColor: hexToRgba(config.aiColor, config.aiOpacity),
        borderWidth: '0 0 0 5px',
        borderStyle: 'solid'
      };

    case MixPattern.HUMAN_BORDER:
      // AI background with Human left border
      return {
        backgroundColor: hexToRgba(config.aiColor, config.aiOpacity),
        borderColor: hexToRgba(config.humanColor, config.humanOpacity),
        borderWidth: '0 0 0 5px',
        borderStyle: 'solid'
      };

    default:
      // Fallback to average
      return {
        backgroundColor: hexToRgba(
          blendColors(config.aiColor, config.humanColor),
          (config.aiOpacity + config.humanOpacity) / 2
        )
      };
  }
}

/**
 * Gets the border/minimap color for mixed permissions
 */
export function getMixedBorderColor(pattern: MixPattern, config: ColorConfig): string {
  // Patterns that already have their own borders don't need additional ones
  const patternsWithBorders = [
    MixPattern.AI_BORDER,
    MixPattern.HUMAN_BORDER
  ];

  if (patternsWithBorders.includes(pattern)) {
    return ''; // No additional border needed
  }

  // Use AI minimap color or fall back to AI color
  const borderColor = config.aiMinimapColor || config.aiColor;
  const borderOpacity = config.aiBorderOpacity ?? 1.0;

  return hexToRgba(borderColor, borderOpacity);
}