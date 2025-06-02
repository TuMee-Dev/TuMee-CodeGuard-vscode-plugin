export enum MixPattern {
  AVERAGE = 'average',                 // Average RGB values
  HUMAN_PRIORITY = 'humanPriority',    // Human color only
  AI_PRIORITY = 'aiPriority',          // AI color only
  AI_BORDER = 'aiBorder',              // Human background with AI left border
  HUMAN_BORDER = 'humanBorder'         // AI background with Human left border
}

export interface MixPatternDefinition {
  id: MixPattern;
  name: string;
  description: string;
}

export const MIX_PATTERNS: MixPatternDefinition[] = [
  {
    id: MixPattern.AVERAGE,
    name: 'Average Blend',
    description: 'Blend AI and human colors equally'
  },
  {
    id: MixPattern.HUMAN_PRIORITY,
    name: 'Human Priority',
    description: 'Human color takes precedence'
  },
  {
    id: MixPattern.AI_PRIORITY,
    name: 'AI Priority',
    description: 'AI color takes precedence'
  },
  {
    id: MixPattern.AI_BORDER,
    name: 'AI Border',
    description: 'Human background with AI left border'
  },
  {
    id: MixPattern.HUMAN_BORDER,
    name: 'Human Border',
    description: 'AI background with Human left border'
  }
];

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