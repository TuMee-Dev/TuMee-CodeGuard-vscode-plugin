# Refactoring Recommendations - TuMee VSCode Plugin

## Executive Summary

This document outlines the major refactoring opportunities identified in the TuMee VSCode Plugin codebase. The analysis focused on the largest source files, duplicate code patterns, and repetitive blocks that could be optimized.

## Key Files Requiring Refactoring

### 1. **webviewContent.ts** (56,942 bytes)
**Issues:**
- Massive single file containing both CSS and JavaScript as template strings
- Inline JavaScript with extensive DOM manipulation code
- Hardcoded HTML generation with repetitive patterns

**Recommendations:**
- Split CSS into a separate `.css` file
- Extract JavaScript into a separate module
- Use a templating engine or component-based approach for HTML generation
- Consider using a framework like Svelte/React for the webview

### 2. **colorCustomizer.ts** (42,780 bytes)
**Issues:**
- Extensive theme configuration data mixed with logic
- Duplicate configuration access patterns
- Multiple similar theme update/save operations
- Repetitive message handling patterns

**Recommendations:**
- Extract theme configurations into a separate data file
- Create a `ThemeManager` class to handle all theme operations
- Consolidate configuration access through `configurationManager.ts`
- Extract webview message handling into a separate handler class

### 3. **guardProcessorCore.ts** (33,001 bytes)
**Issues:**
- Complex nested logic with deep indentation
- Repetitive permission checking patterns
- Duplicate scope resolution logic
- Long function bodies (parseGuardTagsCore is over 500 lines)

**Recommendations:**
- Extract permission handling into a `PermissionManager` class
- Create separate functions for each scope type resolution
- Use strategy pattern for different guard processing strategies
- Split the main parsing function into smaller, focused functions

## Major Duplicate Code Patterns

### 1. **Output Channel Management**
Multiple files create their own output channels independently:
```typescript
// Current: Scattered across multiple files
// errorHandler.ts
const outputChannel = vscode.window.createOutputChannel('CodeGuard');
// performanceMonitor.ts
const outputChannel = vscode.window.createOutputChannel('TuMee Performance');
// validationMode.ts
const outputChannel = vscode.window.createOutputChannel('TuMee Debug');
```

**Solution:** Create a centralized `OutputChannelManager`:
```typescript
class OutputChannelManager {
  private static channels = new Map<string, vscode.OutputChannel>();
  
  static getChannel(name: string): vscode.OutputChannel {
    if (!this.channels.has(name)) {
      this.channels.set(name, vscode.window.createOutputChannel(name));
    }
    return this.channels.get(name)!;
  }
}
```

### 2. **Configuration Access Patterns**
Repeated pattern throughout the codebase:
```typescript
const config = vscode.workspace.getConfiguration('tumee-vscode-plugin');
const value = config.get<Type>('key', defaultValue);
await config.update('key', value, vscode.ConfigurationTarget.Global);
```

**Solution:** Leverage the existing `configurationManager.ts` more extensively:
```typescript
// Extend configurationManager.ts with batch operations
class ConfigurationManager {
  async batchUpdate(updates: Record<string, any>): Promise<void> {
    const config = vscode.workspace.getConfiguration('tumee-vscode-plugin');
    for (const [key, value] of Object.entries(updates)) {
      await config.update(key, value, vscode.ConfigurationTarget.Global);
    }
  }
}
```

### 3. **Promise-based Timeout Patterns**
Multiple implementations of promise with timeout:
```typescript
// Current: Duplicated in multiple files
return new Promise((resolve) => {
  const disposable = webview.onDidReceiveMessage(handler);
  setTimeout(() => {
    disposable.dispose();
    resolve(undefined);
  }, 1000);
});
```

**Solution:** Create a utility function:
```typescript
export function promiseWithTimeout<T>(
  setup: (resolve: (value: T) => void) => vscode.Disposable,
  timeout: number,
  defaultValue: T
): Promise<T> {
  return new Promise((resolve) => {
    const disposable = setup(resolve);
    setTimeout(() => {
      disposable.dispose();
      resolve(defaultValue);
    }, timeout);
  });
}
```

## Repetitive Blocks That Could Be Loop-Generated

### 1. **Theme Configuration in colorCustomizer.ts**
The THEME_CONFIGS array contains 10 themes with nearly identical structure:
```typescript
// Current: 150+ lines of repetitive theme definitions
const THEME_CONFIGS: ThemeDefinition[] = [
  {
    name: 'light',
    permissions: {
      aiWrite: { enabled: true, color: '#FFA500', transparency: 0.2 },
      aiRead: { enabled: true, color: '#808080', transparency: 0.15 },
      // ... 6 more permission types
    }
  },
  // ... 9 more themes with same structure
];
```

**Solution:** Use a theme builder pattern:
```typescript
class ThemeBuilder {
  static buildTheme(name: string, colorScheme: ColorScheme): ThemeDefinition {
    const permissions = {};
    for (const [permType, config] of Object.entries(colorScheme)) {
      permissions[permType] = {
        enabled: config.enabled ?? true,
        color: config.color,
        transparency: config.transparency ?? 0.2
      };
    }
    return { name, permissions, borderBarEnabled: true };
  }
}

const THEME_SCHEMES = {
  light: { aiWrite: { color: '#FFA500' }, /* ... */ },
  dark: { aiWrite: { color: '#FF8C00', transparency: 0.4 }, /* ... */ }
};

const THEME_CONFIGS = Object.entries(THEME_SCHEMES)
  .map(([name, scheme]) => ThemeBuilder.buildTheme(name, scheme));
```

