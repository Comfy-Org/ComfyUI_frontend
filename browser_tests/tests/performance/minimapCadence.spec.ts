import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { recordMeasurement } from '@e2e/fixtures/utils/perfReporter'

test.describe('Minimap change cadence performance', { tag: ['@perf'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', true)
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

    await comfyPage.perf.startMeasuring()
    for (let update = 0; update < 20; update++) {
      await comfyPage.page.evaluate(
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
      await comfyPage.nextFrame()
      await comfyPage.page.evaluate(
        () => new Promise((resolve) => window.setTimeout(resolve, 110))
      )
    }
    const measurement = await comfyPage.perf.stopMeasuring(
      'minimap-progress-execution-cadence'
    )
    recordMeasurement(measurement)

    const finalProgress = await comfyPage.page.evaluate(() => {
      const node = window.app?.graph.nodes[0]
      if (!node) throw new Error('Graph has no nodes')
      return node.progress
    })
    expect(finalProgress).toBeCloseTo(19 / 20)
  })

  test('node geometry cadence', async ({ comfyPage }) => {
    const initialX = await comfyPage.page.evaluate(() => {
      const node = window.app?.graph.nodes[0]
      if (!node) throw new Error('Graph has no nodes')
      return node.pos[0]
    })

    await comfyPage.perf.startMeasuring()
    for (let update = 0; update < 20; update++) {
      await comfyPage.page.evaluate(() => {
        const app = window.app
        const node = app?.graph.nodes[0]
        if (!app || !node) throw new Error('Graph has no nodes')
        node.pos[0] += 1
        app.graph.setDirtyCanvas(true, true)
      })
      await comfyPage.nextFrame()
      await comfyPage.page.evaluate(
        () => new Promise((resolve) => window.setTimeout(resolve, 110))
      )
    }
    const measurement = await comfyPage.perf.stopMeasuring(
      'minimap-progress-geometry-cadence'
    )
    recordMeasurement(measurement)

    const finalX = await comfyPage.page.evaluate(() => {
      const node = window.app?.graph.nodes[0]
      if (!node) throw new Error('Graph has no nodes')
      return node.pos[0]
    })
    expect(finalX).toBe(initialX + 20)
  })

  test('node topology cadence', async ({ comfyPage }) => {
    const initialCount = await comfyPage.page.evaluate(() => {
      const graph = window.app?.graph
      if (!graph) throw new Error('Graph is not available')
      return graph.nodes.length
    })

    await comfyPage.perf.startMeasuring()
    for (let update = 0; update < 20; update++) {
      await comfyPage.page.evaluate(
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
      await comfyPage.nextFrame()
      await comfyPage.page.evaluate(
        () => new Promise((resolve) => window.setTimeout(resolve, 110))
      )
    }
    const measurement = await comfyPage.perf.stopMeasuring(
      'minimap-progress-topology-cadence'
    )
    recordMeasurement(measurement)

    const finalCount = await comfyPage.page.evaluate(() => {
      const graph = window.app?.graph
      if (!graph) throw new Error('Graph is not available')
      return graph.nodes.length
    })
    expect(finalCount).toBe(initialCount)
  })
})
