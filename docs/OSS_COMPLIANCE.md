# OSS Compliance Verification

This document describes the automated compliance checks that ensure the OSS (Open Source Software) distribution of ComfyUI Frontend meets licensing and privacy requirements.

## Overview

The OSS build verification system consists of two main components:

1. **License Compliance Check** - Ensures all production dependencies use approved open-source licenses
2. **OSS Build Verification** - Ensures the OSS distribution doesn't contain proprietary code or telemetry

## Quick Start

### Run All Compliance Checks

```bash
pnpm verify:compliance
```

This command will:
1. Check all production dependency licenses
2. Build the OSS distribution
3. Verify the build output doesn't contain violations

### Individual Checks

```bash
# Check licenses only
pnpm verify:licenses

# Build OSS distribution
pnpm build:oss

# Verify OSS build (requires build first)
pnpm verify:oss
```

## License Compliance

### Purpose

Verifies that all production dependencies use licenses compatible with ComfyUI's GPL-3.0-only license.

### Script Location

`scripts/verify-licenses.js`

### Approved Licenses

The following licenses are approved for use:

- **Permissive**: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC
- **Copyleft**: GPL-2.0, GPL-3.0, LGPL-2.1, LGPL-3.0, MPL-2.0
- **Public Domain**: CC0-1.0, Unlicense, WTFPL
- And other OSI-approved licenses

### How It Works

1. Runs `pnpm licenses list --json --prod` to get all production dependencies
2. Checks each license against the approved list
3. Flags any non-compliant or unknown licenses
4. Exits with error code 1 if violations are found

### Adding New Approved Licenses

If a legitimate open-source license is being flagged, edit `scripts/verify-licenses.js` and add it to the `APPROVED_LICENSES` set.

## OSS Build Verification

### Purpose

Ensures the OSS distribution (DISTRIBUTION=localhost) doesn't contain:

1. **Proprietary licensed assets** (e.g., ABCROM font files)
2. **Telemetry code** (e.g., Mixpanel tracking)

### Script Location

`scripts/verify-oss-build.js`

### What Gets Checked

#### Proprietary Font Files

- Searches for `.woff`, `.woff2`, `.ttf`, `.otf` files containing "ABCROM"
- These fonts are proprietary and licensed only for cloud distribution

#### Telemetry Code

Searches JavaScript files for:
- `mixpanel` references
- `MixpanelTelemetryProvider` class
- Tracking method calls (`trackWorkflow`, `trackEvent`)
- Mixpanel API endpoints (`mp.comfy.org`)

### How It Works

1. Recursively scans the `dist/` directory
2. Checks font files by filename
3. Checks JavaScript files for telemetry code patterns
4. Reports all violations with file locations and matches
5. Exits with error code 1 if violations are found

### Tree-Shaking Mechanism

The codebase uses compile-time constants for tree-shaking:

```typescript
// src/platform/distribution/types.ts
const DISTRIBUTION: Distribution = __DISTRIBUTION__
export const isCloud = DISTRIBUTION === 'cloud'

// src/platform/telemetry/index.ts
if (isCloud) {
  _telemetryProvider = new MixpanelTelemetryProvider()
}
```

When building with `DISTRIBUTION=localhost`:
- `isCloud` evaluates to `false`
- Dead code elimination removes all cloud-specific code
- Mixpanel library is never imported or bundled

## CI Integration

### GitHub Actions Workflow

`.github/workflows/ci-oss-compliance.yaml`

The workflow runs on all pushes to main/dev branches and pull requests:

1. **license-check** job
   - Installs dependencies
   - Runs license verification

2. **oss-build-check** job
   - Installs dependencies
   - Builds OSS distribution
   - Runs build verification
   - Uploads artifacts on failure for debugging

### When Checks Run

- On push to: `main`, `master`, `dev*`, `core/*`, `desktop/*`
- On pull requests (except `wip/*`, `draft/*`, `temp/*`)

## Troubleshooting

### License Check Fails

1. Review the flagged packages
2. Check if the license is genuinely non-compliant
3. If it's a false positive, add the license to `APPROVED_LICENSES`
4. If it's truly non-compliant, find an alternative package

### OSS Build Check Fails

1. Review the violations in the output
2. Check if cloud-specific code is being included
3. Verify tree-shaking is working:
   - Check `vite.config.mts` for `define` configuration
   - Ensure `DISTRIBUTION` is set correctly
   - Check that cloud imports are conditionally loaded

### Build Artifacts

If the OSS build check fails in CI, artifacts are uploaded for 7 days:
1. Go to the failed workflow run
2. Download "oss-build-artifacts"
3. Inspect the files to identify violations

## Adding New Cloud-Specific Code

When adding code that should only be in cloud builds:

1. **Place it in `src/platform/cloud/`** - Recommended approach
2. **Use conditional imports**:
   ```typescript
   if (isCloud) {
     const { CloudFeature } = await import('./cloud/CloudFeature')
     // Use CloudFeature
   }
   ```
3. **Test locally**:
   ```bash
   pnpm build:oss
   pnpm verify:oss
   ```

## References

- [Vite Tree-Shaking](https://vitejs.dev/guide/features.html#build-optimizations)
- [GPL-3.0 License](https://www.gnu.org/licenses/gpl-3.0.en.html)
- [OSI Approved Licenses](https://opensource.org/licenses/)
