/**
 * Cached and compiled regex patterns for better performance
 * Single source of truth for all guard tag patterns
 */


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


