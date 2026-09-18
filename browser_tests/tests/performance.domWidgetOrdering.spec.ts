import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { recordMeasurement } from '@e2e/fixtures/utils/perfReporter'

const INTERACTIONS = 120

const workloadCells = [
  {
    label: 'dense',
    metric: 'dom-widget-order-dense-n200-w200-i120',
    nodeCount: 200,
    widgetCount: 200
  },
  {
    label: 'sparse',
    metric: 'dom-widget-order-sparse-n1000-w20-i120',
    nodeCount: 1_000,
    widgetCount: 20
  }
] as const

test.describe('DOM widget ordering baseline', { tag: ['@perf'] }, () => {
  for (const cell of workloadCells) {
    test(`${cell.label}: N=${cell.nodeCount}, W=${cell.widgetCount}`, async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')

      const identity = await comfyPage.page.evaluate(
        ({ nodeCount, widgetCount, interactions }) => {
          const app = window.app
          const LiteGraph = window.LiteGraph
          if (!app?.graph || !app.canvas || !LiteGraph) {
            throw new Error('Comfy graph runtime is unavailable')
          }

          const graph = app.graph
          graph.clear()

          const widgetNodeIndexes: number[] = []
          for (let index = 0; index < nodeCount; index++) {
            // VAEDecode has no built-in DOM widgets, so W is controlled solely
            // by this fixture rather than implicitly growing with N.
            const node = LiteGraph.createNode('VAEDecode')
            if (!node) throw new Error('Could not create VAEDecode node')
            node.pos = [50, 50]
            node.size = [200, 100]
            graph.add(node)

            // Spread sparse widgets deterministically across the full graph.
            const hasWidget =
              widgetCount === nodeCount ||
              (index * widgetCount) % nodeCount < widgetCount
            if (!hasWidget) continue

            const element = document.createElement('div')
            element.textContent = `perf-widget-${index}`
            element.dataset.perfDomWidget = 'true'
            element.style.width = '160px'
            element.style.height = '24px'
            node.addDOMWidget(`perf-widget-${index}`, 'perf', element, {
              serialize: false
            })
            widgetNodeIndexes.push(index)
          }

          if (widgetNodeIndexes.length !== widgetCount) {
            throw new Error(
              `Expected ${widgetCount} widgets, created ${widgetNodeIndexes.length}`
            )
          }

          const counter = { enabled: false, indexOfCalls: 0 }
          const state = {
            counter,
            interactions,
            nodeCount,
            widgetCount,
            widgetNodeIndexes
          }
          ;(
            window as typeof window & {
              __domWidgetOrderPerfState?: typeof state
            }
          ).__domWidgetOrderPerfState = state

          app.canvas.setDirty(true, true)
          return { interactions, nodeCount, widgetCount }
        },
        {
          interactions: INTERACTIONS,
          nodeCount: cell.nodeCount,
          widgetCount: cell.widgetCount
        }
      )

      expect(identity).toEqual({
        interactions: INTERACTIONS,
        nodeCount: cell.nodeCount,
        widgetCount: cell.widgetCount
      })

      // Allow widget registration and initial Vue DOM work outside the window.
      await comfyPage.idleFrames(10)
      await expect(
        comfyPage.page.locator('[data-perf-dom-widget="true"]')
      ).toHaveCount(cell.widgetCount)

      // Instrument the settled graph array. Installing this during setup can
      // race with post-load graph replacement on the first test in a worker.
      await comfyPage.page.evaluate(() => {
        const app = window.app
        const state = (
          window as typeof window & {
            __domWidgetOrderPerfState?: {
              counter: { enabled: boolean; indexOfCalls: number }
            }
          }
        ).__domWidgetOrderPerfState
        if (!app?.graph || !state) {
          throw new Error('DOM widget performance state is unavailable')
        }

        const nodes = app.graph.nodes
        const originalIndexOf = nodes.indexOf
        nodes.indexOf = function (...args) {
          if (state.counter.enabled) state.counter.indexOfCalls++
          return originalIndexOf.apply(this, args)
        }
      })

      await comfyPage.perf.startMeasuring()
      await comfyPage.page.evaluate(() => {
        const app = window.app
        const state = (
          window as typeof window & {
            __domWidgetOrderPerfState?: {
              counter: { enabled: boolean; indexOfCalls: number }
              interactions: number
              widgetNodeIndexes: number[]
            }
          }
        ).__domWidgetOrderPerfState
        if (!app?.graph || !app.canvas || !state) {
          throw new Error('DOM widget performance state is unavailable')
        }

        const widgetNodes = state.widgetNodeIndexes.map((nodeIndex) => {
          const node = app.graph.nodes[nodeIndex]
          if (!node) throw new Error(`Widget node ${nodeIndex} is unavailable`)
          return node
        })

        state.counter.enabled = true
        try {
          for (
            let interaction = 0;
            interaction < state.interactions;
            interaction++
          ) {
            const delta = interaction % 2 === 0 ? 1 : -1
            for (const node of widgetNodes) node.pos[0] += delta
            app.canvas.onDrawForeground?.(
              app.canvas.ctx,
              app.canvas.visible_area
            )
          }
        } finally {
          state.counter.enabled = false
        }
      })

      // Flush Vue style updates within the measured window.
      await comfyPage.idleFrames(30)
      const measurement = await comfyPage.perf.stopMeasuring(cell.metric)
      recordMeasurement(measurement)

      const indexOfCalls = await comfyPage.page.evaluate(() => {
        const state = (
          window as typeof window & {
            __domWidgetOrderPerfState?: {
              counter: { indexOfCalls: number }
            }
          }
        ).__domWidgetOrderPerfState
        if (!state)
          throw new Error('DOM widget performance state is unavailable')
        return state.counter.indexOfCalls
      })

      // Baseline proof for #16029: one graph-order scan per visible widget per
      // update. Dense is W=N; sparse keeps W much smaller than N.
      expect(indexOfCalls).toBe(cell.widgetCount * INTERACTIONS)
      console.log(
        `${cell.metric}: indexOf=${indexOfCalls}, task=${measurement.taskDurationMs.toFixed(0)}ms, style=${measurement.styleRecalcs}/${measurement.styleRecalcDurationMs.toFixed(0)}ms, layout=${measurement.layouts}/${measurement.layoutDurationMs.toFixed(0)}ms, frame-p95=${measurement.p95FrameDurationMs.toFixed(1)}ms`
      )
    })
  }
})
