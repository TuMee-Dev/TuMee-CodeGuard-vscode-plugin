# AI Assistant Context - TuMee CodeGuard Extension

## Purpose
This document provides essential context for AI assistants working on the TuMee CodeGuard VSCode extension.

## System Architecture Overview

### Core Components
1. **Extension Host** (`src/extension.ts`)
   - Entry point and lifecycle management
   - CLI worker initialization
   - Command registration

2. **CLI Integration** (`src/utils/cli/`)
   - Persistent RPC connection to CodeGuard CLI
   - Document parsing and guard tag processing
   - Theme management and configuration

3. **Rendering Engine** (`src/utils/rendering/`)
   - Real-time syntax highlighting
   - Color management and decoration types
   - Mix pattern logic for complex permissions

4. **Gitignore System** (`src/tools/gitignore/`)
   - Intelligent autocomplete provider
   - Workspace file analysis
   - Template generation

### Key Design Principles
- **RPC-First**: All intelligence comes from CLI server, minimal client logic
- **Performance**: Caching, debouncing, chunked processing for large files
- **Error Handling**: Graceful degradation with comprehensive error reporting
- **Type Safety**: Full TypeScript typing with proper interfaces

## Current Implementation Status (v1.6.2)

### ✅ Completed Features
- Guard tag parsing with tree-sitter (block/file scopes)
- CLI RPC communication with timeout handling
- Real-time decoration updates with caching
- Color customization with theme management
- File/folder customization (colors, badges, tooltips)
- Gitignore autocomplete with workspace analysis
- Context menu integration
- Performance monitoring and optimization

### 🔧 Key Technical Details

#### Guard Tag Processing
- **Parser**: Tree-sitter for supported languages, regex fallback
- **Scopes**: Block scope searches forward for next code block
- **Permissions**: `ai:r/w/n`, `human:r/w/n`, `context` types
- **Rendering**: Background colors with opacity, borders for mixed permissions

#### CLI Communication
- **Protocol**: JSON-RPC over stdin/stdout
- **Commands**: `setDocument`, `applyDelta`, `getThemes`, `getGitignoreSuggestions`, etc.
- **Worker**: Singleton CLIWorker with automatic restart
- **Timeout**: Configurable timeouts for startup (5s) and requests (10s)

#### Performance Optimizations
- **ACL Caching**: 5-minute TTL with intelligent invalidation
- **Decoration Caching**: Prevents flashing on tab switches
- **Chunked Processing**: Large files processed in 1000-line chunks
- **Debouncing**: 300ms delay for text changes

### 🚨 Critical Implementation Notes

#### Configuration Management
- Uses `configurationManager` for centralized settings
- Validation with auto-fix for common issues
- Theme storage in `guardColorsComplete` namespace

#### Error Handling
- Centralized `errorHandler` with operation context
- User-friendly messages with "Show Logs" option
- Graceful degradation when CLI unavailable

#### File Structure Patterns
- **Utils**: Shared utilities and CLI integration
- **Tools**: Feature-specific implementations
- **Types**: TypeScript interfaces and type definitions
- **Extension**: Core extension logic and managers

## Development Guidelines

### Working with the Codebase
1. **Read CLAUDE.md**: Contains current development state and completed tasks
2. **Check Types**: All interfaces defined in `src/types/`
3. **Use Existing Patterns**: Follow established error handling and CLI patterns
4. **Test CLI Integration**: Use acceptance tests with real CLI

### Common Patterns
- **RPC Calls**: Always use `getCliWorker().sendRequest()`
- **Error Handling**: Use `errorHandler.handleError()` with context
- **Configuration**: Use `configManager().get()` for settings
- **Caching**: Check existing cache patterns before implementing new ones

### Testing
- **Unit Tests**: Limited, focus on integration tests
- **CLI Tests**: `tests/codeguard-cli-test.js` for RPC testing
- **Acceptance**: `tests/codeguard-acceptance-test.js` for end-to-end

## API Specifications

### Current RPC Commands
- `setDocument` / `applyDelta`: Document parsing
- `getThemes` / `setCurrentTheme`: Theme management
- `getGitignoreSuggestions`: Common gitignore patterns
- `getWorkspaceGitignoreSuggestions`: Workspace file analysis
- `getGitignoreTemplate`: Project-aware template generation

### Extension Points
- Command registration in `package.json`
- Context menu integration
- Language support for guard tags
- Decoration type management

## Debugging and Troubleshooting

### Common Issues
1. **CLI Connection**: Check `cliWorkerTimeout` settings
2. **Performance**: Monitor decoration update frequency
3. **Scope Resolution**: Tree-sitter vs regex parsing conflicts
4. **Theme Loading**: Namespace issues with `guardColorsComplete`

### Logging
- Extension output channel: "CodeGuard"
- Performance monitoring when enabled
- CLI stderr/stdout handling

## Future Considerations
See `futures/` directory for planned enhancements and architectural improvements.

---

**For AI Assistants**: This codebase follows strict patterns for CLI integration and error handling. Always check existing implementations before adding new features. The extension is designed to work gracefully when the CLI is unavailable.