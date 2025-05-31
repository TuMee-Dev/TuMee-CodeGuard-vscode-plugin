# Extension.ts Refactoring Plan - Clean Cutover Approach

## Overview
This document outlines a step-by-step refactoring plan for `src/extension.ts` using a clean cutover approach. Each step completely replaces the old implementation with the new one - no parallel execution or feature flags.

## Refactoring Principles
1. **One Component at a Time** - Extract and cutover one logical unit per step
2. **Maintain Working State** - Extension must be fully functional after each step
3. **Test Before Cutover** - Comprehensive testing before replacing old code
4. **No Dual Modes** - Clean replacement, no feature flags or parallel execution

## Step-by-Step Migration Plan

### Step 1: Extract Status Bar Management
**Scope**: Lines 581-691 (Status bar creation and updates)

**Actions**:
1. Create `src/services/StatusBarManager.ts`
2. Move all status bar logic to new class
3. Update `extension.ts` to use StatusBarManager
4. Test thoroughly
5. Remove old status bar code

**File Changes**:
```typescript
// src/services/StatusBarManager.ts
export class StatusBarManager {
  private statusBarItem: StatusBarItem;
  private disposables: Disposable[] = [];

  constructor() {}

  create(context: ExtensionContext): void {
    // Move createStatusBarItem logic here
  }

  async update(document: TextDocument, editor: TextEditor): Promise<void> {
    // Move updateStatusBarItem logic here
  }

  dispose(): void {
    // Cleanup logic
  }
}

// extension.ts changes
- Remove createStatusBarItem and updateStatusBarItem functions
- Add: const statusBarManager = new StatusBarManager();
- Replace calls with: statusBarManager.create(context);
- Replace calls with: await statusBarManager.update(document, editor);
```

**Testing Checklist**:
- [ ] Status bar appears on activation
- [ ] Shows correct AI permission at cursor
- [ ] Updates when cursor moves
- [ ] Toggle command works
- [ ] Disposal works correctly

### Step 2: Extract Decoration Cache
**Scope**: Cache management (lines 38, 161-182, 556-557)

**Actions**:
1. Create `src/decorations/DecorationCache.ts`
2. Move cache logic and flash prevention
3. Update all cache references
4. Test decoration persistence
5. Remove old cache code

**File Changes**:
```typescript
// src/decorations/DecorationCache.ts
export class DecorationCache {
  private cache = new WeakMap<TextDocument, DecorationRanges>();
  private versionCache = new WeakMap<TextDocument, number>();

  set(document: TextDocument, ranges: DecorationRanges): void {}
  get(document: TextDocument): DecorationRanges | undefined {}
  delete(document: TextDocument): void {}
  
  isVersionCurrent(document: TextDocument): boolean {}
  updateVersion(document: TextDocument): void {}
}

// extension.ts changes
- Remove: decorationCache, processedDocumentVersions WeakMaps
- Add: const decorationCache = new DecorationCache();
- Update all cache operations to use new instance
```

**Testing Checklist**:
- [ ] Decorations persist when switching tabs
- [ ] No flashing when switching between files
- [ ] Cache clears when document closes
- [ ] Version tracking prevents redundant updates

### Step 3: Extract Command Registry
**Scope**: Command registration (lines 56-100)

**Actions**:
1. Create `src/services/CommandRegistry.ts`
2. Move all command registration logic
3. Keep command handlers in place (for now)
4. Update activation to use CommandRegistry
5. Remove old registration code

**File Changes**:
```typescript
// src/services/CommandRegistry.ts
export class CommandRegistry {
  private disposables: Disposable[] = [];

  registerAll(
    context: ExtensionContext, 
    callbacks: CommandCallbacks
  ): Disposable[] {
    // Move all command registration here
    // Pass callbacks for actual implementations
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}

// extension.ts changes
- Remove registerCommands function
- Add: const commandRegistry = new CommandRegistry();
- In activate: commandRegistry.registerAll(context, {
    refreshDecorations: () => { /* existing logic */ },
    showPerformanceReport: () => { /* existing logic */ }
  });
```

