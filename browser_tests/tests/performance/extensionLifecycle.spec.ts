import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import { recordMeasurement } from '@e2e/fixtures/utils/perfReporter'

const FRAME_COUNT = 120
const REFRESH_INTERVAL = 30
const EXPECTED_REFRESH_COUNT = Math.ceil(FRAME_COUNT / REFRESH_INTERVAL)

type DrawTarget = 'instance' | 'prototype'

type InstrumentationCounters = {
  wrapperCalls: number
  labelMeasurements: number
  rerouteFacadeReads: number
  dirtyTimerTicks: number
  listenerCalls: number
}

type InstrumentationResult = InstrumentationCounters & { restored: boolean }

type InstrumentationScope = Window & {
  __extensionLifecyclePerf?: {
    cleanup: () => InstrumentationResult
  }
}

async function installDrawInstrumentation(
  comfyPage: ComfyPage,
  target: DrawTarget
) {
  await comfyPage.page.evaluate((drawTarget) => {
    const app = window.app
    if (!app) throw new Error('window.app is not available')

    const canvas = app.canvas
    const graph = app.graph
    const drawOwner =
      drawTarget === 'prototype'
        ? (Object.getPrototypeOf(canvas) as typeof canvas)
        : canvas
    const originalDrawNode = drawOwner.drawNode
    const labelNodes = new Set(graph.nodes.slice(0, 16))
    const rerouteNodes = new Set(graph.nodes.slice(16, 32))
    const counters: InstrumentationCounters = {
      wrapperCalls: 0,
      labelMeasurements: 0,
      rerouteFacadeReads: 0,
      dirtyTimerTicks: 0,
      listenerCalls: 0
    }
    const listener = () => counters.listenerCalls++
    const wrapper: typeof drawOwner.drawNode = function (
      this: typeof canvas,
      node,
      context
    ) {
      originalDrawNode.call(this, node, context)
      counters.wrapperCalls++

      if (labelNodes.has(node)) {
        for (const line of node.title.split('\n')) {
          context.measureText(line)
          counters.labelMeasurements++
        }
      }

      if (rerouteNodes.has(node)) {
        void node.pos[0]
        void node.pos[1]
        void node.size[0]
        void node.size[1]
        counters.rerouteFacadeReads += 4
        for (const input of node.inputs) {
          void input.link
          counters.rerouteFacadeReads++
        }
        for (const output of node.outputs) {
          void output.links
          counters.rerouteFacadeReads++
        }
      }
    }
    drawOwner.drawNode = wrapper

    canvas.canvas.addEventListener('extension-perf-refresh', listener)
    const timer = window.setInterval(() => {
      counters.dirtyTimerTicks++
      graph.setDirtyCanvas(true, true)
    }, 250)

    const scope = window as InstrumentationScope
    scope.__extensionLifecyclePerf = {
      cleanup: () => {
        window.clearInterval(timer)
        canvas.canvas.removeEventListener('extension-perf-refresh', listener)
        if (drawOwner.drawNode === wrapper)
          drawOwner.drawNode = originalDrawNode
        delete scope.__extensionLifecyclePerf
        return {
          ...counters,
          restored: drawOwner.drawNode === originalDrawNode
        }
      }
    }
  }, target)
}

async function runRedrawFrames(comfyPage: ComfyPage) {
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    await comfyPage.page.evaluate(
      (dispatchRefresh) => {
        const app = window.app
        if (!app) throw new Error('window.app is not available')
        app.graph.setDirtyCanvas(true, true)
        if (dispatchRefresh) {
          app.canvas.canvas.dispatchEvent(new Event('extension-perf-refresh'))
        }
      },
      frame % REFRESH_INTERVAL === 0
    )
    await comfyPage.nextFrame()
  }
}

async function cleanupDrawInstrumentation(comfyPage: ComfyPage) {
  return await comfyPage.page.evaluate(() => {
    const installation = (window as InstrumentationScope)
      .__extensionLifecyclePerf
    if (!installation) throw new Error('Extension fixture not installed')
    return installation.cleanup()
  })
}

function expectInstrumentationCoverage(counters: InstrumentationResult) {
  expect(counters.wrapperCalls).toBeGreaterThan(0)
  expect(counters.labelMeasurements).toBeGreaterThan(0)
  expect(counters.rerouteFacadeReads).toBeGreaterThan(0)
  expect(counters.dirtyTimerTicks).toBeGreaterThan(0)
  expect(counters.listenerCalls).toBe(EXPECTED_REFRESH_COUNT)
  expect(counters.restored).toBe(true)
}

test.describe('Extension lifecycle performance', { tag: ['@perf'] }, () => {
  test('clean extension combined draw lifecycle', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')
    await fitToViewInstant(comfyPage)

    await installDrawInstrumentation(comfyPage, 'instance')
    await comfyPage.perf.startMeasuring()
    await runRedrawFrames(comfyPage)
    const measurement = await comfyPage.perf.stopMeasuring(
      'extension-clean-combined-draw'
    )
    recordMeasurement(measurement)

    expectInstrumentationCoverage(await cleanupDrawInstrumentation(comfyPage))
  })

  test('rgthree-style prototype draw lifecycle', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')
    await fitToViewInstant(comfyPage)

    await installDrawInstrumentation(comfyPage, 'prototype')
    await comfyPage.perf.startMeasuring()
    await runRedrawFrames(comfyPage)
    const measurement = await comfyPage.perf.stopMeasuring(
      'extension-rgthree-prototype-draw'
    )
    recordMeasurement(measurement)

    expectInstrumentationCoverage(await cleanupDrawInstrumentation(comfyPage))
  })
})
