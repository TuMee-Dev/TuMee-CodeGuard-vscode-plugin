export enum MixPattern {
  AVERAGE = 'average',           // Current behavior - average RGB values
  TRANSPARENT_AI = 'transparentAi',      // AI color wins
  TRANSPARENT_HUMAN = 'transparentHuman',  // Human color wins
  CHECKERBOARD = 'checkerboard',     // Alternating pattern
  VERTICAL_SPLIT = 'verticalSplit'    // 50/50 vertical split
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
    id: MixPattern.TRANSPARENT_AI,
    name: 'Human Priority',
    description: 'Human color takes precedence'
  },
  {
    id: MixPattern.TRANSPARENT_HUMAN,
    name: 'AI Priority', 
    description: 'AI color takes precedence'
  },
  {
    id: MixPattern.CHECKERBOARD,
    name: 'Checkerboard',
    description: 'Alternating pattern of AI and human colors'
  },
  {
    id: MixPattern.VERTICAL_SPLIT,
    name: 'Vertical Split',
    description: '50/50 split with AI on left, human on right'
  }
];

export const DEFAULT_MIX_PATTERN = MixPattern.AVERAGE;