// Export only the pure parsing logic without tree-sitter dependencies for WASM compilation
export { parseGuardTag } from './core/guardParser';
export { isLineAComment } from './core/commentDetector';
export { 
  getDefaultPermissions,
  parseGuardTagsCore,
  getLinePermissionsCore 
} from './core/processor';
export type { GuardTag, LinePermission } from './core/types';