**Testing Checklist**:
- [ ] All commands appear in command palette
- [ ] Each command executes correctly
- [ ] Context menu commands work
- [ ] Guard tag commands work
- [ ] Validation commands work

### Step 4: Extract Decoration Type Management
**Scope**: Decoration type creation and disposal (lines 281-294, 384-412)

**Actions**:
1. Create `src/decorations/DecorationTypeManager.ts`
2. Move decoration type map and creation logic
3. Move getDecorationType helper
4. Update all decoration type references
5. Remove old decoration code

**File Changes**:
```typescript
// src/decorations/DecorationTypeManager.ts
export class DecorationTypeManager {
  private decorationTypes = new Map<string, TextEditorDecorationType>();
  private factory: DecorationTypeFactory;

  constructor() {
    this.factory = new DecorationTypeFactory();
  }

  initialize(): void {
    // Move initializeCodeDecorations logic
  }

  getDecorationType(
    aiPerm: string, 
    humanPerm: string, 
    aiContext: boolean, 
    humanContext: boolean
  ): string | null {
    // Move getDecorationType logic
  }

  getAll(): Map<string, TextEditorDecorationType> {}
  dispose(): void {}
}

// extension.ts changes
- Remove: decorationTypes map, initializeCodeDecorations, getDecorationType
- Add: const decorationTypeManager = new DecorationTypeManager();
- Update all references
```

**Testing Checklist**:
- [ ] All decoration types created correctly
- [ ] Colors match configuration
- [ ] Decoration types dispose properly
- [ ] Color configuration changes work

### Step 5: Extract Event Handlers
**Scope**: Event handling setup (lines 105-154, 159-218)

**Actions**:
1. Create `src/services/EventCoordinator.ts`
2. Move all event handler setup
3. Move handler implementations
4. Update activation to use EventCoordinator
5. Remove old event code

**File Changes**:
```typescript
// src/services/EventCoordinator.ts
export class EventCoordinator {
  private disposables: Disposable[] = [];
  private updateTimer?: NodeJS.Timeout;

  constructor(
    private decorationUpdater: DecorationUpdater,
    private statusBarManager: StatusBarManager,
    private cache: DecorationCache
  ) {}

  setupEventHandlers(context: ExtensionContext): void {
    // Move all event handler setup
    // Move handler implementations
  }

  dispose(): void {
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.disposables.forEach(d => d.dispose());
  }
}

// extension.ts changes
- Remove: setupEventHandlers and all handler functions
- Remove: decorationUpdateTimer
- Add: const eventCoordinator = new EventCoordinator(...);
- In activate: eventCoordinator.setupEventHandlers(context);
```

**Testing Checklist**:
- [ ] Document changes trigger updates
- [ ] Editor changes update decorations
- [ ] Configuration changes apply
- [ ] Document close clears cache
- [ ] Scroll events work

### Step 6: Extract Decoration Updates
**Scope**: Core decoration logic (lines 295-575)

**Actions**:
1. Create `src/decorations/DecorationUpdater.ts`
2. Move update logic and implementation
3. Move clear decorations
4. Update all decoration calls
5. Remove old update code

**File Changes**:
```typescript
// src/decorations/DecorationUpdater.ts
export class DecorationUpdater {
  constructor(
    private typeManager: DecorationTypeManager,
    private cache: DecorationCache,
    private performanceMonitor: IPerformanceMonitor
  ) {}

  async updateDecorations(document: TextDocument): Promise<void> {
    // Move updateCodeDecorations + updateCodeDecorationsImpl
  }

  triggerUpdate(document: TextDocument): void {
    // Move triggerUpdateDecorations with debounce logic
  }

  clearDecorations(editor?: TextEditor): void {
    // Move clearDecorations
  }
}

// extension.ts changes
- Remove: all decoration update functions
- Add: const decorationUpdater = new DecorationUpdater(...);
- Update all calls to use new instance
```

