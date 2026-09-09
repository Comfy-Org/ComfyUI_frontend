import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  CleanExtensionDrawContext,
  CleanExtensionScheduler
} from '@/lib/litegraph/test/fixtures/cleanExtensionCompatFixture'
import {
  createRgthreeLifecycleInstaller,
  disposeRgthreeLifecycleDrawNodeWrapper,
  getRgthreePrototypeWrapperDepth,
  installRgthreeLifecycleFixture,
  RGTHREE_LIFECYCLE_FIXTURE_IDENTITY,
  RgthreeLabelFixtureNode
} from '@/lib/litegraph/test/fixtures/rgthreeLifecycleCompatFixture'
import type {
  RgthreeLifecycleCanvas,
  RgthreeLifecycleHost,
  RgthreeLifecycleInstallation
} from '@/lib/litegraph/test/fixtures/rgthreeLifecycleCompatFixture'

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

class TestCanvas implements RgthreeLifecycleCanvas {
  readonly coreDraws = vi.fn<(node: LGraphNode) => string>(
    (node) => `${node.id}:${node.title}`
  )

  drawNode(node: LGraphNode, _context: CleanExtensionDrawContext): unknown {
    return this.coreDraws(node)
  }
}

interface ScaleSetup {
  canvas: TestCanvas
  graph: LGraph
  nodes: LGraphNode[]
  context: CleanExtensionDrawContext
  host: RgthreeLifecycleHost
  scheduler: ManualScheduler
  dirtyRequests: ReturnType<typeof vi.fn>
  measurements: ReturnType<typeof vi.fn>
}

function createScaleSetup(scale: number): ScaleSetup {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'INT')
  graph.add(source)
  const nodes = [source]

  for (let index = 0; index < scale; index++) {
    const label = new RgthreeLabelFixtureNode(`Label ${index}\nSecond line`)
    label.type = 'fixture/label'
    graph.add(label)
    nodes.push(label)

    const reroute = new LGraphNode(`Reroute ${index}`)
    reroute.type = 'fixture/reroute'
    reroute.addInput('in', 'INT')
    reroute.addOutput('out', 'INT')
    graph.add(reroute)
    source.connect(0, reroute, 0)
    nodes.push(reroute)
  }

  const dirtyRequests = vi.fn()
  const measurements = vi.fn()
  return {
    canvas: new TestCanvas(),
    graph,
    nodes,
    context: { measureText: measurements },
    host: { events: new EventTarget(), setDirty: dirtyRequests },
    scheduler: new ManualScheduler(),
    dirtyRequests,
    measurements
  }
}

