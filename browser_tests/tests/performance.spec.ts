import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  logMeasurement,
  recordMeasurement
} from '@e2e/fixtures/utils/perfReporter'

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

  test('large graph legacy node drag', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')

    // Legacy drags write to layoutStore every frame because registration is
    // renderer-independent.
    const nodePos = await comfyPage.page.evaluate(() => {
      const app = window.app
      if (!app) throw new Error('window.app is not available')

      const { canvas } = app
      const node = app.graph.nodes[0]
      if (!node) throw new Error('Graph has no nodes')

      canvas.ds.scale = 1
      canvas.centerOnNode(node)
      const [x, y] = app.canvasPosToClientPos(node.pos)
      return { id: node.id, x, y, graphX: node.pos[0] }
    })
    await comfyPage.nextFrame()

    await comfyPage.perf.startMeasuring()

    await comfyPage.page.mouse.move(nodePos.x + 40, nodePos.y + 10)
    await comfyPage.page.mouse.down()
    for (let i = 0; i < 60; i++) {
      await comfyPage.page.mouse.move(
        nodePos.x + 40 + i * 4,
        nodePos.y + 10 + i * 2
      )
      await comfyPage.nextFrame()
    }
    await comfyPage.page.mouse.up()

    const m = await comfyPage.perf.stopMeasuring('legacy-node-drag')
    recordMeasurement(m)

    // Verify the measured interaction was a node drag, not a canvas pan.
    const movedX = await comfyPage.page.evaluate((id) => {
      const node = window.app?.graph.getNodeById(id)
      if (!node) throw new Error(`Node ${id} not found`)
      return node.pos[0]
    }, nodePos.id)
    expect(movedX).not.toBeCloseTo(nodePos.graphX, 0)

    console.log(
      `Legacy node drag: ${m.styleRecalcs} style recalcs, ${m.layouts} layouts, ${m.taskDurationMs.toFixed(1)}ms task`
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

    await comfyPage.perf.startMeasuring()
    await comfyPage.canvasOps.panSweep()

    const measurement = await comfyPage.perf.stopMeasuring('viewport-pan-sweep')
    recordMeasurement(measurement)
    logMeasurement('Viewport pan sweep', measurement, [
      'styleRecalcs',
      'layouts',
      'taskDurationMs',
      'heapDeltaBytes',
      'domNodes'
    ])
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

    test('node resize workload', async ({ comfyPage }) => {
      const nodeCount = await comfyPage.page
        .locator('[data-node-id]')
        .evaluateAll((elements) => {
          const nodes = elements.slice(0, 100) as HTMLElement[]
          for (const node of nodes) {
            node.dataset.perfOriginalWidth = node.style.width
            node.dataset.perfWidth = `${node.getBoundingClientRect().width}px`
          }
          return nodes.length
        })
      expect(nodeCount).toBe(100)

      await comfyPage.perf.startMeasuring()
      for (let index = 0; index < 10; index++) {
        await comfyPage.page
          .locator('[data-perf-width]')
          .evaluateAll((elements) => {
            for (const element of elements as HTMLElement[]) {
              const width = Number.parseFloat(element.dataset.perfWidth ?? '')
              element.style.width = `${width + 1}px`
            }
          })
        await comfyPage.nextFrame()
        await comfyPage.page
          .locator('[data-perf-width]')
          .evaluateAll((elements) => {
            for (const element of elements as HTMLElement[]) {
              element.style.width = element.dataset.perfWidth ?? ''
            }
          })
        await comfyPage.nextFrame()
      }

      const measurement = await comfyPage.perf.stopMeasuring(
        'vue-node-resize-workload'
      )
      recordMeasurement(measurement)

      await comfyPage.page
        .locator('[data-perf-width]')
        .evaluateAll((elements) => {
          for (const element of elements as HTMLElement[]) {
            element.style.width = element.dataset.perfOriginalWidth ?? ''
            delete element.dataset.perfOriginalWidth
            delete element.dataset.perfWidth
          }
        })
    })

    test('zoom out idle', async ({ comfyPage }) => {
      // This test previously claimed to measure size-based culling
      // (isNodeTooSmall / isNodeInViewport) and asserted scale < 0.02.
      // No such culling exists in production source: GraphCanvas.vue mounts
      // every Vue node from allNodes at any zoom, and the only
      // isNodeTooSmall / isNodeInViewport matches in the repo are stale
      // comments in this file. The assertion could never pass at the real
      // ds.min_scale clamp (0.1), which is what kept the perf job red and
      // the baseline pipeline dead (issue #15545).
      //
      // Until renderer-owned LOD lands (PR #15031 replaces Vue widget DOM
      // below the readable-font threshold, reachable at production zoom),
      // this measures the honest current behavior: frame cost at maximum
      // supported zoom-out with all Vue node DOM still mounted.
      await comfyPage.perf.startMeasuring()

      // Zoom out to the ds.min_scale clamp (0.1).
      for (let i = 0; i < 20; i++) {
        await comfyPage.canvasOps.zoom(100)
      }

      // Idle at maximum zoom-out with everything mounted.
      for (let i = 0; i < 60; i++) {
        await comfyPage.nextFrame()
      }

      // Zoom back in
      for (let i = 0; i < 20; i++) {
        await comfyPage.canvasOps.zoom(-100)
      }

      const m = await comfyPage.perf.stopMeasuring('vue-zoom-out-idle')
      recordMeasurement(m)
      console.log(
        `Vue zoom out idle: ${m.styleRecalcs} style recalcs, ${m.layouts} layouts, ${m.frameDurationMs.toFixed(1)}ms/frame`
      )
    })
  })

  test(
    'subgraph transition (enter and exit)',
    { tag: ['@vue-nodes'] },
    async ({ comfyPage }, testInfo) => {
      // Heaviest perf test: loads an 80-node subgraph and pays ~30s/repeat.
      // The signal is dominated by N=80 mount cost, so a single sample per
      // CI invocation is sufficient — early-return on subsequent repeats.
      if (testInfo.repeatEachIndex > 0) return

      // Load workflow with a subgraph containing 80 interior nodes.
      // Entering the subgraph unmounts root nodes and mounts all 80 interior
      // nodes synchronously — this is the bottleneck we're measuring.
      await comfyPage.workflow.loadWorkflow('subgraphs/large-subgraph-80-nodes')

      await comfyPage.idleFrames(30)

      await comfyPage.vueNodes.enterSubgraph()
      await comfyPage.vueNodes.waitForNodes(80)
      await comfyPage.idleFrames(30)

      // Exit back to root graph before measuring a fresh enter/exit cycle
      await comfyPage.subgraph.exitViaBreadcrumb()
      await comfyPage.idleFrames(10)

      // Start measuring the enter transition
      await comfyPage.perf.startMeasuring()

      await comfyPage.vueNodes.enterSubgraph()
      await comfyPage.vueNodes.waitForNodes(80)
      await comfyPage.idleFrames(30)

      const m = await comfyPage.perf.stopMeasuring('subgraph-transition-enter')
      recordMeasurement(m)
      console.log(
        `Subgraph enter (80 nodes): ${m.taskDurationMs.toFixed(0)}ms task, ${m.layouts} layouts, TBT=${m.totalBlockingTimeMs.toFixed(0)}ms`
      )
    }
  )

  test('workflow execution', async ({ comfyPage }) => {
    // Uses lightweight PrimitiveString → PreviewAny workflow (no GPU needed)
    await comfyPage.workflow.loadWorkflow('execution/partial_execution')
    await comfyPage.perf.startMeasuring()

    // Queue the prompt and wait for execution to complete
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')

    // Wait for the output widget to populate (execution_success)
    const outputNode = await comfyPage.nodeOps.getNodeRefById(1)
    await expect
      .poll(async () => (await outputNode.getWidget(0)).getValue(), {
        timeout: 10000
      })
      .toBe('foo')

    const m = await comfyPage.perf.stopMeasuring('workflow-execution')
    recordMeasurement(m)
    console.log(
      `Workflow execution: ${m.durationMs.toFixed(0)}ms total, ${m.layouts} layouts, TBT=${m.totalBlockingTimeMs.toFixed(0)}ms`
    )
  })
})