**Testing Checklist**:
- [ ] Decorations apply correctly
- [ ] Large files show warning
- [ ] Debouncing works
- [ ] Background processing for large files
- [ ] Performance monitoring tracks updates

### Step 7: Create Extension Lifecycle Manager
**Scope**: Initialization and lifecycle (lines 43-51, 221-242, 244-279, 693-711)

**Actions**:
1. Create `src/services/ExtensionLifecycleManager.ts`
2. Move initialization logic
3. Move activation/deactivation orchestration
4. Create service locator pattern
5. Update extension.ts to delegate

**File Changes**:
```typescript
// src/services/ExtensionLifecycleManager.ts
export class ExtensionLifecycleManager {
  private services: ExtensionServices;

  async activate(context: ExtensionContext): Promise<void> {
    // Initialize all services in correct order
    // Wire up dependencies
    // Handle first-time setup
    // Validate configuration
  }

  deactivate(): void {
    // Dispose all services in reverse order
    // Clear caches
    // Clean up resources
  }
}

// extension.ts - Final state (~50 lines)
import { ExtensionLifecycleManager } from './services/ExtensionLifecycleManager';

const lifecycleManager = new ExtensionLifecycleManager();

export async function activate(context: ExtensionContext) {
  await lifecycleManager.activate(context);
}

export function deactivate() {
  lifecycleManager.deactivate();
}
```

**Testing Checklist**:
- [ ] Extension activates without errors
- [ ] All services initialize correctly
- [ ] First-time setup works
- [ ] Configuration validation runs
- [ ] Deactivation cleans up properly

## Testing Strategy for Each Step

### Before Cutover
1. Create new component with full implementation
2. Write comprehensive unit tests
3. Test component in isolation
4. Create integration test harness

### During Cutover
1. Make minimal changes to extension.ts
2. Run all existing tests
3. Manual testing with checklist
4. Monitor for console errors

### After Cutover
1. Run full regression suite
2. Test all user workflows
3. Check performance metrics
4. Verify no memory leaks

## Rollback Strategy

Each step is a single commit that can be reverted:
```bash
# If Step N fails:
git revert HEAD
npm run compile
# Test that rollback works
```

## Implementation Timeline

### Day 1: Preparation
- Set up test infrastructure
- Create directory structure
- Define shared interfaces

### Day 2: Steps 1-2
- Extract StatusBarManager (2 hours)
- Test and cutover (1 hour)
- Extract DecorationCache (2 hours)
- Test and cutover (1 hour)

### Day 3: Steps 3-4
- Extract CommandRegistry (3 hours)
- Test and cutover (1 hour)
- Extract DecorationTypeManager (2 hours)
- Test and cutover (1 hour)

### Day 4: Step 5
- Extract EventCoordinator (4 hours)
- Comprehensive testing (2 hours)
- Cutover (1 hour)

### Day 5: Step 6
- Extract DecorationUpdater (4 hours)
- Integration testing (2 hours)
- Cutover (1 hour)

### Day 6: Step 7
- Create ExtensionLifecycleManager (3 hours)
- Wire up all services (2 hours)
- Final testing (2 hours)

### Day 7: Validation
- Full regression testing
- Performance validation
- Documentation updates
- Code review

## Success Metrics

1. **Zero Functionality Loss**
   - All features work identically
   - No user-visible changes

2. **Clean Architecture**
   - extension.ts < 50 lines
   - Each service < 200 lines
   - Clear separation of concerns

3. **Maintainability**
   - Each component independently testable
   - Clear interfaces between services
   - Documented service responsibilities

4. **Performance**
   - No degradation in update times
   - Same or better memory usage
   - Startup time unchanged

This approach ensures a clean, step-by-step migration where each phase completely replaces the old implementation, maintaining a working extension throughout the refactoring process.