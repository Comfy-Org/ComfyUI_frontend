import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import { recordMeasurement } from '@e2e/fixtures/utils/perfReporter'

const UPDATE_COUNT = 20

type MinimapInstrumentation = {
  repaintCount: number
  cleanup: () => { repaintCount: number; restored: boolean }
}

type MinimapInstrumentationScope = Window & {
  __minimapCadencePerf?: MinimapInstrumentation
  __minimapTopologyNode?: ReturnType<
    NonNullable<typeof window.LiteGraph>['createNode']
  >
}

async function installMinimapInstrumentation(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    const app = window.app
    if (!app?.graph) throw new Error('window.app.graph is not available')

    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-testid="minimap-canvas"]'
    )
    if (!canvas) throw new Error('Minimap canvas is not available')

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Minimap 2D context is not available')

    const originalClearRect = context.clearRect
    const scope = window as MinimapInstrumentationScope
    if (scope.__minimapCadencePerf) {
      throw new Error('Minimap instrumentation is already installed')
    }

    const instrumentation: MinimapInstrumentation = {
      repaintCount: 0,
      cleanup: () => {
        context.clearRect = originalClearRect
        delete scope.__minimapCadencePerf
        return {
          repaintCount: instrumentation.repaintCount,
          restored: context.clearRect === originalClearRect
        }
      }
    }
    context.clearRect = function (...args) {
      instrumentation.repaintCount++
      return originalClearRect.apply(this, args)
    }
    scope.__minimapCadencePerf = instrumentation
  })
}

async function waitForNextMinimapRepaint(
  comfyPage: ComfyPage,
  previousCount: number
) {
  await expect
    .poll(
      () =>
        comfyPage.page.evaluate(() => {
          const instrumentation = (window as MinimapInstrumentationScope)
            .__minimapCadencePerf
          if (!instrumentation) {
            throw new Error('Minimap instrumentation is not installed')
          }
          return instrumentation.repaintCount
        }),
      { message: 'minimap should repaint after the graph change' }
    )
    .toBeGreaterThan(previousCount)
}

async function getMinimapRepaintCount(comfyPage: ComfyPage) {
  return await comfyPage.page.evaluate(() => {
    const instrumentation = (window as MinimapInstrumentationScope)
      .__minimapCadencePerf
    if (!instrumentation) {
      throw new Error('Minimap instrumentation is not installed')
    }
    return instrumentation.repaintCount
  })
}

async function cleanupMinimapInstrumentation(comfyPage: ComfyPage) {
  return await comfyPage.page.evaluate(() => {
    const instrumentation = (window as MinimapInstrumentationScope)
      .__minimapCadencePerf
    if (!instrumentation) {
      throw new Error('Minimap instrumentation is not installed')
    }
    return instrumentation.cleanup()
  })
}

function expectInstrumentationCoverage(result: {
  repaintCount: number
  restored: boolean
}) {
  expect(result.repaintCount).toBeGreaterThanOrEqual(UPDATE_COUNT)
  expect(result.restored).toBe(true)
}

