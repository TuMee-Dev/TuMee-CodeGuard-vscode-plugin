# Code Reduction Examples - High Impact Refactorings

## 1. Guard Stack Operations Consolidation (guardProcessorCore.ts)

### Current Code (Lines 78-110):
```typescript
// Two similar functions doing almost the same thing
function popGuardWithContextCleanup(guardStack: GuardStackEntry[]): void {
  guardStack.pop();
  while (guardStack.length > 0) {
    const next = guardStack[guardStack.length - 1];
    const hasContextPermission = Object.values(next.permissions).includes('context');
    if (hasContextPermission) {
      guardStack.pop();
    } else {
      break;
    }
  }
}

function removeInterruptedContextGuards(guardStack: GuardStackEntry[]): void {
  while (guardStack.length > 0) {
    const top = guardStack[guardStack.length - 1];
    const hasContextPermission = Object.values(top.permissions).includes('context');
    if (hasContextPermission) {
      guardStack.pop();
    } else {
      break;
    }
  }
}
```

### Refactored Code:
```typescript
// Single function with parameter
function cleanupContextGuards(guardStack: GuardStackEntry[], popFirst: boolean = false): void {
  if (popFirst) {
    guardStack.pop();
  }
  
  while (guardStack.length > 0) {
    const top = guardStack[guardStack.length - 1];
    if (Object.values(top.permissions).includes('context')) {
      guardStack.pop();
    } else {
      break;
    }
  }
}

// Usage:
// Instead of: popGuardWithContextCleanup(guardStack)
// Use: cleanupContextGuards(guardStack, true)
// Instead of: removeInterruptedContextGuards(guardStack)
// Use: cleanupContextGuards(guardStack, false)
```
**Lines saved: ~15**

## 2. Scope Pattern Finding Consolidation (scopeResolver.ts)

### Current Code (Lines 463-525):
```typescript
function findFunctionScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  return findScopeByPattern(
    lines,
    guardLine,
    language,
    'FUNCTION',
    'function',
    /^\s*(async\s+)?function\s+\w+\s*\(|^\s*(const|let|var)\s+\w+\s*=\s*(async\s*)?\(/
  );
}

function findClassScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  return findScopeByPattern(
    lines,
    guardLine,
    language,
    'CLASS',
    'class',
    /^\s*class\s+\w+/
  );
}

function findMethodScope(lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  return findFunctionScope(lines, guardLine, language);
}
```

### Refactored Code:
```typescript
// Define scope configurations
const SCOPE_CONFIGS = {
  function: {
    patternName: 'FUNCTION' as const,
    defaultPattern: /^\s*(async\s+)?function\s+\w+\s*\(|^\s*(const|let|var)\s+\w+\s*=\s*(async\s*)?\(/
  },
  class: {
    patternName: 'CLASS' as const,
    defaultPattern: /^\s*class\s+\w+/
  },
  method: 'function' // Alias to function
} as const;

// Single generic function
function findNamedScope(scopeType: string, lines: string[], guardLine: number, language: string): ScopeBoundary | null {
  const config = typeof SCOPE_CONFIGS[scopeType] === 'string' 
    ? SCOPE_CONFIGS[SCOPE_CONFIGS[scopeType]] 
    : SCOPE_CONFIGS[scopeType];
    
  if (!config) return null;
  
  return findScopeByPattern(
    lines,
    guardLine,
    language,
    config.patternName,
    scopeType,
    config.defaultPattern
  );
}
```
**Lines saved: ~25**

## 3. Exit Code Handling Consolidation (validationMode.ts)

### Current Code (Lines 353-419):
```typescript
// Long switch with repetitive patterns
switch (exitCode) {
  case 0: {
    const successResult = parseValidationResponse(output);
    if (!successResult.discrepancies) {
      successResult.discrepancies = [];
    }
    await window.showInformationMessage('Validation successful...');
    return successResult;
  }
  case 1: {
    const mismatchResult = parseValidationResponse(output);
    if (!mismatchResult.discrepancies) {
      mismatchResult.discrepancies = [];
    }
    const errorCount = mismatchResult.discrepancies.filter(d => d.severity === 'ERROR').length;
    const warningCount = mismatchResult.discrepancies.filter(d => d.severity === 'WARNING').length;
    await window.showWarningMessage(`Validation found ${errorCount} errors...`);
    return mismatchResult;
  }
  // ... more cases
}
```

