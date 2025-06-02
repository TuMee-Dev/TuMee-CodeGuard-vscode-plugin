// Debug script to test theme loading
const fs = require('fs');
const path = require('path');

// Load theme configuration directly from JSON file
function loadThemeConfiguration() {
  try {
    const themesPath = path.join(__dirname, 'resources', 'themes.json');
    const themesData = fs.readFileSync(themesPath, 'utf8');
    return JSON.parse(themesData);
  } catch (error) {
    console.error('Failed to load themes configuration:', error);
    return { version: '1.0.0', themes: {} };
  }
}

function getColorThemes() {
  const config = loadThemeConfiguration();
  const resolvedThemes = {};
  
  for (const [themeId, theme] of Object.entries(config.themes)) {
    resolvedThemes[themeId] = theme;
  }
  
  return resolvedThemes;
}

// Test the theme loading
const COLOR_THEMES = getColorThemes();
console.log('COLOR_THEMES keys:', Object.keys(COLOR_THEMES));
console.log('default theme exists:', Boolean(COLOR_THEMES['default']));
console.log('default theme name:', COLOR_THEMES['default'] ? COLOR_THEMES['default'].name : 'undefined');

// Test the logic from the initialization
const selectedTheme = 'default';
const isSystemTheme = !!COLOR_THEMES[selectedTheme];
console.log('selectedTheme:', selectedTheme);
console.log('isSystemTheme:', isSystemTheme);