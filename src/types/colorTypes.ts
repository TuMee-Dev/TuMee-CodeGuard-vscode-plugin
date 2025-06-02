// Re-export types from colorCustomizer for centralized access
export type { GuardColors, PermissionColorConfig } from '../tools/colorCustomizer/ColorConfigTypes';
import type { GuardColors as GuardColorsType } from '../tools/colorCustomizer/ColorConfigTypes';

export interface ColorTheme {
  name: string;
  description: string;
  colors: GuardColorsType;
}