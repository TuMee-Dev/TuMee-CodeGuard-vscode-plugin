/**
 * Language-specific comment detection utilities
 */

/**
 * Language configuration for comment patterns
 */
interface LanguageCommentConfig {
  lineComments: string[];
  blockCommentStart?: string[];
  blockCommentContinue?: string[];
}

/**
 * Map of language IDs to their comment configurations
 */
const LANGUAGE_COMMENTS: Record<string, LanguageCommentConfig> = {
  // C-style languages
  javascript: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  typescript: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  javascriptreact: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  typescriptreact: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  java: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  c: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  cpp: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  csharp: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  go: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  rust: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  swift: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  kotlin: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  scala: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  php: { lineComments: ['//', '#'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  
  // Shell-style languages
  python: { lineComments: ['#'] },
  ruby: { lineComments: ['#'] },
  perl: { lineComments: ['#'] },
  shellscript: { lineComments: ['#'] },
  yaml: { lineComments: ['#'] },
  r: { lineComments: ['#'] },
  elixir: { lineComments: ['#'] },
  
  // XML-style languages
  html: { lineComments: [], blockCommentStart: ['<!--'] },
  xml: { lineComments: [], blockCommentStart: ['<!--'] },
  svg: { lineComments: [], blockCommentStart: ['<!--'] },
  
  // CSS-style languages
  css: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  scss: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  less: { lineComments: ['//'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  
  // SQL
  sql: { lineComments: ['--'], blockCommentStart: ['/*'], blockCommentContinue: ['*'] },
  
  // Lua
  lua: { lineComments: ['--'] },
  
  // Haskell
  haskell: { lineComments: ['--'], blockCommentStart: ['{-'] },
  
  // PowerShell
  powershell: { lineComments: ['#'], blockCommentStart: ['<#'] },
  
  // Visual Basic
  vb: { lineComments: ["'", 'rem '] },
  vbscript: { lineComments: ["'", 'rem '] },
  
  // Lisp-style languages
  clojure: { lineComments: [';'] },
  lisp: { lineComments: [';'] },
  scheme: { lineComments: [';'] },
  
  // Erlang
  erlang: { lineComments: ['%'] },
  
  // Fortran
  fortran: { lineComments: ['c', 'C', '!'] },
  
  // Pascal/Delphi
  pascal: { lineComments: ['//'], blockCommentStart: ['{', '(*'] },
  delphi: { lineComments: ['//'], blockCommentStart: ['{', '(*'] }
};

/**
 * Check if a line is a comment based on language
 * @param line The line text to check
 * @param languageId The language identifier
 * @returns true if the line is a comment
 */
export function isLineAComment(line: string, languageId: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Get language config or use defaults
  const config = LANGUAGE_COMMENTS[languageId] || {
    lineComments: ['#', '//'],
    blockCommentStart: ['/*'],
    blockCommentContinue: ['*']
  };

  // Check line comments
  for (const prefix of config.lineComments) {
    if (trimmed.startsWith(prefix)) {
      return true;
    }
  }

  // Check block comment starts
  if (config.blockCommentStart) {
    for (const prefix of config.blockCommentStart) {
      if (trimmed.startsWith(prefix)) {
        return true;
      }
    }
  }

  // Check block comment continuation
  if (config.blockCommentContinue) {
    for (const prefix of config.blockCommentContinue) {
      if (trimmed.startsWith(prefix)) {
        return true;
      }
    }
  }

  // Special case for case-insensitive matches
  if (languageId === 'vb' || languageId === 'vbscript') {
    return !!trimmed.match(/^rem\s/i);
  }

  return false;
}

/**
 * Get comment prefixes for a language
 * @param languageId The language identifier
 * @returns Array of comment prefixes
 */
export function getCommentPrefixes(languageId: string): string[] {
  const config = LANGUAGE_COMMENTS[languageId];
  if (!config) return ['#', '//', '/*'];

  const prefixes: string[] = [...config.lineComments];
  if (config.blockCommentStart) {
    prefixes.push(...config.blockCommentStart);
  }
  return prefixes;
}

/**
 * Check if a language supports line comments
 * @param languageId The language identifier
 * @returns true if the language supports line comments
 */
export function supportsLineComments(languageId: string): boolean {
  const config = LANGUAGE_COMMENTS[languageId];
  return config ? config.lineComments.length > 0 : true;
}

/**
 * Check if a language supports block comments
 * @param languageId The language identifier
 * @returns true if the language supports block comments
 */
export function supportsBlockComments(languageId: string): boolean {
  const config = LANGUAGE_COMMENTS[languageId];
  return config ? (config.blockCommentStart?.length || 0) > 0 : true;
}