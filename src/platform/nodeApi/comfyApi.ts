/**
 * The public entry point handed to custom nodes.
 *
 * Capability probing is first-class rather than an afterthought: packs must run
 * against several frontend versions at once, so `supports()` is how they branch
 * without version sniffing, and how we retire transitional behaviour safely.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'

import { handleToken, isSameEntity } from './closedProxy'
import {
  createDefRegistry,
  frontendResolverMap,
  frontendSupplierMap
} from './defsRegistry'
import type { DefRegistry } from './defsRegistry'
import { ComfyApiError, ComfyUnsupportedError } from './errors'
import { createBackendApi } from './backendHandle'
import type { BackendHandle } from './backendHandle'
import { createCommandsApi } from './commandsHandle'
import type { CommandsHandle } from './commandsHandle'
import { isInteracting } from './constants'
import {
  createNodeDragEndObserver,
  createNodeMoveObserver
} from './interaction'
import type { NodeMoveEvent } from './interaction'
import { watch } from 'vue'

import { useExecutionStore } from '@/stores/executionStore'

import { currentDocumentId, onAppReady, onWorkflowLoaded } from './appReady'
import { createNodeChangeObserver } from './nodeChanges'
import type { NodeChangeEvent, NodeChangeOptions } from './nodeChanges'
import { createQueueApi } from './queueHandle'
import type { QueueHandle } from './queueHandle'
import type { Unsubscribe } from './widgetHandle'
import { createGraphApi } from './graphHandle'
import type { GraphHandle } from './graphHandle'
import { createSettingsApi } from './settingsHandle'
import { createStorageApi } from './storageHandle'
import { createUiHandle } from './uiHandle'
import { createViewportObserver } from './viewport'
import type { SettingsHandle } from './settingsHandle'
import type { StorageHandle } from './storageHandle'
import { createSystemApi } from './systemHandle'
import type { SystemHandle } from './systemHandle'
import type { UiHandle } from './uiHandle'
import type { NodeHandle } from './nodeHandle'
import { createWorkflowApi } from './workflowHandle'
import type { WorkflowData, WorkflowHandle } from './workflowHandle'

type ComfyApiHost = {
  openWorkflow?: (data: WorkflowData) => Promise<void>
  refreshDefinitions?: () => Promise<void>
}

/**
 * Version of this surface, independent of the app version.
 *
 * `major.minor`, with no patch component — a contract has exactly two kinds of
 * change:
 *
 * - **major** — something was removed or its behaviour changed. May break packs.
 * - **minor** — something was added. Cannot break an existing pack.
 *
 * A third component would describe a change that is neither, which needs no
 * announcement, and would tempt packs into comparing on it. Fine-grained
 * detail belongs in capabilities, not in the number.
 *
 * Within a major: nothing is removed, nothing changes behaviour, and every
 * addition is discoverable through `supports()`. That is the promise that makes
 * this surface worth migrating onto.
 */
export const NODE_API_VERSION = '2.0'

/**
 * Every major this host currently serves.
 *
 * A major is a *spec*, not a fork: each is a declarative mapping from public
 * names onto whatever the internals currently are, sharing one engine
 * (`closedProxy`, `slotRef`, the collections). Adding a major adds a mapping;
 * it does not freeze internals or duplicate logic. That is what makes serving
 * more than one affordable.
 *
 * **Support is not perpetual.** An earlier draft of this file promised that no
 * major would ever be withdrawn. The API review declined to make that
 * commitment, and it was the right call: the cost of a major is not maintenance
 * but the day its semantics become genuinely inexpressible against current
 * internals, and a promise of forever converts that day into an unbounded
 * liability. A major follows ComfyUI's ordinary phased deprecation instead —
 * announced, warned about in development builds, then removed in a later
 * release. Majors should still be rare and batched, for the same reason.
 */
export const SUPPORTED_MAJORS: readonly number[] = Object.freeze([2])
export const LATEST_MAJOR = SUPPORTED_MAJORS[SUPPORTED_MAJORS.length - 1]

/**
 * Capabilities, mapped to the API version that introduced each.
 *
 * Capability names — not version comparisons — are the contract. A pack asking
 * `supports('widgets.reorder')` keeps working if the feature is backported to a
 * patch release, or reordered across minors; a pack comparing `version >= 1.3`
 * does not. The version here exists only to produce a good error message.
 *
 * Removing an entry is a breaking change and requires a major bump.
 */
