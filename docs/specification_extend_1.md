# Visual Studio Plugin - Validation Mode Specification

## Context for AI/LLM Implementation

This specification describes a **validation testing mode** that the Visual Studio plugin should implement. This is NOT part of the normal user workflow. Instead, this is a debugging/testing feature that:

1. **Purpose**: Ensures the Visual Studio plugin and the CodeGuard command-line tool parse guard regions identically
2. **When Used**: During development, testing, or when debugging parsing inconsistencies
3. **How It Works**: 
   - The plugin generates a JSON package containing its understanding of all guard regions in a file
   - The plugin calls the CodeGuard command-line tool with this JSON package
   - The tool independently parses the same file and compares results
   - Any differences are reported back to help identify parsing inconsistencies
4. **Not For**: Regular users during normal code editing - this is a developer/testing feature

The plugin will call the command-line tool's `validate-sections` command to perform this validation. The tool will return detailed information about any parsing differences.

**Important**: Guards create overlapping protection layers, not sequential non-overlapping sections. A single line of code can be covered by multiple guard annotations with different targets, permissions, and scopes.

## Overview

This specification defines how the Visual Studio plugin should implement validation mode to verify its guard region parsing matches the CodeGuard command-line tool. This is a testing/debugging feature to ensure consistency between the plugin and tool.

## Guard Semantics

The plugin must understand that guards work as overlapping layers:
- Each guard applies from its declaration point to the end of its scope
- Multiple guards can apply to the same code region
- Guards with different targets (ai/human) create independent layers
- More specific guards can override or complement broader guards

Example:
```python
# @guard:ai:r          # AI can read from here onwards
def func1():
    pass

# @guard:human:w       # Humans can write from here (AI still has read)
def func2():
    pass

# @guard:all:n         # Nobody can modify from here (overrides previous)
def func3():
    pass
```

## Validation Features

### Triggering Validation Mode

The validation mode should be triggered through:

1. **Developer Menu**: Add a menu item under `Tools > CodeGuard > Developer Tools > Validate Parsing`
2. **Command Palette**: Add command `CodeGuard: Validate Section Parsing`
3. **Keyboard Shortcut**: Optional binding (e.g., `Ctrl+Shift+Alt+V`)
4. **Context Menu**: Right-click in editor → `CodeGuard Developer > Validate Parsing`

**Important**: This should NEVER run automatically during normal editing operations. It's only for:
- Plugin developers testing their parsing implementation
- Debugging reported parsing inconsistencies
- Quality assurance testing
- Troubleshooting user-reported issues

### 1. Validation Package Generation

The plugin must generate a complete guard region map that shows all overlapping layers.

#### JSON Package Structure

```json
{
  "validation_request": {
    "file_path": "/absolute/path/to/file.py",
    "file_hash": "sha256_of_file_content",
    "total_lines": 150,
    "timestamp": "2024-01-15T10:30:00Z",
    "plugin_version": "1.0.0",
    "plugin_name": "CodeGuard for Visual Studio",
    "guard_regions": [
      {
        "index": 0,
        "guard": "@guard:ai:r",
        "parsed_guard": {
          "raw": "@guard:ai:r",
          "target": "ai",
          "identifiers": ["*"],
          "permission": "read-only",
          "scope": "file",
          "scope_modifiers": []
        },
        "declaration_line": 1,
        "start_line": 2,
        "end_line": 150,
        "content_hash": "sha256_of_region_content",
        "content_preview": "def calculate_payment(amount: float..."
      },
      {
        "index": 1,
        "guard": "@guard:human:w",
        "parsed_guard": {
          "raw": "@guard:human:w",
          "target": "human",
          "identifiers": ["*"],
          "permission": "write",
          "scope": "file",
          "scope_modifiers": []
        },
        "declaration_line": 25,
        "start_line": 26,
        "end_line": 150
      },
      {
        "index": 2,
        "guard": "@guard:all:n.function",
        "parsed_guard": {
          "raw": "@guard:all:n.function",
          "target": "all",
          "identifiers": ["*"],
          "permission": "none",
          "scope": "function",
          "scope_modifiers": []
        },
        "declaration_line": 45,
        "start_line": 46,
        "end_line": 55
      }
    ],
    "line_coverage": [
      {
        "line": 1,
        "guards": []
      },
      {
        "line": 2,
        "guards": [0]
      },
      {
        "line": 26,
        "guards": [0, 1]
      },
      {
        "line": 46,
        "guards": [0, 1, 2]
      }
    ],
    "validation_metadata": {
      "parser_used": "tree-sitter",
      "language": "python",
      "encoding": "utf-8",
      "supports_overlapping": true
    }
  }
}
```

