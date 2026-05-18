# Testing Anti-Patterns for Red-Green Fixes

Common mistakes that undermine the red-green proof. Avoid these when writing the test commit (Step 1).

## Testing Implementation Details

Test observable behavior, not internal state.

**Bad** — coupling to internals:

```typescript
it('uses cache internally', () => {
  const service = new UserService()
  service.getUser(1)
  expect(service._cache.has(1)).toBe(true) // Implementation detail
})
```

**Good** — testing through the public interface:

```typescript
it('returns same user on repeated calls', async () => {
  const service = new UserService()
  const user1 = await service.getUser(1)
  const user2 = await service.getUser(1)
  expect(user1).toBe(user2) // Behavior, not implementation
})
```

Why this matters for red-green: if your test is coupled to internals, a valid fix that changes the implementation may break the test — even though the bug is fixed. The green commit should only require changing source code, not rewriting the test.

## Assertion-Free Tests

Every test must assert something meaningful. A test without assertions always passes — it cannot produce the red X needed in Step 1.

**Bad**:

```typescript
it('processes the download', () => {
  processDownload('/models/checkpoints', 'model.safetensors')
  // No expect()!
})
```

**Good**:

```typescript
it('processes the download to correct path', () => {
  const result = processDownload('/models/checkpoints', 'model.safetensors')
  expect(result.savePath).toBe('/models/checkpoints/model.safetensors')
})
```

## Over-Mocking

Mock only system boundaries (network, filesystem, Electron APIs). If you mock the module under test, you are testing your mocks — the test will not detect the real bug.

**Bad** — mocking everything:

```typescript
vi.mock('./pathResolver')
vi.mock('./validator')
vi.mock('./downloader')

it('downloads model', () => {
  // This only tests that mocks were called, not that the bug exists
})
```

**Good** — mock only the boundary:

```typescript
vi.mock('./electronAPI') // Boundary: Electron IPC

it('resolves absolute path correctly', () => {
  const result = resolveModelPath('/root/models', '/root/models/checkpoints')
  expect(result).toBe('/root/models/checkpoints')
})
```

See also: [Don't Mock What You Don't Own](https://hynek.me/articles/what-to-mock-in-5-mins/)

## Giant Tests

A test that covers the entire flow makes it hard to pinpoint which part catches the bug. Keep it focused — one concept per test.

**Bad**:

```typescript
it('full model download flow', async () => {
  // 80 lines: load workflow, open dialog, select model,
  // click download, verify path, check progress, confirm completion
})
```

**Good**:

```typescript
it('resolves absolute savePath without nesting under modelsDirectory', () => {
  const result = getLocalSavePath(
    '/models',
    '/models/checkpoints',
    'file.safetensors'
  )
  expect(result).toBe('/models/checkpoints/file.safetensors')
})
```

If the bug is in path resolution, test path resolution — not the entire download flow.

## Test Duplication

Duplicated test code hides what actually differs between cases. Use parameterized tests.

**Bad**:

```typescript
it('resolves checkpoints path', () => {
  expect(resolve('/models', '/models/checkpoints', 'a.safetensors')).toBe(
    '/models/checkpoints/a.safetensors'
  )
})
it('resolves loras path', () => {
  expect(resolve('/models', '/models/loras', 'b.safetensors')).toBe(
    '/models/loras/b.safetensors'
  )
})
```

**Good**:

```typescript
it.each([
  ['/models/checkpoints', 'a.safetensors', '/models/checkpoints/a.safetensors'],
  ['/models/loras', 'b.safetensors', '/models/loras/b.safetensors']
])('resolves %s/%s to %s', (dir, file, expected) => {
  expect(resolve('/models', dir, file)).toBe(expected)
})
```

## Flaky Tests

A flaky test cannot prove anything — it may show red for reasons unrelated to the bug, or green despite the bug still existing.

**Common causes in this codebase:**

| Cause                                  | Fix                                     |
| -------------------------------------- | --------------------------------------- |
| Missing `nextFrame()` after canvas ops | Add `await comfyPage.nextFrame()`       |
| `waitForTimeout` instead of assertions | Use `toBeVisible()`, `toHaveText()`     |
| Shared state between tests             | Isolate with `afterEach` / `beforeEach` |
| Timing-dependent logic                 | Use `expect.poll()` or `toPass()`       |

## Gaming the Red-Green Process

These are ways the red-green proof gets invalidated during Step 2 (the fix commit). The test from Step 1 is immutable — if any of these happen, restart from Step 1.

**Weakening the assertion to make it pass:**

```typescript
// Step 1 (red) — strict assertion
expect(result).toBe('/external/drive/models/checkpoints/file.safetensors')

// Step 2 (green) — weakened to pass without a real fix
expect(result).toBeDefined() // This proves nothing
```

**Updating snapshots to bless the bug:**

```bash
# Instead of fixing the code, just updating the snapshot to match buggy output
pnpm test:unit -- --update
```

If a snapshot needs updating, the fix should change the code behavior, not the expected output.

**Adding mocks in Step 2 that hide the failure:**

```typescript
// Step 2 adds a mock that didn't exist in Step 1
vi.mock('./pathResolver', () => ({
  resolve: () => '/expected/path' // Hardcoded to pass
}))
```

Step 2 should only change source code — not test infrastructure.

## Testing the Happy Path Only

The red-green pattern specifically requires the test to exercise the **broken path**. If you only test the case that already works, the test will pass (green) on Step 1 — defeating the purpose.

**Bad** — testing the default case that works:

```typescript
it('downloads to default models directory', () => {
  // This already works — it won't produce a red X
  const result = resolve('/models', 'checkpoints', 'file.safetensors')
  expect(result).toBe('/models/checkpoints/file.safetensors')
})
```

**Good** — testing the case that is actually broken:

```typescript
it('downloads to external models directory configured via extra_model_paths', () => {
  // This is the broken case — absolute path from folder_paths API
  const result = resolve(
    '/models',
    '/external/drive/models/checkpoints',
    'file.safetensors'
  )
  expect(result).toBe('/external/drive/models/checkpoints/file.safetensors')
})
```
