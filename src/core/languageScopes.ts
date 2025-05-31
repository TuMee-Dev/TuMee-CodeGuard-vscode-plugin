/**
 * Core language scope mappings - embedded in WASM for consistency
 * No filesystem dependencies allowed in this module
 */

export interface LanguageScopes {
  scopes: Record<string, string[]>;
  extends?: string;
}

export interface LanguageScopeConfig {
  version: string;
  commonPatterns?: Record<string, string[]>;
  languages: Record<string, LanguageScopes>;
}

// Embedded language scope configuration - this will be identical in both apps
const EMBEDDED_LANGUAGE_SCOPES: LanguageScopeConfig = {
  "version": "1.0.0",
  "commonPatterns": {
    "block": ["block", "statement_block", "compound_statement", "code_block", "object", "array", "dictionary"],
    "func": ["function_declaration", "method_declaration", "function_definition", "method_definition"],
    "class": ["class_declaration", "class_definition"],
    "statement": ["expression_statement", "assignment_statement", "declaration_statement"],
    "signature": ["function_declaration", "method_declaration", "function_definition", "method_definition"]
  },
  "languages": {
    "javascript": {
      "scopes": {
        "func": ["function_declaration", "method_definition", "arrow_function", "function_expression"],
        "class": ["class_declaration"],
        "block": ["statement_block", "object", "array"],
        "statement": ["expression_statement", "variable_declaration", "assignment_expression"],
        "signature": ["function_declaration", "method_definition"]
      }
    },
    "typescript": {
      "extends": "javascript",
      "scopes": {
        "func": ["function_declaration", "method_definition", "arrow_function", "function_expression", "method_signature"],
        "class": ["class_declaration", "interface_declaration"],
        "block": ["statement_block", "object_type", "object", "array"],
        "statement": ["expression_statement", "variable_declaration", "assignment_expression", "type_alias_declaration"],
        "signature": ["function_declaration", "method_definition", "method_signature"]
      }
    },
    "tsx": {
      "extends": "typescript",
      "scopes": {}
    },
    "python": {
      "scopes": {
        "func": ["function_definition"],
        "class": ["class_definition"],
        "block": ["block", "dictionary", "list", "set"],
        "statement": ["expression_statement", "assignment", "import_statement"],
        "signature": ["function_definition"]
      }
    },
    "java": {
      "scopes": {
        "func": ["method_declaration", "constructor_declaration"],
        "class": ["class_declaration", "interface_declaration"],
        "block": ["block", "array_initializer"],
        "statement": ["expression_statement", "local_variable_declaration"],
        "signature": ["method_declaration", "constructor_declaration"]
      }
    },
    "csharp": {
      "scopes": {
        "func": ["method_declaration", "constructor_declaration"],
        "class": ["class_declaration", "interface_declaration", "struct_declaration"],
        "block": ["block", "array_creation_expression"],
        "statement": ["expression_statement", "local_declaration_statement"],
        "signature": ["method_declaration", "constructor_declaration"]
      }
    },
    "c": {
      "scopes": {
        "func": ["function_definition", "function_declarator"],
        "class": ["struct_specifier"],
        "block": ["compound_statement", "initializer_list"],
        "statement": ["expression_statement", "declaration"],
        "signature": ["function_definition", "function_declarator"]
      }
    },
    "cpp": {
      "extends": "c",
      "scopes": {
        "func": ["function_definition", "function_declarator", "method_definition"],
        "class": ["class_specifier", "struct_specifier"],
        "block": ["compound_statement", "initializer_list"],
        "statement": ["expression_statement", "declaration"],
        "signature": ["function_definition", "function_declarator", "method_definition"]
      }
    },
    "go": {
      "scopes": {
        "func": ["function_declaration", "method_declaration"],
        "class": ["type_declaration"],
        "block": ["block", "composite_literal"],
        "statement": ["expression_statement", "assignment_statement", "var_declaration"],
        "signature": ["function_declaration", "method_declaration"]
      }
    },
    "rust": {
      "scopes": {
        "func": ["function_item"],
        "class": ["struct_item", "enum_item", "impl_item"],
        "block": ["block", "array_expression", "struct_expression"],
        "statement": ["expression_statement", "let_declaration"],
        "signature": ["function_item"]
      }
    },
    "ruby": {
      "scopes": {
        "func": ["method", "singleton_method"],
        "class": ["class", "module"],
        "block": ["begin", "array", "hash"],
        "statement": ["assignment", "method_call"],
        "signature": ["method", "singleton_method"]
      }
    },
    "php": {
      "scopes": {
        "func": ["function_definition", "method_declaration"],
        "class": ["class_declaration", "interface_declaration"],
        "block": ["compound_statement", "array_creation_expression"],
        "statement": ["expression_statement", "assignment_expression"],
        "signature": ["function_definition", "method_declaration"]
      }
    },
    "swift": {
      "scopes": {
        "func": ["function_declaration"],
        "class": ["class_declaration", "protocol_declaration", "struct_declaration"],
        "block": ["statements", "array_literal", "dictionary_literal"],
        "statement": ["assignment", "call_expression"],
        "signature": ["function_declaration"]
      }
    },
    "kotlin": {
      "scopes": {
        "func": ["function_declaration"],
        "class": ["class_declaration", "interface_declaration"],
        "block": ["statements", "collection_literal"],
        "statement": ["assignment", "call_expression"],
        "signature": ["function_declaration"]
      }
    }
  }
};

let resolvedScopes: Record<string, Record<string, string[]>> | null = null;

/**
 * Get language scope configuration (embedded, no filesystem access)
 */
export function getLanguageScopeConfig(): LanguageScopeConfig {
  return EMBEDDED_LANGUAGE_SCOPES;
}

/**
 * Resolve scopes for a language, handling inheritance
 */
function resolveLanguageScopes(languageId: string, config: LanguageScopeConfig): Record<string, string[]> {
  const language = config.languages[languageId];
  if (!language) {
    return {};
  }

  let resolvedScopes = { ...language.scopes };

  // Handle inheritance
  if (language.extends) {
    const parentScopes = resolveLanguageScopes(language.extends, config);
    resolvedScopes = { ...parentScopes, ...resolvedScopes };
  }

  // Merge with common patterns if available
  if (config.commonPatterns) {
    for (const [scope, patterns] of Object.entries(config.commonPatterns)) {
      if (!resolvedScopes[scope]) {
        resolvedScopes[scope] = [...patterns];
      }
    }
  }

  return resolvedScopes;
}

/**
 * Get scope mappings for a specific language
 */
export function getLanguageScopeMappings(languageId: string): Record<string, string[]> | undefined {
  if (!resolvedScopes) {
    // Build resolved scopes cache
    resolvedScopes = {};
    const config = getLanguageScopeConfig();
    
    for (const langId of Object.keys(config.languages)) {
      resolvedScopes[langId] = resolveLanguageScopes(langId, config);
    }
  }

  return resolvedScopes[languageId];
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(languageId: string): boolean {
  const config = getLanguageScopeConfig();
  return languageId in config.languages;
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): string[] {
  const config = getLanguageScopeConfig();
  return Object.keys(config.languages);
}