const CAPABILITIES: ReadonlyMap<string, string> = new Map([
  ['graph.nodes', '2.0'],
  ['node.geometry', '2.0'],
  ['slots.connect', '2.0'],
  ['slots.identity', '2.0'],
  ['slots.resolvedSource', '2.0'],
  ['widgets.reorder', '2.0'],
  ['widgets.hidden', '2.0'],
  ['widgets.height', '2.0'],
  ['widgets.linked', '2.0'],
  ['widgets.textInteraction', '2.0'],
  ['slots.retype', '2.0'],
  ['slots.moveLinks', '2.0'],
  ['defs.extend', '2.0'],
  ['widgets.create', '2.0'],
  ['serialization.control', '2.0'],
  ['widgets.mount', '2.0'],
  ['widgets.typeContext', '2.0'],
  ['widgets.canvas', '2.0'],
  ['node.onPreview', '2.0'],
  ['node.sizeConstraints', '2.0'],
  ['node.onSerialize', '2.0'],
  ['defs.define', '2.0'],
  ['node.resolve', '2.0'],
  ['slots.dynamic', '2.0'],
  ['slots.widgetConfig', '2.0'],
  ['slots.layout', '2.0'],
  ['slots.localizedName', '2.0'],
  ['slots.connectedType', '2.0'],
  ['graph.selection', '2.0'],
  ['node.connectVeto', '2.0'],
  ['node.menu', '2.0'],
  ['settings', '2.0'],
  ['commands', '2.0'],
  ['commands.playSound', '2.0'],
  ['backend', '2.0'],
  ['storage', '2.0'],
  ['system.monitor', '2.0'],
  ['ui.sidebarTab', '2.0'],
  ['viewport.changed', '2.0'],
  ['interaction.state', '2.0'],
  ['interaction.nodeMoved', '2.0'],
  ['interaction.nodeDragEnd', '2.0'],
  ['node.changeScope', '2.0'],
  ['node.fileDrop', '2.0'],
  ['workflow.open', '2.0'],
  ['workflow.textReplacements', '2.0'],
  ['execution.node', '2.0'],
  ['defs.typeCompatibility', '2.0'],
  ['defs.inputValues', '2.0'],
  ['defs.localizedInputNames', '2.0'],
  ['supply.outputs', '2.0'],
  ['supply.resolved', '2.0'],
  ['queue.disableAutoQueue', '2.0'],
  ['queue.settings', '2.0']
])

/**
 * Capabilities that are known but not yet available here, so `require()` can
 * say *when* rather than merely "no". Entries move into CAPABILITIES on ship.
 *
 * `slots.named` gates the transitional rule in `slotRef`: while absent, a
 * canonical integer string resolves positionally (`'0'` is slot 0), so call
 * sites need no rewrite once the backend supplies names.
 */
const PLANNED: ReadonlyMap<string, string> = new Map([
  ['slots.named', '2.1'],
  ['node.decorations', '2.2'],
  ['node.chrome', '2.2']
])

export interface Comfy {
  /**
   * `major.minor`. Prefer `supports()` over comparing this — a capability
   * survives being backported or reordered across minors; a version comparison
   * does not.
   */
  readonly version: string
  /** Breaking-change generation. Incremented only when something is removed. */
  readonly major: number
  /** Cheap, never throws. The supported way to branch. */
  supports(capability: string): boolean
  /** Asserts a capability, with an actionable error naming it. */
  require(capability: string): void
  /** Every capability this host provides. */
  capabilities(): readonly string[]
  /**
   * Pins to a specific major, so a pack written against one is not moved onto
   * the next by a host upgrade.
   *
   * A pinned major stays available for as long as it is supported — see
   * {@link SUPPORTED_MAJORS} — not indefinitely. Withdrawal follows ComfyUI's
   * phased deprecation, so a pin buys a stable contract across releases rather
   * than a permanent one.
   */
  forMajor(major: number): Comfy

  /**
   * True when two handles refer to the same entity, whatever major, API
   * instance or graph scope produced them.
   *
   * `===` is only reliable for handles from the same instance, the same major
   * AND the same scope. Scope is the one most likely to catch a pack out: a
   * node reached through `comfy.graph` while it is on screen and the same node
   * reached through `graph.subgraphs()` or through a document-scoped
   * `onNodeChanged` come from different handle caches, so they are equal here
   * and not equal under `===`. Use this whenever a handle may have come from
   * another pack, from an event, or from a graph other than the visible one.
   */
  sameEntity(a: unknown, b: unknown): boolean

