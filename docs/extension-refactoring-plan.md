# Extension.ts Refactoring Plan

## Overview
This document outlines a comprehensive plan to refactor `src/extension.ts` from a 710-line monolithic file into a well-structured, modular architecture without losing any functionality or introducing bugs.

## Current State Analysis

### Current Responsibilities (710 lines)
1. **Extension Lifecycle** (activate/deactivate)
2. **Command Registration** (9 commands)
3. **Event Handling** (5 event handlers)
4. **Decoration Management** (creation, updates, caching)
5. **Configuration Management** (validation, change handling)
6. **Status Bar Management** (creation, updates)
7. **Performance Optimization** (caching, debouncing)
8. **Error Handling** (throughout)

### Key Dependencies
- VSCode API
- Guard Processing (`parseGuardTags`, `getLinePermissions`)
- Configuration Manager
- Error Handler
- Performance Monitor
- Background Processor
- Debug Logger

### Existing Test Coverage
- `integration.test.js` - Basic guard tag parsing
- `guard-tags.test.js` - Guard tag regex patterns
- `line-permissions.test.js` - Permission calculation
- No direct tests for extension.ts functionality

## Proposed Architecture

### New Module Structure
```
src/
├── extension.ts (thin entry point ~50 lines)
├── services/
│   ├── ExtensionLifecycleManager.ts
│   ├── DecorationManager.ts
│   ├── EventCoordinator.ts
│   ├── CommandRegistry.ts
│   └── StatusBarManager.ts
├── decorations/
│   ├── DecorationCache.ts
│   ├── DecorationRenderer.ts
│   └── DecorationCalculator.ts
└── types/
    └── extensionTypes.ts
```

### Class Responsibilities

#### 1. ExtensionLifecycleManager
**Responsibilities:**
- Initialize extension components
- Coordinate startup sequence
- Manage disposables
- Handle activation/deactivation

**Methods:**
```typescript
class ExtensionLifecycleManager {
  activate(context: ExtensionContext): Promise<void>
  deactivate(): void
  private initializeComponents(): void
  private validateConfiguration(): void
}
```

#### 2. DecorationManager
**Responsibilities:**
- Create decoration types
- Apply decorations to editors
- Manage decoration cache
- Handle decoration updates

**Methods:**
```typescript
class DecorationManager {
  initializeDecorations(): void
  updateDecorations(document: TextDocument): Promise<void>
  clearDecorations(editor?: TextEditor): void
  handleColorConfigurationChange(): void
  private createDecorationTypes(): Map<string, TextEditorDecorationType>
  private applyDecorations(editor: TextEditor, ranges: DecorationRanges): void
}
```

#### 3. EventCoordinator
**Responsibilities:**
- Register all event handlers
- Coordinate event responses
- Manage debouncing logic
- Handle document/editor changes

**Methods:**
```typescript
class EventCoordinator {
  registerEventHandlers(context: ExtensionContext): void
  handleDocumentChange(event: TextDocumentChangeEvent): void
  handleActiveEditorChange(editor: TextEditor): void
  handleConfigurationChange(event: ConfigurationChangeEvent): void
  private setupDebouncing(): void
}
```

#### 4. CommandRegistry
**Responsibilities:**
- Register all commands
- Handle command execution
- Coordinate with other services

**Methods:**
```typescript
class CommandRegistry {
  registerCommands(context: ExtensionContext): void
  private registerDecorationCommands(): void
  private registerGuardTagCommands(): void
  private registerToggleCommand(): void
}
```

#### 5. StatusBarManager
**Responsibilities:**
- Create status bar item
- Update status based on cursor position
- Handle status bar interactions

**Methods:**
```typescript
class StatusBarManager {
  createStatusBar(context: ExtensionContext): void
  updateStatusBar(document: TextDocument, cursorLine: number): Promise<void>
  dispose(): void
}
```

## Migration Strategy

### Phase 1: Create Infrastructure (No Breaking Changes)
1. Create new directory structure
2. Define interfaces and types
3. Create empty class shells
4. Add comprehensive logging

### Phase 2: Extract Non-Breaking Components
1. **Extract DecorationCache** (standalone, no dependencies)
2. **Extract StatusBarManager** (minimal dependencies)
3. **Create CommandRegistry** (wrapper around existing commands)

