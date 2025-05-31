/**
 * Core parsing module entry point
 * Platform-agnostic guard tag parsing, tree-sitter parsing and scope resolution
 */

// Export all types
export type {
  IDocument,
  ITextLine,
  IExtensionContext,
  IParsingConfig,
  ScopeBoundary,
  ParseResult,
  NodePosition,
  NodeBoundaries,
  Node,
  Tree
} from './types';

// Export guard parser types
export type {
  GuardTagParseResult
} from './guardParser';

// Export core types
export type {
  PermissionValue,
  PermissionTarget,
  GuardTag,
  LinePermission,
  GuardStackEntry,
  ICoreConfiguration
} from './types';

export {
  DEFAULT_PERMISSIONS
} from './types';

// Export parser functions
export {
  initializeTreeSitter,
  loadLanguageParser,
  parseDocument,
  findNodeAtPosition,
  findParentOfType,
  getNodeBoundaries,
  isTreeSitterInitialized,
  getSupportedLanguages
} from './parser';

// Export scope resolution functions
export {
  resolveSemanticScope,
  findSignatureScope,
  findBodyScope,
  findStatementScope,
  findContextScope,
  isDocumentationNode
} from './scopeResolver';

// Export language scope functions
export {
  getLanguageScopeConfig,
  getLanguageScopeMappings,
  isLanguageSupported,
  getSupportedLanguages as getSupportedLanguagesFromScopes
} from './languageScopes';

export type {
  LanguageScopes,
  LanguageScopeConfig
} from './languageScopes';

// Export guard parser functions
export {
  parseGuardTag,
  hasGuardTag,
  extractGuardTagMatches
} from './guardParser';

// Export patterns and normalization functions
export {
  GUARD_TAG_PREFIX,
  PERMISSION_ALIASES,
  SCOPE_ALIASES,
  GUARD_TAG_PATTERNS,
  UTILITY_PATTERNS,
  LANGUAGE_PATTERNS,
  normalizePermission,
  normalizeScope,
  getCachedPattern,
  clearPatternCache,
  getLanguagePatterns
} from './patterns';

// Export comment detection functions
export {
  isLineAComment,
  getCommentPrefixes,
  supportsLineComments,
  supportsBlockComments
} from './commentDetector';

// Export error handling
export {
  ErrorSeverity,
  GuardProcessingError,
  handleGuardError,
  consoleLogger
} from './errorHandler';

export type {
  ErrorContext,
  ILogger
} from './errorHandler';

// Export guard stack management
export {
  popGuardWithContextCleanup,
  removeInterruptedContextGuards,
  createGuardStackEntry
} from './guardStackManager';

// Export core processor functions
export {
  parseGuardTagsCore,
  getLinePermissionsCore,
  getDefaultPermissions,
  processDocument
} from './processor';

// Export regex scope resolver
export {
  resolveSemanticWithRegex
} from './regexScopeResolver';