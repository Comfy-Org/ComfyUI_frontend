# Playwright Testing for ComfyUI_frontend

This document outlines the setup, usage, and common patterns for Playwright browser tests in the ComfyUI_frontend project.

## WARNING

The browser tests will change the ComfyUI backend state, such as user settings and saved workflows.
If `TEST_COMFYUI_DIR` in `.env` isn't set to your `(Comfy Path)/ComfyUI` directory, these changes won't be automatically restored.

## Setup

### ComfyUI devtools
Clone <https://github.com/Comfy-Org/ComfyUI_devtools> to your `custom_nodes` directory.  
_ComfyUI_devtools adds additional API endpoints and nodes to ComfyUI for browser testing._

### Node.js & Playwright Prerequisites
Ensure you have Node.js v20 or later installed. Then, set up the Chromium test driver:
```bash
npx playwright install chromium --with-deps
```

### Environment Variables
Ensure the environment variables in `.env` are set correctly according to your setup. 

The `.env` file will not exist until you create it yourself.

A template with helpful information can be found in `.env_example`.

### Multiple Tests
If you are running Playwright tests in parallel or running the same test multiple times, the flag `--multi-user` must be added to the main ComfyUI process.

## Running Tests

There are two ways to run the tests:

1. **Headless mode with report generation:**
   ```bash
   npx playwright test
   ```
   This runs all tests without a visible browser and generates a comprehensive test report.

2. **UI mode for interactive testing:**
   ```bash
   npx playwright test --ui
   ```
   This opens a user interface where you can select specific tests to run and inspect the test execution timeline.

   ![Playwright UI Mode](https://github.com/user-attachments/assets/6a1ebef0-90eb-4157-8694-f5ee94d03755)

3. **Running specific tests:**
   ```bash
   npx playwright test widget.spec.ts
   ```

## Test Structure

Browser tests in this project follow a specific organization pattern:

- **Fixtures**: Located in `fixtures/` - These provide test setup and utilities
  - `ComfyPage.ts` - The main fixture for interacting with ComfyUI
  - `ComfyMouse.ts` - Utility for mouse interactions with the canvas
  - Components fixtures in `fixtures/components/` - Page object models for UI components

- **Tests**: Located in `tests/` - The actual test specifications
  - Organized by functionality (e.g., `widget.spec.ts`, `interaction.spec.ts`)
  - Snapshot directories (e.g., `widget.spec.ts-snapshots/`) contain reference screenshots

- **Utilities**: Located in `utils/` - Common utility functions
  - `litegraphUtils.ts` - Utilities for working with LiteGraph nodes

## Common Patterns and Utilities

### Page Object Pattern

Tests use the Page Object pattern to create abstractions over the UI:

```typescript
// Using the ComfyPage fixture
test('Can toggle boolean widget', async ({ comfyPage }) => {
  await comfyPage.loadWorkflow('widgets/boolean_widget')
  const node = (await comfyPage.getFirstNodeRef())!
  const widget = await node.getWidget(0)
  await widget.click()
});
```

### Node References

The `NodeReference` class provides helpers for interacting with LiteGraph nodes:

```typescript
// Getting node by type and interacting with it
const nodes = await comfyPage.getNodeRefsByType('LoadImage')
const loadImageNode = nodes[0]
const widget = await loadImageNode.getWidget(0)
await widget.click()
```

### Visual Regression Testing

Tests use screenshot comparisons to verify UI state:

```typescript
// Take a screenshot and compare to reference
await expect(comfyPage.canvas).toHaveScreenshot('boolean_widget_toggled.png')
```

### Waiting for Animations

Always call `nextFrame()` after actions that trigger animations:

```typescript
await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
await comfyPage.nextFrame() // Wait for canvas to redraw
```

### Mouse Interactions

Canvas operations use special helpers to ensure proper timing:

```typescript
// Using ComfyMouse for drag and drop
await comfyMouse.dragAndDrop(
  { x: 100, y: 100 },  // From
  { x: 200, y: 200 }   // To
)

// Standard ComfyPage helpers
await comfyPage.drag({ x: 100, y: 100 }, { x: 200, y: 200 })
await comfyPage.pan({ x: 200, y: 200 })
await comfyPage.zoom(-100) // Zoom in
```

### Workflow Management

Tests use workflows stored in `assets/` for consistent starting points:

```typescript
// Load a test workflow
await comfyPage.loadWorkflow('single_ksampler')

// Wait for workflow to load and stabilize
await comfyPage.nextFrame()
```

### Custom Assertions

The project includes custom Playwright assertions through `comfyExpect`:

```typescript
// Check if a node is in a specific state
await expect(node).toBePinned()
await expect(node).toBeBypassed()
await expect(node).toBeCollapsed()
```

## Troubleshooting Common Issues

### Flaky Tests

- **Timing Issues**: Always wait for animations to complete with `nextFrame()`
- **Coordinate Sensitivity**: Canvas coordinates are viewport-relative; use node references when possible
- **Test Isolation**: Tests run in parallel; avoid dependencies between tests
- **Screenshots vary**: Ensure your OS and browser match the reference environment (Linux)

### Missing Node Elements

If nodes or widgets aren't found:
1. Ensure the workflow is loaded and rendered
2. Verify node types and widget indices
3. Inspect the ComfyUI backend logs for errors

### Canvas State Not Reset

The tests modify ComfyUI state. To reset between test runs:
1. Stop ComfyUI
2. Delete `ComfyUI/temp`
3. Delete `ComfyUI/user` if needed
4. Restart ComfyUI with `--multi-user` flag

## Screenshot Expectations

Due to variations in system font rendering, screenshot expectations are platform-specific. Please note:

- We maintain Linux screenshot expectations as our GitHub Action runner operates in a Linux environment.
- To set new test expectations:
  1. Create a pull request from a `Comfy-Org/ComfyUI_frontend` branch.
  2. Add the `New Browser Test Expectation` tag to your pull request.
  3. This will trigger a GitHub action to update the screenshot expectations automatically.

> **Note:** If you're making a pull request from a forked repository, the GitHub action won't be able to commit updated screenshot expectations directly to your PR branch.