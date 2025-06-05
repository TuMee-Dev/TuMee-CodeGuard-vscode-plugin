# API Documentation

This folder contains current API specifications and system requirements for the TuMee CodeGuard extension.

## Current Specifications

### `specification.md`
**Core system specification** defining:
- Guard tag syntax and semantics
- Permission model (AI/Human read/write/none)
- File and folder customization capabilities
- Extension architecture requirements

### `mission.md`
**Project mission and goals** outlining:
- System purpose and vision
- Target use cases and workflows
- Design principles and constraints
- Success criteria and metrics

## API Versioning

The current API specifications correspond to:
- **Extension Version**: 1.6.2
- **CLI Version Requirement**: 0.4.0+
- **Protocol Version**: JSON-RPC over stdin/stdout

## Implementation Status

### ✅ Completed APIs
- Guard tag processing and rendering
- File/folder customization
- Theme management
- Basic gitignore functionality

### 🔄 In Progress
- Workspace gitignore analysis (CLI implementation needed)
- Advanced pattern matching
- Project-aware template generation

### 📋 Planned
See `../futures/` for upcoming API enhancements

## Integration Requirements

### CLI Dependencies
The extension requires a CodeGuard CLI that implements:
1. **Document Processing**: `setDocument`, `applyDelta`
2. **Theme Management**: `getThemes`, `setCurrentTheme`
3. **Gitignore Intelligence**: `getGitignoreSuggestions`, `getWorkspaceGitignoreSuggestions`

### VS Code Requirements
- **Minimum Version**: 1.100.0
- **Node Version**: 16.x+
- **TypeScript**: 5.4.5+

## Development Standards

### API Design Principles
1. **Server-Side Intelligence**: Minimal client-side logic
2. **Graceful Degradation**: Works without CLI
3. **Performance First**: Caching and optimization
4. **Type Safety**: Full TypeScript interfaces

### Documentation Standards
- **Request/Response Examples**: JSON format
- **Error Handling**: Comprehensive error scenarios
- **Performance Notes**: Caching and optimization details
- **Integration Examples**: Real-world usage patterns

## Support and Maintenance

### Version Compatibility
- **Breaking Changes**: Major version bumps
- **Feature Additions**: Minor version bumps
- **Bug Fixes**: Patch version bumps

### Deprecation Policy
- **Notice Period**: 2 major versions
- **Migration Guide**: Provided for breaking changes
- **Backward Compatibility**: Maintained when possible

For implementation details, see the `../completed/` folder for fully implemented features.