### Phase 3: Core Extraction with Parallel Testing
1. **Extract DecorationManager**
   - Move decoration creation logic
   - Keep original functions as thin wrappers
   - Add feature flags for gradual rollout
2. **Extract EventCoordinator**
   - Move event handler setup
   - Maintain backward compatibility

### Phase 4: Final Integration
1. **Create ExtensionLifecycleManager**
   - Orchestrate all services
   - Replace activation logic
2. **Update extension.ts**
   - Reduce to thin entry point
   - Delegate to lifecycle manager

## Testing Strategy

### 1. Unit Tests for Each Service
```typescript
// Example: DecorationManager.test.ts
describe('DecorationManager', () => {
  it('should create all decoration types', () => {})
  it('should apply decorations correctly', () => {})
  it('should handle cache updates', () => {})
  it('should clear decorations', () => {})
})
```

### 2. Integration Tests
- Test service interactions
- Verify event flow
- Ensure command execution

### 3. Regression Tests
- Compare decoration output before/after
- Verify all commands still work
- Check performance metrics

### 4. Manual Testing Checklist
- [ ] Extension activates without errors
- [ ] All commands appear in command palette
- [ ] Decorations update on document changes
- [ ] Status bar updates correctly
- [ ] Configuration changes apply immediately
- [ ] No performance degradation
- [ ] No memory leaks

## Implementation Steps

### Step 1: Setup (Day 1)
1. Create directory structure
2. Define all interfaces in `extensionTypes.ts`
3. Create class shells with logging
4. Setup test infrastructure

### Step 2: Extract Cache & Status Bar (Day 2)
1. Extract `DecorationCache` class
2. Extract `StatusBarManager` class
3. Write unit tests
4. Verify no regression

### Step 3: Extract Decoration Logic (Day 3-4)
1. Create `DecorationManager` class
2. Move decoration type creation
3. Move decoration application logic
4. Add feature flag for testing
5. Run parallel with existing code

### Step 4: Extract Events & Commands (Day 5)
1. Create `EventCoordinator` class
2. Create `CommandRegistry` class
3. Maintain backward compatibility
4. Comprehensive testing

### Step 5: Final Integration (Day 6)
1. Create `ExtensionLifecycleManager`
2. Update `extension.ts` to delegate
3. Remove old code
4. Final testing

### Step 6: Documentation & Cleanup (Day 7)
1. Update documentation
2. Remove feature flags
3. Performance validation
4. Code review

## Risk Mitigation

### 1. Feature Flags
```typescript
const USE_NEW_DECORATION_MANAGER = workspace.getConfiguration()
  .get('tumee-vscode-plugin.experimental.newDecorationManager', false);
```

### 2. Parallel Execution
- Run new code alongside old code
- Compare outputs for discrepancies
- Log differences for investigation

### 3. Rollback Plan
- Git branches for each phase
- Feature flags for instant rollback
- Keep old code until fully validated

### 4. Performance Monitoring
- Measure before/after metrics
- Monitor memory usage
- Track decoration update times

## Success Criteria

1. **No Functionality Loss**
   - All features work identically
   - No user-visible changes
   - All commands functional

2. **No Performance Degradation**
   - Decoration updates ≤ current timing
   - Memory usage ≤ current usage
   - No additional CPU overhead

3. **Improved Maintainability**
   - Each class < 200 lines
   - Single responsibility principle
   - Clear interfaces between modules

4. **Better Testability**
   - 80%+ unit test coverage
   - Mockable dependencies
   - Isolated components

## Post-Refactoring Benefits

1. **Easier Feature Addition**
   - New decorations in DecorationManager
   - New commands in CommandRegistry
   - New events in EventCoordinator

2. **Better Debugging**
   - Isolated modules
   - Clear error boundaries
   - Component-specific logging

3. **Team Scalability**
   - Multiple developers can work on different services
   - Clear ownership boundaries
   - Reduced merge conflicts

## Timeline
- **Total Duration**: 7 working days
- **Testing Buffer**: 2 additional days
- **Rollback Decision Point**: Day 5

This plan ensures a safe, incremental refactoring that maintains all functionality while significantly improving code structure and maintainability.