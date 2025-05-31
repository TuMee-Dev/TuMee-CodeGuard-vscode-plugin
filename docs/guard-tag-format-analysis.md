# Guard Tag Format Analysis

## Executive Summary

This document provides a comprehensive analysis of all guard tag formats found in the TuMee VSCode Plugin specifications and implementation. It identifies discrepancies between the specifications and current implementation, and provides recommendations for reconciliation.

## Guard Tag Formats Found in Specifications

### 1. Basic Permission Formats (specification.md)

#### Core Format Structure
```
@guard:target[identifier]:permission[.scope][+scope][-scope]
```

#### Case Insensitivity
The specification emphasizes that **ALL components are case-insensitive**:
- `@guard` = `@GUARD` = `@Guard`
- `ai` = `AI` = `Ai`
- `human` = `HUMAN` = `Human`
- `[claude-4]` = `[Claude-4]` = `[CLAUDE-4]`
- `r` = `R` = `read` = `READ` = `Read`
- `.func` = `.FUNC` = `.Function` = `.function`

#### Target Options
- `ai` - AI systems
- `human` - Human developers
- `hu` - Shortened form of "human" (mentioned in implementation)
- `all` - All entities (from specification_extend_1.md)

#### Permission Options
- `r` / `read` / `readonly` / `READ-ONLY` - Read-only access
- `w` / `write` / `WRITE` - Write access
- `n` / `noaccess` / `none` / `NONE` - No access
- `context` / `CONTEXT` - Context information (implies read)

### 2. Scope Modifiers (specification.md)

#### Semantic Scopes
- `signature` / `sig` - Function/method/class signatures only
- `body` - Implementation body only
- `function` / `func` - Entire function
- `block` - Current code block (DEFAULT in specification_extend_1.md)
- `statement` / `stmt` - Single logical statement
- `class` - Entire class definition
- `method` - Entire method
- `docstring` / `doc` - Documentation strings
- `import` / `imports` - Import statements
- `decorator` / `dec` - Decorators/annotations
- `value` / `val` - Variable values only
- `expression` / `expr` - Single expression
- `file` - Entire file from declaration point

#### Numeric Scopes
- `.5` - Next 5 lines
- `.10` - Next 10 lines
- Any numeric value for line count

#### Compound Scopes
- `sig+doc` - Signature plus docstring
- `func-doc` - Function except docstring
- `class-methods` - Class without methods

### 3. Identifier Formats (specification.md)

#### Single Identifiers
- `@guard:ai[claude-4]:r` - Specific AI model
- `@guard:human[security-team]:w` - Specific team
- `@guard:ai[senior-dev]:r` - Specific role

#### Multiple Identifiers
- `@guard:ai[claude-4,gpt-4]:r` - Multiple specific models
- `@guard:human[qa-team,dev-team]:w` - Multiple teams

#### Wildcards and Special
- `@guard:ai:r` - All AI (equivalent to `@guard:ai[*]:r`)
- `@guard:ai[*]:n` - Explicitly all AIs
- `@guard:ai[!gpt-3]:r` - All EXCEPT specified (negation)
- `@guard:ai[group:*]:w` - All members of a group
- `@guard:ai[claude-*]:r` - Wildcard pattern matching (e.g., claude-3, claude-4, claude-opus)
- `@guard:ai[gpt-*]:w` - All GPT models
- `@guard:human[team-*]:r` - All teams (team-alpha, team-beta, etc.)
- `@guard:human[*-dev]:w` - Pattern suffix matching (senior-dev, junior-dev, etc.)

### 4. Context Permissions (specification.md)

#### Basic Context
- `@guard:ai:context` - AI should read for context
- `@guard:human:context` - Human context information

#### Context with Metadata
- `@guard:ai:context[priority=high]` - High priority context
- `@guard:ai:context[for=testing]` - Context for specific use
- `@guard:ai:context[inherit=true]` - Inheritable context

### 5. Directory-Level Guards (.ai-attributes)

#### Pattern-Based Guards
```
**/*.py @guard:ai:r
build/** @guard:human:n
tests/**/*.py @guard:ai[testing-agents]:w,human[qa-team]:w
```

#### Conditional and Advanced
```
financial/** @guard:ai[finance-certified]:r[approval=finance-team]
@developer tests/** @guard:ai[dev-assistants]:w
```

### 6. Multi-Target Guards (specification_extend_1.md)

- `@guard:ai:r,human:w` - Different permissions for AI and human
- `@guard:ai[claude-4]:w,human[security-team]:w` - Multiple specific targets

### 7. Default Scope Behavior (specification_extend_1.md)

**Important Change**: Guards without explicit scope default to `block` scope, not file scope:
- `@guard:ai:w` - Applies to next block only
- `@guard:ai:w.file` - Explicitly applies to entire file

## Current Implementation Formats (regexCache.ts)

### Main Guard Tag Pattern
```regex
/(?:\/\/|#|--|\/\*|\*)*\s*@guard:(ai|human|hu)(?:\[([^\]]+)\])?:(read|write|noaccess|context|r|w|n)(?:\.([a-zA-Z]+|\d+))?(?:(\+[a-zA-Z]+)*)?(?:(-[a-zA-Z]+)*)?/gi
```

