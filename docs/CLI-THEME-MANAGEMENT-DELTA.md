# CodeGuard CLI Theme Management - Delta Specification

## Overview

This document specifies the theme management commands to be added to the CodeGuard CLI Worker Mode. These commands enable the CLI to be the authoritative source for theme data, replacing VSCode configuration-based theme storage.

## New Commands

### 1. Get All Themes

Retrieves all available themes (built-in and custom).

**Request:**

```json
{
  "id": "themes-1",
  "command": "getThemes"
}
```

**Response:**

```json
{
  "id": "themes-1",
  "status": "success",
  "result": {
    "builtIn": {
      "light": {
        "name": "Light Theme",
        "colors": {
          "permissions": {
            "aiWrite": {"enabled": true, "color": "#FFA500", "transparency": 0.2},
            "aiRead": {"enabled": true, "color": "#808080", "transparency": 0.15},
            "aiNoAccess": {"enabled": true, "color": "#90EE90", "transparency": 0.2},
            "humanWrite": {"enabled": false, "color": "#0000FF", "transparency": 0.2},
            "humanRead": {"enabled": true, "color": "#D3D3D3", "transparency": 0.3},
            "humanNoAccess": {"enabled": true, "color": "#FF0000", "transparency": 0.25},
            "contextRead": {"enabled": true, "color": "#00CED1", "transparency": 0.15},
            "contextWrite": {"enabled": true, "color": "#1E90FF", "transparency": 0.15}
          },
          "borderBarEnabled": true,
          "highlightEntireLine": false,
          "mixPattern": "aiBorder"
        }
      },
      "dark": {
        "name": "Dark Theme",
        "colors": { /* ... similar structure ... */ }
      }
    },
    "custom": {
      "mytheme": {
        "name": "My Custom Theme",
        "colors": { /* ... GuardColors structure ... */ }
      }
    }
  }
}
```

### 2. Create Theme

Creates a new custom theme.

**Request:**

```json
{
  "id": "create-theme-1",
  "command": "createTheme",
  "payload": {
    "name": "My New Theme",
    "colors": {
      "permissions": {
        "aiWrite": {"enabled": true, "color": "#FF6B6B", "transparency": 0.3},
        "aiRead": {"enabled": true, "color": "#4ECDC4", "transparency": 0.2},
        "aiNoAccess": {"enabled": true, "color": "#45B7D1", "transparency": 0.25},
        "humanWrite": {"enabled": true, "color": "#96CEB4", "transparency": 0.2},
        "humanRead": {"enabled": true, "color": "#FCEA2B", "transparency": 0.15},
        "humanNoAccess": {"enabled": true, "color": "#FF9F43", "transparency": 0.3},
        "contextRead": {"enabled": true, "color": "#A55EEA", "transparency": 0.2},
        "contextWrite": {"enabled": true, "color": "#26C281", "transparency": 0.2}
      },
      "borderBarEnabled": true,
      "highlightEntireLine": false,
      "mixPattern": "average"
    }
  }
}
```

**Response:**

```json
{
  "id": "create-theme-1",
  "status": "success",
  "result": {
    "themeId": "mynewtheme",
    "message": "Theme 'My New Theme' created successfully"
  }
}
```

### 3. Update Theme

Updates an existing custom theme.

**Request:**
```json
{
  "id": "update-theme-1",
  "command": "updateTheme",
  "payload": {
    "themeId": "mynewtheme",
    "name": "My Updated Theme",
    "colors": {
      /* ... complete GuardColors structure ... */
    }
  }
}
```

**Response:**
```json
{
  "id": "update-theme-1",
  "status": "success",
  "result": {
    "message": "Theme 'My Updated Theme' updated successfully"
  }
}
```

### 4. Delete Theme

Deletes a custom theme.

**Request:**
```json
{
  "id": "delete-theme-1",
  "command": "deleteTheme",
  "payload": {
    "themeId": "mynewtheme"
  }
}
```

**Response:**
```json
{
  "id": "delete-theme-1",
  "status": "success",
  "result": {
    "message": "Theme 'My New Theme' deleted successfully"
  }
}
```

### 5. Export Theme

Exports a theme as JSON for sharing.

**Request:**
```json
{
  "id": "export-theme-1",
  "command": "exportTheme",
  "payload": {
    "themeId": "mytheme"
  }
}
```

**Response:**
```json
{
  "id": "export-theme-1",
  "status": "success",
  "result": {
    "name": "My Custom Theme",
    "exportData": {
      "name": "My Custom Theme",
      "colors": {
        /* ... complete GuardColors structure ... */
      },
      "exportedAt": "2025-01-26T10:30:00Z",
      "version": "1.3.5"
    }
  }
}
```

