#!/bin/bash

# VisualGuard - Visualize guard permissions for any file
# Shows line-by-line permissions using the same logic as the VSCode extension
#
# Usage: ./visualguard.sh <file>
#        ./visualguard.sh --no-color <file>
#
# By default, output is colored. Use --no-color to disable colors.

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if --no-color flag is present
if [[ "$*" == *"--no-color"* ]]; then
    # Remove --no-color from arguments and use debug format
    args=()
    for arg in "$@"; do
        if [[ "$arg" != "--no-color" ]]; then
            args+=("$arg")
        fi
    done
    node "$SCRIPT_DIR/tests/cli-parser-test.js" --output-format debug "${args[@]}"
else
    # Default to color output
    node "$SCRIPT_DIR/tests/cli-parser-test.js" --output-format color "$@"
fi