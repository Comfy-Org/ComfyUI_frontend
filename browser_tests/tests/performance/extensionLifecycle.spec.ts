import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import { recordMeasurement } from '@e2e/fixtures/utils/perfReporter'

const FRAME_COUNT = 120
const REFRESH_INTERVAL = 30
const EXPECTED_REFRESH_COUNT = Math.ceil(FRAME_COUNT / REFRESH_INTERVAL)

test.describe('Extension lifecycle performance', { tag: ['@perf'] }, () => {
  test('clean extension combined draw lifecycle', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')
    await fitToViewInstant(comfyPage)

    const identity = await comfyPage.page.evaluate(() => {
      const app = window.app
      if (!app) throw new Error('window.app is not available')

      type Counters = {
        wrapperCalls: number
        labelMeasurements: number
        rerouteFacadeReads: number
        dirtyTimerTicks: number
        listenerCalls: number
      }
      type Scope = Window & {
        __cleanExtensionPerf?: {
          cleanup: () => Counters & { restored: boolean }
        }
      }

      const canvas = app.canvas
      const graph = app.graph
      const originalDrawNode = canvas.drawNode
      const labelNodes = new Set(graph.nodes.slice(0, 16))
      const rerouteNodes = new Set(graph.nodes.slice(16, 32))
      const counters: Counters = {
        wrapperCalls: 0,
        labelMeasurements: 0,
        rerouteFacadeReads: 0,
        dirtyTimerTicks: 0,
        listenerCalls: 0
      }
      const listener = () => counters.listenerCalls++

      canvas.drawNode = function (node, context) {
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

      canvas.canvas.addEventListener('extension-perf-refresh', listener)
      const timer = window.setInterval(() => {
        counters.dirtyTimerTicks++
        graph.setDirtyCanvas(true, true)
      }, 250)

      const scope = window as Scope
      scope.__cleanExtensionPerf = {
        cleanup: () => {
          window.clearInterval(timer)
          canvas.canvas.removeEventListener('extension-perf-refresh', listener)
          canvas.drawNode = originalDrawNode
          delete scope.__cleanExtensionPerf
          return { ...counters, restored: canvas.drawNode === originalDrawNode }
        }
      }

      return {
        fixture: 'comfy.clean-extension-compat.v1',
        labelPatternSource:
          'rgthree-comfy@13b4399c00b5ef5a97b1b6800fc1185874740f5d',
        reroutePatternSource: 'rgthree-comfy@629c514a',
        compatibilityPatternSource:
          'ComfyUI-KJNodes@3f20054214fec9f9234fd3841ae6f1e4287948f6'
      }
    })

    expect(identity).toEqual({
      fixture: 'comfy.clean-extension-compat.v1',
      labelPatternSource:
        'rgthree-comfy@13b4399c00b5ef5a97b1b6800fc1185874740f5d',
      reroutePatternSource: 'rgthree-comfy@629c514a',
      compatibilityPatternSource:
        'ComfyUI-KJNodes@3f20054214fec9f9234fd3841ae6f1e4287948f6'
    })

    await comfyPage.perf.startMeasuring()
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
    const measurement = await comfyPage.perf.stopMeasuring(
      'extension-clean-combined-draw'
    )
    recordMeasurement(measurement)

    const counters = await comfyPage.page.evaluate(() => {
      type Scope = Window & {
        __cleanExtensionPerf?: {
          cleanup: () => {
            wrapperCalls: number
            labelMeasurements: number
            rerouteFacadeReads: number
            dirtyTimerTicks: number
            listenerCalls: number
            restored: boolean
          }
        }
      }
      const installation = (window as Scope).__cleanExtensionPerf
      if (!installation)
        throw new Error('Clean extension fixture not installed')
      return installation.cleanup()
    })

    expect(counters.wrapperCalls).toBeGreaterThan(0)
    expect(counters.labelMeasurements).toBeGreaterThan(0)
    expect(counters.rerouteFacadeReads).toBeGreaterThan(0)
    expect(counters.dirtyTimerTicks).toBeGreaterThan(0)
    expect(counters.listenerCalls).toBe(EXPECTED_REFRESH_COUNT)
    expect(counters.restored).toBe(true)
  })

  test('rgthree-style prototype draw lifecycle', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')
    await fitToViewInstant(comfyPage)

    const identity = await comfyPage.page.evaluate(() => {
      const app = window.app
      if (!app) throw new Error('window.app is not available')

      type Counters = {
        wrapperCalls: number
        labelMeasurements: number
        rerouteFacadeReads: number
        dirtyTimerTicks: number
        listenerCalls: number
      }
      type Scope = Window & {
        __rgthreeExtensionPerf?: {
          cleanup: () => Counters & { restored: boolean; wrapperDepth: number }
        }
      }

      const canvas = app.canvas
      const graph = app.graph
      const prototype = Object.getPrototypeOf(canvas) as typeof canvas
      const originalDrawNode = prototype.drawNode
      const labelNodes = new Set(graph.nodes.slice(0, 16))
      const rerouteNodes = new Set(graph.nodes.slice(16, 32))
      const counters: Counters = {
        wrapperCalls: 0,
        labelMeasurements: 0,
        rerouteFacadeReads: 0,
        dirtyTimerTicks: 0,
        listenerCalls: 0
      }
      const listener = () => counters.listenerCalls++
      const wrapper: typeof prototype.drawNode = function (
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
        } else if (rerouteNodes.has(node)) {
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
      prototype.drawNode = wrapper

      canvas.canvas.addEventListener('extension-perf-refresh', listener)
      const timer = window.setInterval(() => {
        counters.dirtyTimerTicks++
        graph.setDirtyCanvas(true, true)
      }, 250)

      const scope = window as Scope
      scope.__rgthreeExtensionPerf = {
        cleanup: () => {
          window.clearInterval(timer)
          canvas.canvas.removeEventListener('extension-perf-refresh', listener)
          if (prototype.drawNode === wrapper)
            prototype.drawNode = originalDrawNode
          delete scope.__rgthreeExtensionPerf
          return {
            ...counters,
            restored: prototype.drawNode === originalDrawNode,
            wrapperDepth: prototype.drawNode === originalDrawNode ? 0 : 1
          }
        }
      }

      return {
        fixture: 'comfy.rgthree-lifecycle-compat.v1',
        labelPatternSource:
          'rgthree-comfy@13b4399c00b5ef5a97b1b6800fc1185874740f5d',
        reroutePatternSource: 'rgthree-comfy@629c514a'
      }
    })

    expect(identity).toEqual({
      fixture: 'comfy.rgthree-lifecycle-compat.v1',
      labelPatternSource:
        'rgthree-comfy@13b4399c00b5ef5a97b1b6800fc1185874740f5d',
      reroutePatternSource: 'rgthree-comfy@629c514a'
    })

    await comfyPage.perf.startMeasuring()
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
    const measurement = await comfyPage.perf.stopMeasuring(
      'extension-rgthree-prototype-draw'
    )
    recordMeasurement(measurement)

    const counters = await comfyPage.page.evaluate(() => {
      type Scope = Window & {
        __rgthreeExtensionPerf?: {
          cleanup: () => {
            wrapperCalls: number
            labelMeasurements: number
            rerouteFacadeReads: number
            dirtyTimerTicks: number
            listenerCalls: number
            restored: boolean
            wrapperDepth: number
          }
        }
      }
      const installation = (window as Scope).__rgthreeExtensionPerf
      if (!installation)
        throw new Error('Rgthree extension fixture not installed')
      return installation.cleanup()
    })

    expect(counters.wrapperCalls).toBeGreaterThan(0)
    expect(counters.labelMeasurements).toBeGreaterThan(0)
    expect(counters.rerouteFacadeReads).toBeGreaterThan(0)
    expect(counters.dirtyTimerTicks).toBeGreaterThan(0)
    expect(counters.listenerCalls).toBe(EXPECTED_REFRESH_COUNT)
    expect(counters.restored).toBe(true)
    expect(counters.wrapperDepth).toBe(0)
  })
})
