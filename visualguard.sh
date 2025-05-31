#!/bin/bash

# VisualGuard - Production CLI for TuMee VSCode Plugin
# Visualize guard permissions for any file
#
# Usage: ./visualguard.sh <file>
#        ./visualguard.sh --no-color <file>
#        ./visualguard.sh --theme <theme> <file>
#        ./visualguard.sh --list-themes

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Run the production CLI tool
exec node "$SCRIPT_DIR/dist/cli/visualguard.js" "$@"