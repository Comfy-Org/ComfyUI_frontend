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

  test('large graph zoom interaction', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')

    const canvas = comfyPage.canvas
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box not available')

    // Position mouse at center so wheel events hit the canvas
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    await comfyPage.page.mouse.move(centerX, centerY)

    await comfyPage.perf.startMeasuring()

    // Zoom in 30 steps then out 30 steps — each step triggers
    // ResizeObserver for all ~245 node elements due to CSS scale change.
    for (let i = 0; i < 30; i++) {
      await comfyPage.page.mouse.wheel(0, -100)
      await comfyPage.nextFrame()
    }
    for (let i = 0; i < 30; i++) {
      await comfyPage.page.mouse.wheel(0, 100)
      await comfyPage.nextFrame()
    }

    const m = await comfyPage.perf.stopMeasuring('large-graph-zoom')
    recordMeasurement(m)
    console.log(
      `Large graph zoom: ${m.layouts} layouts, ${m.layoutDurationMs.toFixed(1)}ms layout, ${m.frameDurationMs.toFixed(1)}ms/frame, TBT=${m.totalBlockingTimeMs.toFixed(0)}ms`
    )
  })

  test('large graph viewport pan sweep', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')

    const canvas = comfyPage.canvas
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box not available')

    // Pan aggressively across the full graph so many nodes cross the
    // viewport boundary, triggering mount/unmount cycles and GC churn.
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    await comfyPage.page.mouse.move(centerX, centerY)
    await comfyPage.page.mouse.down({ button: 'middle' })

    await comfyPage.perf.startMeasuring()

    // Sweep right (nodes exit left edge, new nodes enter right edge)
    for (let i = 0; i < 120; i++) {
      await comfyPage.page.mouse.move(centerX + i * 8, centerY + i * 3)
      await comfyPage.nextFrame()
    }
    // Sweep back left
    for (let i = 120; i > 0; i--) {
      await comfyPage.page.mouse.move(centerX + i * 8, centerY + i * 3)
      await comfyPage.nextFrame()
    }

    await comfyPage.page.mouse.up({ button: 'middle' })

    const m = await comfyPage.perf.stopMeasuring('viewport-pan-sweep')
    recordMeasurement(m)
    console.log(
      `Viewport pan sweep: ${m.styleRecalcs} recalcs, ${m.layouts} layouts, ` +
        `${m.taskDurationMs.toFixed(1)}ms task, ` +
        `heap Δ${(m.heapDeltaBytes / 1024).toFixed(0)}KB, ` +
        `${m.domNodes} DOM nodes`
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

  test.describe('vue renderer large graph', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow('large-graph-workflow')
      await comfyPage.vueNodes.waitForNodes()
    })

    test('idle', async ({ comfyPage }) => {
      await comfyPage.perf.startMeasuring()

      for (let i = 0; i < 120; i++) {
        await comfyPage.nextFrame()
      }

      const m = await comfyPage.perf.stopMeasuring('vue-large-graph-idle')
      recordMeasurement(m)
      console.log(
        `Vue large graph idle: ${m.styleRecalcs} style recalcs, ${m.layouts} layouts, ${m.domNodes} DOM nodes`
      )
    })

    test('pan', async ({ comfyPage }) => {
      const canvas = comfyPage.canvas
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas bounding box not available')

      await comfyPage.perf.startMeasuring()

      const centerX = box.x + box.width / 2
      const centerY = box.y + box.height / 2
      await comfyPage.page.mouse.move(centerX, centerY)
      await comfyPage.page.mouse.down({ button: 'middle' })
      for (let i = 0; i < 60; i++) {
        await comfyPage.page.mouse.move(centerX + i * 5, centerY + i * 2)
        await comfyPage.nextFrame()
      }
      await comfyPage.page.mouse.up({ button: 'middle' })

      const m = await comfyPage.perf.stopMeasuring('vue-large-graph-pan')
      recordMeasurement(m)
      console.log(
        `Vue large graph pan: ${m.styleRecalcs} style recalcs, ${m.layouts} layouts, ${m.frameDurationMs.toFixed(1)}ms/frame, TBT=${m.totalBlockingTimeMs.toFixed(0)}ms`
      )
    })

    test('zoom out culling', async ({ comfyPage }) => {
      await comfyPage.perf.startMeasuring()

      // Zoom out far enough that nodes become < 4px screen size
      // (triggers size-based culling in isNodeInViewport)
      for (let i = 0; i < 20; i++) {
        await comfyPage.canvasOps.zoom(100)
      }

      // Verify we actually entered the culling regime.
      // isNodeTooSmall triggers when max(width, height) * scale < 4px.
      // Typical nodes are ~200px wide, so scale must be < 0.02.
      const scale = await comfyPage.canvasOps.getScale()
      expect(scale).toBeLessThan(0.02)

      // Idle at extreme zoom-out — most nodes should be culled
      for (let i = 0; i < 60; i++) {
        await comfyPage.nextFrame()
      }

      // Zoom back in
      for (let i = 0; i < 20; i++) {
        await comfyPage.canvasOps.zoom(-100)
      }

      const m = await comfyPage.perf.stopMeasuring('vue-zoom-culling')
      recordMeasurement(m)
      console.log(
        `Vue zoom culling: ${m.styleRecalcs} style recalcs, ${m.layouts} layouts, ${m.frameDurationMs.toFixed(1)}ms/frame`
      )
    })
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
