#!/bin/bash
# ColorGuard - Visualize guard permissions with terminal colors
# Shows line-by-line permissions using colored backgrounds
#
# Usage: ./colorguard.sh <file>
#
# Colors match the VSCode extension theme:
# - Red background: AI no access
# - Green background: Human no access  
# - Yellow background: AI no write
# - Blue background: Human read-only
# - Cyan background: Context
# - No color: Default permissions (AI read, Human write)

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Run the CLI parser with color output format
node "$SCRIPT_DIR/tests/cli-parser-test.js" --output-format color "$@"