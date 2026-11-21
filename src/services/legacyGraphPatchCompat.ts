import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { ComfyApp, ComfyExtension } from '@/types/comfy'

const graphPatchMembers = [
  'add',
  'remove',
  'configure',
  'serialize',
  'onNodeAdded',
  'onNodeRemoved',
  'beforeChange',
  'afterChange',
  'convertToSubgraph',
  'clear'
] as const satisfies readonly (keyof LGraph)[]

type GraphPatchMember = (typeof graphPatchMembers)[number]

type GraphPatchHost = Pick<ComfyApp, 'rootGraphOrUndefined'>

interface GraphPatch {
  member: GraphPatchMember
  handler: LGraph[GraphPatchMember]
  previousByGraph: WeakMap<LGraph, LGraph[GraphPatchMember]>
}

const capturedHooks = new Set(['init', 'setup'])

const perWorkflowGraphTroubleshootingUrl =
  'https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/docs/extensions/core.md#per-workflow-graphs-troubleshooting'

const bridges = new WeakMap<
  GraphPatchHost,
  { patches: GraphPatch[]; reported: Set<string> }
>()

const dispatchingGraphs: LGraph[] = []

function dispatch(graph: LGraph, handler: unknown, args: unknown[]) {
  if (typeof handler !== 'function') return
  dispatchingGraphs.push(graph)
  try {
    return Reflect.apply(handler, graph, args)
  } finally {
    dispatchingGraphs.pop()
  }
}

function installPatch(host: GraphPatchHost, graph: LGraph, patch: GraphPatch) {
  Reflect.set(graph, patch.member, function (this: LGraph, ...args: unknown[]) {
    return dispatch(
      this,
      this === host.rootGraphOrUndefined
        ? patch.handler
        : patch.previousByGraph.get(this),
      args
    )
  })
}

export function captureLegacyGraphPatches<T>(
  host: GraphPatchHost,
  extension: Pick<
    ComfyExtension,
    'name' | 'beforeConfigureGraph' | 'afterLoadGraph'
  >,
  hook: string,
  run: () => T
): T {
  const graph = host.rootGraphOrUndefined
  if (
    !capturedHooks.has(hook) ||
    extension.beforeConfigureGraph ||
    extension.afterLoadGraph ||
    !graph
  )
    return run()

  const candidates = graphPatchMembers.map((member) => {
    const descriptor = Object.getOwnPropertyDescriptor(graph, member)
    const original = graph[member]
    const previousByGraph = new WeakMap([[graph, original]])
    function callPrevious(this: LGraph, ...args: unknown[]) {
      const dispatching = dispatchingGraphs.at(-1)
      const target =
        this === graph && dispatching && previousByGraph.has(dispatching)
          ? dispatching
          : this
      const previous = previousByGraph.has(target)
        ? previousByGraph.get(target)
        : original
      return dispatch(target, previous, args)
    }
    Reflect.set(graph, member, callPrevious)
    return { member, descriptor, previousByGraph, callPrevious }
  })

  try {
    return run()
  } finally {
    const patches: GraphPatch[] = []
    for (const candidate of candidates) {
      const handler = graph[candidate.member]
      if (handler === candidate.callPrevious) {
        if (candidate.descriptor)
          Object.defineProperty(graph, candidate.member, candidate.descriptor)
        else Reflect.deleteProperty(graph, candidate.member)
      } else if (typeof handler === 'function') {
        const patch = {
          member: candidate.member,
          previousByGraph: candidate.previousByGraph,
          handler
        }
        patches.push(patch)
        installPatch(host, graph, patch)
      }
    }
    if (patches.length) {
      const bridge = bridges.get(host) ?? {
        patches: [],
        reported: new Set<string>()
      }
      bridge.patches.push(...patches)
      bridges.set(host, bridge)
      if (!bridge.reported.has(extension.name)) {
        bridge.reported.add(extension.name)
        reportError(
          new Error(
            `${extension.name} patches app.graph during ${hook}. Temporary compatibility is deprecated. Update the extension to patch each graph it receives in beforeConfigureGraph. See ${perWorkflowGraphTroubleshootingUrl}`
          ),
          {
            errorType: 'deprecated_extension_graph_patch',
            surface: 'graph',
            level: 'warning',
            tags: { extension: extension.name },
            context: { hook, members: patches.map((patch) => patch.member) }
          }
        )
      }
    }
  }
}

export function applyLegacyGraphPatches(host: GraphPatchHost, graph: LGraph) {
  const bridge = bridges.get(host)
  if (!bridge) return
  for (const patch of bridge.patches) {
    if (patch.previousByGraph.has(graph)) continue
    patch.previousByGraph.set(graph, graph[patch.member])
    installPatch(host, graph, patch)
  }
}
