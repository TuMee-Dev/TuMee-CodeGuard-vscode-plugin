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

### VSCode Extension (Visual Coloring) Requirements

For the VSCode extension's visual rendering, implement these features:

#### 1. High Priority - Core Visual Features
1. **Add `all` target support** - Parse and color `@guard:all:permission`
2. **Implement full case-insensitive parsing** - Already mostly there, just need to handle more aliases
3. **Add permission aliases** - Simple string mapping for `readonly`→`r`, `none`→`n`
4. **Add scope aliases** - Map `sig`→`signature`, `func`→`function`, etc.
5. **Support wildcard patterns** - Parse `ai[claude-*]`, `human[team-*]` for visual indication

#### 2. Medium Priority - Enhanced Visual Features
1. **Multi-target syntax** - Parse comma-separated targets in single tag for coloring
2. **Visual distinction for special identifiers** - Different styling for wildcards, negations
3. **Context metadata parsing** - Extract and display `[key=value]` pairs in tooltips

#### 3. Not Required for VSCode
- Identity resolution (treat all guards as active)
- Group membership checking
- Environment condition evaluation
- Approval system integration
- External identity provider connections

### CLI Tool (Enforcement) Requirements

For full permission enforcement in the CLI tool:

#### 1. High Priority - Core Enforcement
1. **Identity resolution system** - Know current AI/human actor
2. **Callback architecture** - Pluggable resolvers for identity, groups, context
3. **Configuration file support** - `.guardconfig.yml` for identity and context
4. **Wildcard pattern matching** - Support `claude-*`, `team-*` patterns

#### 2. Medium Priority - Advanced Enforcement
1. **Group membership resolution** - LDAP, Active Directory, custom providers
2. **Context metadata evaluation** - Match against current execution context
3. **Negation identifiers** - Support `[!identifier]` exclusions
4. **Environment conditionals** - `.if(production)` evaluation

#### 3. Low Priority - Enterprise Features
1. **Approval system integration** - Check `[approval=team]` conditions
2. **Directory-level pattern guards** - Full `.ai-attributes` support
3. **External identity provider plugins** - OAuth, SAML, custom systems
4. **Audit logging** - Track permission checks and violations

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

## External Variables Required for Full Processing

For complete guard tag enforcement, the following external data sources and resolvers are required:

### 1. Identity Resolution
- **Current AI Model/Agent Identifier**: Required to match tags like `@guard:ai[claude-3]:r`
  - Must know if current AI is "claude-3", "gpt-4", etc.
  - Should support wildcard matching (e.g., "claude-opus-4" matches `ai[claude-*]`)
- **Current Human User Identifier**: Required to match tags like `@guard:human[john]:w`
  - Must know the current user's identifier
  - Should support multiple identifiers per user (username, email, employee ID)

### 2. Group Membership Resolution
- **Group Membership Callback**: Function to determine if user/AI belongs to a group
  - Example: `isInGroup(identifier: string, group: string): boolean`
  - Required for tags like `@guard:human[@team-alpha]:w`
  - Should support nested groups (team-alpha is part of engineering-dept)

### 3. Context Metadata Resolution
- **Context Resolver**: Provides current execution context
  - For tags like `@guard:ai:context[purpose:authentication]`
  - Should provide: purpose, environment, task type, security level
  - Example structure: `{ purpose: 'authentication', level: 'high', task: 'code-review' }`

### 4. Environment and Conditional Resolution
- **Environment Variables**: For conditional guards
  - Production/staging/development environment
  - Feature flags and deployment settings
  - For tags like `.if(production)` or `[when=staging]`
- **Approval System Integration**: For approval-based guards
  - Check if approval exists for `[approval=finance-team]`
  - Callback: `hasApproval(resource: string, team: string): boolean`

### 5. External Identity Providers
- **LDAP/Active Directory Integration**: For enterprise user groups
- **OAuth/SAML Providers**: For federated identity
- **Custom Identity Systems**: Plugin architecture for custom providers

### 6. Permission Inheritance and Override Systems
- **Hierarchy Resolver**: Determine permission precedence
  - File-level vs block-level vs line-level guards
  - Directory `.ai-attributes` inheritance
  - Default permission policies

## Implementation Strategy for VSCode Extension

### Visual Rendering (VSCode Extension)

For the VSCode extension's primary purpose of **visual indication**, a simplified approach is appropriate:

1. **Ignore Identifier Matching**
   - Treat all `@guard:ai[any-identifier]:permission` as active
   - Don't attempt to resolve current AI/human identity
   - Apply coloring based on permission type regardless of identifier match

2. **Simplified Processing**
   - Parse guard tags for structure only
   - Extract permission (r/w/n/context) and scope
   - Apply decorations based on permission type
   - No need for external data resolution

3. **Benefits of This Approach**
   - Fast, synchronous processing
   - No external dependencies
   - Consistent visual feedback
   - Works offline
   - No configuration needed

### Command-Line Enforcement (CLI Tool)

For actual permission **enforcement**, the CLI tool would need:

1. **Callback Mechanism**
   ```typescript
   interface GuardEnforcementCallbacks {
     getCurrentIdentity: () => { type: 'ai' | 'human', id: string };
     isInGroup: (id: string, group: string) => boolean;
     getContext: () => Record<string, any>;
     hasApproval: (resource: string, approver: string) => boolean;
     getEnvironment: () => string;
   }
   ```

2. **Configuration File Support**
   ```yaml
   # .guardconfig.yml
   identity:
     type: ai
     id: claude-opus-4
     groups: [assistants, code-reviewers]
   
   context:
     purpose: development
     level: standard
   
   environment: development
   ```

3. **Plugin Architecture**
   - Allow custom resolvers for enterprise systems
   - Support for different identity providers
   - Extensible context providers

### Clear Separation of Concerns

1. **VSCode Extension (Visual Layer)**
   - Purpose: Visual indication and awareness
   - Processing: Parse and color based on permission type
   - Identity: Ignored - all guards shown as if active
   - Performance: Fast, synchronous, no external calls
   - Configuration: Minimal - just color preferences

2. **CLI Tool (Enforcement Layer)**
   - Purpose: Actual permission enforcement
   - Processing: Full resolution with callbacks
   - Identity: Required - must know current actor
   - Performance: Can be async, make external calls
   - Configuration: Extensive - identity, groups, context

3. **Shared Components**
   - Guard tag parser (syntax only)
   - Scope resolver (code structure analysis)
   - Permission type definitions

## Conclusion

The current implementation covers the core functionality but lacks support for many convenience features and advanced capabilities described in the specifications. The recommended phased approach would bring the implementation into full compliance with the specifications while maintaining backward compatibility.

The most critical gaps are:
1. Missing `all` target support
2. Limited permission and scope aliases
3. No multi-target syntax support
4. Missing context metadata parsing
5. Wildcard pattern support for identifiers

For the VSCode extension specifically, focusing on visual rendering without identity resolution is the correct approach. This provides immediate value to developers while keeping the implementation simple and performant. Full enforcement with identity resolution should be delegated to the CLI tool, which can handle the complexity of external data integration and callback mechanisms.

These can be addressed incrementally without breaking existing functionality.