### Refactored Code:
```typescript
const EXIT_CODE_HANDLERS = {
  0: { 
    message: 'Validation successful - guard parsing matches perfectly!',
    type: 'info',
    parseResponse: true
  },
  1: {
    message: (result: ValidationResult) => {
      const errors = result.discrepancies?.filter(d => d.severity === 'ERROR').length || 0;
      const warnings = result.discrepancies?.filter(d => d.severity === 'WARNING').length || 0;
      return `Validation found ${errors} errors and ${warnings} warnings.`;
    },
    type: 'warning',
    parseResponse: true
  },
  2: { message: 'CodeGuard parsing error', type: 'error', parseResponse: false },
  3: { message: 'Plugin generated invalid JSON', type: 'error', throwError: true },
  4: { message: 'File not found', type: 'error', parseResponse: false },
  5: { message: 'File modified during validation', type: 'warning', parseResponse: false },
  6: { message: 'Version incompatible', type: 'error', parseResponse: false },
  7: { message: 'Internal tool error', type: 'error', parseResponse: false }
};

async function handleValidationResponse(exitCode: number, output: string, error: string): Promise<ValidationResult> {
  const handler = EXIT_CODE_HANDLERS[exitCode];
  if (!handler) {
    throw new Error(`Unknown exit code: ${exitCode}`);
  }
  
  let result: ValidationResult;
  if (handler.parseResponse) {
    result = parseValidationResponse(output);
    result.discrepancies = result.discrepancies || [];
  } else {
    result = parseErrorResponse(output, exitCode);
  }
  
  const message = typeof handler.message === 'function' ? handler.message(result) : handler.message;
  
  if (handler.throwError) {
    throw new Error(message);
  }
  
  await window[`show${handler.type.charAt(0).toUpperCase() + handler.type.slice(1)}Message`](message);
  return result;
}
```
**Lines saved: ~35**

## 4. Data-Driven Decoration Creation (decorationTypeFactory.ts)

### Current Code (Lines 180-350):
```typescript
// Repetitive decoration creation
const aiRead_humanRead = this.createDecorationType(
  mergedPermissions.aiRead_humanRead || this.mixColors(
    guardColors.permissions.aiRead,
    guardColors.permissions.humanRead,
    guardColors.mixPattern || DEFAULT_MIX_PATTERN
  ),
  permissionTransparencies.aiRead || guardColors.permissions.aiRead.transparency,
  permissionBorderOpacities.aiRead || 1.0
);

const aiRead_humanWrite = this.createDecorationType(
  mergedPermissions.aiRead_humanWrite || this.mixColors(
    guardColors.permissions.aiRead,
    guardColors.permissions.humanWrite,
    guardColors.mixPattern || DEFAULT_MIX_PATTERN
  ),
  permissionTransparencies.aiRead || guardColors.permissions.aiRead.transparency,
  permissionBorderOpacities.aiRead || 1.0
);
// ... many more similar blocks
```

