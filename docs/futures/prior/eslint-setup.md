# ESLint Configuration for TuMee VSCode Plugin

## Overview

This document describes the ESLint configuration set up for the TuMee VSCode Plugin project.

## Configuration Files

### `.eslintrc.json`

- **Parser**: `@typescript-eslint/parser` for TypeScript support
- **Extends**:
  - `eslint:recommended` - ESLint recommended rules
  - `plugin:@typescript-eslint/recommended` - TypeScript recommended rules
  - `plugin:@typescript-eslint/recommended-requiring-type-checking` - Additional type-aware rules
- **Key Rules**:
  - TypeScript strict type checking enabled
  - No floating promises (must use `void` or handle)
  - Consistent type imports required
  - No console logs (except warn/error)
  - Strict equality checks
  - Consistent code formatting (indentation, spacing, quotes)

### `.eslintignore`

Excludes:

- `node_modules/`
- `dist/` (build output)
- `out/`
- JavaScript files
- Test files
- Backup directories

### `.vscode/settings.json`

- Auto-format on save enabled
- ESLint auto-fix on save
- TypeScript SDK configured

## Available Scripts

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix

# Run TypeScript type checking
npm run typecheck

# Run all checks before commit
npm run precommit
```

## Common Issues and Fixes

### Duplicate Imports

Combine type and regular imports:

```typescript
// Bad
import type { TextDocument } from 'vscode';
import { window } from 'vscode';

// Good
import type { TextDocument } from 'vscode';
import { window } from 'vscode';
```

### Floating Promises

Add `void` operator:

```typescript
// Bad
window.showInformationMessage('Hello');

// Good
void window.showInformationMessage('Hello');
```

### Unused Parameters

Prefix with underscore:

```typescript
// Bad
function handler(context: ExtensionContext) {
  // context not used
}

// Good
function handler(_context: ExtensionContext) {
  // _context indicates intentionally unused
}
```

## Remaining Work

There are still some ESLint errors in the codebase that need manual fixes:

- Duplicate vscode imports in several files
- Some `any` types that should be properly typed
- Unsafe operations that need type guards

Run `npm run lint` to see current issues.
