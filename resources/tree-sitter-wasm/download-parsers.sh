#!/bin/bash

# Script to download tree-sitter WASM files for common languages
# These will be bundled with the extension for offline use

WASM_DIR="$(dirname "$0")"
cd "$WASM_DIR"

# Base URL for tree-sitter WASM files from unpkg
BASE_URL="https://unpkg.com"

# List of languages to download
LANGUAGES=(
  "javascript"
  "typescript" 
  "python"
  "java"
  "c"
  "cpp"
  "csharp"
  "go"
  "rust"
  "ruby"
  "php"
  "swift"
  "kotlin"
  "tsx"
)

echo "Downloading tree-sitter WASM files..."

for lang in "${LANGUAGES[@]}"; do
  echo "Downloading tree-sitter-${lang}.wasm..."
  
  # Special handling for some language names
  case "$lang" in
    "cpp")
      pkg_name="tree-sitter-cpp"
      file_name="tree-sitter-cpp.wasm"
      ;;
    "csharp")
      pkg_name="tree-sitter-c-sharp"
      file_name="tree-sitter-c_sharp.wasm"
      ;;
    "tsx")
      pkg_name="tree-sitter-typescript"
      file_name="tree-sitter-tsx.wasm"
      # For TSX, we need the tsx.wasm file from typescript package
      curl -L "${BASE_URL}/${pkg_name}/tree-sitter-tsx.wasm" -o "$file_name" || echo "Failed to download $file_name"
      continue
      ;;
    *)
      pkg_name="tree-sitter-${lang}"
      file_name="tree-sitter-${lang}.wasm"
      ;;
  esac
  
  # Download the WASM file
  curl -L "${BASE_URL}/${pkg_name}/tree-sitter-${lang}.wasm" -o "$file_name" || echo "Failed to download $file_name"
done

echo "Download complete!"
echo "Downloaded files:"
ls -la *.wasm 2>/dev/null || echo "No WASM files found"