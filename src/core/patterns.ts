/**
 * Core regex patterns and normalization functions - platform agnostic
 * Single source of truth for all guard tag patterns
 * No dependencies allowed in this module
 */

// Guard tag prefix constant
export const GUARD_TAG_PREFIX = '@guard:';

// Permission aliases mapping
export const PERMISSION_ALIASES = {
  'read': 'r',
  'readonly': 'r',
  'read-only': 'r',
  'write': 'w',
  'noaccess': 'n',
  'none': 'n',
  'no-access': 'n'
} as const;

// Scope aliases mapping
export const SCOPE_ALIASES = {
  'sig': 'signature',
  'func': 'function',
  'stmt': 'statement',
  'doc': 'docstring',
  'dec': 'decorator',
  'val': 'value',
  'expr': 'expression'
} as const;

// Guard tag patterns - compile once and reuse
export const GUARD_TAG_PATTERNS = {
  // Comprehensive guard tag pattern supporting ALL specification formats
  // Pattern: @guard:target[identifier]:permission[.scope][+scope][-scope][.if(condition)][metadata]
  GUARD_TAG: /(?:\/\/|#|--|\/\*|\*|<!--)*\s*@guard:(ai|human|hu|all)(?:,(ai|human|hu|all))*(?:\[([^\]]+)\])?:(read-only|readonly|read|write|noaccess|none|context|r|w|n)(?::(r|w|read|write))?(?:\[([^\]]+)\])?(?:\.([a-zA-Z]+|\d+))?(?:\.if\(([^)]+)\))?(?:(\+[a-zA-Z]+)*)?(?:(-[a-zA-Z]+)*)?/gi,

  // Markdown-specific guard tag pattern
  MARKDOWN_GUARD_TAG: /<!--\s*@guard:(ai|human|hu|all)(?:,(ai|human|hu|all))*(?:\[([^\]]+)\])?:(read-only|readonly|read|write|noaccess|none|context|r|w|n)(?::(r|w|read|write))?(?:\[([^\]]+)\])?(?:\.([a-zA-Z]+|\d+))?(?:\.if\(([^)]+)\))?(?:(\+[a-zA-Z]+)*)?(?:(-[a-zA-Z]+)*)?(?:\s*-->)?/gi,

  // Pattern for extracting scope modifiers
  SCOPE_MODIFIER: /([+-])([a-zA-Z]+)/g,

  // Pattern for numeric line counts
  NUMERIC_SCOPE: /^\d+$/,

  // Inline guard tag pattern for parseGuardTag function (non-global)
  PARSE_GUARD_TAG: /(?:\/\/|#|--|\/\*|\*|<!--)*\s*@guard:(ai|human|hu|all)(?:,(ai|human|hu|all))*(?:\[([^\]]+)\])?:(read-only|readonly|read|write|noaccess|none|context|r|w|n)(?::(r|w|read|write))?(?:\[([^\]]+)\])?(?:\.([a-zA-Z]+|\d+))?(?:\.if\(([^)]+)\))?(?:(\+[a-zA-Z]+)*)?(?:(-[a-zA-Z]+)*)?/i,

  // Simple pattern to detect any guard tag (case-insensitive)
  HAS_GUARD_TAG: /@guard:/i
} as const;

// Helper functions for normalizing permissions and scopes
export function normalizePermission(permission: string): string {
  const normalized = permission.toLowerCase();
  return PERMISSION_ALIASES[normalized as keyof typeof PERMISSION_ALIASES] || normalized;
}

export function normalizeScope(scope: string): string {
  const normalized = scope.toLowerCase();
  return SCOPE_ALIASES[normalized as keyof typeof SCOPE_ALIASES] || normalized;
}

// Utility patterns
export const UTILITY_PATTERNS = {
  // Path normalization
  BACKSLASH: /\\/g,
  TRAILING_SLASH: /\/+$/,

  // Line splitting
  LINE_SPLIT: /\r?\n/,

  // Numeric validation
  NUMERIC_ONLY: /^\d+$/
} as const;

