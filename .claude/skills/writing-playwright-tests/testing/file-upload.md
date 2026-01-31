# File Upload & Drag-Drop Patterns

## Drag and Drop Files

Use for testing file drops onto canvas or nodes:

```typescript
// Drop file on canvas (default position)
await comfyPage.dragAndDropFile('workflowInMedia/workflow.webp')

// Drop file at specific position (on a node)
const node = await comfyPage.getNodeRefsByType('LoadImage')[0]
const { x, y } = await node.getPosition()
await comfyPage.dragAndDropFile('image32x32.webp', {
  dropPosition: { x, y }
})

// Wait for upload to complete
await comfyPage.dragAndDropFile('animated_webp.webp', {
  dropPosition: { x, y },
  waitForUpload: true
})
```

## Drag and Drop URLs

For testing URL drops (simulating drag from browser):

```typescript
await comfyPage.dragAndDropURL('https://example.com/workflow.png')
await expect(comfyPage.canvas).toHaveScreenshot('dropped_url.png')
```

## File Chooser Pattern

For testing file upload dialogs:

```typescript
// Set up file chooser promise before clicking
const fileChooserPromise = comfyPage.page.waitForEvent('filechooser')
await uploadButton.click()
const fileChooser = await fileChooserPromise

// Upload the test file
await fileChooser.setFiles(comfyPage.assetPath('image32x32.webp'))
```

## Workflow Upload Input

For loading workflow files:

```typescript
// This is what loadWorkflow() uses internally
await comfyPage.workflowUploadInput.setInputFiles(
  comfyPage.assetPath('workflow.json')
)
await comfyPage.nextFrame()
```

## Available Test Assets

Located in `browser_tests/assets/`:

### Images

- `image32x32.webp` - Small test image
- `image64x64.webp` - Larger test image
- `example.webp` - Example thumbnail
- `animated_webp.webp` - Animated WebP for animation tests

### Workflows in Media

- `workflowInMedia/workflow.webp` - Workflow embedded in WebP
- `workflowInMedia/workflow.png` - Workflow embedded in PNG
- `workflowInMedia/workflow.mp4` - Workflow embedded in MP4
- `workflowInMedia/workflow.svg` - Workflow embedded in SVG

## Example: Image Upload Test

```typescript
test('Can drag and drop image', async ({ comfyPage }) => {
  await comfyPage.loadWorkflow('widgets/load_image_widget')

  // Get position of the LoadImage node
  const nodes = await comfyPage.getNodeRefsByType('LoadImage')
  const loadImageNode = nodes[0]
  const { x, y } = await loadImageNode.getPosition()

  // Drag and drop image file onto the node
  await comfyPage.dragAndDropFile('image32x32.webp', {
    dropPosition: { x, y }
  })

  // Verify the image preview changed
  await expect(comfyPage.canvas).toHaveScreenshot(
    'image_preview_drag_and_dropped.png'
  )

  // Verify the filename combo was updated
  const fileComboWidget = await loadImageNode.getWidget(0)
  const filename = await fileComboWidget.getValue()
  expect(filename).toBe('image32x32.webp')
})
```

## Example: File Chooser Test

```typescript
test('should upload image file', async ({ comfyPage }) => {
  await comfyPage.page.keyboard.press('Control+,')
  const uploadButton = comfyPage.page.locator('button:has(.pi-upload)')

  // Set up file upload handler before clicking
  const fileChooserPromise = comfyPage.page.waitForEvent('filechooser')
  await uploadButton.click()
  const fileChooser = await fileChooserPromise

  // Upload the test image
  await fileChooser.setFiles(comfyPage.assetPath('image32x32.webp'))

  // Verify upload succeeded
  const urlInput = comfyPage.page.locator('input[type="text"]')
  await expect(urlInput).toHaveValue(/^\/api\/view\?/)
})
```

## Organizing Test Assets

Assets should be organized by feature:

```
browser_tests/assets/
├── widgets/               # Widget-specific workflows
│   ├── load_image_widget.json
│   └── boolean_widget.json
├── workflowInMedia/       # Files with embedded workflows
├── nodes/                 # Node-specific workflows
└── image32x32.webp        # Shared image assets
```

See [patterns/assets.md](assets.md) for full asset organization guide.
