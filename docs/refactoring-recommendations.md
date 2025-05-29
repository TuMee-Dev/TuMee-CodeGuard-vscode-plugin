# TuMee VSCode Plugin - Refactoring Recommendations

## Overview
This document identifies key refactoring opportunities in the TuMee VSCode plugin codebase based on code analysis performed on 2025-01-29.

## 1. Large Files (>500 lines) That Need Decomposition

### Files requiring immediate attention:
1. **`src/utils/guardProcessorCore.ts`** (870 lines)
   - Contains core guard processing logic
   - Mix of parsing, stack management, and scope resolution
   - Should be split into: parser module, stack manager, and scope resolver

2. **`src/utils/scopeResolver.ts`** (868 lines)
   - Handles both tree-sitter and regex-based scope resolution
   - Should separate tree-sitter logic from regex fallback logic
   - Extract scope caching into separate module

3. **`src/tools/colorCustomizer.ts`** (800 lines)
   - Manages color configuration, themes, and webview
   - Should extract: theme management, color calculations, webview handling

4. **`src/extension.ts`** (708 lines)
   - Main extension file with mixed responsibilities
   - Should extract: command registration, decoration management, event handling

5. **`src/utils/validationMode.ts`** (579 lines)
   - Validation logic mixed with UI concerns
   - Should separate validation engine from report generation

6. **`src/tools/colorCustomizer/ColorCustomizerWebview.ts`** (509 lines)
   - Webview management with embedded HTML/JS generation
   - Should externalize HTML templates and message handling

## 2. Duplicate Code Patterns

### Configuration Access Pattern
Found 14+ instances of:
```typescript
const config = vscode.workspace.getConfiguration('tumee-vscode-plugin');
```

**Recommendation**: Create a centralized configuration service that caches values and provides typed access.

### Error Handling Pattern
Found 19 files with similar try-catch patterns:
```typescript
try {
  // operation
} catch (error) {
  console.error(`Error in X: ${error instanceof Error ? error.message : String(error)}`);
  return null/false;
}
```

**Recommendation**: Create error handling utilities with consistent logging and recovery strategies.

### Permission State Mapping
Multiple files contain hardcoded permission mappings:
```typescript
if (aiPerm === 'r' && humanPerm === 'r') return 'aiRead_humanRead';
if (aiPerm === 'r' && humanPerm === 'w') return 'aiRead_humanWrite';
// ... many more conditions
```

**Recommendation**: Replace with a lookup table or state machine pattern.

## 3. Complex Functions to Break Down

### `updateCodeDecorationsImpl()` in extension.ts
- 100+ lines handling multiple concerns
- Should be split into: parsing, permission calculation, decoration application

### `processGuardTags()` in guardProcessorCore.ts
- Complex stack-based processing with multiple nested conditions
- Extract: stack operations, scope resolution, permission merging

### `resolveSemantic()` in scopeResolver.ts
- Handles both tree-sitter and regex fallback in one function
- Should use strategy pattern for different resolution methods

## 4. Hardcoded Constants to Externalize

### Magic Numbers
- `MAX_FILE_SIZE = 1024 * 1024` (multiple locations)
- `CACHE_TTL = 5 * 60 * 1000` (5 minutes)
- `DEBOUNCE_DELAY = 300`
- `CHUNK_SIZE = 1000`
- `PROGRESS_THRESHOLD = 10000`

### Color Values
- Default colors embedded in code
- Border styles and opacities
- Mix pattern definitions

### Regex Patterns
- Guard tag patterns duplicated across files
- Comment detection patterns
- Scope resolution patterns

**Recommendation**: Create a `constants.ts` file with categorized exports.

## 5. Tightly Coupled Modules

### Tree-sitter and Scope Resolution
- `treeSitterParser.ts` and `scopeResolver.ts` have circular dependencies
- Both modules initialize each other
- **Recommendation**: Create a facade pattern to manage initialization

### Guard Processing Chain
- `guardProcessor.ts` → `guardProcessorCore.ts` → `scopeResolver.ts` → `treeSitterParser.ts`
- Tight coupling makes testing difficult
- **Recommendation**: Use dependency injection and interfaces

### Decoration System
- `decorationTypeFactory.ts` depends on configuration, color utils, and mix patterns
- Direct VSCode API usage throughout
- **Recommendation**: Abstract VSCode APIs behind interfaces

## 6. Data/Configuration to Extract

### Theme Configurations
Currently loaded from JSON but with embedded logic:
```typescript
export function getDefaultColorConfig(): GuardColors {
  // 50+ lines of configuration
}
```

**Recommendation**: Move all default configurations to JSON files.

### Language Scope Mappings
Hardcoded mappings between tree-sitter nodes and semantic scopes.
**Recommendation**: Externalize to language-specific configuration files.

### Validation Rules
Validation logic embedded in code with hardcoded limits.
**Recommendation**: Create a validation schema file with rules and limits.

## 7. Specific Refactoring Actions

### Priority 1 (High Impact, Low Risk)
1. Extract configuration service
2. Create constants file for magic numbers
3. Externalize theme and color configurations
4. Create error handling utilities

### Priority 2 (Medium Impact, Medium Risk)
1. Split large files into focused modules
2. Extract permission state machine
3. Create abstractions for VSCode APIs
4. Implement dependency injection for guard processing

### Priority 3 (High Impact, Higher Risk)
1. Redesign scope resolution with strategy pattern
2. Separate validation engine from UI
3. Create plugin architecture for language support
4. Implement proper caching layer with invalidation

## 8. Code Smells Identified

1. **Long parameter lists**: Functions with 5+ parameters
2. **Deep nesting**: Some functions have 4+ levels of nesting
3. **Mixed concerns**: Business logic mixed with UI logic
4. **Weak typing**: Heavy use of `any` and string literals
5. **Global state**: WeakMaps and module-level variables for caching

## 9. Testing Improvements Needed

1. **Unit test coverage**: Large files have minimal unit tests
2. **Integration tests**: Complex interactions not well tested
3. **Mocking**: Direct VSCode API usage makes testing difficult
4. **Test data**: Hardcoded test strings throughout test files

## Conclusion

The codebase would benefit most from:
1. **Modularization**: Breaking down large files into focused modules
2. **Configuration extraction**: Moving data out of code
3. **Abstraction**: Creating interfaces for external dependencies
4. **Standardization**: Consistent patterns for common operations

These refactoring efforts would improve maintainability, testability, and make the codebase more accessible to new contributors.