// Language-specific patterns for semantic scope detection
export const LANGUAGE_PATTERNS = {
  // JavaScript/TypeScript patterns
  javascript: {
    FUNCTION: /^(?:\s*(?:export\s+)?(?:async\s+)?function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|\w+\s*=>))/,
    CLASS: /^(?:\s*(?:export\s+)?(?:abstract\s+)?class\s+\w+)/,
    METHOD: /^(?:\s*(?:async\s+)?(?:static\s+)?(?:get\s+|set\s+)?\w+\s*\([^)]*\)\s*(?:\{|=>))/,
    BLOCK: /^(?:\s*(?:if|for|while|do|try|catch|finally)\s*(?:\([^)]*\))?\s*\{)/,
  },

  // Python patterns
  python: {
    FUNCTION: /^(?:\s*(?:async\s+)?def\s+\w+\s*\()/,
    CLASS: /^(?:\s*class\s+\w+(?:\s*\([^)]*\))?:)/,
    METHOD: /^(?:\s{4,}(?:async\s+)?def\s+\w+\s*\()/,
    BLOCK: /^(?:\s*(?:if|for|while|try|except|finally|with)\s+.+:)/,
    DECORATOR: /^(?:\s*@\w+)/,
  },

  // Java patterns
  java: {
    FUNCTION: /^(?:\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:\w+(?:<[^>]+>)?)\s+\w+\s*\([^)]*\)\s*(?:throws\s+\w+(?:\s*,\s*\w+)*)?\s*\{)/,
    CLASS: /^(?:\s*(?:public|private|protected)?\s*(?:abstract\s+|final\s+)?class\s+\w+(?:<[^>]+>)?(?:\s+extends\s+\w+)?(?:\s+implements\s+\w+(?:\s*,\s*\w+)*)?\s*\{)/,
    METHOD: /^(?:\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:\w+(?:<[^>]+>)?)\s+\w+\s*\([^)]*\)\s*(?:throws\s+\w+(?:\s*,\s*\w+)*)?\s*\{)/,
    BLOCK: /^(?:\s*(?:if|for|while|do|try|catch|finally)\s*(?:\([^)]*\))?\s*\{)/,
  },

  // C# patterns
  csharp: {
    FUNCTION: /^(?:\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?(?:\w+(?:<[^>]+>)?)\s+\w+\s*\([^)]*\)\s*(?:where\s+\w+\s*:\s*\w+)?\s*\{)/,
    CLASS: /^(?:\s*(?:public|private|protected|internal)?\s*(?:abstract\s+|sealed\s+)?(?:partial\s+)?class\s+\w+(?:<[^>]+>)?(?:\s*:\s*\w+(?:\s*,\s*\w+)*)?(?:\s*where\s+\w+\s*:\s*\w+)?\s*\{)/,
    METHOD: /^(?:\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?(?:\w+(?:<[^>]+>)?)\s+\w+\s*\([^)]*\)\s*(?:where\s+\w+\s*:\s*\w+)?\s*\{)/,
    BLOCK: /^(?:\s*(?:if|for|foreach|while|do|try|catch|finally)\s*(?:\([^)]*\))?\s*\{)/,
  }
} as const;

// Cache for dynamically created patterns
const patternCache = new Map<string, RegExp>();

/**
 * Get or create a cached regex pattern
 */
export function getCachedPattern(pattern: string, flags: string = ''): RegExp {
  const key = `${pattern}::${flags}`;

  if (!patternCache.has(key)) {
    try {
      patternCache.set(key, new RegExp(pattern, flags));
    } catch (error) {
      console.error(`Failed to compile regex pattern: ${pattern}`, error);
      // Return a pattern that never matches
      return /(?!)/;
    }
  }

  return patternCache.get(key) ?? /(?!)/;
}

/**
 * Clear the pattern cache (useful for testing)
 */
export function clearPatternCache(): void {
  patternCache.clear();
}

/**
 * Get language-specific patterns
 */
export function getLanguagePatterns(languageId: string): typeof LANGUAGE_PATTERNS.javascript | null {
  switch (languageId) {
    case 'javascript':
    case 'javascriptreact':
    case 'typescript':
    case 'typescriptreact':
      return LANGUAGE_PATTERNS.javascript;

    case 'python':
      return LANGUAGE_PATTERNS.python;

    case 'java':
      return LANGUAGE_PATTERNS.java;

    case 'csharp':
      return LANGUAGE_PATTERNS.csharp;

    default:
      return null;
  }
}