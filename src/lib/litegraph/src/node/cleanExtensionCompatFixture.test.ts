import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { MapProxyHandler } from '@/lib/litegraph/src/MapProxyHandler'
import { installCleanExtensionFixture } from '@/lib/litegraph/test/fixtures/cleanExtensionCompatFixture'
import type {
  CleanExtensionCounters,
  CleanExtensionDrawContext,
  CleanExtensionHost,
  CleanExtensionMode,
  CleanExtensionScheduler
} from '@/lib/litegraph/test/fixtures/cleanExtensionCompatFixture'

class ManualScheduler implements CleanExtensionScheduler {
  private readonly callbacks = new Set<() => void>()

  setInterval(callback: () => void, _delay: number): () => void {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  tick(): void {
    for (const callback of this.callbacks) callback()
  }

  get activeTimers(): number {
    return this.callbacks.size
  }
}

interface MatrixSetup {
  graph: LGraph
  nodes: LGraphNode[]
  label: LGraphNode
  reroute: LGraphNode
  host: CleanExtensionHost
  context: CleanExtensionDrawContext
  scheduler: ManualScheduler
  coreDraws: ReturnType<typeof vi.fn>
  dirtyRequests: ReturnType<typeof vi.fn>
  measurements: ReturnType<typeof vi.fn>
}

function createMatrixSetup(): MatrixSetup {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'INT')
  const target = new LGraphNode('Target')
  target.addInput('in', 'INT')
  const label = new LGraphNode('First line\nSecond line')
  label.type = 'fixture/label'
  const reroute = new LGraphNode('Reroute')
  reroute.type = 'fixture/reroute'
  reroute.addInput('in', 'INT')
  reroute.addOutput('out', 'INT')
  const nodes = [source, target, label, reroute]
  nodes.forEach((node) => graph.add(node))
  source.connect(0, target, 0)
  source.connect(0, reroute, 0)

  const coreDraws = vi.fn()
  const dirtyRequests = vi.fn()
  const measurements = vi.fn()
  const host: CleanExtensionHost = {
    drawNode: coreDraws,
    setDirty: dirtyRequests,
    events: new EventTarget()
  }
  return {
    graph,
    nodes,
    label,
    reroute,
    host,
    context: { measureText: measurements },
    scheduler: new ManualScheduler(),
    coreDraws,
    dirtyRequests,
    measurements
  }
}

function topology(graph: LGraph) {
  return graph.serialize()
}

function runMode(mode: CleanExtensionMode) {
  const setup = createMatrixSetup()
  const before = topology(setup.graph)
  const fixture = installCleanExtensionFixture(
    setup.host,
    setup.scheduler,
    mode
  )
  for (const node of setup.nodes) setup.host.drawNode(node, setup.context)
  fixture.sweepLegacyFacades(setup.nodes, setup.graph)
  setup.scheduler.tick()
  setup.host.events.dispatchEvent(new Event('fixture:refresh'))
  return { ...setup, before, fixture, after: topology(setup.graph) }
}

