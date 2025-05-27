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