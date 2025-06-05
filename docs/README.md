# TuMee CodeGuard VSCode Extension

## What is CodeGuard?

CodeGuard is a revolutionary code access control system that enables **precise AI-human collaboration** in software development. It allows developers to mark specific code regions with permissions, controlling exactly what AI assistants can read, write, or access.

### The Problem

In modern AI-assisted development:
- **AI assistants** need access to code context but shouldn't modify critical sections
- **Human developers** want to maintain control over sensitive or complex code
- **Collaboration** between AI and humans often lacks clear boundaries
- **Code safety** requires granular access control, not just file-level permissions

### The Solution

CodeGuard introduces **guard tags** - special comments that define AI/human access permissions at the code block level:

```javascript
// @guard:ai:r,human:w - AI can read, humans can write
function criticalSecurityFunction() {
    // @guard:ai:n - AI has no access to this block
    const apiKey = process.env.SECRET_KEY;
    return authenticateUser(apiKey);
}

// @guard:ai:w - AI can freely modify this utility function
function formatDate(date) {
    return date.toISOString();
}
```

## Core Features

### 1. 🛡️ Guard Tag System

**What it does**: Provides granular access control for AI assistants and human developers.

**How it works**:
- **Syntax**: `@guard:actor:permission` where actor is `ai` or `human`, permission is `r` (read), `w` (write), or `n` (no access)
- **Scope**: Works at file level and code block level
- **Intelligence**: Automatically detects code block boundaries using tree-sitter parsing
- **Visual Feedback**: Real-time color coding shows permission levels

**Example Use Cases**:
- **Security Code**: `@guard:ai:n` - Keep AI away from authentication logic
- **AI Playground**: `@guard:ai:w` - Let AI freely experiment with utility functions  
- **Human Review Required**: `@guard:ai:r,human:w` - AI can read for context but humans must make changes
- **Legacy Code**: `@guard:ai:r` - AI can understand but shouldn't modify stable code

**Supported Languages**: JavaScript, TypeScript, Python, Java, C++, Rust, Go, and more (with automatic fallback for unsupported languages)

### 2. 🎨 Visual Code Highlighting

**What it does**: Provides instant visual feedback about code permissions.

**How it works**:
- **Background Colors**: Different colors for different permission combinations
- **Opacity Levels**: Subtle visual cues that don't interfere with reading
- **Borders**: Special indicators for mixed permissions
- **Real-time Updates**: Changes appear immediately as you type

**Permission Color Coding**:
- 🟢 **Green**: Human-only access (`@guard:ai:n`)
- 🔴 **Red**: AI write access (`@guard:ai:w`)  
- 🟣 **Purple**: Human read-only (`@guard:human:r`)
- 🟠 **Orange**: Human no access (`@guard:human:n`)
- 🔵 **Blue**: Mixed permissions
- 🔷 **Cyan**: Context information

### 3. 📁 File & Folder Customization

**What it does**: Extends access control to entire files and folders with visual customization.

**Features**:
- **Custom Colors**: Set colors for files/folders based on ACL rules
- **Badges**: Add text or emoji badges to indicate file purposes
- **Tooltips**: Custom hover information for quick context
- **Right-click Integration**: Easy access through context menus

**Use Cases**:
- Mark AI-safe utility folders with green colors
- Badge critical system files with ⚠️ warnings
- Color-code feature branches by development status
- Add tooltips explaining file purposes to team members

### 4. 🤖 Intelligent Gitignore Management

**What it does**: Provides smart .gitignore editing with workspace awareness.

**Features**:
- **Smart Autocomplete**: Type `.vscode/t` and get `test.out` suggestions based on actual files
- **Pattern Intelligence**: Type `*.l` and see `*.log`, `*.lock` patterns from your workspace
- **Context Awareness**: Suggestions based on detected project type (Node.js, Python, Rust, etc.)
- **Template Generation**: Create project-specific .gitignore files automatically

**How it works**:
1. **Workspace Analysis**: Scans your project files and structure
2. **Pattern Matching**: Suggests patterns based on existing files
3. **Common Patterns**: Includes standard patterns for detected frameworks
4. **Real-time Suggestions**: Updates as you type in .gitignore files

