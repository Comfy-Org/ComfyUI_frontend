# Browser Test Specifications

This directory contains the Playwright browser test specifications for the ComfyUI frontend.

## Writing Effective Tests

When writing new tests, follow these patterns:

### Test Structure

```typescript
// Import the test fixture
import { comfyPageFixture as test } from '../fixtures/ComfyPage';

test.describe('Feature Name', () => {
  // Set up test environment if needed
  test.beforeEach(async ({ comfyPage }) => {
    // Common setup
  });

  test('should do something specific', async ({ comfyPage }) => {
    // Test implementation
  });
});
```

### Leverage Existing Fixtures and Helpers

Always check for existing helpers and fixtures before implementing new ones:

- **ComfyPage**: Main fixture with methods for canvas interaction and node management
- **ComfyMouse**: Helper for precise mouse operations on the canvas
- **Helpers**: Check `browser_tests/helpers/` for specialized helpers like:
  - `actionbar.ts`: Interact with the action bar
  - `manageGroupNode.ts`: Group node management operations
  - `templates.ts`: Template workflows operations
- **Component Fixtures**: Check `browser_tests/fixtures/components/` for UI component helpers
- **Utility Functions**: Check `browser_tests/utils/` and `browser_tests/fixtures/utils/` for shared utilities

Most common testing needs are already addressed by these helpers, which will make your tests more consistent and reliable.

### Key Testing Patterns

1. **Focus elements explicitly**:
   Canvas-based elements often need explicit focus before interaction:
   ```typescript
   // Click the canvas first to focus it before pressing keys
   await comfyPage.canvas.click();
   await comfyPage.page.keyboard.press('a');
   ```

2. **Mark canvas as dirty if needed**:
   Some interactions need explicit canvas updates:
   ```typescript
   // After programmatically changing node state, mark canvas dirty
   await comfyPage.page.evaluate(() => {
     window['app'].graph.setDirtyCanvas(true, true);
   });
   ```

3. **Use node references over coordinates**: 
   Node references from `fixtures/utils/litegraphUtils.ts` provide stable ways to interact with nodes:
   ```typescript
   // Prefer this:
   const node = await comfyPage.getNodeRefsByType('LoadImage')[0];
   await node.click('title');
   
   // Over this:
   await comfyPage.canvas.click({ position: { x: 100, y: 100 } });
   ```

4. **Wait for canvas to render after UI interactions**:
   ```typescript
   await comfyPage.nextFrame();
   ```

5. **Clean up persistent server state**:
   While most state is reset between tests, anything stored on the server persists:
   ```typescript
   // Reset settings that affect other tests (these are stored on server)
   await comfyPage.setSetting('Comfy.ColorPalette', 'dark');
   await comfyPage.setSetting('Comfy.NodeBadge.NodeIdBadgeMode', 'None');
   
   // Clean up uploaded files if needed
   await comfyPage.request.delete(`${comfyPage.url}/api/delete/image.png`);
   ```

6. **Prefer functional assertions over screenshots**:
   Use screenshots only when visual verification is necessary:
   ```typescript
   // Prefer this:
   expect(await node.isPinned()).toBe(true);
   expect(await node.getProperty('title')).toBe('Expected Title');
   
   // Over this - only use when needed:
   await expect(comfyPage.canvas).toHaveScreenshot('state.png');
   ```

7. **Use minimal test workflows**:
   When creating test workflows, keep them as minimal as possible:
   ```typescript
   // Include only the components needed for the test
   await comfyPage.loadWorkflow('single_ksampler');
   ```

For more details and common patterns, see the main README in the `browser_tests/` directory.