Apply performance monitoring concepts from performance-test-guide.md to the specified test file: $ARGUMENTS

## Task Overview
Transform browser tests to include performance monitoring for canvas, node, and widget operations following the established performance testing patterns.

## Instructions

<analysis_phase>
1. **Read the target test file** specified in $ARGUMENTS
2. **Analyze test operations** to identify which ones should have performance monitoring based on the guide criteria:
   - ✅ **Monitor**: Node operations, widget interactions, canvas operations, graph operations, background operations
   - ❌ **Skip**: UI chrome elements, dialogs/modals, floating menus, gallery/template views
3. **Review existing test structure** to understand the test flow and key operations
</analysis_phase>

<implementation_phase>
4. **Add performance monitoring** following these steps:
   
   **a. Import and setup:**
   - Add `import { PerformanceMonitor } from '../helpers/performanceMonitor'`
   - Add `@perf` tag to test name
   - Initialize PerformanceMonitor with `comfyPage.page`
   - Create descriptive kebab-case test name
   - Call `startMonitoring(testName)`

   **b. Wrap appropriate operations:**
   - Use `measureOperation()` for node operations (creating, selecting, dragging, copying, deleting)
   - Use `measureOperation()` for widget interactions (input changes, clicks, value modifications)  
   - Use `measureOperation()` for canvas operations (panning, zooming, selections, connections)
   - Use `measureOperation()` for graph operations (loading workflows, undo/redo, batch operations)
   - Use `markEvent()` for logical boundaries and state transitions
   - Group related operations when they represent a single user action
   - Keep assertions and expectations outside performance measurements

   **c. Apply appropriate patterns:**
   - **User Interaction Sequence**: Separate click, type, submit operations
   - **Copy/Paste Operations**: Separate select, copy, paste with before/after marks
   - **Drag Operations**: Separate start-drag, drag-to-position, drop
   
   **d. Finalize:**
   - Call `finishMonitoring(testName)` at the end
   - Ensure all async operations are properly wrapped
</implementation_phase>

<naming_conventions>
- **Test names**: kebab-case, descriptive (e.g., 'copy-paste-multiple-nodes')
- **Operation names**: kebab-case, action-focused (e.g., 'click-node', 'drag-to-position')
- **Event marks**: kebab-case, state-focused (e.g., 'before-paste', 'after-render')
</naming_conventions>

<quality_guidelines>
- **Balance granularity**: Don't wrap every line, focus on meaningful operations
- **Maintain readability**: Wrapped code should remain clear and understandable
- **Preserve test logic**: Don't change test functionality, only add monitoring
- **Keep consistency**: Use similar operation names across similar tests
- **Group intelligently**: Combine related operations that represent single user actions
</quality_guidelines>

## Expected Output

Transform the test file to include:
1. Performance monitor import and initialization
2. `@perf` tag in test name
3. Appropriate `measureOperation()` wrapping for qualifying operations
4. `markEvent()` calls for logical boundaries
5. `finishMonitoring()` call at the end
6. Preserved test assertions and expectations outside performance measurements

Show the complete transformed test file with clear before/after comparison if the changes are substantial.

## Example Transformation Reference

Follow this pattern for transformation:

**Before:**
```typescript
test('Can copy and paste node', async ({ comfyPage }) => {
  await comfyPage.clickEmptyLatentNode()
  await comfyPage.ctrlC()
  await comfyPage.ctrlV()
  await expect(comfyPage.canvas).toHaveScreenshot('copied-node.png')
})
```

**After:**
```typescript
test('@perf Can copy and paste node', async ({ comfyPage }) => {
  const perfMonitor = new PerformanceMonitor(comfyPage.page)
  const testName = 'copy-paste-node'
  
  await perfMonitor.startMonitoring(testName)
  
  await perfMonitor.measureOperation('click-node', async () => {
    await comfyPage.clickEmptyLatentNode()
  })
  
  await perfMonitor.measureOperation('copy-node', async () => {
    await comfyPage.ctrlC()
  })
  
  await perfMonitor.measureOperation('paste-node', async () => {
    await comfyPage.ctrlV()
  })
  
  await expect(comfyPage.canvas).toHaveScreenshot('copied-node.png')
  
  await perfMonitor.finishMonitoring(testName)
})
```

Now apply these concepts to the test file: $ARGUMENTS