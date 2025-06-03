
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