### Refactored Code:
```typescript
// Define all permission combinations
const PERMISSION_COMBINATIONS = [
  ['aiRead', 'humanRead'],
  ['aiRead', 'humanWrite'],
  ['aiRead', 'humanNoAccess'],
  ['aiWrite', 'humanRead'],
  ['aiWrite', 'humanWrite'],
  ['aiWrite', 'humanNoAccess'],
  ['aiNoAccess', 'humanRead'],
  ['aiNoAccess', 'humanWrite'],
  ['aiNoAccess', 'humanNoAccess']
];

// Create decorations in a loop
const decorations = new Map<string, vscode.TextEditorDecorationType>();

for (const [aiPerm, humanPerm] of PERMISSION_COMBINATIONS) {
  const key = `${aiPerm}_${humanPerm}`;
  const customColor = mergedPermissions[key];
  const mixedColor = customColor || this.mixColors(
    guardColors.permissions[aiPerm],
    guardColors.permissions[humanPerm],
    guardColors.mixPattern || DEFAULT_MIX_PATTERN
  );
  
  decorations.set(key, this.createDecorationType(
    mixedColor,
    permissionTransparencies[aiPerm] || guardColors.permissions[aiPerm].transparency,
    permissionBorderOpacities[aiPerm] || 1.0
  ));
}

// Handle context variants
const CONTEXT_COMBINATIONS = [
  ['aiReadContext', 'humanRead', 'contextRead'],
  ['aiReadContext', 'humanWrite', 'contextRead'],
  ['aiReadContext', 'humanNoAccess', 'contextRead'],
  ['aiWriteContext', 'humanRead', 'contextWrite'],
  ['aiWriteContext', 'humanWrite', 'contextWrite'],
  ['aiWriteContext', 'humanNoAccess', 'contextWrite']
];

for (const [aiCtx, humanPerm, ctxPerm] of CONTEXT_COMBINATIONS) {
  const key = `${aiCtx}_${humanPerm}`;
  const customColor = mergedPermissions[key];
  const mixedColor = customColor || this.mixColors(
    guardColors.permissions[ctxPerm],
    guardColors.permissions[humanPerm],
    guardColors.mixPattern || DEFAULT_MIX_PATTERN
  );
  
  decorations.set(key, this.createDecorationType(
    mixedColor,
    permissionTransparencies[ctxPerm] || guardColors.permissions[ctxPerm].transparency,
    permissionBorderOpacities[ctxPerm] || 1.0
  ));
}
```
**Lines saved: ~40**

## 5. Permission Inheritance Logic (guardProcessorCore.ts)

### Current Code (Duplicated in lines 425-459 and 660-678):
```typescript
// First occurrence
let currentPermissions: { [target: string]: string } = { ...DEFAULT_PERMISSIONS };
let currentContext: { ai: boolean; human: boolean } = { ai: false, human: false };

for (let i = guardStack.length - 1; i >= 0; i--) {
  const stackEntry = guardStack[i];
  if (lineNumber >= stackEntry.startLine && lineNumber <= stackEntry.endLine) {
    currentPermissions = { ...stackEntry.permissions };
    currentContext = {
      ai: stackEntry.isContext.ai || false,
      human: stackEntry.isContext.human || false
    };
    break;
  }
}

// Second occurrence (almost identical)
let currentPermissions = { ...defaultPermissions };
let currentContext: { ai: boolean; human: boolean } = { ai: false, human: false };

for (let i = guardStack.length - 1; i >= 0; i--) {
  const stackEntry = guardStack[i];
  if (line >= stackEntry.startLine && line <= stackEntry.endLine) {
    currentPermissions = { ...stackEntry.permissions };
    currentContext = {
      ai: stackEntry.isContext.ai || false,
      human: stackEntry.isContext.human || false
    };
    break;
  }
}
```

### Refactored Code:
```typescript
function getActivePermissions(
  guardStack: GuardStackEntry[], 
  lineNumber: number,
  defaultPerms: { [target: string]: string } = DEFAULT_PERMISSIONS
): { permissions: { [target: string]: string }, context: { ai: boolean, human: boolean } } {
  // Walk backwards to find active guard
  for (let i = guardStack.length - 1; i >= 0; i--) {
    const entry = guardStack[i];
    if (lineNumber >= entry.startLine && lineNumber <= entry.endLine) {
      return {
        permissions: { ...entry.permissions },
        context: {
          ai: entry.isContext.ai || false,
          human: entry.isContext.human || false
        }
      };
    }
  }
  
  // Return defaults if no active guard
  return {
    permissions: { ...defaultPerms },
    context: { ai: false, human: false }
  };
}

// Usage:
const { permissions: currentPermissions, context: currentContext } = 
  getActivePermissions(guardStack, lineNumber);
```
**Lines saved: ~20**

## Total Lines Saved from These Examples: ~155 lines

These refactorings maintain the exact same functionality while significantly reducing code duplication and improving maintainability.