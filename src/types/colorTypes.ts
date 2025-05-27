// Re-export types from colorCustomizer for centralized access
export type { GuardColors, PermissionColorConfig } from '../tools/colorCustomizer';
import type { GuardColors as GuardColorsType } from '../tools/colorCustomizer';

export interface ColorTheme {
  name: string;
  description: string;
  colors: GuardColorsType;
}