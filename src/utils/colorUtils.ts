/**
 * Shared color utility functions
 */

/**
 * Convert hex color to RGBA
 * @param hex Hex color string (e.g., '#FF0000')
 * @param alpha Alpha value (0-1)
 * @returns RGBA color string
 */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Convert RGB to hex color
 * @param r Red value (0-255)
 * @param g Green value (0-255)
 * @param b Blue value (0-255)
 * @returns Hex color string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${  [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? `0${  hex}` : hex;
  }).join('')}`;
}

/**
 * Parse CSS color to RGB components
 * @param color CSS color string
 * @returns RGB object or null if invalid
 */
export function parseColor(color: string): { r: number, g: number, b: number } | null {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    } else if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }
  }

  // Handle rgb/rgba colors
  const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10)
    };
  }

  return null;
}

/**
 * Calculate color brightness using YIQ formula
 * @param color Color in any CSS format
 * @returns Brightness value (0-255)
 */
export function getColorBrightness(color: string): number {
  const rgb = parseColor(color);
  if (!rgb) return 128; // Default to medium brightness

  // YIQ formula for perceived brightness
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
}

/**
 * Determine if a color is light or dark
 * @param color Color in any CSS format
 * @returns true if light, false if dark
 */
export function isLightColor(color: string): boolean {
  return getColorBrightness(color) > 128;
}