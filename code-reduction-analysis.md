# Code Reduction Analysis - TuMee VSCode Plugin

## Summary
Based on analysis of the largest source files, I've identified opportunities to reduce the codebase by approximately **200-250 lines** with minimal risk. The primary opportunities are in duplicate code extraction, verbose implementations, and repetitive patterns.

## Top 10 Longest Source Files

### 1. **guardProcessorCore.ts** (870 lines)
**Opportunities:**
- **Extract repeated guard stack operations** (est. 30 lines saved)
  - `popGuardWithContextCleanup` and `removeInterruptedContextGuards` have similar logic
  - Create a generic stack management utility
- **Consolidate permission inheritance logic** (est. 20 lines saved)
  - Lines 425-459 and 660-678 have duplicated permission inheritance
  - Extract to `inheritPermissions()` function
- **Simplify scope trimming logic** (est. 15 lines saved)
  - Lines 463-485 and similar patterns can be extracted
- **Risk: LOW** - These are isolated refactorings

### 2. **scopeResolver.ts** (868 lines)
**Opportunities:**
- **Extract common pattern finding logic** (est. 40 lines saved)
  - Functions like `findFunctionScope`, `findClassScope`, `findMethodScope` share 80% code
  - Create generic `findScopeByPattern()` that they all use
- **Consolidate tree-sitter node type checking** (est. 25 lines saved)
  - Repeated patterns in `findSignatureScopeTreeSitter`, `findBodyScopeTreeSitter`
- **Merge similar regex patterns** (est. 20 lines saved)
  - Many regex scope finders have identical structure
- **Risk: LOW** - Well-tested scope resolution logic

### 3. **colorCustomizer.ts** (802 lines)
**Opportunities:**
- **Move HTML generation to templates** (est. 50 lines saved)
  - Lines 570-783 contain inline HTML that could be templated
  - Already have `webviewContent.ts` module - use it more
- **Extract theme management logic** (est. 30 lines saved)
  - Theme apply/save/delete has repeated validation
  - Create `ThemeManager` class
- **Simplify message handling switch** (est. 15 lines saved)
  - Use command map instead of switch statement
- **Risk: MEDIUM** - UI changes need careful testing

### 4. **extension.ts** (709 lines)
**Opportunities:**
- **Extract decoration range building** (est. 25 lines saved)
  - Lines 468-547 have repetitive range building
  - Use a loop with permission combinations
- **Consolidate event handler setup** (est. 20 lines saved)
  - Similar patterns in all event handlers
- **Simplify status bar update logic** (est. 15 lines saved)
  - Repeated permission mapping can be extracted
- **Risk: LOW** - Core logic is well-isolated

### 5. **validationMode.ts** (579 lines)
**Opportunities:**
- **Extract exit code handling** (est. 30 lines saved)
  - Lines 353-419 have repetitive error handling
  - Create exit code to result mapper
- **Consolidate logging functions** (est. 15 lines saved)
  - `logDebug`, `logError`, `logInfo` are nearly identical
- **Remove test/debug code** (est. 20 lines saved)
  - Lines 499-512 contain debug help commands
- **Risk: LOW** - This is developer tooling

### 6. **ColorCustomizerWebview.ts** (509 lines)
**Opportunities:**
- **Already uses external webview content** - Good!
- **Minor consolidation possible** (est. 10 lines saved)
- **Risk: LOW**

### 7. **validationReportView.ts** (439 lines)
**Opportunities:**
- **Extract HTML template literals** (est. 30 lines saved)
  - Similar to colorCustomizer, use templates
- **Consolidate style generation** (est. 15 lines saved)
- **Risk: LOW**

### 8. **decorationTypeFactory.ts** (391 lines)
**Opportunities:**
- **Use data-driven decoration creation** (est. 40 lines saved)
  - Lines 180-350 repeat similar patterns
  - Create decorations from permission combination data
- **Extract color calculation logic** (est. 15 lines saved)
- **Risk: MEDIUM** - Affects visual appearance

### 9. **configValidator.ts** (337 lines)
**Opportunities:**
- **Consolidate validation rules** (est. 20 lines saved)
  - Similar validation patterns repeated
- **Risk: LOW**

### 10. **acl.ts** (334 lines)
**Opportunities:**
- **Already well-optimized with regex caching**
- **Minor consolidation** (est. 10 lines saved)
- **Risk: LOW**

## Additional Opportunities

### Cross-File Patterns
1. **Extract common error handling patterns** (est. 20 lines total)
   - Many files have similar try-catch-log patterns
   
2. **Create shared HTML/CSS utilities** (est. 30 lines total)
   - Multiple files generate HTML strings
   
3. **Consolidate permission mapping** (est. 15 lines total)
   - Permission string to enum conversions repeated

### Dead Code
1. **Remove commented legacy code** (est. 10 lines)
2. **Remove unused imports** (est. 5 lines)

## Implementation Priority

### Phase 1 - Quick Wins (Low Risk, High Impact)
1. Extract repeated guard stack operations in `guardProcessorCore.ts` (30 lines)
2. Consolidate scope finding patterns in `scopeResolver.ts` (40 lines)
3. Extract exit code handling in `validationMode.ts` (30 lines)
4. Data-driven decoration creation in `decorationTypeFactory.ts` (40 lines)
**Total Phase 1: ~140 lines**

### Phase 2 - Medium Effort (Low Risk)
1. Move HTML to templates in `colorCustomizer.ts` (50 lines)
2. Extract permission inheritance logic (20 lines)
3. Consolidate logging and error handling (20 lines)
**Total Phase 2: ~90 lines**

### Phase 3 - Careful Refactoring (Medium Risk)
1. Theme management extraction (30 lines)
2. Additional HTML templating (30 lines)
**Total Phase 3: ~60 lines**

## Total Estimated Reduction: 290 lines

## Key Principles
1. **Don't break working code** - All changes should be isolated refactorings
2. **Maintain readability** - Don't over-optimize at the cost of clarity
3. **Test thoroughly** - Especially UI and visual changes
4. **Keep commits atomic** - One refactoring per commit for easy rollback