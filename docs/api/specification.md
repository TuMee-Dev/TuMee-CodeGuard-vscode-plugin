# CodeGuard: File Change Detection and Guard System Documentation

## Overview

CodeGuard is a powerful file change detection tool that identifies, tracks, and validates code modifications with a focus on respecting designated "guarded" regions across multiple programming languages. The system intelligently parses source code files using tree-sitter to understand code structure, identifies special guard annotations, and enforces compliance with those directives during code reviews or automated checks.

The Code Guard system provides clear guidance to both AI systems and human developers about how specific sections of code should be treated. It uses a straightforward annotation format that works across different programming languages and leverages semantic understanding of code structure for resilient, maintainable guards.

## Core Requirements

Create a Python-based tool that:

1. Uses tree-sitter for language-aware parsing of source code across multiple programming languages
2. Identifies specially marked code regions using guard annotations (e.g., `@guard:ai:r`, `@guard:ai:n`)
3. Supports both semantic scope-based guards (e.g., `@guard:ai:r.func`) and line-count guards
4. Computes SHA-256 hashes of guarded regions to detect unauthorized changes
5. Provides detailed reporting on violations with context about what changed
6. Can be compiled into a standalone executable for easy deployment
7. Enables multiple comparison modes:
   - Compare a modified file against the current file on disk
   - Compare against the last checked-in version in version control
   - Compare the latest version against a specific revision X commits back
8. Runs both as a standalone executable (for git pre-commit hooks) and as an MCP server
9. Provides a comprehensive help system for both users and AI assistants
10. Includes comprehensive unit testing for all externally callable functions, with tests organized alongside their respective modules
11. Requires all tests to be executed and passed before any implementation is considered complete
12. Strictly prohibits skipping or exempting any tests without explicit human approval
13. Maintains a MODULE_CONTEXT.md file in each module directory to provide comprehensive context for AI guardians
14. Provides clear executable entry points that handle command-line invocation
15. Follows a standardized project structure with properly isolated test files
16. Uses the latest stable versions of all libraries and follows current best practices
17. Supports directory-level guard annotations through `.ai-attributes` files
18. Determines effective permissions by checking both in-code annotations and directory-level guards
19. Traverses the directory tree to apply guard rules from all applicable parent directories
20. Provides a way to quickly retrieve the effective access control permissions for any file or directory tree
21. Leverages tree-sitter's AST understanding to apply guards to semantic code structures

## Guard Annotation System

The tool must recognize and enforce a standardized guard notation that works across programming languages:

### Tag Format

All tags follow this structure:

```
@guard:target[identifier]:permission[.scope][+scope][-scope]
```

Where:

- `@guard`: The prefix that identifies this as a guard directive
- `target`: Specifies who the directive applies to (`ai`, `human`, or future targets)
- `[identifier]`: Optional - specifies which AI models, human teams, or groups (defaults to all if omitted)
- `permission`: Specifies the permission level (`r` for read-only, `w` for write, `n` for none/no access)
- `.scope`: Semantic scope identifier (see below)
- `+scope`: Additional scopes to include
- `-scope`: Subscopes to exclude

**Case Insensitivity**: The entire guard syntax is case-insensitive. All of the following are equivalent:

```
@guard:ai[claude-4]:r.func
@GUARD:AI[Claude-4]:R.FUNC
@Guard:AI[CLAUDE-4]:Read.Function
@guard:ai[claude-4]:read.function
```

This applies to all components:

- Prefix: `@guard` = `@GUARD` = `@Guard`
- Targets: `ai` = `AI` = `Ai`, `human` = `HUMAN` = `Human`
- Identifiers: `[claude-4]` = `[Claude-4]` = `[CLAUDE-4]`
- Permissions: `r` = `R` = `read` = `READ` = `Read`
- Scopes: `.func` = `.FUNC` = `.Function` = `.function`
- Metadata: `[priority=high]` = `[Priority=HIGH]` = `[PRIORITY=high]`

### Target Identifiers

The bracket notation allows fine-grained control over who has what permissions:

| Syntax | Description | Example |
|--------|-------------|---------|
| `@guard:ai:r` | All AI systems (backwards compatible) | `@guard:ai:r` = `@guard:ai[*]:r` |
| `@guard:ai[claude-4]:w` | Specific AI model | Only Claude 4 can write |
| `@guard:ai[claude-4,gpt-4]:r` | Multiple AI models | Claude 4 and GPT-4 can read |
| `@guard:ai[*]:n` | Explicitly all AIs | No AI access |
| `@guard:human[security-team]:w` | Specific human team | Only security team can write |
| `@guard:human[senior-dev]:r` | Specific role | Senior developers can read |
| `@guard:human:n` | All humans | No human should modify |

Identifiers can represent:
- Specific AI models: `claude-4`, `gpt-4`, `gemini-pro`
- AI providers: `anthropic-models`, `openai-models`
- AI capabilities: `coding-agents`, `analysis-agents`
- Human teams: `security-team`, `frontend-team`
- Human roles: `senior-dev`, `contractor`, `admin`
- Custom groups defined in external systems

### Permission Options

The system is completely case-insensitive for all components. For permissions, `@guard:ai:r` will match `@guard:ai:read`, `@GUARD:AI:R`, `@guard:ai:READ`, and any other case variation. Partial word matching is supported for the permission part (e.g., `r` matches `read`, `readonly`, `READ-ONLY`).

| Tag | Name | Description |
|-----|------|-------------|
| `@guard:ai:r` | AI Read-Only | AI systems should not modify this section |
| `@guard:ai:w` | AI Write | AI systems can modify this section |
| `@guard:ai:n` | AI None | AI systems must not access this code at all |
| `@guard:ai:context` | AI Context | AI systems should read this for context (implies read) |
| `@guard:human:r` | Human Read-Only | Humans should not modify (e.g., generated code) |
| `@guard:human:n` | Human None | Humans must not modify (machine-managed) |

### Semantic Scope Identifiers

