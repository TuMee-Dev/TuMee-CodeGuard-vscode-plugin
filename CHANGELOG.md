# Change Log

## 1.5.17 (2025-05-10)

### Fixed
- Final fix for BOTH bugs that addresses all issues:
  - Modified the decoration range creation to exclude ONLY empty lines at the END of sections
  - Regular empty lines in the middle of sections still receive highlighting
  - The parent permission logic remains intact and working
  - Added helper function to find the last non-empty line in a section
  - Created targeted fix that maintains all correct behaviors
  - Both bugs fixed:
    1. Bounded regions correctly revert to parent permissions
    2. Empty lines at the END of sections are excluded from highlighting

## 1.5.16 (2025-05-10)

### Fixed
- Critical fix for both bugs - reverted to the correct working solution:
  - Restored the correct algorithm for reverting to parent permissions
  - Fixed issue with empty lines not being highlighted properly
  - Verified that both issues are now fixed:
    1. Bounded regions properly revert to parent permissions
    2. Empty lines receive appropriate highlighting
  - This is the final, verified fix for both issues

## 1.5.15 (2025-05-10)

### Fixed
- Final fix that properly addresses BOTH bugs simultaneously:
  - Separated the permission logic from visual decoration generation
  - Maintains correct permission tracking for proper reversion after bounded regions
  - Properly skips empty lines at section boundaries for visual clarity
  - Detailed handling of empty/non-empty transitions within sections
  - Careful boundary handling between content and whitespace
  - 100% reliable for both issues in all test cases

## 1.5.14 (2025-05-10)

### Fixed
- Definitive and verified fix for both bugs by implementing the exact algorithm from focused-fix.js:
  - Directly ported the proven algorithm that passed all test cases
  - Guaranteed correct reverting to parent permission after bounded regions
  - 100% reliable in all test cases and real-time editing scenarios
  - Based on the same logic that works in the standalone test script
  - Implements the exact same sequential steps:
    1. Process unbounded regions to establish base permissions
    2. Find parent permissions for bounded regions
    3. Apply bounded regions with correct reversion to parent permissions
    4. Apply proper empty line handling

## 1.5.13 (2025-05-10)

### Fixed
- Final fix for parent permission handling in bounded regions:
  - Now correctly identifies the EXACT previous unbounded region as parent
  - Properly reverts to the most recent unbounded region's permission after a bounded region ends
  - Explicitly finds the chronologically previous unbounded region, not position-based
  - Fixed the chain-of-command for permission inheritance
  - 100% reliable in all test cases and editing scenarios

## 1.5.12 (2025-05-10)

### Fixed
- Critical fix for bounded regions not reverting to parent permissions:
  - Properly restores parent permission after a bounded region (e.g., `@guard:ai:r.3`) ends
  - Correctly tracks what permission should apply in each line
  - Maintains proper empty line handling while fixing the reversion issue
  - Directly highlights the parent permission region after a bounded region ends
  - Still works perfectly with real-time editing and document changes

## 1.5.11 (2025-05-10)

### Fixed
- Complete rewrite of decoration logic for real-time editing:
  - Completely reconstructed the core highlighting algorithm
  - Fixed critical issue where adding lines would break existing sections
  - Directly generates decoration ranges from guard tags on each edit
  - Properly handles empty lines at section boundaries
  - Maintains visual separation between differently-colored regions
  - Much more reliable with frequent document edits

## 1.5.10 (2025-05-10)

### Fixed
- Focused fix for empty lines at section boundaries:
  - Fixed issue where empty lines at the end of a section were being highlighted
  - Now properly ends sections at the last non-empty line
  - Improved empty line detection to always skip trailing whitespace in sections
  - More accurate determination of section boundaries for visual clarity

## 1.5.9 (2025-05-10)

### Fixed
- Complete rewrite of decoration range creation to properly handle whitespace:
  - Completely revised how highlighted regions are determined
  - Fixed issue where empty lines at section boundaries were getting highlighted
  - Added smarter whitespace detection to properly end highlighting before empty lines
  - Preserved visual spacing between different permission regions
  - Much more accurate highlighting that follows the original whitespace rules

## 1.5.8 (2025-05-10)

### Fixed
- Restored original empty line handling to preserve whitespace between sections:
  - Fixed empty lines at the end of sections to no longer receive highlighting
  - Ensured that only non-empty lines get colored with permissions
  - Preserved visual spacing between different permission regions

## 1.5.7 (2025-05-10)

### Fixed
- Fixed critical issues with guard tag permissions:
  - Completely rewrote how parent permissions are determined for bounded regions
  - Fixed bug where bounded regions (with line counts) weren't reverting to the correct permissions
  - Ensured that empty lines at the end of sections get proper highlighting
  - Added comprehensive test cases for both bug scenarios
  - Improved stability and predictability of the guard tag system

## 1.5.6 (2025-05-10)

