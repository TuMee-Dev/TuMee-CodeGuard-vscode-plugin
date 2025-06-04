export enum MixPattern {
  AVERAGE = 'average',                 // Average RGB values
  HUMAN_PRIORITY = 'humanPriority',    // Human color only
  AI_PRIORITY = 'aiPriority',          // AI color only
  AI_BORDER = 'aiBorder',              // Human background with AI left border
  HUMAN_BORDER = 'humanBorder'         // AI background with Human left border
}

export const DEFAULT_MIX_PATTERN = MixPattern.HUMAN_BORDER;

/**
 * Converts a string to a MixPattern enum value
 * @param value - String value to convert
 * @returns MixPattern enum value or default if not found
 */
export function stringToMixPattern(value: string): MixPattern {
  // Direct enum value lookup
  const enumValue = Object.values(MixPattern).find(pattern => pattern as string === value);
  if (enumValue) {
    return enumValue as MixPattern;
  }

  // Fallback to default
  return DEFAULT_MIX_PATTERN;
}

/**
 * Normalizes a MixPattern or string to a MixPattern enum value
 * @param pattern - MixPattern enum or string
 * @returns MixPattern enum value
 */
export function normalizeMixPattern(pattern: MixPattern | string): MixPattern {
  if (typeof pattern === 'string') {
    return stringToMixPattern(pattern);
  }
  return pattern;
}