The system uses tree-sitter to understand code structure and apply guards to semantic boundaries rather than arbitrary line counts. All scope identifiers are case-insensitive (e.g., `.func` = `.FUNC` = `.Function`):

| Scope | Aliases | Description | Example Coverage |
|-------|---------|-------------|------------------|
| `signature` | `sig` | Function/method/class signatures only | `def foo(a, b):` |
| `body` | - | Implementation body only | Everything inside `{}` or indented block |
| `function` | `func` | Entire function (signature + body) | Full function |
| `block` | - | Current code block | Current `if`, `for`, `try` block, etc. |
| `statement` | `stmt` | Single logical statement | One complete statement |
| `class` | - | Entire class definition | Class and all its members |
| `method` | - | Entire method | Method signature + body |
| `docstring` | `doc` | Documentation strings | Docstrings/comments |
| `import` | `imports` | Import statements | `import`/`using`/`require` |
| `decorator` | `dec` | Decorators/annotations | `@decorator` lines |
| `value` | `val` | Variable values only | Right side of assignment |
| `expression` | `expr` | Single expression | Any evaluatable expression |

### Compound Scopes

| Scope | Description | Example |
|-------|-------------|---------|
| `sig+doc` | Signature plus docstring | Function signature and its docs |
| `func-doc` | Function except docstring | Everything but documentation |
| `class-methods` | Class without methods | Class definition and fields only |

### Usage Examples

#### Semantic Guards

```python
# @guard:ai:r.sig
def calculate_payment(amount: float, rate: float) -> float:
    """Calculate payment with interest."""
    return amount * (1 + rate)  # AI can modify implementation

# @guard:ai[claude-4]:w.func,ai[*]:r.func
def validate_token(token: str) -> bool:
    """Only Claude 4 can modify this function, others can read."""
    return check_signature(token)

# @guard:human:n,ai[trusted-models]:w
def auto_generated_parser():
    """Auto-generated code - humans shouldn't edit, trusted AI models can update."""
    # Implementation
    pass

# @guard:ai[security-auditor]:r.body,human[security-team]:w.body
def process_sensitive_data(data):
    # Only security team can modify, security auditor AI can review
    result = security_algorithm(data)
    return result

# @guard:ai:r.class-methods
class ConfigManager:
    VERSION = "1.0"  # Protected
    API_KEY = "..."  # Protected
    
    def get_config(self):  # Not protected
        pass

# @guard:ai[documentation-agents]:w.doc,ai[*]:r.doc
async def critical_api_endpoint(request: Request) -> Response:
    """
    Documentation can be updated by documentation agents only.
    
    This handles payment processing.
    """
    # Implementation can be modified by any AI
    return process_payment(request)
```

#### Specific Model/Team Guards

```python
# @guard:ai[gpt-4,claude-4]:w,ai[*]:n,human[ml-team]:w
class NeuralNetworkImpl:
    """Only GPT-4, Claude-4, or ML team members can modify."""
    pass

# @guard:human:n
# AUTO-GENERATED FILE - DO NOT EDIT
# This file is automatically generated by the build process

# @guard:ai[junior-models]:n,ai[senior-models]:r
def financial_calculation():
    """Critical financial logic - only senior AI models can read."""
    pass
```

#### Block Guards

```python
if user.is_authenticated:
    # @guard:ai:n.block
    secret_key = load_secret()
    process_sensitive_data(secret_key)
else:
    # This block is not protected
    show_login()

try:
    # @guard:ai[monitoring-agents]:r.block,ai[*]:n.block
    result = sensitive_operation()
    validate_result(result)
except Exception as e:
    # Error handling can be modified
    log_error(e)

# @guard:human:n.block
# AUTO-GENERATED BLOCK - DO NOT EDIT MANUALLY
{
    generated_config = {
        "version": "1.2.3",
        "timestamp": "2024-01-01"
    }
}
```

```javascript
// @guard:ai[senior-models]:w.block,ai[*]:r.block,human[security-team]:w.block
{
    const apiKey = process.env.API_KEY;
    const secret = process.env.SECRET;
    initializeAuth(apiKey, secret);
}
```

#### Expression and Statement Guards

```python
# @guard:ai:r.expr
complex_calculation = (a * b + c) / (d - e) if d != e else 0

# @guard:ai:n.stmt
cursor.execute("DROP TABLE users")  # Never let AI touch this

# @guard:ai:r.value
API_ENDPOINT = "https://api.production.com/v2"  # Value protected, not variable name
```

#### Line-Count Guards

For cases where semantic scopes don't fit, you can still use line counts:

```python
# @guard:ai:r.1 Only the function signature is read-only
async def record_claude_start(self, process_id, model=None, conversation_id=None):
    """Record a new Claude CLI process start"""
    now = datetime.datetime.now()
    iso_now = now.isoformat()

# @guard:ai[junior-models]:n.3 Next 3 lines off-limits to junior models
API_KEY = os.environ.get("API_KEY")
SECRET = os.environ.get("SECRET")
DATABASE_URL = os.environ.get("DATABASE_URL")
```

### Implementation Tips

1. Use semantic scopes instead of line counts for more resilient guards
2. Place guard tags at the start of comment lines for maximum visibility
3. Use `.sig` to protect API contracts while allowing implementation changes
4. Use `.body` to protect implementation while allowing signature updates
5. Use `.block` for protecting specific control flow sections
6. Include brief explanations of why the guard is needed
7. For critical sections, consider using `@guard:ai:n`
8. Review guards periodically to ensure they remain appropriate

### Resilience Features

1. **Fuzzy Matching**: If tree-sitter can't parse, fall back to heuristics:
   - `.sig` → Match until first `{` or `:` 
   - `.block` → Match indentation or brackets
   - `.func` → Match from function keyword to end of indentation

2. **Scope Validation**: Warn if scope doesn't match context:

   ```python
   # @guard:ai:r.class  # Warning: No class found, protecting block instead
   def function():
       pass
   ```

