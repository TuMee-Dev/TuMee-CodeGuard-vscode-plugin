# Release Process

## Overview
This project uses automated GitHub releases triggered by version tags. Only major (X) or minor (Y) version changes trigger releases - patch (Z) changes are for testing only.

## Version Strategy
- **X.Y.Z format**
- **X or Y changes** → GitHub Release with VSIX
- **Z changes** → No automated build (testing only)

## Release Workflow

### 1. Development and Testing
```bash
# Bump patch versions for testing
npm version patch  # 1.6.2 → 1.6.3 (no release)
```

### 2. Prepare Release
```bash
# For new features (minor release)
npm version minor  # 1.6.3 → 1.7.0

# For major updates  
npm version major  # 1.7.0 → 2.0.0
```

### 3. Trigger Release
```bash
# Push the version tag to trigger GitHub Action
git push origin main --tags
```

### 4. Automated Process
1. GitHub Action detects `v1.7.0` tag
2. Runs linting and type checking
3. Builds extension (`npm run package`)
4. Packages VSIX (`npm run build:vsix`)
5. Creates GitHub Release with VSIX attached

## Download URLs

### Latest Version (Stable URL)
```
https://github.com/TuMee/CodeGuard-vscode-plugin/releases/latest/download/tumee-vscode-plugin-latest.vsix
```

### Specific Versions
```
https://github.com/TuMee/CodeGuard-vscode-plugin/releases/download/v1.7.0/tumee-vscode-plugin-1.7.0.vsix
```

### Latest Release API (for automation)
```
curl -s https://api.github.com/repos/TuMee/CodeGuard-vscode-plugin/releases/latest | jq -r '.assets[0].browser_download_url'
```

## Manual Release
For emergency releases, use GitHub Actions "workflow_dispatch":
1. Go to Actions tab in GitHub
2. Select "Release VSIX" workflow  
3. Click "Run workflow" button

## Local VSIX Building
```bash
# Build VSIX locally for testing
npm run build:vsix
```

This creates `tumee-vscode-plugin-{version}.vsix` in the root directory.