describe('clean extension compatibility fixture', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    LiteGraph.onDeprecationWarning = []
  })

  it('keeps the unloaded control free of registrations and wrappers', () => {
    const setup = createMatrixSetup()
    for (const node of setup.nodes) setup.host.drawNode(node, setup.context)
    setup.scheduler.tick()

    expect(setup.coreDraws).toHaveBeenCalledTimes(setup.nodes.length)
    expect(setup.dirtyRequests).not.toHaveBeenCalled()
    expect(setup.scheduler.activeTimers).toBe(0)
  })

  it.for([
    {
      mode: 'loaded-inactive',
      expected: { labelHookCalls: 0, rerouteHookCalls: 0, dirtyTimerTicks: 0 }
    },
    {
      mode: 'label',
      expected: { labelHookCalls: 1, rerouteHookCalls: 0, dirtyTimerTicks: 0 }
    },
    {
      mode: 'reroute',
      expected: { labelHookCalls: 0, rerouteHookCalls: 1, dirtyTimerTicks: 0 }
    },
    {
      mode: 'dirty-timer',
      expected: { labelHookCalls: 0, rerouteHookCalls: 0, dirtyTimerTicks: 1 }
    },
    {
      mode: 'legacy-facade',
      expected: { labelHookCalls: 0, rerouteHookCalls: 0, dirtyTimerTicks: 0 }
    },
    {
      mode: 'combined',
      expected: { labelHookCalls: 1, rerouteHookCalls: 1, dirtyTimerTicks: 1 }
    }
  ] satisfies {
    mode: CleanExtensionMode
    expected: Partial<CleanExtensionCounters>
  }[])(
    'attributes the $mode arm without charging forwarded core draws',
    ({ mode, expected }) => {
      const result = runMode(mode)

      expect(result.fixture.counters).toMatchObject({
        registrations: 1,
        wrapperCalls: result.nodes.length,
        forwardedCoreDraws: result.nodes.length,
        listenerCalls: 1,
        ...expected
      })
      expect(result.coreDraws).toHaveBeenCalledTimes(result.nodes.length)
      expect(result.after).toEqual(result.before)
      expect(result.fixture.identity).toEqual({
        fixture: 'comfy.clean-extension-compat.v1',
        emulationPatternSha256:
          'a8603d20ae82775a902553058e1cea4e72ea10c0ab1664cd57ab6b5fc573a719',
        labelPatternSource:
          'rgthree-comfy@13b4399c00b5ef5a97b1b6800fc1185874740f5d',
        labelPatternSha256:
          '5a0f8d72d0be3c6573477943a18295310f82dd4b1d99a506517bb6956af1790d',
        reroutePatternSource: 'rgthree-comfy@629c514a',
        reroutePatternSha256:
          'fea80b78a4e055446ad69628c2ea436f06eda52a31382e005a5476f1a6e65b24',
        compatibilityPatternSource:
          'ComfyUI-KJNodes@3f20054214fec9f9234fd3841ae6f1e4287948f6'
      })

      if (mode === 'loaded-inactive') {
        expect(result.fixture.counters).toMatchObject({
          labelMeasurements: 0,
          inputLinkReads: 0,
          outputLinksReads: 0,
          dirtyRequests: 0
        })
      }
      if (mode === 'label' || mode === 'combined') {
        expect(result.measurements).toHaveBeenCalledTimes(2)
      }
      if (mode === 'dirty-timer' || mode === 'combined') {
        expect(result.dirtyRequests).toHaveBeenCalledExactlyOnceWith(true, true)
      }
    }
  )

  it('counts facade accesses, stable views, and graph resolution separately', () => {
    const linkFacadeReads = vi.spyOn(MapProxyHandler.prototype, 'get')
    const result = runMode('legacy-facade')
    const { counters } = result.fixture
    const indexedLinkReads = linkFacadeReads.mock.calls.filter(
      ([, property]) => typeof property === 'string' && /^\d+$/.test(property)
    )

    expect(counters).toMatchObject({
      inputLinkReads: 2,
      outputLinksReads: 2,
      outputLinkViewAllocations: 1,
      graphLinkReads: 4,
      positionComponentReads: 8,
      sizeComponentReads: 8
    })
    expect(indexedLinkReads).toHaveLength(counters.graphLinkReads)

    result.fixture.sweepLegacyFacades(result.nodes, result.graph)
    expect(counters.outputLinksReads).toBe(4)
    expect(counters.outputLinkViewAllocations).toBe(1)
    expect(topology(result.graph)).toEqual(result.before)
  })

  it('registers once on reload and disposes wrappers, timers, and listeners', () => {
    const setup = createMatrixSetup()
    const originalDrawNode = setup.host.drawNode
    const first = installCleanExtensionFixture(
      setup.host,
      setup.scheduler,
      'combined'
    )
    const reload = installCleanExtensionFixture(
      setup.host,
      setup.scheduler,
      'combined'
    )

    expect(reload).toBe(first)
    expect(first.counters.registrations).toBe(1)
    expect(setup.scheduler.activeTimers).toBe(1)

    first.dispose()
    first.dispose()
    setup.scheduler.tick()
    setup.host.events.dispatchEvent(new Event('fixture:refresh'))
    setup.host.drawNode(setup.label, setup.context)

    expect(setup.host.drawNode).toBe(originalDrawNode)
    expect(setup.scheduler.activeTimers).toBe(0)
    expect(first.counters.dirtyTimerTicks).toBe(0)
    expect(first.counters.listenerCalls).toBe(0)
    expect(first.counters.wrapperCalls).toBe(0)
    expect(setup.coreDraws).toHaveBeenCalledExactlyOnceWith(
      setup.label,
      setup.context
    )

    const reinstalled = installCleanExtensionFixture(
      setup.host,
      setup.scheduler,
      'loaded-inactive'
    )
    expect(reinstalled).not.toBe(first)
    expect(reinstalled.counters.registrations).toBe(1)
  })
})