### 2. **Permission Section Generation in colorCustomizer.ts**
The `_generatePermissionSection` method is called 8 times with similar parameters:
```typescript
// Current: Manual generation for each permission type
const permissionSections = ColorCustomizerPanel.PERMISSION_SECTIONS
  .map(s => this._generatePermissionSection(s)).join('');
```

**Solution:** Already optimized, but the PERMISSION_SECTIONS array could be generated:
```typescript
const PERMISSION_TYPES = ['Write', 'Read', 'NoAccess'];
const PERMISSION_TARGETS = ['ai', 'human'];
const PERMISSION_SECTIONS = [
  ...PERMISSION_TARGETS.flatMap(target => 
    PERMISSION_TYPES.map(type => ({
      id: `${target}${type}`,
      title: `${target.toUpperCase()} ${type.replace(/([A-Z])/g, ' $1')}`,
      category: `${target.toUpperCase()} Permissions`,
      defaultColor: getDefaultColor(target, type),
      defaultEnabled: getDefaultEnabled(target, type)
    }))
  ),
  { id: 'contextRead', title: 'Context Read', category: 'Context', defaultColor: '#00CED1', defaultEnabled: true },
  { id: 'contextWrite', title: 'Context Write', category: 'Context', defaultColor: '#1E90FF', defaultEnabled: true }
];
```

### 3. **Scope Mappings in scopeResolver.ts**
The SCOPE_MAPPINGS object has repetitive patterns across languages:
```typescript
// Current: 150+ lines of similar scope mappings
const SCOPE_MAPPINGS = {
  'javascript': { func: [...], class: [...], block: [...] },
  'typescript': { func: [...], class: [...], block: [...] },
  // ... 12 more languages
};
```

**Solution:** Use inheritance and composition:
```typescript
const BASE_SCOPES = {
  block: ['if_statement', 'for_statement', 'while_statement', 'try_statement', 'switch_statement']
};

const LANGUAGE_SCOPES = {
  javascript: {
    ...BASE_SCOPES,
    func: ['function_declaration', 'function_expression', 'arrow_function'],
    class: ['class_declaration', 'class_expression'],
    block: [...BASE_SCOPES.block, 'statement_block', 'object']
  },
  typescript: {
    ...LANGUAGE_SCOPES.javascript,
    func: [...LANGUAGE_SCOPES.javascript.func, 'method_signature'],
    class: [...LANGUAGE_SCOPES.javascript.class, 'interface_declaration']
  }
};
```

## Performance Optimization Opportunities

### 1. **Decoration Type Creation**
Currently creates all possible decoration type combinations upfront. Consider lazy initialization:
```typescript
class LazyDecorationTypeFactory {
  private cache = new Map<string, TextEditorDecorationType>();
  
  getDecorationType(key: string): TextEditorDecorationType {
    if (!this.cache.has(key)) {
      this.cache.set(key, this.createDecorationType(key));
    }
    return this.cache.get(key)!;
  }
}
```

### 2. **Guard Tag Parsing**
The parseGuardTagsCore function processes the entire document every time. Consider incremental parsing:
```typescript
class IncrementalGuardParser {
  private cache = new Map<number, GuardTag>();
  
  parseChangedLines(document: TextDocument, changedLines: Set<number>): GuardTag[] {
    // Only reparse affected lines and their scope boundaries
  }
}
```

## Architecture Improvements

### 1. **Separate Concerns**
- Extract data (themes, configurations) from logic
- Create dedicated manager classes for different domains
- Use dependency injection for better testability

### 2. **Event-Driven Architecture**
- Create an event bus for cross-component communication
- Reduce tight coupling between modules
- Make the system more extensible

### 3. **Plugin System for Languages**
Instead of hardcoding language support, create a plugin architecture:
```typescript
interface LanguagePlugin {
  languageId: string;
  scopeMappings: Record<string, string[]>;
  parseGuardTag(line: string): GuardTag | null;
  getCommentPattern(): RegExp;
}

class LanguagePluginManager {
  private plugins = new Map<string, LanguagePlugin>();
  
  register(plugin: LanguagePlugin): void {
    this.plugins.set(plugin.languageId, plugin);
  }
}
```

## Priority Refactoring Tasks

1. **High Priority**
   - Split webviewContent.ts into multiple files
   - Create OutputChannelManager
   - Extract theme configurations from colorCustomizer.ts
   - Reduce parseGuardTagsCore function complexity

2. **Medium Priority**
   - Consolidate configuration access patterns
   - Create promise utility functions
   - Implement lazy decoration type creation
   - Extract permission handling logic

3. **Low Priority**
   - Generate repetitive data structures programmatically
   - Create language plugin system
   - Implement incremental parsing

## Estimated Impact

- **Code Reduction**: ~30% reduction in total lines of code
- **Maintainability**: Significantly improved with better separation of concerns
- **Performance**: 10-20% improvement in parse time with incremental parsing
- **Testability**: Much easier to unit test individual components

## Next Steps

1. Start with high-priority items that provide immediate value
2. Create unit tests before refactoring to ensure functionality is preserved
3. Refactor incrementally, one module at a time
4. Update documentation as code structure changes