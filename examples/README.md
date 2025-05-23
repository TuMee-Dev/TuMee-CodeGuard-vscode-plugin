# TuMee VSCode Plugin Examples

This directory contains example files demonstrating the use of guard tags to control AI access to different parts of your code.

## Guard Tag Colors

The extension uses the following color scheme to highlight different permission levels:

- **🟡 Yellow/Amber** - AI Write Access (`@guard:ai:w`)
- **🟢 Light Green** - AI No Access (`@guard:ai:n` or `@guard:human:w`)
- **⚪ Light Grey** - Human Read-Only (`@guard:human:r`)
- **🔴 Red** - Human No Access (`@guard:human:n`)
- **🔵 Light Blue/Cyan** - AI Context (`@guard:ai:context`)
- **✅ Default** - Human Write Access (no highlighting, default permission)

## API Key Manager Example

The API Key Manager example demonstrates a real-world use case for guard tags: protecting sensitive API keys while allowing AI to help with the application structure.

### Available Implementations

- **JavaScript** (`api-key-manager.js`) - Node.js implementation
- **Python** (`api-key-manager.py`) - Python 3.6+ implementation  
- **TypeScript** (`api-key-manager.ts`) - TypeScript implementation

### Key Features Demonstrated

1. **AI Write Access** (Yellow/Amber)
   - Configuration objects
   - Validation functions
   - Error handling classes
   - Main business logic (encryption, storage, retrieval)

2. **AI No Access** (Light Green)
   - Production API keys and credentials
   - Sensitive configuration values
   - Database connection strings

3. **AI Context** (Light Blue/Cyan)
   - Design requirements and specifications
   - Implementation notes for AI assistance
   - Security considerations

4. **Human Read-Only** (Light Grey)
   - Usage examples
   - Demonstration code
   - Output logs

### Guard Tag Patterns

```javascript
// @guard:ai:w
// AI can modify this code
class APIKeyManager {
  // Implementation...
}
// @guard:ai:w:end

// @guard:ai:n
// AI cannot see this section
const PRODUCTION_KEYS = {
  // Sensitive data...
};
// @guard:ai:n:end

// @guard:ai:context
// Context for AI: Requirements and specifications
// @guard:ai:context:end

// @guard:human:r
// Human can read but not modify via AI
const example = new APIKeyManager();
// @guard:human:r:end
```

### Running the Examples

#### JavaScript
```bash
node api-key-manager.js
```

#### Python
```bash
python api-key-manager.py
```

#### TypeScript
```bash
# First compile
npx tsc api-key-manager.ts

# Then run
node api-key-manager.js
```

## Other Example Ideas

Here are additional examples that could be implemented:

1. **User Profile Manager** - Protect PII while AI helps with data validation
2. **Configuration Validator** - AI helps with validation logic, not production configs
3. **Password Generator** - AI helps with algorithms, not generated passwords
4. **Audit Logger** - AI helps with framework, sensitive logs are protected
5. **Payment Processor** - AI helps with flow, not actual card processing

## Best Practices

1. **Use clear boundaries** - Place guard tags at logical boundaries in your code
2. **Provide context** - Use `@guard:ai:context` to give AI helpful information
3. **Protect sensitive data** - Always use `@guard:ai:n` for credentials, keys, and PII
4. **Allow AI to help** - Use `@guard:ai:w` for non-sensitive business logic
5. **Document usage** - Use `@guard:human:r` for examples that shouldn't be modified