#### Package Requirements

1. **Complete Guard Mapping**: Every guard region with its boundaries
2. **Overlapping Support**: Multiple guards can cover the same lines
3. **Line Coverage**: Optional but recommended - which guards apply to each line
4. **Content Hashes**: Include SHA-256 for verification
5. **Declaration Tracking**: Track where each guard was declared

### 2. Expected Return Values

The plugin must handle all possible exit codes and status values from the tool.

#### Exit Codes

```csharp
public enum ValidationExitCode
{
    Success = 0,                    // Perfect match
    ValidationMismatch = 1,         // Differences found
    ParsingError = 2,              // Tool couldn't parse file
    JsonError = 3,                 // Invalid JSON sent
    FileNotFound = 4,              // Source file not found
    FileChanged = 5,               // File modified since parse
    VersionIncompatible = 6,       // Version mismatch
    InternalError = 7              // Unexpected error
}
```

#### Status Values

```csharp
public enum ValidationStatus
{
    Match,                         // "MATCH"
    Mismatch,                     // "MISMATCH"
    ErrorParsing,                 // "ERROR_PARSING"
    ErrorJson,                    // "ERROR_JSON"
    ErrorFileNotFound,            // "ERROR_FILE_NOT_FOUND"
    ErrorFileChanged,             // "ERROR_FILE_CHANGED"
    ErrorVersion,                 // "ERROR_VERSION"
    ErrorInternal                 // "ERROR_INTERNAL"
}
```

#### Discrepancy Types

```csharp
public enum DiscrepancyType
{
    BoundaryMismatch,             // Guard region boundaries differ
    GuardMissing,                 // Plugin has guard, tool doesn't
    GuardExtra,                   // Tool has guard, plugin doesn't
    GuardInterpretation,          // Same guard, different parse
    PermissionMismatch,           // Different permissions
    ScopeMismatch,                // Different scope interpretation
    TargetMismatch,               // Different target (ai/human)
    IdentifierMismatch,           // Different identifier parsing
    LayerMismatch,                // Different overlapping guards at line
    EffectivePermissionMismatch,  // Different effective permissions
    ScopeBoundaryMismatch,        // Guard scope ends at different line
    InheritanceMismatch,          // Different guard inheritance
    OverrideMismatch,             // Different interpretation of overrides
    ContentHashMismatch,          // Content changed
    LineCountMismatch             // File size changed
}
```

### 3. Implementation

#### Core Validation Method

```csharp
public class ValidationResult
{
    public ValidationStatus Status { get; set; }
    public int ExitCode { get; set; }
    public string FilePath { get; set; }
    public DateTime Timestamp { get; set; }
    public string ToolVersion { get; set; }
    public string PluginVersion { get; set; }
    public List<Discrepancy> Discrepancies { get; set; }
    public ValidationStatistics Statistics { get; set; }
    public ErrorDetails ErrorDetails { get; set; }
}

public class Discrepancy
{
    public string Type { get; set; }
    public string Severity { get; set; }  // "ERROR" or "WARNING"
    public int? Line { get; set; }
    public int? GuardIndex { get; set; }
    public object PluginRegion { get; set; }
    public object ToolRegion { get; set; }
    public List<GuardReference> PluginGuards { get; set; }
    public List<GuardReference> ToolGuards { get; set; }
    public string Message { get; set; }
}

public class ValidationStatistics
{
    public int TotalLines { get; set; }
    public int PluginGuardRegions { get; set; }
    public int ToolGuardRegions { get; set; }
    public int MatchingRegions { get; set; }
    public int MaxOverlappingGuards { get; set; }
    public int LinesWithMultipleGuards { get; set; }
    public int DiscrepancyCount { get; set; }
    public int AffectedLines { get; set; }
}

public async Task<ValidationResult> ValidateGuardSections(string filePath)
{
    string tempFile = null;
    
    try
    {
        // Step 1: Generate validation package
        var guardRegions = await ParseFileGuardRegions(filePath);
        var lineCoverage = ComputeLineCoverage(guardRegions, GetFileLineCount(filePath));
        var validationPackage = BuildValidationPackage(filePath, guardRegions, lineCoverage);
        
        // Step 2: Save to temp file
        var jsonPayload = JsonSerializer.Serialize(validationPackage, new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
        
        tempFile = Path.GetTempFileName();
        await File.WriteAllTextAsync(tempFile, jsonPayload);
        
        // Step 3: Execute validation command
        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = GetCodeGuardExecutablePath(),
                Arguments = $"validate-sections --json-file \"{tempFile}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };
        
        process.Start();
        
        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();
        
        await process.WaitForExitAsync();
        
        var output = await outputTask;
        var error = await errorTask;
        
        // Step 4: Handle exit codes
        return await HandleValidationResponse(process.ExitCode, output, error);
    }
    catch (Exception ex)
    {
        await LogError($"Validation failed: {ex.Message}");
        throw new ValidationException("Failed to validate guard sections", ex);
    }
    finally
    {
        // Cleanup
        if (tempFile != null && File.Exists(tempFile))
        {
            try { File.Delete(tempFile); } catch { }
        }
    }
}

private List<LineCoverage> ComputeLineCoverage(List<GuardRegion> regions, int totalLines)
{
    var coverage = new List<LineCoverage>();
    
    for (int line = 1; line <= totalLines; line++)
    {
        var applicableGuards = regions
            .Where(r => line >= r.StartLine && line <= r.EndLine)
            .Select(r => regions.IndexOf(r))
            .ToList();
            
        coverage.Add(new LineCoverage
        {
            Line = line,
            Guards = applicableGuards
        });
    }
    
    return coverage;
}
```

