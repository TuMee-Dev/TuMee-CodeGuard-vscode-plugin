#!/bin/bash

# VisualGuard - Visualize guard permissions for any file
# Shows line-by-line permissions using the same logic as the VSCode extension

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Run the CLI parser with debug output format
# Pass all arguments through to the parser
node "$SCRIPT_DIR/tests/cli-parser-test.js" --output-format debug "$@"