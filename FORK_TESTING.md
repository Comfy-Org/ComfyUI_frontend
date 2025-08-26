# Fork Testing Guide

This document explains how Playwright tests work for contributors working from forked repositories.

## Test Execution

All Playwright tests run for both internal PRs and forked PRs. The testing process includes:

1. **Setup Phase**: Builds ComfyUI and ComfyUI_frontend
2. **Server Startup**: Starts ComfyUI server with enhanced diagnostics
3. **Browser Tests**: Runs Playwright tests across multiple browsers (chromium, mobile-chrome, etc.)
4. **Artifact Upload**: Test reports are always uploaded as GitHub artifacts

## Key Differences for Forked PRs

### ✅ What Works the Same
- All Playwright tests execute normally
- Test results are reported in PR comments
- Test artifacts are uploaded and accessible via GitHub Actions

### ⚠️ What's Different
- **Cloudflare Deployment**: Skipped due to security restrictions
- **Report Access**: Available via GitHub Actions artifacts instead of live URLs
- **Test Reports**: Download from workflow artifacts tab instead of browsing online

## Security Limitations

GitHub Actions restricts secret access for forked PRs to prevent malicious code from accessing sensitive credentials. This affects:

- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are not available
- Deployment to Cloudflare Pages is automatically skipped
- Alternative artifact-based report access is provided

## Accessing Test Reports

### For Internal PRs (Same Repository)
- Live report URLs are posted in PR comments
- Reports are deployed to Cloudflare Pages automatically

### For Forked PRs
1. Go to the GitHub Actions tab in the PR
2. Click on the latest workflow run
3. Download the `playwright-report-{browser}` artifacts
4. Extract and open `index.html` locally

## Enhanced Server Diagnostics

The workflow includes improved server startup logging to help diagnose issues:
- Server PID tracking
- Enhanced timeout handling
- Process status verification
- Clear error messages for troubleshooting

## Troubleshooting

If tests fail to start:
1. Check the "Start ComfyUI server" step logs
2. Look for server PID and startup messages
3. Verify no port conflicts (8188)
4. Check server process status in case of timeout

For deployment issues on forks:
- This is expected behavior for security reasons
- Test reports are still available via artifacts
- All test functionality remains intact

## Contributing

When contributing from a fork:
1. Tests will run automatically on PR creation
2. Expect "deployment skipped" messages (this is normal)
3. Download artifacts to review detailed test reports
4. All test results are still visible in PR comments