describe('rgthree clean-room lifecycle compatibility fixture', () => {
  const installations = new Set<RgthreeLifecycleInstallation>()
  const track = <T extends RgthreeLifecycleInstallation>(
    installation: T
  ): T => {
    installations.add(installation)
    return installation
  }

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    LiteGraph.onDeprecationWarning = []
  })

  afterEach(() => {
    for (const installation of installations) installation.dispose()
    installations.clear()
  })

  it.for([1, 16, 64])(
    'keeps exact activation and topology denominators at scale %i',
    (scale) => {
      const setup = createScaleSetup(scale)
      const before = setup.graph.serialize()
      const originalDrawNode = TestCanvas.prototype.drawNode
      const installation = track(
        installRgthreeLifecycleFixture(
          TestCanvas.prototype,
          setup.host,
          setup.scheduler
        )
      )

      const outputs = setup.nodes.map((node) =>
        setup.canvas.drawNode(node, setup.context)
      )
      setup.scheduler.tick()
      setup.host.events.dispatchEvent(new Event('fixture:refresh'))

      expect(installation.identity).toBe(RGTHREE_LIFECYCLE_FIXTURE_IDENTITY)
      expect(installation.counters).toMatchObject({
        registrations: 1,
        listenerRegistrations: 1,
        listenerCalls: 1,
        timerRegistrations: 1,
        timerTicks: 1,
        dirtyRequests: 1,
        wrapperCalls: scale * 2 + 1,
        forwardedCoreDraws: scale * 2 + 1,
        labelActivations: scale,
        labelMeasurements: scale * 2,
        rerouteActivations: scale,
        inputLinkReads: scale,
        outputLinksReads: scale,
        graphLinkReads: scale,
        positionComponentReads: scale * 2,
        sizeComponentReads: scale * 2
      })
      expect(outputs).toEqual(
        setup.nodes.map((node) => `${node.id}:${node.title}`)
      )
      expect(setup.canvas.coreDraws).toHaveBeenCalledTimes(scale * 2 + 1)
      expect(setup.measurements).toHaveBeenCalledTimes(scale * 2)
      expect(setup.dirtyRequests).toHaveBeenCalledExactlyOnceWith(true, true)
      expect(setup.graph.serialize()).toEqual(before)
      expect(getRgthreePrototypeWrapperDepth(TestCanvas.prototype)).toBe(1)

      installation.dispose()
      expect(TestCanvas.prototype.drawNode).toBe(originalDrawNode)
    }
  )

  it('makes reload idempotent and install/dispose cycles leak-free', () => {
    const setup = createScaleSetup(1)
    const originalDrawNode = TestCanvas.prototype.drawNode
    const firstModuleInstaller = createRgthreeLifecycleInstaller()
    const reloadedModuleInstaller = createRgthreeLifecycleInstaller()

    for (let cycle = 0; cycle < 4; cycle++) {
      const installation = track(
        firstModuleInstaller(TestCanvas.prototype, setup.host, setup.scheduler)
      )
      const reload = track(
        reloadedModuleInstaller(
          TestCanvas.prototype,
          setup.host,
          setup.scheduler
        )
      )

      expect(reload).toBe(installation)
      expect(installation.counters).toMatchObject({
        registrations: 1,
        listenerRegistrations: 1,
        timerRegistrations: 1
      })
      expect(installation.wrapperDepth).toBe(1)
      expect(getRgthreePrototypeWrapperDepth(TestCanvas.prototype)).toBe(1)
      expect(setup.scheduler.activeTimers).toBe(1)

      setup.canvas.drawNode(setup.nodes[1], setup.context)
      setup.scheduler.tick()
      setup.host.events.dispatchEvent(new Event('fixture:refresh'))
      expect(installation.counters).toMatchObject({
        wrapperCalls: 1,
        forwardedCoreDraws: 1,
        labelActivations: 1,
        listenerCalls: 1,
        timerTicks: 1,
        dirtyRequests: 1
      })

      installation.dispose()
      installation.dispose()
      expect(installation.counters).toMatchObject({
        listenerRemovals: 1,
        timerCancellations: 1
      })
      expect(setup.scheduler.activeTimers).toBe(0)
      expect(getRgthreePrototypeWrapperDepth(TestCanvas.prototype)).toBe(0)
      expect(TestCanvas.prototype.drawNode).toBe(originalDrawNode)

      setup.scheduler.tick()
      setup.host.events.dispatchEvent(new Event('fixture:refresh'))
      expect(installation.counters.timerTicks).toBe(1)
      expect(installation.counters.listenerCalls).toBe(1)
    }

    expect(setup.canvas.coreDraws).toHaveBeenCalledTimes(4)
  })

  it('uses label constructor identity instead of the node type string', () => {
    const setup = createScaleSetup(1)
    const installation = track(
      installRgthreeLifecycleFixture(
        TestCanvas.prototype,
        setup.host,
        setup.scheduler
      )
    )
    const typeOnlyImpostor = new LGraphNode('Type-only impostor')
    typeOnlyImpostor.type = 'fixture/label'

    setup.canvas.drawNode(setup.nodes[1], setup.context)
    setup.canvas.drawNode(typeOnlyImpostor, setup.context)

    expect(installation.counters.labelActivations).toBe(1)
    expect(installation.counters.labelMeasurements).toBe(2)
    installation.dispose()
  })

  it('preserves wrappers installed later by another extension', () => {
    const setup = createScaleSetup(1)
    const originalDrawNode = TestCanvas.prototype.drawNode
    const installation = track(
      installRgthreeLifecycleFixture(
        TestCanvas.prototype,
        setup.host,
        setup.scheduler
      )
    )
    const rgthreeWrapper = TestCanvas.prototype.drawNode
    const competingCalls = vi.fn()
    TestCanvas.prototype.drawNode = function competingWrapper(node, context) {
      competingCalls(node)
      return rgthreeWrapper.call(this, node, context)
    }
    const competingWrapper = TestCanvas.prototype.drawNode
    const disposeCompetingWrapper = () => {
      disposeRgthreeLifecycleDrawNodeWrapper(
        TestCanvas.prototype,
        competingWrapper,
        rgthreeWrapper
      )
    }

    installation.dispose()
    const result = setup.canvas.drawNode(setup.nodes[1], setup.context)

    expect(TestCanvas.prototype.drawNode).toBe(competingWrapper)
    expect(competingCalls).toHaveBeenCalledExactlyOnceWith(setup.nodes[1])
    expect(result).toBe(`${setup.nodes[1].id}:${setup.nodes[1].title}`)
    expect(installation.counters.wrapperCalls).toBe(0)
    expect(setup.canvas.coreDraws).toHaveBeenCalledOnce()
    disposeCompetingWrapper()
    expect(TestCanvas.prototype.drawNode).toBe(originalDrawNode)
  })

  it('preserves a reinstalled wrapper when a competing wrapper is disposed', () => {
    const setup = createScaleSetup(1)
    const originalDrawNode = TestCanvas.prototype.drawNode
    const firstInstallation = track(
      installRgthreeLifecycleFixture(
        TestCanvas.prototype,
        setup.host,
        setup.scheduler
      )
    )
    const firstRgthreeWrapper = TestCanvas.prototype.drawNode
    const competingCalls = vi.fn()
    TestCanvas.prototype.drawNode = function competingWrapper(node, context) {
      competingCalls(node)
      return firstRgthreeWrapper.call(this, node, context)
    }
    const competingWrapper = TestCanvas.prototype.drawNode
    const disposeCompetingWrapper = () => {
      disposeRgthreeLifecycleDrawNodeWrapper(
        TestCanvas.prototype,
        competingWrapper,
        firstRgthreeWrapper
      )
    }

    firstInstallation.dispose()
    const secondInstallation = track(
      installRgthreeLifecycleFixture(
        TestCanvas.prototype,
        setup.host,
        setup.scheduler
      )
    )
    const secondRgthreeWrapper = TestCanvas.prototype.drawNode
    disposeCompetingWrapper()

    expect(TestCanvas.prototype.drawNode).toBe(secondRgthreeWrapper)
    expect(getRgthreePrototypeWrapperDepth(TestCanvas.prototype)).toBe(1)
    expect(setup.canvas.drawNode(setup.nodes[1], setup.context)).toBe(
      `${setup.nodes[1].id}:${setup.nodes[1].title}`
    )
    expect(secondInstallation.counters.wrapperCalls).toBe(1)
    expect(competingCalls).not.toHaveBeenCalled()

    secondInstallation.dispose()
    expect(TestCanvas.prototype.drawNode).toBe(originalDrawNode)
  })
})