### 5. ⚡ CLI Integration

**What it does**: Connects to a powerful CLI tool for advanced processing and analysis.

**Features**:
- **Real-time Parsing**: Guard tags processed instantly using tree-sitter
- **Persistent Connection**: Maintains RPC connection for fast responses
- **Background Processing**: Large files processed efficiently in chunks
- **Intelligent Caching**: Results cached for performance with smart invalidation

**Architecture**:
- **JSON-RPC Protocol**: Robust communication over stdin/stdout
- **Automatic Recovery**: CLI restarts automatically if it crashes
- **Proper Disabling**: Extension politely disables features when CLI unavailable
- **Performance Optimized**: Debouncing, caching, and chunked processing

## Real-World Usage Examples

### Example 1: Secure API Development

```javascript
// @guard:ai:r,human:w - AI can understand the API structure but humans control changes
class AuthenticationAPI {
    // @guard:ai:n - Critical security logic - AI cannot access
    private validateApiKey(key: string): boolean {
        return crypto.timingSafeEqual(
            Buffer.from(key), 
            Buffer.from(process.env.MASTER_API_KEY)
        );
    }
    
    // @guard:ai:w - AI can freely improve error handling and validation
    public validateRequest(req: Request): ValidationResult {
        if (!req.headers.authorization) {
            return { valid: false, error: 'Missing authorization header' };
        }
        // AI can enhance this validation logic
        return { valid: true };
    }
}
```

### Example 2: Team Collaboration

```python
# @guard:ai:r - AI can read for context but shouldn't modify legacy code
def legacy_data_processor(data):
    """Legacy function - stable, don't change without team review"""
    return complex_legacy_logic(data)

# @guard:ai:w - AI playground area - experiment freely
def new_data_validator(data):
    """New function - AI can improve and optimize"""
    # AI: feel free to enhance validation logic here
    return True

# @guard:human:w,ai:r - Humans handle business logic, AI provides context
def calculate_pricing(customer_tier, usage):
    """Business-critical pricing - requires human oversight"""
    # Pricing logic requires business domain knowledge
    pass
```

### Example 3: Learning and Experimentation

```rust
// @guard:ai:r - AI can study this pattern but shouldn't modify working code
fn proven_algorithm(input: &[i32]) -> Vec<i32> {
    // Battle-tested sorting implementation
    input.iter().cloned().collect()
}

// @guard:ai:w - AI sandbox for optimization experiments
fn experimental_algorithm(input: &[i32]) -> Vec<i32> {
    // AI: try different sorting approaches here
    // Feel free to experiment with performance optimizations
    input.to_vec()
}
```

## Installation and Setup

### Prerequisites
- **VS Code**: Version 1.100.0 or higher
- **CodeGuard CLI**: Version 0.4.0 or higher (**required** for functionality)
- **Node.js**: 16.x or higher (for development)

### Installation Steps

1. **Install the Extension**:
   ```bash
   code --install-extension tumee-vscode-plugin-1.6.2.vsix
   ```

2. **Install CodeGuard CLI** (optional but recommended):
   ```bash
   # Installation method depends on your system
   # See CLI documentation for specific instructions
   ```

3. **Configure CLI Path** (if not in PATH):
   - Open VS Code Settings
   - Search for "TuMee"
   - Set "ACL CLI Path" to your CodeGuard CLI location

### Quick Start Guide

1. **Add Your First Guard Tag**:
   ```javascript
   // @guard:ai:r - Add this comment above any function
   function myFunction() {
       console.log("AI can read this but won't modify it");
   }
   ```

2. **See the Visual Feedback**:
   - The code block should now have a colored background
   - The color indicates the permission level

3. **Try File Customization**:
   - Right-click any file in the Explorer
   - Select "TuMee Customization" 
   - Choose "Set as AI-Editable" or "Set as Human-Only"

4. **Test Gitignore Intelligence**:
   - Open or create a `.gitignore` file
   - Start typing a file path and see intelligent suggestions

## Configuration Options

