// Main utils re-exports for backward compatibility
// Core utilities (fs, cleanPath, etc.)
export * from './core/index';

// Configuration 
export * from './config/configurationManager';
export * from './config/configValidator';
export * from './config/config';
export * from './config/acl';

// CLI
export * from './cli/cliWorker';
export * from './cli/documentStateManager';

// Cache
export * from './cache/regexCache';
export * from './cache/aclCache';
// Remove guardCache direct export to avoid conflicts with guardProcessor
// export * from './cache/guardCache';
// Use guardProcessor as the main export point for guard functions
export * from './cache/guardProcessor';

// Rendering
export * from './rendering/colorUtils';
export * from './rendering/colorRenderingEngine';
export * from './rendering/decorationTypeFactory';
export * from './rendering/mixPatternLogic';
export * from './rendering/mixPatternRenderer';
export * from './rendering/themeLoader';
export * from './rendering/templateLoader';

// Error Handling  
export * from './error/errorHandler';

// Performance
export * from './performance/performanceMonitor';
export * from './performance/backgroundProcessor';

// UI
export * from './ui/debugLogger';
export * from './ui/statusBar';

// Core (fs already exported by core/index)
export * from './core/languageScopeLoader';