  /**
   * Re-resolves a handle from any major or instance into one of this instance's
   * own. Returns `undefined` if it is not a handle, or its entity is gone.
   */
  adopt(handle: unknown): NodeHandle | undefined

  readonly graph: GraphHandle
  /** Node definitions, and the replacement for `beforeRegisterNodeDef`. */
  readonly defs: DefRegistry
  /** Declaring, reading and writing pack settings. */
  readonly settings: SettingsHandle
  /**
   * Per-user persistent storage for documents the pack's users author —
   * templates, presets, saved prompts. Server-side, so it follows the user
   * between machines.
   */
  readonly storage: StorageHandle
  /** Bounded, host-sampled hardware metrics. */
  readonly system: SystemHandle
  /** The sanctioned slice of app chrome — sidebar tabs. */
  readonly ui: UiHandle
  /** Commands, their keybindings, and notifications. */
  readonly commands: CommandsHandle
  /** Backend URLs and messages, including a pack's own events. */
  readonly backend: BackendHandle
  /** Loading a parsed workflow into a new active document. */
  readonly workflow: WorkflowHandle
  /**
   * The editor is already mid-gesture — dragging a link, resizing a node,
   * dragging a widget. A pack running its own pointer gesture must stand down
   * while this is true.
   */
  isInteracting(): boolean
  /**
   * Observes nodes being moved, under either renderer.
   *
   * For building an editing gesture — swap, insert-on-link, shake-to-detach.
   * A pack that moves nodes itself will see its own writes, so guard re-entry.
   */
  onNodeMoved(listener: (event: NodeMoveEvent) => void): Unsubscribe
  /**
   * A drag finished; every node it moved.
   *
   * Where an editing gesture commits — swap the pair, insert into the link
   * under the cursor. **Nodes 2.0 only**: the legacy canvas renderer publishes
   * no drag lifecycle, so this never fires under it.
   */
  onNodeDragEnd(listener: (nodes: readonly NodeHandle[]) => void): Unsubscribe
  /**
   * The view panned, zoomed or was resized.
   *
   * For keeping something anchored to a node in sync — ask
   * `node.getScreenRect()` again when this fires. Carries no payload: where a
   * node is belongs to the node, and the transform belongs to the renderer.
   */
  onViewportChanged(listener: () => void): Unsubscribe
  /**
   * A node changed — its mode, title, colour or shape.
   *
   * For observing nodes the pack does not own. rgthree's relay polls every
   * 500ms and installs a `defineProperty` trap on `mode` because nothing
   * reports it; this is that signal.
   *
   * One stream rather than a subscription per node, deliberately: node
   * identity does not survive undo, reload or re-entering a subgraph, so
   * anything keyed by the object stops firing silently, and keying by id
   * instead never gets collected. Filter by `event.node.id`.
   *
   * Only fields the host tracks are reported. Position is not among them — it
   * changes per frame during a drag and is served by {@link onNodeMoved}.
   *
   * Reports the graph on screen unless `scope: 'document'` asks for the root
   * graph and every subgraph definition as well. A pack that computes from
   * other nodes wants `'document'`: a relay in a subgraph the user has
   * navigated away from otherwise stops recomputing while still asserting its
   * last answer. Each event names the graph it came from, and resolves its node
   * there — ids repeat across definitions, so `event.node.id` alone is not a
   * key.
   */
  onNodeChanged(
    listener: (event: NodeChangeEvent) => void,
    options?: NodeChangeOptions
  ): Unsubscribe
  /**
   * The application has finished starting: canvas, settings and graph all
   * exist, and node definitions are registered.
   *
   * This is `registerExtension({ setup })`. A pack's module body is the `init`
   * half — it runs before definitions register — so anything that needs the
   * running app belongs here. Registering after the app has already started is
   * fine; the listener is called on the next microtask rather than dropped,
   * which is what makes this safe for a pack loaded lazily.
   *
   * Do not poll for the DOM instead. Several packs shipped a `waitForElements`
   * loop to paper over the missing hook, and a poll that outlives its target
   * is a leak that only shows up on someone else's machine.
   */
  onReady(listener: () => void): Unsubscribe
  /** Starting a run, and knowing when one starts. */
  readonly queue: QueueHandle
  /**
   * The node the backend is executing, or `undefined` between runs.
   *
   * Packs tracked this from the raw `executing` message to badge the running
   * node or follow it with the view.
   */
  executingNode(): NodeHandle | undefined
  /** Resolves a backend execution id, including a nested subgraph path. */
  executionNode(id: string): NodeHandle | undefined
  /** Fires when {@link executingNode} changes, including to nothing. */
  onExecutingNodeChanged(
    listener: (node: NodeHandle | undefined) => void
  ): Unsubscribe
  /**
   * A workflow finished loading, and the graph is the new one.
   *
   * This is `afterConfigureGraph`. Unlike {@link onReady} it fires again for
   * every workflow the user opens, which is what a pack re-attaching itself to
   * the document needs — `onReady` fires once and misses every later open.
   */
  onWorkflowLoaded(listener: () => void): Unsubscribe
}