### Supported Formats in Implementation
1. **Targets**: `ai`, `human`, `hu`
2. **Permissions**: `read`, `write`, `noaccess`, `context`, `r`, `w`, `n`
3. **Identifiers**: `[...]` bracket notation
4. **Scopes**: `.word` or `.number`
5. **Scope modifiers**: `+scope`, `-scope`

### Missing from Implementation
1. **Case insensitivity** for permissions (partial support - lowercase normalized internally)
2. **Target `all`** from specification_extend_1.md
3. **Permission aliases**: `readonly`, `none`
4. **Scope aliases**: Most semantic scope aliases (e.g., `sig` for `signature`)
5. **Negation identifiers**: `[!identifier]`
6. **Group identifiers**: `[group:*]`
7. **Context metadata**: `[priority=high]`, `[for=testing]`, etc.
8. **Conditional guards**: `[approval=team]`
9. **Multi-target syntax**: Comma-separated targets in single tag

## Discrepancies Between Spec and Implementation

### 1. Case Sensitivity
- **Spec**: Fully case-insensitive for all components
- **Implementation**: Pattern matches case-insensitively but normalizes to lowercase internally
- **Impact**: Works correctly but could be clearer

### 2. Target Support
- **Spec**: `ai`, `human`, `all`
- **Implementation**: `ai`, `human`, `hu` (no `all`)
- **Impact**: Missing `all` target functionality

### 3. Permission Variations
- **Spec**: Many aliases (`readonly`, `READ-ONLY`, `none`, `NONE`)
- **Implementation**: Limited set (`read`, `write`, `noaccess`, `r`, `w`, `n`, `context`)
- **Impact**: Less flexible input acceptance

### 4. Scope Aliases
- **Spec**: Rich set of aliases (e.g., `sig`/`signature`, `func`/`function`)
- **Implementation**: No alias support
- **Impact**: Users must use exact scope names

### 5. Advanced Identifier Features
- **Spec**: Negation (`[!id]`), groups (`[group:*]`)
- **Implementation**: Basic bracket notation only
- **Impact**: Missing advanced targeting capabilities

### 6. Context Metadata
- **Spec**: Rich metadata support (`[priority=high]`, `[for=testing]`)
- **Implementation**: No metadata parsing
- **Impact**: Cannot specify context priority or purpose

### 7. Multi-Target Support
- **Spec**: Single tag with multiple targets (`@guard:ai:r,human:w`)
- **Implementation**: Parses multiple tags on same line but not comma-separated in single tag
- **Impact**: Requires multiple tags instead of one compact form

### 8. Default Scope Behavior
- **Spec** (extend_1): Default to `block` scope
- **Implementation**: Defaults to `block` scope (correctly implemented)
- **Impact**: None - correctly aligned

## Recommendations for Reconciliation

### 1. High Priority - Core Functionality
1. **Add `all` target support** - Required by specification_extend_1.md
2. **Implement full case-insensitive parsing** - Already mostly there, just need to handle more aliases
3. **Add permission aliases** - Simple string mapping for `readonly`→`r`, `none`→`n`
4. **Add scope aliases** - Map `sig`→`signature`, `func`→`function`, etc.

### 2. Medium Priority - Enhanced Features
1. **Multi-target syntax** - Parse comma-separated targets in single tag
2. **Negation identifiers** - Support `[!identifier]` syntax
3. **Group identifiers** - Support `[group:*]` syntax
4. **Context metadata** - Parse and store `[key=value]` pairs

### 3. Low Priority - Advanced Features
1. **Conditional guards** - `[approval=team]` syntax
2. **Directory-level pattern guards** - Full `.ai-attributes` support
3. **External identity provider integration** - For identifier resolution

### 4. Implementation Strategy

#### Phase 1: Update Regex Pattern
```typescript
// Enhanced pattern supporting more formats
export const ENHANCED_GUARD_TAG = /(?:\/\/|#|--|\/\*|\*)*\s*@guard:(ai|human|hu|all)(?:\[([^\]]+)\])?:(read|write|noaccess|context|r|w|n|readonly|none)(?:\.([a-zA-Z]+|\d+))?(?:(\+[a-zA-Z]+)*)?(?:(-[a-zA-Z]+)*)?(?:\[([^\]]+)\])?/gi
```

#### Phase 2: Add Alias Mappings
```typescript
const PERMISSION_ALIASES = {
  'read': 'r',
  'readonly': 'r',
  'read-only': 'r',
  'write': 'w',
  'noaccess': 'n',
  'none': 'n',
  'no-access': 'n'
};

const SCOPE_ALIASES = {
  'sig': 'signature',
  'func': 'function',
  'stmt': 'statement',
  'doc': 'docstring',
  'dec': 'decorator',
  'val': 'value',
  'expr': 'expression'
};
```

#### Phase 3: Enhanced Parser
Update `parseGuardTag` function to:
1. Handle case-insensitive matching properly
2. Support alias resolution
3. Parse multi-target syntax
4. Extract context metadata
5. Support negation and group identifiers

## Conclusion

The current implementation covers the core functionality but lacks support for many convenience features and advanced capabilities described in the specifications. The recommended phased approach would bring the implementation into full compliance with the specifications while maintaining backward compatibility.

The most critical gaps are:
1. Missing `all` target support
2. Limited permission and scope aliases
3. No multi-target syntax support
4. Missing context metadata parsing

These can be addressed incrementally without breaking existing functionality.