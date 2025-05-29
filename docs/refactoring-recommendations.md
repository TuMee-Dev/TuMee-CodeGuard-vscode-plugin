# Refactoring Recommendations for TuMee VSCode Plugin

## Current State (Updated: 2025-01-30)

### Completed Refactorings
1. ✅ **webviewContent.ts** - Reduced from 1074 → 26 lines
   - Moved JavaScript to external webview.js file
   - CSS already externalized to styles.css
   
2. ✅ **scopeResolver.ts** - Reduced from 1016 → 868 lines  
   - Externalized language scope mappings to language-scopes.json
   - Created languageScopeLoader.ts for loading configurations
   - Added Python-compatible loader example

3. ✅ **colorCustomizer.ts** - Reduced from 967 → 800 lines
   - Externalized 11 theme definitions to themes.json
   - Created themeLoader.ts for theme loading
   - Maintained backward compatibility

4. ✅ **validationReportView.ts** - Reduced from 648 → 439 lines
   - Externalized HTML template to validation-report-template.html
   - Created templateLoader.ts for template processing
   - Uses placeholder replacement for dynamic content

### Largest Files Remaining (>500 lines)

### 1. **guardProcessorCore.ts** (870 lines)
**Issues:**
- Complex nested logic with deep indentation
- parseGuardTagsCore function is over 500 lines
- Repetitive permission checking patterns
- Duplicate scope resolution logic

**Recommendations:**
- Extract permission state management into a `PermissionStateManager` class
- Create separate functions for each scope type resolution
- Extract guard stack operations into a `GuardStackManager` class
- Use strategy pattern for different guard processing strategies

**Potential savings: ~200-250 lines**

### 2. **scopeResolver.ts** (868 lines) - Further opportunities
**Issues:**
- Still contains regex fallback code that could be extracted
- Duplicate tree traversal logic
- Complex boundary calculation logic

**Recommendations:**
- Extract regex fallback patterns to external configuration
- Create a `TreeTraversalHelper` class for common AST operations
- Simplify boundary calculation with helper functions

**Potential savings: ~100-150 lines**

### 3. **extension.ts** (708 lines)
**Issues:**
- Activation function doing too many things
- Command registration code is repetitive
- Configuration change handlers are verbose

**Recommendations:**
- Extract command registration into a `CommandRegistry` class
- Create a `ConfigurationWatcher` class for config change handling
- Move provider registrations to separate initialization functions

**Potential savings: ~150-200 lines**

### 4. **validationMode.ts** (579 lines)
**Issues:**
- Complex validation logic mixed with VSCode API calls
- Repetitive error handling patterns
- Large switch statements for different validation modes

**Recommendations:**
- Extract validation strategies into separate classes
- Create a `ValidationEngine` that's VSCode-agnostic
- Use factory pattern for validation mode creation

**Potential savings: ~150-200 lines**

## Quick Win Opportunities (100+ lines with low risk)

### 1. **Extract Command Definitions from extension.ts**
- Create a commands.json with command metadata
- Generate command registration code from configuration
- Similar pattern to language-scopes.json
- **Estimated savings: 100+ lines**
- **Risk: Low** - Just data extraction

### 2. **Consolidate Permission Logic**
- Create a shared `PermissionEvaluator` class
- Used by guardProcessorCore, validationMode, and validationReportView
- Eliminate duplicate permission checking code
- **Estimated savings: 150+ lines across files**
- **Risk: Medium** - Requires careful testing

### 3. **Extract Regex Patterns from scopeResolver.ts**
- Move remaining regex patterns to external configuration
- Create a `RegexPatternMatcher` class
- **Estimated savings: 100+ lines**
- **Risk: Low** - Similar to language scopes extraction

## Recommended Order of Implementation

1. **Command extraction from extension.ts** (Low risk, good cleanup)
2. **Permission logic consolidation** (Medium risk, high value)  
3. **guardProcessorCore.ts refactoring** (Higher risk, but biggest file)

## Architecture Improvements

### 1. **Create Core Logic Package**
- Extract VSCode-independent logic into separate modules
- Make it easier to share with CLI tools
- Improve testability

### 2. **Implement Dependency Injection**
- Reduce tight coupling between modules
- Make testing easier
- Allow for different implementations (VSCode vs CLI)

### 3. **Event-Driven Architecture**
- Create an event bus for cross-component communication
- Reduce direct dependencies between modules
- Make the system more extensible

## Performance Considerations

1. **Lazy Loading**
   - ✅ Tree-sitter parsers already lazy-loaded
   - ✅ Theme and language configurations loaded on demand
   - Consider lazy loading validation rules

2. **Caching Improvements**
   - ACL query results already cached (5 min TTL)
   - Consider caching parsed guard tags per document
   - Cache validation results for unchanged files

3. **Incremental Processing**
   - Only reprocess changed lines
   - Use document change events more efficiently
   - Batch updates to decorations