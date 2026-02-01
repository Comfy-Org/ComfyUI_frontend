# Playwright Best Practices

Official Playwright patterns. ComfyUI-specific patterns in [../SKILL.md](../SKILL.md).

## Locator Priority

Use locators in this order of preference:

| Priority | Method                    | Use Case                                 |
| -------- | ------------------------- | ---------------------------------------- |
| 1        | `page.getByRole()`        | Buttons, links, headings (accessibility) |
| 2        | `page.getByLabel()`       | Form controls with labels                |
| 3        | `page.getByPlaceholder()` | Inputs by placeholder                    |
| 4        | `page.getByText()`        | Elements by text content                 |
| 5        | `page.getByAltText()`     | Images by alt text                       |
| 6        | `page.getByTitle()`       | Elements by title attribute              |
| 7        | `page.getByTestId()`      | `data-testid` fallback                   |

```typescript
// ✅ Good - uses role and accessible name
await page.getByRole('button', { name: 'Submit' }).click()

// ❌ Bad - tied to implementation details
await page.locator('button.btn-primary.submit-btn').click()
```

## Web-First Assertions

**Always use auto-retrying assertions:**

```typescript
// ✅ Good - auto-waits and retries
await expect(page.getByText('Welcome')).toBeVisible()
await expect(page).toHaveTitle(/Dashboard/)

// ❌ Bad - doesn't wait, leads to flaky tests
expect(await page.getByText('Welcome').isVisible()).toBe(true)
```

### Auto-Retrying Assertions

| Assertion           | Purpose             |
| ------------------- | ------------------- |
| `toBeVisible()`     | Element is visible  |
| `toBeHidden()`      | Element is hidden   |
| `toBeEnabled()`     | Element is enabled  |
| `toBeDisabled()`    | Element is disabled |
| `toHaveText()`      | Exact text match    |
| `toContainText()`   | Partial text match  |
| `toHaveValue()`     | Input value         |
| `toHaveAttribute()` | Attribute value     |
| `toHaveCount()`     | Number of elements  |
| `toHaveURL()`       | Page URL            |
| `toHaveTitle()`     | Page title          |

### Soft Assertions

Non-blocking checks:

```typescript
await expect.soft(page.getByTestId('status')).toHaveText('Success')
await expect.soft(page.getByTestId('count')).toHaveText('5')
// Test continues even if above fail
```

## Anti-Patterns

### ❌ Manual Waits

```typescript
// Bad
await page.waitForTimeout(2000)

// Good
await expect(page.getByText('Loaded')).toBeVisible()
```

### ❌ Implementation-Tied Selectors

```typescript
// Bad
await page.locator('div.container > button.btn-primary').click()

// Good
await page.getByRole('button', { name: 'Submit' }).click()
```

### ❌ Using first/last/nth Without Reason

```typescript
// Bad - fragile
await page.getByRole('button').first().click()

// Good - uniquely identify
await page.getByRole('button', { name: 'Submit' }).click()
```

### ❌ Ambiguous Text Selectors (Strict Mode Violations)

`getByText()` matches **all elements containing that text**, causing strict mode violations when multiple elements match. Common in UIs with tabs, section headers, and settings that share terminology.

```typescript
// Bad - "Nodes" appears in tab, section header, and setting labels
await expect(panel.getByText('Nodes')).toBeVisible()
// Error: strict mode violation, resolved to 4 elements

// Good - use role with exact name (section headers are often buttons)
await expect(panel.getByRole('button', { name: 'NODES' })).toBeVisible()

// Good - use exact match when appropriate
await expect(panel.getByText('Nodes', { exact: true })).toBeVisible()

// Good - scope to a more specific container first
await expect(panel.locator('[role="tablist"]').getByText('Nodes')).toBeVisible()
```

**Common patterns that cause this:**

- Tabs and section headers with same text (e.g., "Nodes" tab + "NODES" accordion)
- Settings containing the section name (e.g., "Nodes 2.0", "Snap nodes to grid")
- Repeated labels across different panels

### ❌ Non-Awaited Assertions

```typescript
// Bad
expect(await page.getByText('Hello').isVisible()).toBe(true)

// Good
await expect(page.getByText('Hello')).toBeVisible()
```

### ❌ Shared State Between Tests

```typescript
// Bad
let sharedData
test('first', async () => {
  sharedData = 'value'
})
test('second', async () => {
  expect(sharedData).toBe('value')
})

// Good - each test independent
test('first', async ({ page }) => {
  /* complete setup */
})
test('second', async ({ page }) => {
  /* complete setup */
})
```

## Locator Chaining

```typescript
// Within a container
const dialog = page.getByRole('dialog')
await dialog.getByRole('button', { name: 'Submit' }).click()

// Filter
const product = page.getByRole('listitem').filter({ hasText: 'Product 2' })
await product.getByRole('button', { name: 'Add' }).click()
```

## Network Mocking

```typescript
// Mock API
await page.route('**/api/users', (route) =>
  route.fulfill({
    status: 200,
    body: JSON.stringify([{ id: 1, name: 'Test' }])
  })
)

// Block resources
await context.route('**/*.{png,jpg}', (route) => route.abort())
```

## Test Annotations

```typescript
// Skip conditionally
test('firefox only', async ({ browserName }) => {
  test.skip(browserName !== 'firefox', 'Firefox only')
})

// Slow test (triples timeout)
test('complex', async () => {
  test.slow()
})

// Tag
test('login', { tag: '@smoke' }, async () => {})
```

## Retry Configuration

```typescript
// Per-describe
test.describe(() => {
  test.describe.configure({ retries: 2 })
  test('flaky', async () => {})
})

// Detect retry
test('cleanup aware', async ({}, testInfo) => {
  if (testInfo.retry) await cleanup()
})
```

## Parallel Execution

```typescript
// Parallel (default)
test.describe.configure({ mode: 'parallel' })

// Serial (dependent tests)
test.describe.configure({ mode: 'serial' })
```

## Debugging

```bash
# Debug mode
npx playwright test --debug

# Trace
npx playwright test --trace on
npx playwright show-report
```

```typescript
// Pause in test
await page.pause()
```

## Official Docs

- [Best Practices](https://playwright.dev/docs/best-practices)
- [Locators](https://playwright.dev/docs/locators)
- [Assertions](https://playwright.dev/docs/test-assertions)
- [Auto-waiting](https://playwright.dev/docs/actionability)
