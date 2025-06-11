# Performance Test Wrapping Guide

This guide explains how to add performance monitoring to browser tests for canvas, node, and widget operations.

## When to Add Performance Monitoring

### ✅ Add `@perf` tag and wrappers for:
- **Node operations**: Creating, selecting, dragging, copying, deleting nodes
- **Widget interactions**: Input changes, widget clicks, value modifications
- **Canvas operations**: Panning, zooming, selections, connections between nodes
- **Graph operations**: Loading workflows, undo/redo, batch operations
- **Background/general operations**: Workflow execution, queue management, model loading

### ❌ Skip performance monitoring for:
- **UI chrome elements**: Menubar, topbar, sidebars, action bars
- **Dialogs and modals**: Settings, prompts, confirmations
- **Floating menus**: Context menus, tooltips
- **Gallery/template views**: Template selection, preview panels

## Available Performance Monitor Methods

1. **`startMonitoring(testName: string)`** - Initialize performance tracking
2. **`measureOperation(operationName: string, operation: () => Promise<T>)`** - Wrap async operations to measure duration
3. **`markEvent(eventName: string)`** - Mark specific points in time
4. **`finishMonitoring(testName: string)`** - Collect all metrics and cleanup

## Step-by-Step Implementation

### 1. Import the Performance Monitor
```typescript
import { PerformanceMonitor } from '../helpers/performanceMonitor'
```

### 2. Add @perf Tag to Test Name
```typescript
test('@perf Your test description', async ({ comfyPage }) => {
  // test implementation
})
```

### 3. Initialize Performance Monitor
```typescript
const perfMonitor = new PerformanceMonitor(comfyPage.page)
const testName = 'descriptive-test-name' // Use kebab-case

await perfMonitor.startMonitoring(testName)
```

### 4. Wrap Operations Based on Context

#### For Simple Actions
```typescript
await perfMonitor.measureOperation('operation-name', async () => {
  await comfyPage.someAction()
})
```

#### For Multi-Step Operations
```typescript
// Mark the beginning of a sequence
await perfMonitor.markEvent('sequence-start')

// Measure individual steps
await perfMonitor.measureOperation('step-1', async () => {
  await firstAction()
})

await perfMonitor.measureOperation('step-2', async () => {
  await secondAction()
})

// Mark the end
await perfMonitor.markEvent('sequence-end')
```

#### For Operations with Return Values
```typescript
let result: SomeType
await perfMonitor.measureOperation('get-value', async () => {
  result = await getValue()
})
// Use result! with non-null assertion
```

### 5. Finish Monitoring
```typescript
await perfMonitor.finishMonitoring(testName)
```

## Naming Conventions

- **Test names**: Use kebab-case, be descriptive (e.g., `'copy-paste-multiple-nodes'`)
- **Operation names**: Use kebab-case, describe the action (e.g., `'click-node'`, `'drag-to-position'`)
- **Event marks**: Use kebab-case for states or points in time (e.g., `'before-paste'`, `'after-render'`)

## Common Patterns

### Pattern 1: User Interaction Sequence
```typescript
await perfMonitor.measureOperation('click-element', async () => {
  await element.click()
})

await perfMonitor.measureOperation('type-text', async () => {
  await element.type('text')
})

await perfMonitor.measureOperation('submit-form', async () => {
  await element.press('Enter')
})
```

### Pattern 2: Copy/Paste Operations
```typescript
await perfMonitor.measureOperation('select-item', async () => {
  await selectItem()
})

await perfMonitor.measureOperation('copy-operation', async () => {
  await comfyPage.ctrlC()
})

await perfMonitor.markEvent('before-paste')

await perfMonitor.measureOperation('paste-operation', async () => {
  await comfyPage.ctrlV()
})

await perfMonitor.markEvent('after-paste')
```

### Pattern 3: Drag Operations
```typescript
await perfMonitor.measureOperation('start-drag', async () => {
  await page.mouse.down()
})

await perfMonitor.measureOperation('drag-to-position', async () => {
  await page.mouse.move(x, y)
})

await perfMonitor.measureOperation('drop', async () => {
  await page.mouse.up()
})
```

## Adapting to Individual Test Cases

