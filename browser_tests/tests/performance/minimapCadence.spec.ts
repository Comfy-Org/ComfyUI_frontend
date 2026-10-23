import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { PerfMeasurement } from '@e2e/fixtures/helpers/PerformanceHelper'
import { recordMeasurement } from '@e2e/fixtures/utils/perfReporter'

const CADENCE_UPDATES = 20
const CADENCE_INTERVAL_MS = 110

function expectFramesToSpanMeasurementWindow(measurement: PerfMeasurement) {
  const sampledMs = measurement.allFrameDurationsMs.reduce((a, b) => a + b, 0)
  expect(sampledMs).toBeGreaterThan(measurement.durationMs / 2)
}

async function measureCadence(
  comfyPage: ComfyPage,
  measurementKey: string,
  applyUpdate: (update: number) => Promise<unknown>
) {
  await comfyPage.perf.startMeasuring()
  for (let update = 0; update < CADENCE_UPDATES; update++) {
    await applyUpdate(update)
    await comfyPage.nextFrame()
    await comfyPage.page.evaluate(
      (intervalMs) =>
        new Promise((resolve) => window.setTimeout(resolve, intervalMs)),
      CADENCE_INTERVAL_MS
    )
  }
  return await comfyPage.perf.stopMeasuring(measurementKey)
}

test.describe('Minimap change cadence performance', { tag: ['@perf'] }, () => {
  test.use({ initialSettings: { 'Comfy.Minimap.Visible': true } })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')
    await comfyPage.page
      .locator('.litegraph-minimap')
      .waitFor({ state: 'visible', timeout: 5000 })
  })

  test('execution-only progress cadence', async ({ comfyPage }) => {
    const nodeId = await comfyPage.page.evaluate(() => {
      const node = window.app?.graph.nodes[0]
      if (!node) throw new Error('Graph has no nodes')
      return String(node.id)
    })

    const measurement = await measureCadence(
      comfyPage,
      'minimap-progress-execution-cadence',
      (update) =>
        comfyPage.page.evaluate(
          ({ nodeId, update }) => {
            const api = window.app?.api
            if (!api) throw new Error('window.app.api is not available')
            api.dispatchCustomEvent('progress_state', {
              prompt_id: 'minimap-perf-job',
              nodes: {
                [nodeId]: {
                  value: update,
                  max: 20,
                  state: update % 2 === 0 ? 'finished' : 'running',
                  node_id: nodeId,
                  display_node_id: nodeId,
                  prompt_id: 'minimap-perf-job'
                }
              }
            })
          },
          { nodeId, update }
        )
    )
    expectFramesToSpanMeasurementWindow(measurement)

    const finalProgress = await comfyPage.page.evaluate(() => {
      const node = window.app?.graph.nodes[0]
      if (!node) throw new Error('Graph has no nodes')
      return node.progress
    })
    expect(finalProgress).toBeCloseTo(19 / 20)

    recordMeasurement(measurement)
  })

  test('node geometry cadence', async ({ comfyPage }) => {
    const initialX = await comfyPage.page.evaluate(() => {
      const node = window.app?.graph.nodes[0]
      if (!node) throw new Error('Graph has no nodes')
      return node.pos[0]
    })

    const measurement = await measureCadence(
      comfyPage,
      'minimap-geometry-cadence',
      () =>
        comfyPage.page.evaluate(() => {
          const app = window.app
          const node = app?.graph.nodes[0]
          if (!app || !node) throw new Error('Graph has no nodes')
          node.pos[0] += 1
          app.graph.setDirtyCanvas(true, true)
        })
    )
    expectFramesToSpanMeasurementWindow(measurement)

    const finalX = await comfyPage.page.evaluate(() => {
      const node = window.app?.graph.nodes[0]
      if (!node) throw new Error('Graph has no nodes')
      return node.pos[0]
    })
    expect(finalX).toBe(initialX + 20)

    recordMeasurement(measurement)
  })

  test('node topology cadence', async ({ comfyPage }) => {
    const initialCount = await comfyPage.page.evaluate(() => {
      const graph = window.app?.graph
      if (!graph) throw new Error('Graph is not available')
      return graph.nodes.length
    })

    const measurement = await measureCadence(
      comfyPage,
      'minimap-topology-cadence',
      (update) =>
        comfyPage.page.evaluate(
          (removeNode) => {
            const graph = window.app?.graph
            if (!graph) throw new Error('Graph is not available')

            type Scope = Window & {
              __minimapTopologyNode?: (typeof graph.nodes)[number]
            }
            const scope = window as Scope
            if (removeNode) {
              const node = graph.nodes.at(-1)
              if (!node) throw new Error('Graph has no removable node')
              scope.__minimapTopologyNode = node
              graph.remove(node)
            } else {
              const node = scope.__minimapTopologyNode
              if (!node) throw new Error('Removed node is unavailable')
              graph.add(node)
              delete scope.__minimapTopologyNode
            }
          },
          update % 2 === 0
        )
    )
    expectFramesToSpanMeasurementWindow(measurement)

    const finalCount = await comfyPage.page.evaluate(() => {
      const graph = window.app?.graph
      if (!graph) throw new Error('Graph is not available')
      return graph.nodes.length
    })
    expect(finalCount).toBe(initialCount)

    recordMeasurement(measurement)
  })
})
