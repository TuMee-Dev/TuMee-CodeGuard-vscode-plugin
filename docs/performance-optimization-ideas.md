# Performance Optimization Ideas

**Current Problem**: 4 seconds from file open to colorization (vs code highlighter: <1 second)

## Immediate High-Impact Optimizations

### 1. **Pre-warm Tree-sitter in Background**
- Load tree-sitter WASM runtime during VSCode idle time
- Use `setTimeout(() => initializeTreeSitter(context), 2000)` after activation
- Keep current lazy loading for individual language parsers

### 2. **Skip Tree-sitter for Small Files**
- Files <50 lines: use regex-only parsing (much faster)
- Tree-sitter overhead not worth it for small files
- Regex parsing is ~10x faster for simple cases

### 3. **Parse Only Visible Lines First**
- Get `editor.visibleRanges` and parse only those lines initially
- Parse rest of file in background chunks
- Similar to how VSCode syntax highlighting works

### 4. **Cache Parsed Results**
- Cache guard tag parsing results by file content hash
- Skip re-parsing if file hasn't changed since last parse
- Store in extension's `globalState` for persistence

### 5. **Debounce/Throttle More Aggressively**
- Increase debounce delay from 300ms to 500ms for large files
- Use `requestAnimationFrame` instead of `setTimeout` for smoother updates

## Medium-Impact Optimizations

### 6. **Worker Thread for Parsing**
- Move tree-sitter parsing to web worker (if VSCode extensions support it)
- Keep UI thread responsive during heavy parsing

### 7. **Incremental Parsing**
- Only re-parse changed sections of file using `event.contentChanges`
- Tree-sitter supports incremental parsing natively

### 8. **Streaming Decoration Updates**
- Apply decorations in chunks rather than all-at-once
- Show partial decorations while processing continues

### 9. **Smarter File Type Detection**
- Skip guard tag processing for files that can't contain them
- Quick regex check for guard tag presence before full parsing

### 10. **Reduce Decoration Complexity**
- Combine similar decoration types to reduce VSCode API calls
- Use fewer decoration types (merge similar ones)

## Low-Impact / Experimental

### 11. **WebAssembly Optimization**
- Precompile/optimize WASM modules for specific languages
- Bundle smaller, language-specific WASM files

### 12. **Memory Pool for Parsing**
- Reuse parser instances instead of creating new ones
- Pool tree-sitter trees for common file types

### 13. **Parallel Language Loading**
- Load multiple language parsers concurrently
- Use `Promise.allSettled()` for common language combinations

### 14. **Progressive Enhancement**
- Show basic decorations immediately (regex-based)
- Enhance with tree-sitter results when available
- Users see something immediately, gets better over time

### 15. **Compile-time Optimizations**
- Bundle tree-sitter parsers into extension JS
- Eliminate file I/O for WASM loading

## Measurement & Profiling

### 16. **Add Performance Telemetry**
- Track time for each parsing phase
- Monitor real-world performance across different file sizes
- Identify bottlenecks in production

### 17. **A/B Testing Framework**
- Test different optimization strategies
- Compare performance across different configurations

### 18. **Memory Usage Monitoring**
- Track memory consumption during parsing
- Identify memory leaks or excessive usage

## Architecture Changes

### 19. **Two-Phase Rendering**
- Phase 1: Quick regex scan, basic decorations (<200ms)
- Phase 2: Tree-sitter enhancement, full decorations (background)

### 20. **Language Server Protocol**
- Move heavy parsing to dedicated language server
- Communicate via LSP for ultimate performance

### 21. **Native Module**
- Write critical parsing logic in Rust/C++
- Use N-API for maximum performance

## Quick Wins to Try First

1. **Pre-warm tree-sitter** (add `setTimeout` after activation)
2. **Skip tree-sitter for small files** (<50 lines)
3. **Parse visible lines first** (using `visibleRanges`)
4. **Cache parsing results** (by content hash)
5. **Increase debounce delay** for large files

These should get you under 1 second for most files.

## Notes

- Code syntax highlighting is faster because it's optimized in VSCode core
- Our parsing is more complex (semantic scopes + guard tag processing)
- Tree-sitter initialization is one-time cost, but significant
- File I/O for WASM loading adds latency
- VSCode decoration API has overhead for many decoration types

## Current Bottlenecks (in order)

1. Tree-sitter WASM runtime initialization (~500ms)
2. Language parser loading (~100-200ms per language)
3. Document parsing + scope resolution (~100-500ms depending on file size)
4. Decoration creation + application (~50-100ms)
5. VSCode API overhead (~50ms)

Total: ~800-1350ms + file size overhead = ~1-4 seconds