### 6. Import Theme

Imports a theme from JSON data.

**Request:**
```json
{
  "id": "import-theme-1",
  "command": "importTheme",
  "payload": {
    "exportData": {
      "name": "Imported Theme",
      "colors": {
        /* ... complete GuardColors structure ... */
      },
      "exportedAt": "2025-01-26T10:30:00Z",
      "version": "1.3.5"
    }
  }
}
```

**Response:**
```json
{
  "id": "import-theme-1",
  "status": "success",
  "result": {
    "themeId": "importedtheme",
    "message": "Theme 'Imported Theme' imported successfully"
  }
}
```

### 7. Get Current Theme

Gets the currently selected theme configuration.

**Request:**
```json
{
  "id": "current-theme-1",
  "command": "getCurrentTheme"
}
```

**Response:**
```json
{
  "id": "current-theme-1",
  "status": "success",
  "result": {
    "selectedTheme": "mytheme",
    "isBuiltIn": false,
    "colors": {
      /* ... complete GuardColors structure ... */
    }
  }
}
```

### 8. Set Current Theme

Sets the currently active theme.

**Request:**
```json
{
  "id": "set-theme-1",
  "command": "setCurrentTheme",
  "payload": {
    "themeId": "dark"
  }
}
```

**Response:**
```json
{
  "id": "set-theme-1",
  "status": "success",
  "result": {
    "message": "Theme 'Dark Theme' selected successfully",
    "colors": {
      /* ... complete GuardColors structure for selected theme ... */
    }
  }
}
```

## Data Structures

### GuardColors
```typescript
interface GuardColors {
  permissions: {
    aiWrite: PermissionColorConfig;
    aiRead: PermissionColorConfig;
    aiNoAccess: PermissionColorConfig;
    humanWrite: PermissionColorConfig;
    humanRead: PermissionColorConfig;
    humanNoAccess: PermissionColorConfig;
    contextRead: PermissionColorConfig;
    contextWrite: PermissionColorConfig;
  };
  borderBarEnabled: boolean;
  highlightEntireLine?: boolean;
  mixPattern?: "aiBorder" | "aiPriority" | "average" | "humanBorder" | "humanPriority";
  combinations?: {
    [key: string]: string;  // e.g., "aiRead_humanWrite": "#FF0000"
  };
}
```

### PermissionColorConfig
```typescript
interface PermissionColorConfig {
  enabled: boolean;
  color: string;                 // Hex color code
  transparency: number;          // 0.0 to 1.0
  borderOpacity?: number;        // 0.0 to 1.0
  minimapColor?: string;         // Optional custom minimap color
  highlightEntireLine?: boolean; // Override global setting per permission
}
```

### ThemeExportData
```typescript
interface ThemeExportData {
  name: string;
  colors: GuardColors;
  exportedAt: string;           // ISO 8601 timestamp
  version: string;              // CLI version that exported it
}
```

## Error Codes

Additional error codes for theme management:

- `THEME_NOT_FOUND`: Specified theme does not exist
- `THEME_ALREADY_EXISTS`: Theme with that name already exists
- `INVALID_THEME_DATA`: Theme data structure is invalid
- `BUILTIN_THEME_READONLY`: Cannot modify or delete built-in themes
- `INVALID_EXPORT_DATA`: Import data is malformed or incompatible

## Storage Requirements

The CLI must maintain theme data persistently, separate from the VSCode configuration:

1. **Built-in themes**: Read from `resources/themes.json` 
2. **Custom themes**: Store in CLI configuration directory (e.g., `~/.config/codeguard/themes.json`)
3. **Current selection**: Store in CLI configuration (e.g., `~/.config/codeguard/config.json`)

## Migration Considerations

For existing VSCode users with custom themes:

1. VSCode plugin should detect existing custom themes in configuration
2. Migrate them to CLI storage via `createTheme` commands during first launch
3. Clear VSCode configuration after successful migration
4. Provide fallback if CLI is unavailable (read-only mode using existing config)

## Validation

All theme operations must validate:

1. **Color format**: Valid hex colors (#RRGGBB or #RGB)
2. **Transparency values**: Between 0.0 and 1.0
3. **Required permissions**: All 8 permission types must be present
4. **Mix pattern**: Must be one of the valid enum values
5. **Theme names**: Non-empty, reasonable length limits

## Performance

- Theme operations should complete within 100ms
- Theme data should be cached in memory after first load
- Only write to disk when themes are modified
- Built-in themes are read-only and can be heavily cached