#### Exit Code Handling

```csharp
private async Task<ValidationResult> HandleValidationResponse(int exitCode, string output, string error)
{
    // Log raw response for debugging
    await LogDebug($"Exit Code: {exitCode}");
    await LogDebug($"Output: {output}");
    if (!string.IsNullOrEmpty(error))
        await LogDebug($"Error: {error}");
    
    switch (exitCode)
    {
        case 0: // SUCCESS - Perfect match
            var successResult = ParseValidationResponse(output);
            await ShowSuccessNotification("Validation successful - guard parsing matches perfectly!");
            return successResult;
            
        case 1: // VALIDATION_MISMATCH
            var mismatchResult = ParseValidationResponse(output);
            await HandleValidationMismatches(mismatchResult);
            return mismatchResult;
            
        case 2: // PARSING_ERROR
            await LogError($"CodeGuard parsing error: {error}");
            await ShowUserError(
                "Validation Error",
                "The CodeGuard tool could not parse the file. This may indicate a syntax error or unsupported language construct.",
                error
            );
            return ParseErrorResponse(output, exitCode);
            
        case 3: // JSON_ERROR
            await LogError($"JSON format error: {error}");
            await ShowUserError(
                "Internal Error", 
                "The plugin generated invalid data for validation. Please report this issue.",
                "JSON Error: " + error
            );
            throw new InvalidOperationException("Plugin generated invalid JSON for validation");
            
        case 4: // FILE_NOT_FOUND
            await ShowUserError(
                "File Not Found",
                $"The file could not be found: {GetFilePathFromResponse(output)}",
                "Please ensure the file exists and try again."
            );
            return ParseErrorResponse(output, exitCode);
            
        case 5: // FILE_CHANGED
            await ShowUserWarning(
                "File Modified",
                "The file has been modified since parsing began. Please save your changes and retry validation.",
                "The validation results may not be accurate."
            );
            return ParseErrorResponse(output, exitCode);
            
        case 6: // VERSION_INCOMPATIBLE
            var versionDetails = ParseVersionError(output);
            await ShowUserError(
                "Version Incompatible",
                $"The plugin (v{versionDetails.PluginVersion}) is not compatible with CodeGuard tool (v{versionDetails.ToolVersion}).",
                $"Please update to version {versionDetails.MinimumVersion} or later."
            );
            return ParseErrorResponse(output, exitCode);
            
        case 7: // INTERNAL_ERROR
            await LogError($"Internal tool error: {error}");
            await ShowUserError(
                "Unexpected Error",
                "An unexpected error occurred in the CodeGuard tool.",
                "Error details have been logged. Please try again or report this issue."
            );
            return ParseErrorResponse(output, exitCode);
            
        default:
            await LogError($"Unknown exit code: {exitCode}");
            throw new InvalidOperationException($"Unknown exit code from CodeGuard: {exitCode}");
    }
}
```

#### Mismatch Handling