3. **Nested Scope Resolution**: Inner guards override outer ones:

   ```python
   # @guard:ai:r.func
   def process():
       data = load()
       # @guard:ai:w.block  # This block can be modified
       if needs_optimization:
           data = optimize(data)
       return data
   ```

### Additional Semantic Patterns

For more complex scenarios:

```python
# Pattern matching (future enhancement)
# @guard:ai:r.match="test_*"
# Protects all functions matching pattern

# Conditional guards (future enhancement)
# @guard:ai:r.if-prod.func
# Only enforced in production environment

# Timed guards (future enhancement)
# @guard:ai:r.until="2024-12-31".func
# Temporary protection

# Author-specific guards
# @guard:ai:r.by="security-team".class
# Only security team can modify
```

### Implementation Benefits

1. **Resilient to Reformatting**: Semantic scopes survive code formatting
2. **Self-Documenting**: `.sig`, `.body` clearly indicate intent
3. **Granular Control**: Protect exactly what matters
4. **Language-Aware**: Leverages tree-sitter's understanding
5. **Maintainable**: Guards remain valid as code evolves
6. **Composable**: Combine scopes for precise control

This approach transforms guards from brittle line counts to intelligent, semantic protections that understand code structure and developer intent.

### Integration Ideas

- Add syntax highlighting for guard tags in your IDE
- Create linting rules to enforce guard compliance
- Include guard validation in code review processes
- Document guard usage in team coding standards

## Directory-Level Guard System

The tool must support directory-level guard annotations through `.ai-attributes` files placed in directories, using the pathspec library for enhanced pattern matching:

1. **File Format**:

   - `.ai-attributes` files use gitignore-style patterns with `@guard:` permissions
   - Parsed using the pathspec library for robust pattern matching
   - Each line contains a pattern followed by one or more guard annotations

2. **Syntax**:

   ```
   <pattern> @guard:target[identifier]:permission[.scope][conditions]
   ```

3. **Permission Types** (same as in-code annotations):
   - `@guard:ai:r` - All AIs read-only (equivalent to `@guard:ai[*]:r`)
   - `@guard:ai[specific-model]:w` - Specific AI write access
   - `@guard:ai:n` - No AI access
   - `@guard:ai:context` - Context files for all AIs
   - `@guard:human:n` - No human modifications (machine-managed)
   - `@guard:human[team]:w` - Specific team write access

4. **Pattern Matching** (via pathspec):
   - `*` matches all files in the current directory only
   - `**/*` matches all files in the current directory and all subdirectories
   - `*.py` matches all Python files in the current directory
   - `src/*.js` matches all JavaScript files in the src subdirectory
   - `tests/**/*.py` matches all Python files in the tests directory and its subdirectories
   - `!important.log` negation patterns (exclude from previous patterns)

5. **Basic Examples**:
   ```
   # All files in this directory are AI read-only
   * @guard:ai:r
   
   # Case doesn't matter - these are all equivalent:
   **/*.py @guard:ai[Claude-4]:w,ai[*]:r
   **/*.py @GUARD:AI[claude-4]:W,AI[*]:R
   **/*.py @Guard:AI[CLAUDE-4]:Write,AI[*]:Read
   
   # Human restrictions - auto-generated files
   build/** @guard:human:n
   dist/** @guard:HUMAN:N,AI:R
   
   # Test files - only certain AIs and team can edit
   tests/**/*.py @guard:ai[testing-agents]:w,human[qa-team]:w,human[*]:r
   tests/**/*.py @GUARD:AI[TESTING-AGENTS]:W,HUMAN[QA-TEAM]:W,HUMAN[*]:R
   
   # Legacy code - restricted access
   src/legacy/** @guard:ai[senior-models]:r,ai[*]:n,human[senior-dev]:w
   
   # Config files are hidden from most
   config/** @guard:ai[ops-bots]:r,ai[*]:n,human[ops-team]:w
   ```

6. **Context Files with Specific Access**:
   Context files are marked with `@guard:ai:context` to indicate they contain important information that LLMs should read when working in an area:

   ```
   # Mark README files as context for all AIs
   **/README.md @guard:ai:context
   
   # Internal docs - only certain AIs should see
   **/INTERNAL.md @guard:ai[trusted-models]:context,ai[*]:n
   
   # Architecture documentation is high-priority context
   ARCHITECTURE.md @guard:ai:context[priority=high]
   docs/design/*.md @guard:ai[senior-models]:context[priority=high],ai[*]:r
   
   # Context with specific use cases and model restrictions
   tests/fixtures/*.json @guard:ai[testing-agents]:context[for=testing]
   migrations/*.sql @guard:ai[db-agents]:context[for=database-work],ai[*]:n
   
   # Different context access levels
   docs/public/*.md @guard:ai:context,human:r
   docs/internal/*.md @guard:ai[employee-models]:context,ai[*]:n,human[employees]:r
   
   # Source files that provide context but shouldn't be modified
   src/auth/oauth.py @guard:ai:context
   src/payment/stripe.py @guard:ai:context
   ```

7. **Advanced Features**:
   ```
   # Conditional access with specific models/teams
   financial/** @guard:ai[finance-certified]:r[approval=finance-team],ai[*]:n
   src/auth/** @guard:ai[security-auditor]:r,human[security-team]:w,human[*]:n
   
   # Role-based patterns
   @developer tests/** @guard:ai[dev-assistants]:w,human[developer]:w
   @reviewer src/** @guard:ai:r,human[reviewer]:r,human[developer]:w
   
   # Model-specific write permissions
   experimental/** @guard:ai[claude-4,gpt-4]:w,ai[*]:r,human[research-team]:w
   
   # Auto-generated with specific permissions
   **/*.generated.ts @guard:human:n,ai[codegen-agents]:w,ai[*]:r
   ```