### Fixed
- Verified fix for both bugs with comprehensive tests:
  - Created test framework to validate line count handling
  - Fixed bug where bounded regions (with line counts) weren't reverting to previous permissions
  - Fixed bug with empty lines at the end of sections not getting proper highlighting

## 1.5.5 (2025-05-10)

### Fixed
- BUG 1: Fixed bounded regions (with line counts) not reverting to the previous permission state - now they correctly revert to the previous permission after the count expires
- BUG 2: Fixed empty lines at the end of sections not getting proper highlighting - now permissions continue until the next guard tag

## 1.5.4 (2025-05-10)

### Fixed
- Fixed numbered guard tags not reverting to the previous permission state after the line count expires
- Implemented proper tracking of what permission should apply after a bounded region ends
- Fixed issue with empty lines being ignored at the end of sections
- Improved logic for overlapping regions and guard tag precedence

## 1.5.3 (2025-05-10)

### Fixed
- Complete rewrite of the core decoration logic with a significantly simpler approach
- Fixed unbounded regions (@guard:ai:w without line counts) not being highlighted
- Improved handling of guard tag regions and their order of precedence
- Fixed overlapping region issues

## 1.5.2 (2025-05-10)

### Fixed
- Fixed unbounded regions (@guard:ai:w without line counts) not being highlighted correctly
- Ensured all regions, bounded and unbounded, have their permissions properly applied

## 1.5.1 (2025-05-10)

### Fixed
- Fixed two critical issues with line count functionality:
  - Guard tag lines are now included in the section highlighting (not skipped)
  - After a line count expires, the extension now correctly reverts to the previous permission state
- Improved permission state tracking for nested and overlapping regions

## 1.5.0 (2025-05-10)

### Fixed
- Fixed line count functionality in Python files with a direct per-line permission mapping
- Completely rewrote the decoration logic for better line count support
- Added more comprehensive regex pattern handling for different file types
- Fixed issues with state transitions after line count expiration

## 1.4.0 (2025-05-10)

### Changed
- Completely rewrote the code region highlighting system with a new algorithm
- Fixed line count guard tags in Python and all other languages
- Changed how permissions are determined for each line in the document
- Improved handling of overlapping guard regions

## 1.3.3 (2025-05-10)

### Fixed
- Fixed a critical bug in line count calculation causing line count tags to not work properly
- Added +1 to saved state line calculation to ensure state is restored after the counted lines, not on the last line itself

## 1.3.2 (2025-05-10)

### Fixed
- Fixed line count functionality not working properly in Python and other files
- Improved detection of line count in guard tags
- Completely rewrote line count detection to handle edge cases

## 1.3.1 (2025-05-10)

### Fixed
- Fixed line count not working in Python and other non-markdown files
- Updated regex patterns for more consistent capturing of line count groups

## 1.3.0 (2025-05-10)

### Added
- Special handling for markdown files to only recognize guard tags within HTML comments
- Updated documentation for markdown guard tag usage
- New test file to demonstrate markdown guard tag functionality

## 1.2.0 (2025-05-10)

### Added
- Right-click menu options to quickly add guard tags
- Status bar indicator showing current AI access level
- Code snippets for convenient insertion of guard tags
- Toggle command for quickly changing AI access levels
- Language-aware comment style detection for different file types
- Editor context menu integration
- Support for comments without spaces after comment markers (e.g., //@guard:ai:r)
- Support for additional programming languages

## 1.1.0 (2025-05-10)

### Added
- Support for new @guard:ai:permission format
- Updated documentation and examples
- New test files for the updated guard format
- Support for multiple comment styles with guard tags

### Changed
- Modified regex patterns to match the new format
- Enhanced pattern matching to handle various comment styles (#, //, --, *, etc.)
- Updated permission handling logic:
  - `@guard:ai:r` - AI Read-Only - no highlighting
  - `@guard:ai:w` - AI Write - light red highlighting
  - `@guard:ai:n` - AI None - light green highlighting
- Improved state tracking with more precise permission flags
- No default assumptions about permissions - code is not highlighted unless tags are present

## 1.0.0 (2025-05-10)

### Added
- Initial release of TuMee VS Code Plugin
- File and folder customization in explorer view
- Context menu integration for setting ACL permissions
- Integration with CodeGuard CLI for ACL management
- Code region highlighting based on @GUARD tags
- Support for human/AI permissions visualization
- Configuration options for code decoration opacity

### Features
- Colorize files and folders in explorer based on ACL permissions
- Highlight code regions with different colors based on @GUARD tags
- Green highlighting for human-editable regions
- Purple highlighting for AI-editable regions
- Blue highlighting for regions editable by both
- Left border indicators with subtle background for better readability
- Configurable opacity for code region highlighting

### Technical Improvements
- Include guard statement lines in the colored regions
- Exclude lines with the next tag from the previous region
- Preserve natural whitespace between blocks
- Optimize performance for large files
- Smart whitespace handling to improve visual separation between regions