```csharp
private async Task HandleValidationMismatches(ValidationResult result)
{
    // Group discrepancies by type and severity
    var errors = result.Discrepancies.Where(d => d.Severity == "ERROR").ToList();
    var warnings = result.Discrepancies.Where(d => d.Severity == "WARNING").ToList();
    
    // Special handling for layer mismatches
    var layerMismatches = result.Discrepancies
        .Where(d => d.Type == "layer_mismatch" || d.Type == "effective_permission_mismatch")
        .ToList();
    
    if (errors.Any())
    {
        // Show error panel with detailed mismatch information
        await ShowValidationErrorPanel(errors);
        
        // Log for debugging
        foreach (var error in errors)
        {
            await LogError($"Validation ERROR at line {error.Line}: {error.Message}");
        }
    }
    
    if (warnings.Any())
    {
        // Show warnings in status bar or info panel
        await ShowValidationWarnings(warnings);
    }
    
    if (layerMismatches.Any())
    {
        // Show special visualization for overlapping guard differences
        await ShowLayerMismatchVisualization(layerMismatches);
    }
    
    // Update visual indicators in editor
    await HighlightMismatchedRegions(result.Discrepancies);
}

private async Task ShowLayerMismatchVisualization(List<Discrepancy> layerMismatches)
{
    // Create a special view showing the layer differences
    var visualizer = new GuardLayerVisualizer();
    
    foreach (var mismatch in layerMismatches)
    {
        visualizer.AddLayerComparison(
            mismatch.Line.Value,
            mismatch.PluginGuards,
            mismatch.ToolGuards
        );
    }
    
    await visualizer.Show();
}
```

### 4. Validation Results Display

The plugin should present validation results in a clear, actionable format:

#### Success Case
- Show a success notification (toast or status bar)
- Log the successful validation with timestamp
- Display statistics about overlapping guards

#### Mismatch Case
- Open a dedicated "Validation Report" panel showing:
  - Summary of discrepancies
  - Guard layer visualization for affected lines
  - Detailed comparison for each mismatch
  - Line numbers with clickable links to navigate to issues
  - Side-by-side comparison of plugin vs tool interpretation
- Highlight mismatched regions in the editor with:
  - Red overlays for ERROR severity
  - Yellow overlays for WARNING severity
  - Hover tooltips explaining the discrepancy
  - Special indicators for overlapping guard differences
- Offer actions to:
  - Save the validation report
  - Copy detailed results to clipboard
  - Report issue to plugin developers
  - Visualize guard layers at specific lines

#### Error Case
- Show appropriate error dialog based on the error type
- Provide actionable next steps (e.g., "Update plugin", "Save file and retry")
- Log full error details for troubleshooting

### 5. Example Validation Report UI

```
CodeGuard Validation Report
==========================
File: /src/example.py
Status: MISMATCH (3 errors, 1 warning)
Guard Regions: 5 (max 3 overlapping)

Discrepancies:
-------------
❌ ERROR - Line 45: Guard region boundary mismatch
   Plugin: @guard:human:w (lines 26-150)
   Tool:   @guard:human:w (lines 26-149)
   
❌ ERROR - Line 46: Layer mismatch (different overlapping guards)
   Plugin guards: [@guard:ai:r, @guard:human:w]
   Tool guards:   [@guard:ai:r, @guard:human:w, @guard:all:n.function]
   Missing:       @guard:all:n.function
   
❌ ERROR - Line 50: Effective permission mismatch for 'ai'
   Plugin: read-only (from @guard:ai:r)
   Tool:   none (overridden by @guard:all:n.function)
   
⚠️  WARNING - Line 89: Scope boundary interpretation differs
   Both found @guard:ai:w.class but disagree on where class ends

Guard Layer Visualization:
-------------------------
Lines 1-25:   [unguarded]
Lines 26-45:  [ai:r]
Lines 46-55:  [ai:r] + [human:w] + [all:n.function]
Lines 56-150: [ai:r] + [human:w]

[View Details] [Show Layers] [Save Report] [Copy to Clipboard]
```

### 6. Guard Layer Visualization

The plugin should provide a visual representation of overlapping guards:

```
Guard Layers at Line 46:
========================
Plugin View:              Tool View:
├─ @guard:ai:r           ├─ @guard:ai:r
└─ @guard:human:w        ├─ @guard:human:w
                         └─ @guard:all:n.function ← MISSING

Effective Permissions:
AI:    read-only         AI:    none (blocked)
Human: write             Human: none (blocked)
```

## Testing the Validation Mode

When implementing this feature, test with:

1. **Matching Cases**: Files where plugin and tool agree perfectly on all overlapping guards
2. **Boundary Cases**: Off-by-one errors in guard region boundaries  
3. **Interpretation Cases**: Same guard text parsed differently
4. **Layer Cases**: 
   - Different numbers of overlapping guards
   - Different effective permissions after layer resolution
   - Guard override scenarios
5. **Scope Cases**: Different interpretations of where scopes end
6. **Complex Overlaps**: Files with 5+ overlapping guards on same lines
7. **Error Cases**: All error conditions (file not found, changed, etc.)
8. **Large Files**: Performance with files having hundreds of guard regions
9. **Various Languages**: Python, JavaScript, C#, etc.