import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { recordMeasurement } from '../helpers/perfReporter'

test.describe('Performance', { tag: ['@perf'] }, () => {
  test('canvas idle style recalculations', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.perf.startMeasuring()

    // Let the canvas idle for 2 seconds — no user interaction.
    // Measures baseline style recalcs from reactive state + render loop.
    for (let i = 0; i < 120; i++) {
      await comfyPage.nextFrame()
    }

    const m = await comfyPage.perf.stopMeasuring('canvas-idle')
    recordMeasurement(m)
    console.log(
      `Canvas idle: ${m.styleRecalcs} style recalcs, ${m.layouts} layouts`
    )
  })

  test('canvas mouse interaction style recalculations', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.perf.startMeasuring()

    const canvas = comfyPage.canvas
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box not available')

    // Sweep mouse across the canvas — crosses nodes, empty space, slots
    for (let i = 0; i < 100; i++) {
      await comfyPage.page.mouse.move(
        box.x + (box.width * i) / 100,
        box.y + (box.height * (i % 3)) / 3
      )
    }

    const m = await comfyPage.perf.stopMeasuring('canvas-mouse-sweep')
    recordMeasurement(m)
    console.log(
      `Mouse sweep: ${m.styleRecalcs} style recalcs, ${m.layouts} layouts`
    )
  })

  test('DOM widget clipping during node selection', async ({ comfyPage }) => {
    // Load default workflow which has DOM widgets (text inputs, combos)
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.perf.startMeasuring()

    // Select and deselect nodes rapidly to trigger clipping recalculation
    const canvas = comfyPage.canvas
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box not available')

    for (let i = 0; i < 20; i++) {
      // Click on canvas area (nodes occupy various positions)
      await comfyPage.page.mouse.click(
        box.x + box.width / 3 + (i % 5) * 30,
        box.y + box.height / 3 + (i % 4) * 30
      )
      await comfyPage.nextFrame()
    }

    const m = await comfyPage.perf.stopMeasuring('dom-widget-clipping')
    recordMeasurement(m)
    console.log(`Clipping: ${m.layouts} forced layouts`)
  })

  test('subgraph idle style recalculations', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/nested-subgraph')
    await comfyPage.perf.startMeasuring()

    for (let i = 0; i < 120; i++) {
      await comfyPage.nextFrame()
    }

    const m = await comfyPage.perf.stopMeasuring('subgraph-idle')
    recordMeasurement(m)
    console.log(
      `Subgraph idle: ${m.styleRecalcs} style recalcs, ${m.layouts} layouts`
    )
  })

  test('subgraph mouse interaction style recalculations', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/nested-subgraph')
    await comfyPage.perf.startMeasuring()

    const canvas = comfyPage.canvas
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box not available')

    for (let i = 0; i < 100; i++) {
      await comfyPage.page.mouse.move(
        box.x + (box.width * i) / 100,
        box.y + (box.height * (i % 3)) / 3
      )
    }

    const m = await comfyPage.perf.stopMeasuring('subgraph-mouse-sweep')
    recordMeasurement(m)
    console.log(
      `Subgraph mouse sweep: ${m.styleRecalcs} style recalcs, ${m.layouts} layouts`
    )
  })

  test('large graph idle rendering', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')
    await comfyPage.perf.startMeasuring()

    // Let the large graph idle for 2 seconds — measures compositor and
    // style recalculation cost at scale (245 nodes).
    for (let i = 0; i < 120; i++) {
      await comfyPage.nextFrame()
    }

    const m = await comfyPage.perf.stopMeasuring('large-graph-idle')
    recordMeasurement(m)
    console.log(
      `Large graph idle: ${m.styleRecalcs} style recalcs, ${m.layouts} layouts`
    )
  })

  test('large graph pan interaction', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')

    const canvas = comfyPage.canvas
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box not available')

    await comfyPage.perf.startMeasuring()

    // Simulate panning across a large graph — stresses compositor
    // layer management and transform recalculation.
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    await comfyPage.page.mouse.move(centerX, centerY)
    await comfyPage.page.mouse.down({ button: 'middle' })
    for (let i = 0; i < 60; i++) {
      await comfyPage.page.mouse.move(centerX + i * 5, centerY + i * 2)
      await comfyPage.nextFrame()
    }
    await comfyPage.page.mouse.up({ button: 'middle' })

    const m = await comfyPage.perf.stopMeasuring('large-graph-pan')
    recordMeasurement(m)
    console.log(
      `Large graph pan: ${m.styleRecalcs} style recalcs, ${m.layouts} layouts, ${m.taskDurationMs.toFixed(1)}ms task`
    )
  })

  test('subgraph DOM widget clipping during node selection', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/nested-subgraph')
    await comfyPage.perf.startMeasuring()

    const canvas = comfyPage.canvas
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box not available')

    for (let i = 0; i < 20; i++) {
      await comfyPage.page.mouse.click(
        box.x + box.width / 3 + (i % 5) * 30,
        box.y + box.height / 3 + (i % 4) * 30
      )
      await comfyPage.nextFrame()
    }

    const m = await comfyPage.perf.stopMeasuring('subgraph-dom-widget-clipping')
    recordMeasurement(m)
    console.log(`Subgraph clipping: ${m.layouts} forced layouts`)
  })

  test('canvas zoom sweep', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.perf.startMeasuring()

    // Zoom in 10 steps, then zoom out 10 steps
    for (let i = 0; i < 10; i++) {
      await comfyPage.canvasOps.zoom(-100)
      await comfyPage.nextFrame()
    }
    for (let i = 0; i < 10; i++) {
      await comfyPage.canvasOps.zoom(100)
      await comfyPage.nextFrame()
    }

    const m = await comfyPage.perf.stopMeasuring('canvas-zoom-sweep')
    recordMeasurement(m)
    console.log(
      `Zoom sweep: ${m.layouts} layouts, ${m.frameDurationMs.toFixed(1)}ms/frame, TBT=${m.totalBlockingTimeMs.toFixed(0)}ms`
    )
  })

  test('minimap idle', async ({ comfyPage }) => {
    // Enable minimap via setting, load workflow, then measure idle cost
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', true)
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')

    // Wait for minimap to render
    await comfyPage.page
      .locator('.litegraph-minimap')
      .waitFor({ state: 'visible', timeout: 5000 })

    await comfyPage.perf.startMeasuring()

    // Idle for 2 seconds with minimap open and 245 nodes
    for (let i = 0; i < 120; i++) {
      await comfyPage.nextFrame()
    }

    const m = await comfyPage.perf.stopMeasuring('minimap-idle')
    recordMeasurement(m)
    console.log(
      `Minimap idle: ${m.styleRecalcs} style recalcs, ${m.layouts} layouts, TBT=${m.totalBlockingTimeMs.toFixed(0)}ms`
    )
  })

  test('PrimeVue dialog open style recalculations', async ({ comfyPage }) => {
    // Load workflow first so the page is settled
    await comfyPage.workflow.loadWorkflow('default')

    // Wait for initial load to stabilize
    for (let i = 0; i < 30; i++) {
      await comfyPage.nextFrame()
    }

    await comfyPage.perf.startMeasuring()

    // Open the settings dialog — triggers mounting of many PrimeVue
    // components (Dialog, InputText, Select, ToggleSwitch, etc.),
    // each of which injects <style> tags via PrimeVue's useStyle.
    await comfyPage.command.executeCommand('Comfy.ShowSettingsDialog')
    await comfyPage.page
      .getByTestId('settings-dialog')
      .waitFor({ state: 'visible', timeout: 5000 })

    // Let it settle so all component styles are injected
    for (let i = 0; i < 30; i++) {
      await comfyPage.nextFrame()
    }

    // Close the dialog
    await comfyPage.page.keyboard.press('Escape')
    for (let i = 0; i < 10; i++) {
      await comfyPage.nextFrame()
    }

    const m = await comfyPage.perf.stopMeasuring(
      'primevue-dialog-open-close'
    )
    recordMeasurement(m)
    console.log(
      `PrimeVue dialog: ${m.styleRecalcs} style recalcs, ${m.layouts} layouts, ${m.styleRecalcDurationMs.toFixed(1)}ms recalc time`
    )
  })

  test('workflow execution', async ({ comfyPage }) => {
    // Uses lightweight PrimitiveString → PreviewAny workflow (no GPU needed)
    await comfyPage.workflow.loadWorkflow('execution/partial_execution')
    await comfyPage.perf.startMeasuring()

    // Queue the prompt and wait for execution to complete
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')

    // Wait for the output widget to populate (execution_success)
    const outputNode = await comfyPage.nodeOps.getNodeRefById(1)
    await expect(async () => {
      expect(await (await outputNode.getWidget(0)).getValue()).toBe('foo')
    }).toPass({ timeout: 10000 })

    const m = await comfyPage.perf.stopMeasuring('workflow-execution')
    recordMeasurement(m)
    console.log(
      `Workflow execution: ${m.durationMs.toFixed(0)}ms total, ${m.layouts} layouts, TBT=${m.totalBlockingTimeMs.toFixed(0)}ms`
    )
  })
})