test.describe('Minimap change cadence performance', { tag: ['@perf'] }, () => {
  test.use({
    initialSettings: {
      'Comfy.Appearance.DisableAnimations': true,
      'Comfy.Minimap.NodeColors': true,
      'Comfy.Minimap.RenderBypassState': true,
      'Comfy.Minimap.RenderErrorState': true,
      'Comfy.Minimap.ShowGroups': true,
      'Comfy.Minimap.ShowLinks': true,
      'Comfy.Minimap.Visible': true,
      'Comfy.VueNodes.Enabled': false
    }
  })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')
    await comfyPage.page
      .locator('.litegraph-minimap')
      .waitFor({ state: 'visible', timeout: 5000 })
    await fitToViewInstant(comfyPage)
    await installMinimapInstrumentation(comfyPage)
  })

  test('execution-only progress cadence', async ({ comfyPage }) => {
    const nodeId = await comfyPage.page.evaluate(() => {
      const app = window.app
      if (!app?.graph) throw new Error('window.app.graph is not available')
      if (app.graph.nodes.length === 0) throw new Error('Graph has no nodes')
      const node = app.graph.nodes[0]
      return String(node.id)
    })

    await comfyPage.perf.startMeasuring()
    for (let update = 0; update < UPDATE_COUNT; update++) {
      const previousRepaintCount = await getMinimapRepaintCount(comfyPage)
      await comfyPage.page.evaluate(
        ({ nodeId, update, updateCount }) => {
          const app = window.app
          if (!app?.api) throw new Error('window.app.api is not available')
          app.api.dispatchCustomEvent('progress_state', {
            prompt_id: 'minimap-perf-job',
            nodes: {
              [nodeId]: {
                value: update,
                max: updateCount,
                state: update % 2 === 0 ? 'finished' : 'running',
                node_id: nodeId,
                display_node_id: nodeId,
                prompt_id: 'minimap-perf-job'
              }
            }
          })
        },
        { nodeId, update, updateCount: UPDATE_COUNT }
      )
      await waitForNextMinimapRepaint(comfyPage, previousRepaintCount)
    }
    const measurement = await comfyPage.perf.stopMeasuring(
      'minimap-progress-execution-cadence'
    )
    const instrumentation = await cleanupMinimapInstrumentation(comfyPage)

    const finalProgress = await comfyPage.page.evaluate(() => {
      const app = window.app
      if (!app?.graph) throw new Error('window.app.graph is not available')
      if (app.graph.nodes.length === 0) throw new Error('Graph has no nodes')
      const node = app.graph.nodes[0]
      return node.progress
    })
    const finalUpdate = UPDATE_COUNT - 1
    const expectedProgress =
      finalUpdate % 2 === 0 ? undefined : finalUpdate / UPDATE_COUNT
    expect(finalProgress).toBe(expectedProgress)
    expectInstrumentationCoverage(instrumentation)
    recordMeasurement(measurement)
  })

  test('node geometry cadence', async ({ comfyPage }) => {
    const initialX = await comfyPage.page.evaluate(() => {
      const app = window.app
      if (!app?.graph) throw new Error('window.app.graph is not available')
      if (app.graph.nodes.length === 0) throw new Error('Graph has no nodes')
      const node = app.graph.nodes[0]
      return node.pos[0]
    })

    await comfyPage.perf.startMeasuring()
    for (let update = 0; update < UPDATE_COUNT; update++) {
      const previousRepaintCount = await getMinimapRepaintCount(comfyPage)
      await comfyPage.page.evaluate(() => {
        const app = window.app
        if (!app?.graph) throw new Error('window.app.graph is not available')
        if (app.graph.nodes.length === 0) throw new Error('Graph has no nodes')
        const node = app.graph.nodes[0]
        node.pos[0] += 1
        app.graph.setDirtyCanvas(true, true)
      })
      await waitForNextMinimapRepaint(comfyPage, previousRepaintCount)
    }
    const measurement = await comfyPage.perf.stopMeasuring(
      'minimap-geometry-cadence'
    )
    const instrumentation = await cleanupMinimapInstrumentation(comfyPage)

    const finalX = await comfyPage.page.evaluate(() => {
      const app = window.app
      if (!app?.graph) throw new Error('window.app.graph is not available')
      if (app.graph.nodes.length === 0) throw new Error('Graph has no nodes')
      const node = app.graph.nodes[0]
      return node.pos[0]
    })
    expect(finalX).toBe(initialX + UPDATE_COUNT)
    expectInstrumentationCoverage(instrumentation)
    recordMeasurement(measurement)
  })

  test('node topology cadence', async ({ comfyPage }) => {
    const initialCount = await comfyPage.page.evaluate(() => {
      const app = window.app
      if (!app?.graph) throw new Error('window.app.graph is not available')
      return app.graph.nodes.length
    })

    await comfyPage.perf.startMeasuring()
    for (let update = 0; update < UPDATE_COUNT; update++) {
      const previousRepaintCount = await getMinimapRepaintCount(comfyPage)
      const actualCount = await comfyPage.page.evaluate(
        ({ addNode }) => {
          const app = window.app
          const LiteGraph = window.LiteGraph
          if (!app?.graph) throw new Error('window.app.graph is not available')
          if (!LiteGraph) throw new Error('window.LiteGraph is not available')

          const scope = window as MinimapInstrumentationScope
          if (addNode) {
            if (scope.__minimapTopologyNode) {
              throw new Error('Throwaway topology node already exists')
            }
            const node = LiteGraph.createNode('Note')
            if (!node)
              throw new Error('Failed to create throwaway topology node')
            scope.__minimapTopologyNode = node
            app.graph.add(node)
          } else {
            const node = scope.__minimapTopologyNode
            if (!node) throw new Error('Throwaway topology node is unavailable')
            app.graph.remove(node)
            delete scope.__minimapTopologyNode
          }
          return app.graph.nodes.length
        },
        { addNode: update % 2 === 0 }
      )
      const expectedCount = initialCount + (update % 2 === 0 ? 1 : 0)
      expect(actualCount).toBe(expectedCount)
      await waitForNextMinimapRepaint(comfyPage, previousRepaintCount)
    }
    const measurement = await comfyPage.perf.stopMeasuring(
      'minimap-topology-cadence'
    )
    const instrumentation = await cleanupMinimapInstrumentation(comfyPage)

    const finalCount = await comfyPage.page.evaluate(() => {
      const app = window.app
      if (!app?.graph) throw new Error('window.app.graph is not available')
      return app.graph.nodes.length
    })
    expect(finalCount).toBe(initialCount)
    expectInstrumentationCoverage(instrumentation)
    recordMeasurement(measurement)
  })
})