8. **Inheritance and Precedence**:
   - More specific patterns override less specific ones
   - More specific identifiers override wildcards (`ai[claude-4]` > `ai[*]`)
   - File-level annotations override directory-level annotations
   - Child directory annotations override parent directory annotations
   - Direct matches override wildcard matches
   - Negation patterns (!) exclude files from previous patterns
   - Explicit denial overrides permissions (`ai[gpt-3]:n` overrides `ai[*]:w`)
   - Context permissions automatically include read access

## Access Control Information Retrieval

The tool must provide a way to quickly retrieve the effective access control permissions for any file or directory tree:

1. **Command-Line Interface**:
   ```bash
   # Get effective permissions for a single file
   codeguard -acl /path/to/file.py
   
   # Get effective permissions for a directory tree
   codeguard -acl /path/to/directory
   
   # Get permissions with detailed source information
   codeguard -acl --verbose /path/to/file.py
   
   # Get permissions in specific output format
   codeguard -acl --format json /path/to/directory
   
   # Include context file information
   codeguard -acl --include-context /path/to/directory
   
   # Show only context files for a directory
   codeguard context /path/to/directory
   
   # List all context files in the project
   codeguard list-context --recursive
   ```

2. **Response Format**:
   The output should follow a standardized JSON format:

   ```json
   {
     "path": "/path/to/file.py",
     "type": "file",
     "permissions": {
       "ai": {
         "*": "read-only",
         "claude-4": "write",
         "gpt-4": "write"
       },
       "human": {
         "*": "read-only",
         "security-team": "write"
       }
     },
     "is_context": false,
     "code": "AI-R",
     "status": "success"
   }
   ```

   For context files:
   
   ```json
   {
     "path": "/path/to/README.md",
     "type": "file",
     "permissions": {
       "ai": {
         "*": "context",
         "untrusted-models": "none"
       }
     },
     "is_context": true,
     "context_metadata": {
       "priority": "high",
       "inherit": true,
       "for": ["general"]
     },
     "code": "AI-C",
     "status": "success"
   }
   ```

   For directories, the response includes summary information:
   
   ```json
   {
     "path": "/path/to/directory",
     "type": "directory",
     "permissions": {
       "ai": {
         "*": "read-only",
         "claude-4": "write"
       },
       "human": {
         "*": "read-only",
         "dev-team": "write"
       }
     },
     "code": "MIXED",
     "context_files": [
       "/path/to/directory/README.md",
       "/path/to/directory/MODULE_CONTEXT.md"
     ],
     "children": {
       "total": 24,
       "consistent": false,
       "inconsistent_paths": ["/path/to/directory/sensitive.py"],
       "context_count": 3
     },
     "status": "success"
   }
   ```

   With the verbose option, include the detailed permission source information:
   
   ```json
   {
     "path": "/path/to/file.py",
     "type": "file",
     "permissions": {
       "ai": {
         "*": "read-only",
         "claude-4": "write"
       }
     },
     "code": "AI-MIXED",
     "permission_sources": [
       {
         "level": "repository",
         "file": "/.ai-attributes",
         "pattern": "**/*.py",
         "permission": "@guard:ai:r",
         "applies_to": ["ai[*]"]
       },
       {
         "level": "directory",
         "file": "/src/.ai-attributes", 
         "pattern": "**/*.py",
         "permission": "@guard:ai[claude-4,gpt-4]:w",
         "applies_to": ["ai[claude-4]", "ai[gpt-4]"]
       }
     ],
     "file_level_guards": [],
     "status": "success"
   }
   ```

3. **Integration Features**:
   - Support for machine-readable output formats (JSON, YAML, CSV)
   - Exit codes that indicate success/failure for automation
   - Performance optimization with caching for repeated queries
   - Support for batch queries to efficiently check multiple paths
   - Context file discovery and reporting

4. **Programmatic API**:
   ```python
   # Python API for integration with other tools
   from codeguard import get_effective_permissions, get_context_files

   # Get permissions for a file
   permissions = get_effective_permissions("/path/to/file.py")
   
   # Get permissions for a directory tree
   permissions = get_effective_permissions("/path/to/directory", recursive=True)
   
   # Get context files for a directory
   context_files = get_context_files("/path/to/directory", inherit=True)
   ```

5. **Integration Examples**:
   - Git hook that checks permissions before allowing commits
   - IDE plugin that displays current file permissions and relevant context files
   - CI/CD pipeline integration for permission validation
   - LLM tools that automatically load context files when working in a directory
   - External tool API integration examples

## Identifier System and External Integration

The bracket notation in guards (`@guard:target[identifier]:permission`) enables integration with external identity and capability systems:

1. **Identifier Types**:
   - **AI Models**: `claude-4`, `gpt-4`, `gemini-pro`, etc.
   - **AI Providers**: `anthropic-models`, `openai-models`, etc.
   - **AI Capabilities**: `coding-agents`, `documentation-agents`, `testing-agents`
   - **Human Teams**: `security-team`, `frontend-team`, `ml-team`
   - **Human Roles**: `senior-dev`, `junior-dev`, `contractor`, `admin`
   - **Custom Groups**: Any identifier defined in external systems

2. **Wildcard and Special Identifiers**:
   - `[*]` or no brackets - Applies to all entities of that target type
   - `[!identifier]` - Applies to all EXCEPT the specified identifier
   - `[group:*]` - All members of a group category

3. **External Integration Points**:
   The tool should support pluggable identity providers to resolve:
   - Which AI model is making the current request
   - Which human user/team is making the current request
   - Group membership and capability mappings

4. **Example Integration Configuration**:
   ```yaml
   # .ai-identity-config.yml
   providers:
     ai_identity:
       type: "header-based"  # Or "oauth", "api-key", etc.
       header: "X-AI-Model"
     human_identity:
       type: "git-config"    # Or "ldap", "oauth", etc.
   
   groups:
     anthropic-models:
       - claude-3-opus
       - claude-3-sonnet
       - claude-4
     senior-models:
       - claude-4
       - gpt-4
       - gemini-ultra
     coding-agents:
       capability_required: "code_generation"
   ```

