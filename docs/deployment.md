# VSIX Deployment and Distribution

## Overview

The TuMee VSCode Plugin uses automated GitHub releases to build and distribute VSIX files. This document describes the deployment process and download URLs for integration with other tools.

## Automated Release Process

### Version-Based Triggers

The deployment system uses semantic versioning with specific release triggers:

- **X.Y.Z format**
- **Major (X) or Minor (Y) changes** → Triggers GitHub Release
- **Patch (Z) changes** → No automated build (development/testing only)

### Release Workflow

1. **Development**: Bump patch versions for testing (`1.6.2` → `1.6.3`)
2. **Release**: Bump minor/major and push tag (`1.6.3` → `1.7.0`)
3. **Automation**: GitHub Action builds and releases VSIX files

## Download URLs

### Stable Latest Version

For tools that need the newest version without version-specific URLs:

```text
https://github.com/TuMee/CodeGuard-vscode-plugin/releases/latest/download/tumee-vscode-plugin-latest.vsix
```

This URL always points to the most recent release and never changes.

### Specific Versions

For tools that require specific version pinning:

```text
https://github.com/TuMee/CodeGuard-vscode-plugin/releases/download/v1.7.0/tumee-vscode-plugin-1.7.0.vsix
```

### Programmatic Access

For automated systems that need to discover the latest version:

```bash
# Get latest release info as JSON
curl -s https://api.github.com/repos/TuMee/CodeGuard-vscode-plugin/releases/latest

# Extract direct download URL
curl -s https://api.github.com/repos/TuMee/CodeGuard-vscode-plugin/releases/latest | jq -r '.assets[0].browser_download_url'
```

## Integration Examples

### Download Script

```bash
#!/bin/bash
# Download latest VSIX
wget -O tumee-plugin.vsix https://github.com/TuMee/CodeGuard-vscode-plugin/releases/latest/download/tumee-vscode-plugin-latest.vsix
```

### CI/CD Integration

```yaml
# Example GitHub Action step
- name: Download TuMee Plugin
  run: |
    curl -L -o tumee-plugin.vsix \
      https://github.com/TuMee/CodeGuard-vscode-plugin/releases/latest/download/tumee-vscode-plugin-latest.vsix
```

### Version Checking

```bash
# Check if new version is available
CURRENT_VERSION="1.6.2"
LATEST_VERSION=$(curl -s https://api.github.com/repos/TuMee/CodeGuard-vscode-plugin/releases/latest | jq -r '.tag_name' | sed 's/v//')

if [ "$LATEST_VERSION" != "$CURRENT_VERSION" ]; then
    echo "New version available: $LATEST_VERSION"
    # Download and update logic here
fi
```

## Manual Release Process

For emergency releases or testing, the workflow can be triggered manually:

1. Navigate to the GitHub repository
2. Go to Actions tab
3. Select "Release VSIX" workflow
4. Click "Run workflow" button
5. Specify the target branch (usually `main`)

## File Structure

Each GitHub release contains two VSIX files:

- `tumee-vscode-plugin-{version}.vsix` - Version-specific file
- `tumee-vscode-plugin-latest.vsix` - Stable filename for latest version

Both files are identical; the "latest" copy provides a stable download URL that doesn't change between releases.

## Release Notes

GitHub automatically generates release notes from commit history and pull requests. The release notes include:

- New features and improvements
- Bug fixes
- Breaking changes (if any)
- Contributor acknowledgments

## Security Considerations

- All releases are built in GitHub's secure environment
- VSIX files are signed with the publisher's certificate
- Download URLs use HTTPS encryption
- Release artifacts are immutable once published

## Troubleshooting

### Failed Releases

If a release fails:

1. Check the GitHub Actions logs in the repository
2. Verify the version tag follows the correct format (`v1.2.0`)
3. Ensure all tests pass before tagging
4. Check for any linting or build errors

### Download Issues

If downloads fail:

1. Verify the release exists in the GitHub releases page
2. Check network connectivity and firewall settings
3. Try the specific version URL instead of the latest URL
4. Use the GitHub API to verify asset availability

## Support

For deployment issues or questions:

- Check the repository's Issues section
- Review the GitHub Actions logs
- Contact the maintainers through the repository