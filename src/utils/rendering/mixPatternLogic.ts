/**
 * Shared mix pattern logic for determining which color takes precedence
 * This centralizes the logic used by CLI, webview, and other components
 */

import { MixPattern } from '../../types/mixPatterns';

export interface MixPatternColors {
  aiColor: any;
  humanColor: any;
}

/**
 * Determines which color should be used for background based on mix pattern
 * @returns 'ai' | 'human' | 'blend' - which color to use
 */
export function getBackgroundColorSource(pattern: MixPattern | string): 'ai' | 'human' | 'blend' {
  const normalizedPattern = typeof pattern === 'string' ? pattern : MixPattern[pattern];

  switch (normalizedPattern) {
    case 'aiBorder':
    case MixPattern.AI_BORDER:
      return 'human'; // Human background with AI border

    case 'humanBorder':
    case MixPattern.HUMAN_BORDER:
      return 'ai'; // AI background with human border

    case 'aiPriority':
    case MixPattern.AI_PRIORITY:
      return 'ai';

    case 'humanPriority':
    case MixPattern.HUMAN_PRIORITY:
      return 'human';

    case 'average':
    case MixPattern.AVERAGE:
      return 'blend';

    default:
      return 'ai'; // Default to AI color
  }
}

/**
 * Determines which color should be used for border based on mix pattern
 * @returns 'ai' | 'human' | 'none' - which color to use for border
 */
export function getBorderColorSource(pattern: MixPattern | string): 'ai' | 'human' | 'none' {
  const normalizedPattern = typeof pattern === 'string' ? pattern : MixPattern[pattern];

  switch (normalizedPattern) {
    case 'aiBorder':
    case MixPattern.AI_BORDER:
      return 'ai'; // AI border

    case 'humanBorder':
    case MixPattern.HUMAN_BORDER:
      return 'human'; // Human border

    default:
      return 'none'; // No special border for other patterns
  }
}

/**
 * Apply mix pattern and return the appropriate color based on the pattern
 * This is a generic version that works with any color type (ANSI, hex, etc)
 */
export function applyMixPattern<T>(
  pattern: MixPattern | string,
  colors: MixPatternColors & { aiColor: T; humanColor: T },
  blendFunction?: (color1: T, color2: T) => T
): { backgroundColor: T; borderColor?: T } {
  const bgSource = getBackgroundColorSource(pattern);
  const borderSource = getBorderColorSource(pattern);

  let backgroundColor: T;
  let borderColor: T | undefined;

  // Determine background color
  switch (bgSource) {
    case 'ai':
      backgroundColor = colors.aiColor;
      break;
    case 'human':
      backgroundColor = colors.humanColor;
      break;
    case 'blend':
      if (blendFunction) {
        backgroundColor = blendFunction(colors.aiColor, colors.humanColor);
      } else {
        // If no blend function provided, default to AI
        backgroundColor = colors.aiColor;
      }
      break;
  }

  // Determine border color
  switch (borderSource) {
    case 'ai':
      borderColor = colors.aiColor;
      break;
    case 'human':
      borderColor = colors.humanColor;
      break;
    case 'none':
      borderColor = undefined;
      break;
  }

  return { backgroundColor, borderColor };
}

/**
 * Determines which config's highlightEntireLine setting to use based on mix pattern
 */
export function getHighlightEntireLineForMix(
  pattern: MixPattern | string,
  aiHighlight: boolean,
  humanHighlight: boolean
): boolean {
  const bgSource = getBackgroundColorSource(pattern);

  switch (bgSource) {
    case 'ai':
      return aiHighlight;
    case 'human':
      return humanHighlight;
    case 'blend':
      // For blend/average, use AI's setting as default
      return aiHighlight;
  }
}