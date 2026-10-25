import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { ComfyApp, ComfyExtension } from '@/types/comfy'

type GraphPatchMember =
  | 'onNodeAdded'
  | 'beforeChange'
  | 'afterChange'
  | 'convertToSubgraph'
  | 'clear'

type GraphPatchHost = Pick<ComfyApp, 'rootGraphOrUndefined'>

interface GraphPatch {
  member: GraphPatchMember
  handler: LGraph[GraphPatchMember]
  previousByGraph: WeakMap<LGraph, LGraph[GraphPatchMember]>
}

const supportedExtensions = new Map<
  string,
  { hook: 'init' | 'setup'; members: readonly GraphPatchMember[] }
>([
  ['pysssss.WidgetDefaults', { hook: 'setup', members: ['onNodeAdded'] }],
  [
    'cg.customnodes.use_everywhere',
    {
      hook: 'init',
      members: ['beforeChange', 'afterChange', 'convertToSubgraph']
    }
  ],
  ['Comfy.ManagerMenu', { hook: 'setup', members: ['clear'] }]
])

const bridges = new WeakMap<
  GraphPatchHost,
  { patches: GraphPatch[]; reported: Set<string> }
>()

function installPatch(host: GraphPatchHost, graph: LGraph, patch: GraphPatch) {
  Reflect.set(graph, patch.member, function (this: LGraph, ...args: unknown[]) {
    const handler =
      this === host.rootGraphOrUndefined
        ? patch.handler
        : patch.previousByGraph.get(this)
    if (typeof handler === 'function') return Reflect.apply(handler, this, args)
  })
}

export function captureLegacyGraphPatches<T>(
  host: GraphPatchHost,
  extension: Pick<ComfyExtension, 'name' | 'beforeConfigureGraph'>,
  hook: string,
  run: () => T
): T {
  const policy = supportedExtensions.get(extension.name)
  const graph = host.rootGraphOrUndefined
  if (
    !policy ||
    policy.hook !== hook ||
    extension.beforeConfigureGraph ||
    !graph
  )
    return run()

  const candidates = policy.members.map((member) => {
    const descriptor = Object.getOwnPropertyDescriptor(graph, member)
    const previousByGraph = new WeakMap([[graph, graph[member]]])
    function callPrevious(this: LGraph, ...args: unknown[]) {
      const previous = previousByGraph.get(this)
      if (typeof previous === 'function')
        return Reflect.apply(previous, this, args)
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
            `${extension.name} patches app.graph during ${hook}. Temporary compatibility is deprecated. Update the extension to install hooks once per graph from beforeConfigureGraph.`
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