5. **Backwards Compatibility**:
   - `@guard:ai:r` is interpreted as `@guard:ai[*]:r`
   - Systems without identity providers treat all guards as applying to `[*]`

## Context File System

The tool supports marking files as "context" - important information that LLMs should read when working in specific areas:

1. **Context File Purpose**:
   - Provide background information for LLMs working in a codebase
   - Document architecture decisions, API contracts, and design patterns
   - Explain complex business logic or domain-specific concepts
   - Guide AI assistants on best practices for specific modules

2. **Standard Context File Conventions**:
   - `README.md` - General directory context
   - `MODULE_CONTEXT.md` - Module-specific context (already required by spec)
   - `*.context.md` - Explicit context files
   - `ARCHITECTURE.md` - System design context
   - `API.md` - API documentation context
   - `DESIGN.md` - Design decisions and rationale

3. **Context Inheritance**:
   - Context files can be marked with `[inherit=true]` to apply to all subdirectories
   - Child directories inherit parent context unless overridden
   - LLMs should read all applicable context files when working in a directory

4. **Context Priority Levels**:
   - `[priority=high]` - Essential context that must be read
   - `[priority=medium]` - Important but not critical context
   - `[priority=low]` - Optional context for additional detail

5. **Scoped Context**:
   - `[for=testing]` - Context relevant only for test-related work
   - `[for=configuration]` - Context for configuration tasks
   - `[for=database-work]` - Context for database-related changes
   - `[for=security]` - Context for security-sensitive work

6. **Example Directory Structure with Context**:
   ```
   project/
   ├── .ai-attributes          # Root: README.md @guard:ai:context[inherit=true]
   ├── README.md              # Project overview (inherited context)
   ├── ARCHITECTURE.md        # System design (inherited context)
   ├── src/
   │   ├── .ai-attributes     # src/**/*.py @guard:ai:r
   │   ├── auth/
   │   │   ├── .ai-attributes # oauth.py @guard:ai:r[approval=security]
   │   │   ├── README.md      # Auth module context
   │   │   └── oauth.py
   │   └── core/
   │       ├── MODULE_CONTEXT.md  # Core module context
   │       └── engine.py
   ```

## Permission Resolution Algorithm

When determining the effective permissions for a file, the tool follows these steps:

1. **Tree Traversal**:
   - Start from the file's immediate directory
   - Check for `.ai-attributes` in this directory
   - Traverse up the directory tree to the repository root
   - Collect all applicable `.ai-attributes` rules
   
2. **Rule Application**:
   - Apply rules from highest directory (repository root) first
   - Progressively apply more specific rules from deeper directories
   - Apply more specific patterns within each directory
   - Process negation patterns (!) to exclude files
   - Finally, check for in-code `@guard:` annotations within the file itself
   
3. **Pattern Specificity** (from least to most specific):
   - `**/*` (all files in all directories)
   - `*` (all files in exact directory)
   - `*.<ext>` (all files with specific extension)
   - `<path>/**/*` (all files in specific subdirectory tree)
   - `<path>/*` (all files in specific subdirectory)
   - `<path>/*.<ext>` (all files with specific extension in specific subdirectory)
   - `<filename>` (exact file match)
   
4. **Identifier Specificity** (from least to most specific):
   - No brackets or `[*]` (applies to all)
   - Group identifiers (e.g., `[anthropic-models]`, `[senior-dev]`)
   - Specific identifiers (e.g., `[claude-4]`, `[john-doe]`)
   - Multiple specific identifiers are treated as equally specific
   
5. **Permission Conflict Resolution**:
   - Most specific match wins (both pattern and identifier)
   - When patterns are equal, more specific identifier wins
   - File-level annotations always override directory-level annotations
   - If two patterns have equal specificity, the one from the deeper directory wins
   - Explicit denial always wins (e.g., `@guard:ai[gpt-3]:n` overrides `@guard:ai[*]:w`)
   - If still equal, the most restrictive permission wins: `@guard:ai:n` > `@guard:ai:r` > `@guard:ai:context` > `@guard:ai:w`
   - Context permissions (`@guard:ai:context`) automatically grant read access

6. **Multi-Target Resolution**:
   When multiple targets are specified (e.g., both AI and human guards):
   - Each target is resolved independently
   - A request must satisfy ANY applicable target rule (OR logic)
   - Example: `@guard:ai[claude-4]:w,human[security-team]:w` means EITHER Claude-4 OR a security team member can write
   - Example: `@guard:ai[*]:r,human[*]:n` means any AI can read but no human can modify

7. **Context File Resolution**:
   - Identify all files marked with `@guard:ai:context` or `@guard:ai[identifier]:context`
   - Filter by requesting entity (e.g., only show context files accessible to the current AI model)
   - Apply inheritance rules for context files marked with `[inherit=true]`
   - Filter context files by scope if `[for=...]` is specified
   - Sort context files by priority level
   - Return ordered list of applicable context files

## Technical Design Considerations

When implementing the tool, focus on:

