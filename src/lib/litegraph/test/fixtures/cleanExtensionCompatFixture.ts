import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

const CLEAN_EXTENSION_FIXTURE_IDENTITY = Object.freeze({
  fixture: 'comfy.clean-extension-compat.v1',
  emulationPatternSha256:
    'a8603d20ae82775a902553058e1cea4e72ea10c0ab1664cd57ab6b5fc573a719',
  labelPatternSource: 'rgthree-comfy@13b4399c00b5ef5a97b1b6800fc1185874740f5d',
  labelPatternSha256:
    '5a0f8d72d0be3c6573477943a18295310f82dd4b1d99a506517bb6956af1790d',
  reroutePatternSource: 'rgthree-comfy@629c514a',
  reroutePatternSha256:
    'fea80b78a4e055446ad69628c2ea436f06eda52a31382e005a5476f1a6e65b24',
  compatibilityPatternSource:
    'ComfyUI-KJNodes@3f20054214fec9f9234fd3841ae6f1e4287948f6'
})

export type CleanExtensionMode =
  | 'loaded-inactive'
  | 'label'
  | 'reroute'
  | 'dirty-timer'
  | 'legacy-facade'
  | 'combined'

export interface CleanExtensionCounters {
  registrations: number
  wrapperCalls: number
  forwardedCoreDraws: number
  labelHookCalls: number
  labelMeasurements: number
  rerouteHookCalls: number
  dirtyTimerTicks: number
  dirtyRequests: number
  listenerCalls: number
  inputLinkReads: number
  outputLinksReads: number
  outputLinkViewAllocations: number
  graphLinkReads: number
  positionComponentReads: number
  sizeComponentReads: number
}

export interface CleanExtensionDrawContext {
  measureText(text: string): void
}

export interface CleanExtensionHost {
  drawNode(node: LGraphNode, context: CleanExtensionDrawContext): void
  setDirty(foreground: boolean, background: boolean): void
  events: EventTarget
}

export interface CleanExtensionScheduler {
  setInterval(callback: () => void, delay: number): () => void
}

export interface CleanExtensionInstallation {
  readonly counters: CleanExtensionCounters
  readonly identity: typeof CLEAN_EXTENSION_FIXTURE_IDENTITY
  sweepLegacyFacades(nodes: readonly LGraphNode[], graph: LGraph): void
  dispose(): void
}

interface ActiveInstallation extends CleanExtensionInstallation {
  disposed: boolean
}

const activeInstallations = new WeakMap<
  CleanExtensionHost,
  ActiveInstallation
>()

export function installCleanExtensionFixture(
  host: CleanExtensionHost,
  scheduler: CleanExtensionScheduler,
  mode: CleanExtensionMode
): CleanExtensionInstallation {
  const active = activeInstallations.get(host)
  if (active && !active.disposed) return active

  const counters = createCounters()
  counters.registrations++
  const originalDrawNode = host.drawNode
  const outputViews = new WeakMap<object, object>()
  const labelActive = mode === 'label' || mode === 'combined'
  const rerouteActive = mode === 'reroute' || mode === 'combined'
  const facadeActive = mode === 'legacy-facade' || mode === 'combined'
  const timerActive = mode === 'dirty-timer' || mode === 'combined'

  host.drawNode = function cleanExtensionDrawNode(node, context) {
    counters.wrapperCalls++
    originalDrawNode.call(host, node, context)
    counters.forwardedCoreDraws++

    if (labelActive && node.type === 'fixture/label') {
      counters.labelHookCalls++
      for (const line of node.title.split('\n')) {
        context.measureText(line)
        counters.labelMeasurements++
      }
    }

    if (rerouteActive && node.type === 'fixture/reroute') {
      counters.rerouteHookCalls++
      sweepNodeFacades(node, node.graph, counters, outputViews)
    }
  }

  const onRefresh = () => {
    counters.listenerCalls++
  }
  host.events.addEventListener('fixture:refresh', onRefresh)

  const cancelTimer = timerActive
    ? scheduler.setInterval(() => {
        counters.dirtyTimerTicks++
        host.setDirty(true, true)
        counters.dirtyRequests++
      }, 250)
    : undefined

  const installation: ActiveInstallation = {
    counters,
    identity: CLEAN_EXTENSION_FIXTURE_IDENTITY,
    disposed: false,
    sweepLegacyFacades(nodes, graph) {
      if (!facadeActive) return
      for (const node of nodes) {
        sweepNodeFacades(node, graph, counters, outputViews)
      }
    },
    dispose() {
      if (installation.disposed) return
      installation.disposed = true
      host.drawNode = originalDrawNode
      host.events.removeEventListener('fixture:refresh', onRefresh)
      cancelTimer?.()
      activeInstallations.delete(host)
    }
  }
  activeInstallations.set(host, installation)
  return installation
}

function createCounters(): CleanExtensionCounters {
  return {
    registrations: 0,
    wrapperCalls: 0,
    forwardedCoreDraws: 0,
    labelHookCalls: 0,
    labelMeasurements: 0,
    rerouteHookCalls: 0,
    dirtyTimerTicks: 0,
    dirtyRequests: 0,
    listenerCalls: 0,
    inputLinkReads: 0,
    outputLinksReads: 0,
    outputLinkViewAllocations: 0,
    graphLinkReads: 0,
    positionComponentReads: 0,
    sizeComponentReads: 0
  }
}

function sweepNodeFacades(
  node: LGraphNode,
  graph: LGraph | null,
  counters: CleanExtensionCounters,
  outputViews: WeakMap<object, object>
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
    if (linkId != null && graph?.links[linkId]) counters.graphLinkReads++
  }
  for (const output of node.outputs) {
    const linkIds = output.links
    counters.outputLinksReads++
    if (linkIds && outputViews.get(output) !== linkIds) {
      outputViews.set(output, linkIds)
      counters.outputLinkViewAllocations++
    }
    for (const linkId of linkIds ?? []) {
      if (graph?.links[linkId]) counters.graphLinkReads++
    }
  }
}