### Extension Settings

Access via: `File > Preferences > Settings > Extensions > TuMee`

- **ACL CLI Path**: Path to CodeGuard CLI executable
- **Code Region Opacity**: Visual opacity for highlighted regions (0.0-1.0)
- **Decoration Update Delay**: Debounce delay for real-time updates (100-1000ms)
- **Max File Size**: Maximum file size for decoration processing (100KB-10MB)
- **Enable Debug Logging**: Verbose logging for troubleshooting

### Theme Customization

- **Built-in Themes**: Several pre-configured color schemes
- **Custom Themes**: Create and save your own color combinations
- **Import/Export**: Share themes with team members
- **Real-time Preview**: See changes instantly as you customize

### Performance Tuning

For large projects:
- **Chunked Processing**: Enable for files >10,000 lines
- **Performance Monitoring**: Track processing times
- **Cache Management**: Automatic cache invalidation and cleanup

## Integration with AI Tools

### Supported AI Assistants

CodeGuard is designed to work with:
- **Claude**: Respects guard tags in code context
- **GitHub Copilot**: Enhanced with permission awareness
- **ChatGPT**: Understands access control when viewing code
- **Custom AI Tools**: API available for integration

### Best Practices for AI Collaboration

1. **Start Permissive**: Begin with `@guard:ai:w` for experimental code
2. **Secure Critical Paths**: Use `@guard:ai:n` for security, authentication, payments
3. **Enable Context**: Use `@guard:ai:r` to provide context without allowing changes
4. **Review Boundaries**: Regularly review and adjust permissions as code matures
5. **Team Standards**: Establish team conventions for guard tag usage

## Troubleshooting

### Common Issues

**Extension not highlighting code**:
- Check if CodeGuard CLI is installed and configured
- Verify CLI path in settings
- Check output panel for error messages

**Slow performance on large files**:
- Enable chunked processing in settings
- Increase decoration update delay
- Consider excluding very large files

**Gitignore autocomplete not working**:
- Ensure you're editing a `.gitignore` file
- Check if workspace analysis is enabled
- Verify CLI connection status

### Getting Help

- **Output Panel**: View "CodeGuard" channel for diagnostic information
- **Debug Logging**: Enable in settings for detailed troubleshooting
- **Performance Report**: Use "Show Performance Report" command
- **GitHub Issues**: Report bugs and request features

## Architecture Overview

### System Components
- **VSCode Extension**: User interface and decoration management
- **CodeGuard CLI**: Core parsing and analysis engine  
- **RPC Protocol**: JSON-RPC communication over stdin/stdout
- **Tree-sitter**: Language-aware code parsing
- **Caching Layer**: Performance optimization with intelligent invalidation

## Documentation Structure

```
docs/
├── README.md                 # This overview (human-readable)
├── ai-context.md             # AI assistant context and guidelines  
├── api/                      # Current API specifications
│   ├── specification.md      # Core system specification
│   └── mission.md            # Project mission and goals
├── completed/                # Implemented features and specs
│   ├── rpc-gitignore-*.md    # Gitignore RPC API specifications
│   ├── CLI-*.md              # CLI integration specifications
│   └── guard-tag-*.md        # Guard tag implementation details
└── futures/                  # Planned features and ideas
    ├── specification_extend_1.md  # Future enhancements
    └── prior/                # Historical development docs
```

## Quick Start

1. **Install Extension**: `code --install-extension tumee-vscode-plugin-1.6.2.vsix`
2. **Install CLI**: Requires CodeGuard CLI for full functionality
3. **Configure**: Set CLI path in extension settings
4. **Use**: Add guard tags to code, customize files, edit .gitignore

## Key Files
- **Extension Entry**: `src/extension.ts`
- **CLI Integration**: `src/utils/cli/`
- **Guard Processing**: `src/utils/rendering/`
- **Gitignore**: `src/tools/gitignore/`

## Development
- **Compile**: `npm run compile`
- **Test**: `npm run test`
- **Package**: `vsce package`
- **Lint**: `npm run lint`

See `completed/` folder for detailed implementation documentation.