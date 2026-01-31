# Mocking Patterns

## API Route Mocking

```typescript
test('mocks API response', async ({ comfyPage }) => {
  await comfyPage.page.route('**/api/queue', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ queue_running: [], queue_pending: [] })
    })
  )

  // Test continues with mocked response
})
```

## Mocking External Resources

### Block Image Loading (Performance)

```typescript
test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.page
    .context()
    .route('**/*.{png,jpg,jpeg}', (route) => route.abort())
})
```

### Mock Model List

```typescript
await comfyPage.page.route('**/object_info', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      CheckpointLoaderSimple: {
        input: {
          required: {
            ckpt_name: [['model1.safetensors', 'model2.safetensors']]
          }
        }
      }
    })
  })
)
```

## Mocking Release Info (Default)

By default, tests mock the release check to prevent popup:

```typescript
// This is already done in fixtures, but if you need custom:
await comfyPage.page.route('**/api/releases', (route) =>
  route.fulfill({
    status: 200,
    body: JSON.stringify({ releases: [] })
  })
)
```

## WebSocket Mocking

For status updates and execution progress:

```typescript
// The fixture provides a websocket helper
const { websocket } = await comfyPage.getWebSocket()

// Send mock status
await websocket.send(
  JSON.stringify({
    type: 'status',
    data: { exec_info: { queue_remaining: 0 } }
  })
)
```

## Mock File Upload Response

```typescript
await comfyPage.page.route('**/upload/image', (route) =>
  route.fulfill({
    status: 200,
    body: JSON.stringify({ name: 'uploaded.png', subfolder: '', type: 'input' })
  })
)
```

## Intercepting Requests

```typescript
test('captures API call', async ({ comfyPage }) => {
  const requestPromise = comfyPage.page.waitForRequest('**/api/prompt')

  // Trigger action that makes request
  await comfyPage.page.keyboard.press('Control+Enter')

  const request = await requestPromise
  const body = request.postDataJSON()
  expect(body.prompt).toBeDefined()
})
```

## Intercepting Responses

```typescript
test('validates response', async ({ comfyPage }) => {
  const responsePromise = comfyPage.page.waitForResponse('**/api/history')

  // Trigger action
  await comfyPage.page.click('[data-testid="history-btn"]')

  const response = await responsePromise
  expect(response.status()).toBe(200)
})
```

## Example: Complete Mocking Test

```typescript
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from './fixtures/ComfyPage'

test.describe('API Mocking', { tag: ['@ui'] }, () => {
  test('shows empty queue message', async ({ comfyPage }) => {
    // Mock empty queue
    await comfyPage.page.route('**/api/queue', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          queue_running: [],
          queue_pending: []
        })
      })
    )

    await comfyPage.loadWorkflow('default')
    await comfyPage.page.click('[data-testid="queue-btn"]')

    await expect(comfyPage.page.getByText('Queue is empty')).toBeVisible()
  })

  test('handles API error', async ({ comfyPage }) => {
    await comfyPage.page.route('**/api/prompt', (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server error' })
      })
    )

    await comfyPage.loadWorkflow('default')
    await comfyPage.page.keyboard.press('Control+Enter')

    await expect(comfyPage.page.getByText('Error')).toBeVisible()
  })
})
```
