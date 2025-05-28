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

# Parse arguments
NO_COLOR=false
THEME=""
ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-color)
            NO_COLOR=true
            shift
            ;;
        --theme)
            THEME="--theme $2"
            shift 2
            ;;
        *)
            ARGS+=("$1")
            shift
            ;;
    esac
done

# Run with appropriate format
if [[ "$NO_COLOR" == true ]]; then
    node "$SCRIPT_DIR/tests/cli-parser-test.js" --output-format debug $THEME "${ARGS[@]}"
else
    node "$SCRIPT_DIR/tests/cli-parser-test.js" --output-format color $THEME "${ARGS[@]}"
fi