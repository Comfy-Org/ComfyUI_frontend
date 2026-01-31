# Debugging Flaky Tests

## Common Causes & Fixes

### 1. Missing `nextFrame()`

**Symptom:** Test passes locally, fails in CI; screenshot mismatches

**Fix:** Add `nextFrame()` after canvas operations:

```typescript
await comfyPage.canvas.click(100, 200)
await comfyPage.nextFrame() // ← Add this
```

### 2. Race Conditions

**Symptom:** Intermittent failures, "element not found"

**Fix:** Use proper waits instead of timeouts:

```typescript
// ❌ Bad
await page.waitForTimeout(500)

// ✅ Good
await expect(element).toBeVisible()
```

### 3. Missing Focus

**Symptom:** Keyboard shortcuts don't work

**Fix:** Focus canvas before keyboard events:

```typescript
await comfyPage.canvas.focus() // ← Add this
await comfyPage.page.keyboard.press('Delete')
```

### 4. Double-Click Timing

**Symptom:** Double-click doesn't trigger edit mode

**Fix:** Add delay option:

```typescript
await element.dblclick({ delay: 5 })
```

### 5. Upload Not Complete

**Symptom:** Widget value incorrect after file upload

**Fix:** Wait for upload response:

```typescript
await comfyPage.dragAndDropFile(path, position, { waitForUpload: true })
```

### 6. Tests Polluting Each Other

**Symptom:** Test fails when run with others, passes alone

**Fix:** Reset state in afterEach:

```typescript
test.afterEach(async ({ comfyPage }) => {
  await comfyPage.resetView()
})
```

### 7. Animation Not Complete

**Symptom:** Screenshot mismatch, elements in wrong position

**Fix:** Add steps to drag operations:

```typescript
await comfyMouse.dragFromTo(start, end, { steps: 10 }) // Not steps: 1
await comfyPage.nextFrame()
```

## Debugging Tools

### Debug Mode

```bash
npx playwright test --debug
npx playwright test mytest.spec.ts:25 --debug  # Specific line
```

### Pause in Test

```typescript
await page.pause() // Opens inspector
```

### Trace Viewer

```bash
npx playwright test --trace on
npx playwright show-report
```

### Verbose Logging

```bash
DEBUG=pw:api npx playwright test
```

### UI Mode (Recommended)

```bash
pnpm exec playwright test --ui
```

## Retry Pattern

For inherently async operations:

```typescript
await expect(async () => {
  const value = await widget.getValue()
  expect(value).toBe(100)
}).toPass({ timeout: 2000 })
```

## Debugging Screenshots

### Local vs CI Mismatch

Screenshots are Linux-only. Don't commit local screenshots.

### Update Baselines

Use PR label: `New Browser Test Expectations`

Or locally:

```bash
pnpm exec playwright test --update-snapshots
```

### Mask Dynamic Content

```typescript
await expect(page).toHaveScreenshot('page.png', {
  mask: [page.locator('.timestamp'), page.locator('.random-id')]
})
```

## Debugging Workflow Issues

### Log Workflow State

```typescript
const workflow = await comfyPage.getWorkflow()
console.log(JSON.stringify(workflow, null, 2))
```

### Check Node Count

```typescript
const nodes = await comfyPage.getNodes()
console.log('Node count:', nodes.length)
```

## CI Debugging

### View Traces

1. Go to failed CI run
2. Download artifacts
3. Extract and open in trace viewer:
   ```bash
   npx playwright show-trace trace.zip
   ```

### View Report

CI deploys report to Cloudflare Pages. Link in PR comment.

### Reproduce CI Environment

```bash
# Run with CI settings
CI=true pnpm test:browser

# Run specific shard
CI=true npx playwright test --shard=1/8
```

## Known Issues & Workarounds

### LiteGraph Click Handler Delay

LiteGraph uses 256ms setTimeout for click handlers:

```typescript
// Acceptable workaround
await page.waitForTimeout(300) // Documented exception
```

### Version Mismatch Warning

Disable in tests via setting:

```typescript
await comfyPage.setSetting('Comfy.Frontend.DisableVersionWarning', true)
```

## When to Use Retry vs Fix

**Use Retry:**

- External service timing
- Animation completion
- Network latency

**Fix Root Cause:**

- Missing awaits
- Missing nextFrame()
- Race conditions in test logic