/** Per-major instances, memoised per graph provider. */
function buildMajor(
  major: number,
  getGraph: () => LGraph | null | undefined,
  forMajor: (m: number) => Comfy,
  defs: ReturnType<typeof createDefRegistry>,
  openWorkflow?: (data: WorkflowData) => Promise<void>
): Comfy {
  const graph = createGraphApi(
    getGraph,
    `v${major}`,
    frontendResolverMap,
    frontendSupplierMap
  )
  const rootGraph = createGraphApi(
    () => getGraph()?.rootGraph,
    `v${major}:root`,
    frontendResolverMap,
    frontendSupplierMap
  )
  const settings = createSettingsApi()
  const storage = createStorageApi()
  const system = createSystemApi()
  const ui = createUiHandle()
  const commands = createCommandsApi()
  const backend = createBackendApi()
  const workflow = createWorkflowApi(getGraph, openWorkflow, currentDocumentId)
  const definitionScopes = new WeakMap<LGraph, GraphHandle>()
  const capabilities = new Map(CAPABILITIES)
  if (!openWorkflow) capabilities.delete('workflow.open')

  function handleForDefinitionNode(node: LGraphNode): NodeHandle {
    const owner = node.graph
    if (!owner) {
      throw new ComfyApiError(
        `Cannot expose widget context for node '${String(node.id)}': it has not joined a graph.`
      )
    }
    let scope = definitionScopes.get(owner)
    if (!scope) {
      scope = createGraphApi(
        () => owner,
        `v${major}:definition:${owner.id}`,
        frontendResolverMap,
        frontendSupplierMap
      )
      definitionScopes.set(owner, scope)
    }
    const handle = scope.node(String(node.id))
    if (!handle) {
      throw new ComfyApiError(
        `Cannot expose widget context for node '${String(node.id)}': its graph cannot resolve it.`
      )
    }
    return handle
  }

  /**
   * The node an event names, resolved inside the graph that owns it. Ids repeat
   * across subgraph definitions, so the graph is half of the key.
   *
   * The graph on screen is tried first, so an event for it yields the same
   * handle `comfy.graph.node()` does.
   */
  function nodeIn(graphId: string, nodeId: string): NodeHandle | undefined {
    if (graphId === graph.id) return graph.node(nodeId)
    const subgraph = graph.subgraphs().find(({ id }) => id === graphId)
    if (subgraph) return subgraph.node(nodeId)
    return graphId === rootGraph.id ? rootGraph.node(nodeId) : undefined
  }

  function executionNode(id: string): NodeHandle | undefined {
    const root = getGraph()?.rootGraph
    if (!root) return undefined
    const node = getNodeByExecutionId(root, id)
    if (!node?.graph) return undefined
    return nodeIn(node.graph.id, String(node.id))
  }

  return Object.freeze({
    version: major === LATEST_MAJOR ? NODE_API_VERSION : `${major}.0`,
    major,
    supports: (capability: string) => capabilities.has(capability),
    require(capability: string) {
      if (capabilities.has(capability)) return
      throw new ComfyUnsupportedError(
        capability,
        NODE_API_VERSION,
        PLANNED.get(capability)
      )
    },
    capabilities: () => Object.freeze([...capabilities.keys()]),
    forMajor,
    sameEntity: isSameEntity,
    adopt(handle: unknown) {
      const token = handleToken(handle)
      // Only node handles are adoptable today; slots and widgets are reached
      // through their owning node, so adopting one in isolation would hand back
      // something with no context.
      return token?.kind === 'node' && token.graphId
        ? nodeIn(token.graphId, token.id)
        : undefined
    },
    graph,
    settings,
    storage,
    system,
    ui,
    commands,
    backend,
    workflow,
    isInteracting,
    onNodeMoved: createNodeMoveObserver((id) => graph.node(id)),
    onNodeDragEnd: createNodeDragEndObserver((id) => graph.node(id)),
    onViewportChanged: createViewportObserver(),
    onNodeChanged: createNodeChangeObserver(nodeIn),
    onReady: onAppReady,
    queue: createQueueApi(getGraph),
    executingNode: () => {
      const id = useExecutionStore().executingNodeId
      return id ? executionNode(id) : undefined
    },
    executionNode,
    onExecutingNodeChanged: (
      listener: (node: NodeHandle | undefined) => void
    ) => {
      const store = useExecutionStore()
      return watch(
        () => store.executingNodeId,
        (id) => listener(id ? executionNode(id) : undefined)
      )
    },
    onWorkflowLoaded,
    defs: defs.forMajor(
      (nodeId) => graph.node(nodeId)!,
      handleForDefinitionNode
    )
  })
}

