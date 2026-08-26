import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { CLEAN_EXTENSION_FIXTURE_IDENTITY } from './cleanExtensionCompatFixture'
import type {
  CleanExtensionDrawContext,
  CleanExtensionScheduler
} from './cleanExtensionCompatFixture'

/**
 * Clean-room lifecycle model derived from the already-proven public behavior
 * patterns, not from copied extension implementation.
 */
export const RGTHREE_LIFECYCLE_FIXTURE_IDENTITY = Object.freeze({
  fixture: 'comfy.rgthree-lifecycle-compat.v1',
  labelPatternSource: CLEAN_EXTENSION_FIXTURE_IDENTITY.labelPatternSource,
  labelPatternSha256: CLEAN_EXTENSION_FIXTURE_IDENTITY.labelPatternSha256,
  reroutePatternSource: CLEAN_EXTENSION_FIXTURE_IDENTITY.reroutePatternSource,
  reroutePatternSha256: CLEAN_EXTENSION_FIXTURE_IDENTITY.reroutePatternSha256
})

interface RgthreeLifecycleCounters {
  registrations: number
  listenerRegistrations: number
  listenerRemovals: number
  listenerCalls: number
  timerRegistrations: number
  timerCancellations: number
  timerTicks: number
  dirtyRequests: number
  wrapperCalls: number
  forwardedCoreDraws: number
  labelActivations: number
  labelMeasurements: number
  rerouteActivations: number
  inputLinkReads: number
  outputLinksReads: number
  graphLinkReads: number
  positionComponentReads: number
  sizeComponentReads: number
}

export interface RgthreeLifecycleCanvas {
  drawNode(node: LGraphNode, context: CleanExtensionDrawContext): unknown
}

export interface RgthreeLifecycleHost {
  events: EventTarget
  setDirty(foreground: boolean, background: boolean): void
}

type CanvasPrototype = Pick<RgthreeLifecycleCanvas, 'drawNode'>

export class RgthreeLabelFixtureNode extends LGraphNode {}

export interface RgthreeLifecycleInstallation {
  readonly counters: RgthreeLifecycleCounters
  readonly identity: typeof RGTHREE_LIFECYCLE_FIXTURE_IDENTITY
  readonly wrapperDepth: number
  dispose(): void
}

interface ActiveInstallation extends RgthreeLifecycleInstallation {
  disposed: boolean
}

interface RgthreeLifecycleRegistry {
  activeInstallations: WeakMap<CanvasPrototype, ActiveInstallation>
  wrapperDepths: WeakMap<CanvasPrototype, number>
}

const registryKey = Symbol.for('comfy.rgthree-lifecycle-compat.registry')

function getRegistry(): RgthreeLifecycleRegistry {
  const scope = globalThis as typeof globalThis & Record<symbol, unknown>
  const existing = scope[registryKey]
  if (existing) return existing as RgthreeLifecycleRegistry

  const registry = {
    activeInstallations: new WeakMap<CanvasPrototype, ActiveInstallation>(),
    wrapperDepths: new WeakMap<CanvasPrototype, number>()
  }
  scope[registryKey] = registry
  return registry
}

export function getRgthreePrototypeWrapperDepth(
  prototype: CanvasPrototype
): number {
  return getRegistry().wrapperDepths.get(prototype) ?? 0
}

export function createRgthreeLifecycleInstaller() {
  return (
    prototype: CanvasPrototype,
    host: RgthreeLifecycleHost,
    scheduler: CleanExtensionScheduler
  ): RgthreeLifecycleInstallation => {
    const registry = getRegistry()
    const active = registry.activeInstallations.get(prototype)
    if (active && !active.disposed) return active

    const counters = createCounters()
    counters.registrations++
    const originalDrawNode = prototype.drawNode
    const depth = getRgthreePrototypeWrapperDepth(prototype) + 1
    registry.wrapperDepths.set(prototype, depth)

    const wrapper: RgthreeLifecycleCanvas['drawNode'] = function (
      this: RgthreeLifecycleCanvas,
      node,
      context
    ) {
      const result = originalDrawNode.call(this, node, context)
      if (installation.disposed) return result

      counters.wrapperCalls++
      counters.forwardedCoreDraws++
      if (node.constructor === RgthreeLabelFixtureNode.prototype.constructor) {
        counters.labelActivations++
        for (const line of node.title.split('\n')) {
          context.measureText(line)
          counters.labelMeasurements++
        }
      } else if (node.type === 'fixture/reroute') {
        counters.rerouteActivations++
        readRerouteFacades(node, node.graph, counters)
      }
      return result
    }
    prototype.drawNode = wrapper

    const onRefresh = () => counters.listenerCalls++
    host.events.addEventListener('fixture:refresh', onRefresh)
    counters.listenerRegistrations++
    const cancelTimer = scheduler.setInterval(() => {
      counters.timerTicks++
      host.setDirty(true, true)
      counters.dirtyRequests++
    }, 250)
    counters.timerRegistrations++

    const installation: ActiveInstallation = {
      counters,
      identity: RGTHREE_LIFECYCLE_FIXTURE_IDENTITY,
      wrapperDepth: depth,
      disposed: false,
      dispose() {
        if (installation.disposed) return
        installation.disposed = true
        if (prototype.drawNode === wrapper) {
          prototype.drawNode = originalDrawNode
        }
        registry.wrapperDepths.set(prototype, depth - 1)
        host.events.removeEventListener('fixture:refresh', onRefresh)
        counters.listenerRemovals++
        cancelTimer()
        counters.timerCancellations++
        registry.activeInstallations.delete(prototype)
      }
    }
    registry.activeInstallations.set(prototype, installation)
    return installation
  }
}

export const installRgthreeLifecycleFixture = createRgthreeLifecycleInstaller()

function readRerouteFacades(
  node: LGraphNode,
  graph: LGraph | null,
  counters: RgthreeLifecycleCounters
): void {
  void node.pos[0]
  void node.pos[1]
  void node.size[0]
  void node.size[1]
  counters.positionComponentReads += 2
  counters.sizeComponentReads += 2

  for (const input of node.inputs) {
    const linkId = input.link
    counters.inputLinkReads++
    if (linkId != null && graph?.links.get(linkId)) counters.graphLinkReads++
  }
  for (const output of node.outputs) {
    const linkIds = output.links
    counters.outputLinksReads++
    for (const linkId of linkIds ?? []) {
      if (graph?.links.get(linkId)) counters.graphLinkReads++
    }
  }
}

function createCounters(): RgthreeLifecycleCounters {
  return {
    registrations: 0,
    listenerRegistrations: 0,
    listenerRemovals: 0,
    listenerCalls: 0,
    timerRegistrations: 0,
    timerCancellations: 0,
    timerTicks: 0,
    dirtyRequests: 0,
    wrapperCalls: 0,
    forwardedCoreDraws: 0,
    labelActivations: 0,
    labelMeasurements: 0,
    rerouteActivations: 0,
    inputLinkReads: 0,
    outputLinksReads: 0,
    graphLinkReads: 0,
    positionComponentReads: 0,
    sizeComponentReads: 0
  }
}
