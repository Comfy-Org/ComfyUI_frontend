# Templates Patterns

Testing the templates dialog and workflow loading from templates.

## Opening Templates Dialog

```typescript
await comfyPage.executeCommand('Comfy.BrowseTemplates')
await expect(comfyPage.templates.content).toBeVisible()
```

## Templates API

Access via `comfyPage.templates`:

```typescript
// Get all templates
const templates = await comfyPage.templates.getAllTemplates()

// Load a specific template
await comfyPage.templates.loadTemplate('default')

// Wait for cards to render
await comfyPage.templates.waitForMinimumCardCount(1)

// Check content visibility
await expect(comfyPage.templates.content).toBeVisible()
await expect(comfyPage.templates.content).toBeHidden()
```

## Template Test Setup

```typescript
test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  await comfyPage.setSetting('Comfy.Workflow.ShowMissingModelsWarning', false)
})
```

## Loading Templates

```typescript
// Clear workflow first
await comfyPage.menu.workflowsTab.open()
await comfyPage.executeCommand('Comfy.NewBlankWorkflow')
await expect(async () => {
  expect(await comfyPage.getGraphNodesCount()).toBe(0)
}).toPass({ timeout: 250 })

// Load template
await comfyPage.executeCommand('Comfy.BrowseTemplates')
await comfyPage.page.getByRole('button', { name: 'Getting Started' }).click()
await comfyPage.templates.loadTemplate('default')

// Verify nodes loaded
await expect(async () => {
  expect(await comfyPage.getGraphNodesCount()).toBeGreaterThan(0)
}).toPass({ timeout: 250 })
```

## Testing Template Localization

```typescript
test('Uses proper locale files', async ({ comfyPage }) => {
  await comfyPage.setSetting('Comfy.Locale', 'fr')

  await comfyPage.executeCommand('Comfy.BrowseTemplates')

  const dialog = comfyPage.page.getByRole('dialog').filter({
    has: comfyPage.page.getByRole('heading', { name: 'Modèles', exact: true })
  })
  await expect(dialog).toBeVisible()

  // Verify French-localized strings
  await expect(
    dialog.getByRole('heading', { name: 'Modèles', exact: true })
  ).toBeVisible()
})
```

## Mocking Template Responses

For testing template display with controlled data:

```typescript
await comfyPage.page.route('**/templates/index.json', async (route, _) => {
  const response = [
    {
      moduleName: 'default',
      title: 'Test Templates',
      type: 'image',
      templates: [
        {
          name: 'short-description',
          title: 'Short Description',
          mediaType: 'image',
          mediaSubtype: 'webp',
          description: 'This is a short description.'
        }
      ]
    }
  ]
  await route.fulfill({
    status: 200,
    body: JSON.stringify(response),
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  })
})

// Mock thumbnail images to avoid 404s
await comfyPage.page.route('**/templates/**.webp', async (route) => {
  await route.fulfill({
    status: 200,
    path: 'browser_tests/assets/example.webp',
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'no-store'
    }
  })
})
```

## Testing First-Time User Experience

```typescript
test('dialog shown to first-time users', async ({ comfyPage }) => {
  // Mark as first-time user
  await comfyPage.setSetting('Comfy.TutorialCompleted', false)

  // Reload page
  await comfyPage.setup({ clearStorage: true })

  // Templates dialog should auto-show
  expect(await comfyPage.templates.content.isVisible()).toBe(true)
})
```

## Testing 404 Fallback

```typescript
test('Falls back to English when locale file not found', async ({
  comfyPage
}) => {
  await comfyPage.setSetting('Comfy.Locale', 'de')

  // Intercept German file to simulate 404
  await comfyPage.page.route('**/templates/index.de.json', async (route) => {
    await route.fulfill({
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Not Found'
    })
  })

  // Allow English fallback
  await comfyPage.page.route('**/templates/index.json', (route) =>
    route.continue()
  )

  await comfyPage.executeCommand('Comfy.BrowseTemplates')
  await expect(comfyPage.templates.content).toBeVisible()
})
```
