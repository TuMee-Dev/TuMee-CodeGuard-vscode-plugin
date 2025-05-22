#!/bin/bash
# Run the compiled extension in VS Code

# Get the current directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Run VS Code with the extension
code --extensionDevelopmentPath="$DIR" "$@"