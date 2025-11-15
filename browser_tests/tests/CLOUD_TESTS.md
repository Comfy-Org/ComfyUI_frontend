# Cloud E2E Tests

## Setup

Cloud tests run against `https://stagingcloud.comfy.org` with Firebase authentication.

### Required GitHub Secrets

Add these to repository settings → Secrets → Actions:

- `CLOUD_TEST_EMAIL`: Firebase test account email
- `CLOUD_TEST_PASSWORD`: Firebase test account password

### Running Locally

```bash
# Set environment variables
export CLOUD_TEST_EMAIL="your-test-email@example.com"
export CLOUD_TEST_PASSWORD="your-password"

# Run cloud tests
pnpm exec playwright test --config=playwright.cloud.config.ts
```

### Running in CI

Workflow: `.github/workflows/ci-tests-e2e-cloud.yaml`

Trigger manually via Actions tab → "CI: Tests E2E Cloud" → Run workflow

### Test Structure

- Tests tagged with `@cloud` run only in cloud config
- Auth handled once in `globalSetupCloud.ts`
- Auth state saved to `browser_tests/.auth/cloudUser.json`
- Cloud fixture in `fixtures/ComfyPageCloud.ts`
