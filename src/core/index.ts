/**
 * Core parsing module entry point
 * Platform-agnostic tree-sitter parsing and scope resolution
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