1. **Language-agnostic operation**: Accurately parse guard annotations in comments across Python, C#, JavaScript, Java, and other major languages
2. **Semantic scope detection**: Use tree-sitter ASTs to identify code structures (functions, classes, blocks, etc.)
3. **Change detection accuracy**: Handle whitespace changes, line ending differences, and other non-semantic modifications appropriately
4. **Region boundary detection**: Properly identify region start/end markers in different languages (e.g., `# region`/`# endregion` in Python, `#region`/`#endregion` in C#)
5. **Performance optimization**: Efficiently process large codebases with minimal resource usage
6. **Command-line interface**: Provide both programmatic API and CLI options for integration into different workflows
7. **Cross-platform compatibility**: Ensure the tool works consistently on Windows, macOS, and Linux
8. **Testability**: Design components with testability in mind, allowing for isolation and mocking of dependencies
9. **Language test corpus**: Maintain a comprehensive test corpus of code samples in all supported languages to verify guard detection
10. **Module context persistence**: Ensure each module maintains sufficient context for AI guardians to understand and recreate the module independently
11. **Library currency**: Verify all libraries are used according to their latest documentation and best practices
12. **Directory tree scanning**: Efficiently traverse directory trees to find and parse `.ai-attributes` files
13. **Permission caching**: Cache permission rules to avoid redundant file parsing and tree traversal
14. **Rule conflict resolution**: Implement clear, deterministic rules for resolving conflicts between directory-level and file-level permissions
15. **Case-insensitive matching**: Implement case-insensitive parsing and matching for ALL components:
    - Guard prefix (`@guard` = `@GUARD`)
    - Targets (`ai` = `AI`, `human` = `HUMAN`)
    - Identifiers in brackets (`[Claude-4]` = `[claude-4]`)
    - Permissions (`r` = `R` = `read` = `READ`)
    - Scopes (`.func` = `.FUNC` = `.function`)
    - Metadata attributes (`[priority=high]` = `[Priority=HIGH]`)
    - Normalize all comparisons to lowercase internally
16. **Semantic scope handling**: Properly identify and track semantic scopes using tree-sitter ASTs
17. **Fallback strategies**: Implement heuristic-based scope detection when tree-sitter parsing fails
18. **Pathspec integration**: Use the pathspec library with custom extensions for parsing `.ai-attributes` files
19. **Context file management**: Efficiently identify, prioritize, and serve context files to LLMs
20. **Pattern negation**: Support gitignore-style negation patterns (!) for excluding files

## Implementation Guidance

The implementation should:

1. Leverage tree-sitter for robust, language-aware parsing of source code files
2. Parse tree-sitter ASTs to identify semantic scopes (functions, classes, blocks, etc.)
3. Compute cryptographic hashes of guarded regions to detect unauthorized changes
4. Compare versions of files to identify modifications to guarded sections
5. Generate reports highlighting violations with clear explanations
6. Support integration with CI/CD pipelines, git hooks, or IDEs
7. Use PyInstaller to create standalone executables for easy deployment
8. Implement a comprehensive testing strategy:
   - Organize tests alongside their respective modules (e.g., /codeguard/core/tests)
   - Create separate test files for each implementation file (e.g., parser.py → test_parser.py)
   - Write unit tests for ALL functions that can be called from outside their module
   - Use appropriate mocking frameworks to handle external dependencies
   - Ensure tests can be conditionally disabled in production environments
   - Run all tests and ensure they pass before considering any task complete
   - Include installation of all testing dependencies (pytest, pytest-cov, etc.) in the setup process
   - Generate and review test coverage reports after test execution
   - Never silently skip tests for any module
9. Ensure testability of complex components:
   - CLI interfaces should separate argument parsing from business logic
   - Use mock objects for external dependencies and I/O operations
   - Create appropriate test fixtures for commonly used test scenarios
   - Implement CLI testing using tools like click.testing or pytest-console
   - Design server components with testing hooks and interfaces
10. Maintain comprehensive module context documentation:
    - Each module directory must contain a MODULE_CONTEXT.md file
    - The context file must document all externally accessible functions with sufficient detail for recreation
    - The context must include implementation details, design decisions, and trade-offs
    - Update context files whenever significant changes are made to the module
11. Provide clear executable entry points:
    - Create a main script at the root level that serves as the primary entry point
    - Implement a `__main__.py` module for execution as a Python module
    - Ensure all entry points provide consistent access to all functionality
    - Include shebang lines and executable permissions for Unix/Linux environments
12. Implement directory-level guard handling:
    - Use pathspec library with custom `AIPermissionPattern` class
    - Parse `.ai-attributes` files with enhanced gitignore syntax
    - Implement an efficient directory tree traversal algorithm
    - Cache permission rules to improve performance on large codebases
    - Ensure deterministic resolution of permission conflicts
    - Support pattern-based file matching with proper wildcard handling
13. Implement semantic scope detection:
    - Use tree-sitter language parsers for each supported language
    - Map tree-sitter node types to semantic scopes
    - Handle nested scopes and scope precedence
    - Implement fallback heuristics for when tree-sitter parsing fails
14. Implement context file system:
    - Identify and parse `@guard:ai:context` permissions
    - Handle context metadata (priority, inheritance, scope)
    - Build ordered lists of applicable context files
    - Provide APIs for LLMs to discover relevant context
15. Implement identifier system:
    - Parse bracket notation in guard tags
    - Support multiple identifiers and wildcards
    - Integrate with external identity providers
    - Resolve group memberships and capabilities
    - Handle multi-target permissions (AI and human)
    - Ensure backwards compatibility for guards without brackets

## Example Command-Line Interface

The tool should use a standard command-line parser (like argparse) with comprehensive help documentation. Commands should include:

```
# Basic comparison
codeguard verify --original file.py --modified new_file.py

# Compare with current version on disk
codeguard verify-disk --modified new_file.py

# Compare with last checked-in version in git
codeguard verify-git --file path/to/file.py

# Compare against specific revision
codeguard verify-revision --file path/to/file.py --revision HEAD~3

# Batch operations
codeguard scan --directory ./src --report-format json

# Integration
codeguard install-hook --git-repo ./my-project

# Start MCP server mode
codeguard serve --port 8080

# Run unit tests for specific module
codeguard test --module core

# Run all tests with coverage reporting
codeguard test --all --coverage

# Run all tests with no exemptions
codeguard test --all --no-exemptions

# Run tests excluding specific modules (requires exemption approval)
codeguard test --exclude=module1,module2 --exemption-id=EX-123

# Run tests in a specific environment
codeguard test --environment development

# Run language-specific tests only
codeguard test --language-support

# Run specific language tests
codeguard test --language python,csharp,javascript

# Initialize test environment (installs pytest and dependencies)
codeguard init-test-env

# Verify test setup is complete and working
codeguard verify-test-setup

# Request a test exemption for a specific module
codeguard request-test-exemption --module cli --reason "needs specialized test harness"

# Generate or update a module context file
codeguard update-context --module core

# Validate module context completeness
codeguard validate-context --all

# Directory-level guard commands
codeguard create-aiattributes --directory path/to/dir
codeguard show-effective-permissions --file path/to/file.py
codeguard list-guarded-directories
codeguard validate-aiattributes --recursive

# Access control information commands
codeguard -acl /path/to/file.py
codeguard -acl /path/to/directory
codeguard -acl --verbose /path/to/file.py
codeguard -acl --format json /path/to/directory
codeguard -acl --include-context /path/to/directory

# Query for specific AI model or human
codeguard -acl --as ai[claude-4] /path/to/file.py
codeguard -acl --as human[security-team] /path/to/directory
codeguard -acl --show-all-identifiers /path/to/file.py

# Context file commands
codeguard context /path/to/directory
codeguard list-context --recursive
codeguard list-context --priority high
codeguard list-context --for testing

# Get help
codeguard --help
codeguard verify --help
```

All commands should offer comprehensive help text when used with `--help` to guide users and AI assistants.

## Output Format

Reports should provide clear, actionable information about violations:

```json
{
  "violations": [
    {
      "file": "src/security.py",
      "line": 42,
      "guard_type": "AI[gpt-3.5]-N",
      "violated_by": "ai[gpt-3.5]",
      "scope": "function",
      "original_hash": "e7a57e0fe09906c7f86c69e65f9e149b72110e15f2f4cf3be9d4a5d2c1e935a3",
      "modified_hash": "a1b2c3d4e5f6...",
      "message": "GPT-3.5 attempted to modify no-access function",
      "original_content": "def validate_token(token): ...",
      "modified_content": "def validate_token(token, extra_param): ...",
      "guard_source": "file-level"
    },
    {
      "file": "build/generated.js",
      "line": 1,
      "guard_type": "HUMAN-N",
      "violated_by": "human[john-doe]",
      "scope": "file",
      "message": "Human attempted to modify machine-generated file",
      "guard_source": "directory-level",
      "guard_pattern": "build/** @guard:human:n"
    }
  ],
  "summary": {
    "files_checked": 24,
    "violations_found": 2,
    "violators": ["ai[gpt-3.5]", "human[john-doe]"],
    "status": "FAILED"
  }
}
```

Permission reports should include details about the source of each permission:

```json
{
  "file": "src/core/security.py",
  "effective_permission": "@guard:ai:r",
  "permission_sources": [
    {
      "level": "repository",
      "file": "/.ai-attributes",
      "pattern": "**/*.py",
      "permission": "@guard:ai:w"
    },
    {
      "level": "directory",
      "file": "/src/.ai-attributes",
      "pattern": "**/*.py",
      "permission": "@guard:ai:w"
    },
    {
      "level": "directory",
      "file": "/src/core/.ai-attributes",
      "pattern": "*.py",
      "permission": "@guard:ai:r"
    }
  ],
  "file_level_guards": [
    {
      "line": 42,
      "scope": "function",
      "permission": "@guard:ai:r",
      "affected_lines": "42-67"
    }
  ]
}
```

Test coverage reports should also follow a structured format:

```json
{
  "overall_coverage": 87,
  "module_coverage": [
    {
      "module": "codeguard.core.parser",
      "coverage": 92,
      "untested_functions": [],
      "status": "PASS"
    },
    {
      "module": "codeguard.core.cli",
      "coverage": 78,
      "untested_functions": ["parse_args", "handle_error"],
      "status": "FAIL",
      "exemption": null
    },
    {
      "module": "codeguard.core.server",
      "coverage": 79,
      "untested_functions": ["start_async_server"],
      "status": "FAIL",
      "exemption": {
        "id": "EX-001",
        "approved_by": "Jane Smith",
        "approved_date": "2023-04-15",
        "expires": "2023-07-15",
        "reason": "Async testing framework pending implementation"
      }
    }
  ],
  "summary": {
    "modules_checked": 12,
    "modules_passed": 10,
    "modules_failed": 1,
    "modules_exempted": 1,
    "status": "PASSED_WITH_EXEMPTIONS"
  }
}
```

## Expected Features

1. **Automatic language detection** based on file extensions and content analysis
2. **Intelligent guard detection** in comments of various formats (line, block, docstring)
3. **Semantic scope analysis** using tree-sitter ASTs to identify functions, classes, blocks, etc.
4. **Region-aware analysis** to handle multi-line guarded sections
5. **Whitespace normalization** to prevent false positives from formatting changes
6. **Detailed violation reporting** with context about what changed
7. **CI/CD integration** options for automated verification
8. **Git hook support** to prevent commits that violate guards
9. **IDE plugins** (optional) for real-time feedback
10. **Comprehensive language support testing** to ensure correct detection and processing for all supported languages
11. **Module context management** to maintain sufficient knowledge for AI guardians
12. **Directory-level guard support** via `.ai-attributes` files
13. **Permission inheritance visualization** to understand how permissions are applied
14. **Pattern-based file matching** with wildcard support
15. **Rule conflict resolution** with clear precedence rules
16. **Permission source tracking** to identify where a permission originated
17. **Access control information retrieval** for quickly determining effective permissions for files and directories
18. **Flexible tag matching** to support case-insensitive and partial word matching for permissions (e.g., @guard:ai:r matches @guard:ai:read)
19. **Semantic scope processing** to protect logical code structures that survive reformatting
20. **Fallback scope detection** using heuristics when tree-sitter parsing fails
21. **Context file discovery** and management for LLM assistance
22. **Pathspec library integration** for robust pattern matching in `.ai-attributes` files
23. **Multi-target support** for both AI and human access controls
24. **Identifier-based permissions** allowing fine-grained control over specific AI models, human teams, or roles
25. **External identity provider integration** to determine current user/AI identity
26. **Group and capability-based access control** for flexible permission management
27. **Machine-managed file protection** preventing human modification of generated code

## Testing Requirements

1. **Test Organization**: 
   - Each module must have its own tests directory (e.g., /codeguard/core/tests)
   - Every Python file should have a corresponding test file (e.g., parser.py → test_parser.py)
   - Test files should follow a consistent naming convention (e.g., test_*.py)
   - A module may have a conftest.py file for shared fixtures, but actual tests must be in dedicated test files
   - Cross-module integration tests may reside in a separate /tests directory

2. **Coverage Requirements**:
   - Every function callable from outside its module must have unit tests
   - Tests should verify both normal operation and error handling
   - Aim for at least 85% code coverage across the codebase
   - ALL modules must individually meet the 85% coverage target
   - No modules may be excluded from coverage calculation
   - "Hard-to-test" components must have testing strategies documented
   - CLI interfaces must be tested using appropriate test frameworks and mocks
   - Coverage reports must clearly identify any modules below threshold

3. **Testing Framework**:
   - Use pytest as the primary testing framework
   - Leverage pytest fixtures for test setup and teardown (defined in conftest.py when shared across tests)
   - Create at least one test case for each code path of externally callable functions
   - Utilize parameterized tests for thorough validation
   - Aim for a 1:1 mapping between implementation files and test files

4. **Mocking Strategy**:
   - Use the unittest.mock library for mocking external dependencies
   - Create reusable mock fixtures for common dependencies
   - Properly verify mock interactions where appropriate

5. **Environmental Considerations**:
   - Tests must only run in test mode, never in production
   - Use environment variables or configuration flags to control test execution
   - Provide a mechanism to verify test environment before running tests

6. **Documentation**:
   - Include docstrings in test functions explaining test purpose
   - Document any non-obvious test setups or assertions
   - Provide examples of running tests in the project's README

7. **Test Execution and Verification**:
   - ALL tests must be executed before marking any implementation as complete
   - pytest must be properly installed in the development environment
   - A failing test is a failing implementation - no exceptions
   - Include test execution as a mandatory part of the development workflow
   - Test execution logs must be reviewed as part of code review
   - Document test failures in an understandable way that guides resolution
   - No tests may be skipped or marked as "too complex to test" without formal exemption
   - "Integration complexity" is not a valid reason to skip tests - complex integration points require MORE testing, not less

8. **Continuous Integration**:
   - Configure CI pipelines to automatically run tests on every push
   - Failing tests must block merges to protected branches
   - Test coverage reports must be generated and reviewed
   - Test metrics (execution time, coverage) should be tracked over time

9. **Directory-Level Guard Testing**:
   - Test pattern matching functionality with various wildcard patterns
   - Test directory tree traversal with nested `.ai-attributes` files
   - Test permission precedence rules with conflicting patterns
   - Test interaction between file-level and directory-level guards
   - Create test fixtures with complex directory structures
   - Ensure performance scales well with large directory structures

10. **Access Control Information Testing**:
    - Test ACL retrieval for files with various permission combinations
    - Test ACL retrieval for directories with mixed permission children
    - Test verbose output formatting and source tracking
    - Test performance of ACL queries on large directory trees
    - Verify that permission caching works correctly for repeated queries
    - Test flexible matching rules for permissions (case-insensitive, partial word matching for r/w/n)
    - Test semantic scope guards to ensure they protect the correct code structures

11. **Semantic Scope Testing**:
    - Test scope detection for all supported languages
    - Test nested scope handling (e.g., function within class)
    - Test compound scopes (e.g., `sig+doc`)
    - Test scope exclusion (e.g., `func-doc`)
    - Test fallback behavior when tree-sitter fails
    - Test edge cases like empty functions, single-line functions, etc.
    - Verify scope boundaries are correctly identified across different coding styles

12. **Context File Testing**:
    - Test context file identification and parsing
    - Test context inheritance with `[inherit=true]`
    - Test context priority levels
    - Test scoped context with `[for=...]` attributes
    - Test context file discovery across directory hierarchies
    - Verify `@guard:ai:context` implies read permission
    - Test pathspec pattern matching for context files

13. **Identifier and Multi-Target Testing**:
    - Test bracket notation parsing for specific AI models and human teams
    - Test wildcard behavior (`[*]` and no brackets being equivalent)
    - Test multiple identifier handling (`[claude-4,gpt-4]`)
    - Test precedence when specific and wildcard rules conflict
    - Test multi-target guards (`@guard:ai[claude-4]:w,human[security-team]:w`)
    - Test group resolution and external identity provider integration
    - Test backwards compatibility with existing guards
    - Test human-specific guards (`@guard:human:n` for generated files)
    - Test permission resolution for various identifier combinations
    - Test case-insensitive matching for all components:
      - Verify `@GUARD:AI:R` = `@guard:ai:r` = `@Guard:Ai:Read`
      - Verify `[Claude-4]` = `[claude-4]` = `[CLAUDE-4]`
      - Verify `.FUNC` = `.func` = `.Function`
      - Verify `[Priority=HIGH]` = `[priority=high]`

## Definition of Done

Before any implementation is considered complete, it must meet ALL of the following criteria:

1. **Code Completeness**:
   - All required functionality is implemented
   - All edge cases are handled
   - Error handling is comprehensive
   - Logging is appropriate and useful

2. **Documentation**:
   - Inline code documentation is complete
   - MODULE_CONTEXT.md is updated to reflect any changes
   - API documentation is thorough and accurate
   - User documentation is clear and complete
   - Examples are provided for all major functionality

3. **Testing**:
   - All tests have been written for new code
   - All tests are passing with no failures or errors
   - Test coverage meets or exceeds the 85% threshold
   - Test execution logs and coverage reports have been reviewed
   - All testing dependencies are properly installed and configured
   - Each module has explicitly met the coverage threshold with NO exceptions
   - Any test coverage exemptions have been formally documented and approved
   - No modules have been silently excluded from test coverage reports
   - CLI interfaces and complex components have adequate test coverage