### Consider the test's focus:
1. **Granularity**: For complex operations, break down into smaller measurements
2. **Key actions**: Focus on the primary actions being tested
3. **Skip trivial operations**: Don't wrap every single line (e.g., simple variable assignments)
4. **Meaningful boundaries**: Use `markEvent` for logical boundaries in the test flow

### Example of discretion:
```typescript
// Too granular - avoid this
await perfMonitor.measureOperation('get-textbox', async () => {
  const textBox = comfyPage.widgetTextBox
})

// Better - group related operations
const textBox = comfyPage.widgetTextBox
await perfMonitor.measureOperation('interact-with-textbox', async () => {
  await textBox.click()
  await textBox.selectText()
})
```

## What Gets Measured

The performance monitor automatically captures:
- **Memory usage**: JS heap size and limits
- **Timing metrics**: Page load, DOM ready, paint events
- **Custom operations**: Duration of wrapped operations
- **Marked events**: Timestamps of specific points

## Performance Data Persistence

### Automatic Collection
All performance metrics from `@perf` tests are automatically collected and saved to JSON files at the end of the test run via global teardown.

### File Output Structure
```
test-results/performance/
├── run-2024-01-15T10-30-45-123Z.json  # Timestamped run file
└── latest.json                        # Always points to most recent run
```

### JSON Schema
Each run file contains:
```typescript
{
  "runId": "run-2024-01-15T10-30-45-123Z",
  "timestamp": 1705315845123,
  "branch": "vue-widget/perf-test",
  "gitCommit": "abc123def456",
  "environment": {
    "nodeVersion": "v18.17.0",
    "playwrightVersion": "1.40.0",
    "os": "linux"
  },
  "testMetrics": [
    {
      "testName": "copy-paste-node",
      "timestamp": 1705315845000,
      "branch": "vue-widget/perf-test",
      "memoryUsage": {
        "usedJSHeapSize": 91700000,
        "totalJSHeapSize": 109000000,
        "jsHeapSizeLimit": 3760000000
      },
      "timing": {
        "firstPaint": 162.3,
        "firstContentfulPaint": 162.3,
        "domContentLoaded": 276.7
      },
      "customMetrics": {
        "click-node": 80.3,
        "copy-operation": 37.1,
        "paste-operation": 36.0
      }
    }
  ]
}
```

### Comparing Across Runs
- Each run generates a unique timestamped file for historical tracking
- Use `latest.json` for current run comparisons
- Git branch and commit info included for correlation with code changes
- Environment metadata helps identify platform-specific performance differences

## Tips

1. **Keep operation names consistent** across similar tests
2. **Don't wrap expectations** - Keep assertions outside performance measurements
3. **Group related operations** when they represent a single user action
4. **Use markEvent** for state transitions or important moments
5. **Balance detail with readability** - The wrapped code should still be easy to understand

## Example: Complete Test Transformation

### Before:
```typescript
test('Can copy and paste node', async ({ comfyPage }) => {
  await comfyPage.clickEmptyLatentNode()
  await comfyPage.page.mouse.move(10, 10)
  await comfyPage.ctrlC()
  await comfyPage.ctrlV()
  await expect(comfyPage.canvas).toHaveScreenshot('copied-node.png')
})
```

### After:
```typescript
test('@perf Can copy and paste node', async ({ comfyPage }) => {
  const perfMonitor = new PerformanceMonitor(comfyPage.page)
  const testName = 'copy-paste-node'
  
  await perfMonitor.startMonitoring(testName)
  
  await perfMonitor.measureOperation('click-node', async () => {
    await comfyPage.clickEmptyLatentNode()
  })
  
  await perfMonitor.measureOperation('position-mouse', async () => {
    await comfyPage.page.mouse.move(10, 10)
  })
  
  await perfMonitor.measureOperation('copy-node', async () => {
    await comfyPage.ctrlC()
  })
  
  await perfMonitor.measureOperation('paste-node', async () => {
    await comfyPage.ctrlV()
  })
  
  // Screenshot assertion stays outside performance monitoring
  await expect(comfyPage.canvas).toHaveScreenshot('copied-node.png')
  
  await perfMonitor.finishMonitoring(testName)
})
```