export function createComfyApi(
  getGraph: () => LGraph | null | undefined,
  major: number = LATEST_MAJOR,
  host: ComfyApiHost = {}
): Comfy {
  const byMajor = new Map<number, Comfy>()
  // One registry across all majors: a def is registered once, so every major's
  // extensions have to be applied in that single pass.
  const defs = createDefRegistry(host.refreshDefinitions)

  const forMajor = (requested: number): Comfy => {
    if (!SUPPORTED_MAJORS.includes(requested)) {
      throw new ComfyUnsupportedError(
        `API major ${requested}`,
        NODE_API_VERSION
      )
    }
    let instance = byMajor.get(requested)
    if (!instance) {
      instance = buildMajor(
        requested,
        getGraph,
        forMajor,
        defs,
        host.openWorkflow
      )
      byMajor.set(requested, instance)
    }
    return instance
  }

  const api = forMajor(major)
  defRegistries.set(api, defs)
  return api
}

/**
 * The `applyTo` half of each API instance's def registry.
 *
 * Kept out of the public `Comfy` surface: packs register extensions, only the
 * app applies them, and exposing the apply hook would let one pack drive
 * another's registration.
 */
const defRegistries = new WeakMap<Comfy, ReturnType<typeof createDefRegistry>>()

/**
 * Applies registered `defs.extend` callbacks to a node class being registered.
 * Called by the app from its legacy `beforeRegisterNodeDef` dispatch.

 */
export function applyDefExtensions(
  nodeType: { prototype: object },
  rawDef: unknown
): void {
  if (!singleton) return
  defRegistries.get(singleton)?.applyTo(nodeType, rawDef)
}

let singleton: Comfy | undefined

/**
 * The app-wide instance. The graph provider is injected by the app layer rather
 * than imported here, so this module stays a leaf: it depends on litegraph
 * types only, never on stores or the app.
 *
 * @knipIgnoreUsedByStackedPR magicPatch/verify builds its instance through this
 */
export function useComfyApi(
  getGraph: () => LGraph | null | undefined,
  host?: ComfyApiHost
): Comfy {
  singleton ??= createComfyApi(getGraph, LATEST_MAJOR, host)
  return singleton
}

/**
 * Drops the memoised instance, so a suite can build one against a graph it
 * controls. The conversion corpus runs every converted pack this way.
 *
 */
export function resetComfyApi(): void {
  singleton = undefined
}

/**
 * Exposes the API as `window.comfy`.
 *
 * Must run **before** extensions are imported. Extension modules execute their
 * top level during `loadExtensions()`, and `window.app` is only assigned after
 * `setup()` resolves — which is why packs historically could not touch the app
 * at module scope. Installing here removes that trap: `window.comfy` is usable
 * from the first line of an extension.

 */
export function installComfyApi(
  getGraph: () => LGraph | null | undefined,
  host?: ComfyApiHost
): Comfy {
  const comfy = useComfyApi(getGraph, host)
  window.comfy = comfy
  return comfy
}
