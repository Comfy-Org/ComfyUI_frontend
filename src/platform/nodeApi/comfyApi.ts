/**
 * The public entry point handed to custom nodes.
 *
 * Capability probing is first-class rather than an afterthought: packs must run
 * against several frontend versions at once, so `supports()` is how they branch
 * without version sniffing, and how we retire transitional behaviour safely.
 */
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { handleToken, isSameEntity } from './closedProxy'
import { createDefRegistry } from './defsRegistry'
import type { DefRegistry } from './defsRegistry'
import { ComfyUnsupportedError } from './errors'
import { apiConstants, isInteracting } from './constants'
import {
  createNodeDragEndObserver,
  createNodeMoveObserver
} from './interaction'
import type { NodeMoveEvent } from './interaction'
import type { Unsubscribe } from './widgetHandle'
import type { ApiConstants } from './constants'
import { createGraphApi } from './graphHandle'
import type { GraphHandle } from './graphHandle'
import { createSettingsApi } from './settingsHandle'
import type { SettingsHandle } from './settingsHandle'
import type { NodeHandle } from './nodeHandle'

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
export const NODE_API_VERSION = '1.0'

/**
 * Every major this host serves. **All majors stay supported — none is ever
 * withdrawn.**
 *
 * This is affordable only because a major is a *spec*, not a fork: each one is
 * a declarative mapping from public names onto whatever the internals currently
 * are, sharing one engine (`closedProxy`, `slotRef`, the collections). Adding a
 * major adds a mapping; it does not freeze internals or duplicate logic.
 *
 * The real cost is not maintenance — it is the day an old major's semantics
 * become genuinely inexpressible against current internals. That is the case to
 * watch for, and the reason majors should be rare and batched.
 */
export const SUPPORTED_MAJORS: readonly number[] = Object.freeze([1])
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
  ['graph.nodes', '1.0'],
  ['node.geometry', '1.0'],
  ['slots.connect', '1.0'],
  ['slots.identity', '1.0'],
  ['widgets.reorder', '1.0'],
  ['widgets.hidden', '1.0'],
  ['slots.retype', '1.0'],
  ['slots.moveLinks', '1.0'],
  ['defs.extend', '1.0'],
  ['widgets.create', '1.0'],
  ['serialization.control', '1.0'],
  ['widgets.mount', '1.0'],
  ['widgets.canvas', '1.0'],
  ['node.onPreview', '1.0'],
  ['node.sizeConstraints', '1.0'],
  ['node.onSerialize', '1.0'],
  ['defs.define', '1.0'],
  ['node.resolve', '1.0'],
  ['slots.dynamic', '1.0'],
  ['graph.selection', '1.0'],
  ['node.connectVeto', '1.0'],
  ['node.menu', '1.0'],
  ['settings', '1.0'],
  ['constants', '1.0'],
  ['interaction.state', '1.0'],
  ['interaction.nodeMoved', '1.0'],
  ['interaction.nodeDragEnd', '1.0']
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
  ['slots.named', '1.1'],
  ['node.decorations', '1.2'],
  ['node.chrome', '1.2']
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
   * Pins to a specific major. Every major this host knows stays available, so a
   * pack written against an older one keeps working indefinitely.
   */
  forMajor(major: number): Comfy

  /**
   * True when two handles refer to the same entity, whatever major or API
   * instance produced them.
   *
   * `===` is only reliable for handles from the *same* instance and major. Use
   * this whenever a handle may have come from another pack.
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
   * Renderer values a pack needs to lay itself out, replacing reads of
   * `LiteGraph.*`. Values, not the object: the constants are the renderer's to
   * change, and a pack holding a reference to it holds the renderer open.
   */
  readonly constants: ApiConstants
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
}

/** Per-major instances, memoised per graph provider. */
function buildMajor(
  major: number,
  getGraph: () => LGraph | null | undefined,
  forMajor: (m: number) => Comfy,
  defs: ReturnType<typeof createDefRegistry>
): Comfy {
  const graph = createGraphApi(getGraph, `v${major}`)
  const settings = createSettingsApi()

  return Object.freeze({
    version: major === LATEST_MAJOR ? NODE_API_VERSION : `${major}.0`,
    major,
    supports: (capability: string) => CAPABILITIES.has(capability),
    require(capability: string) {
      if (CAPABILITIES.has(capability)) return
      throw new ComfyUnsupportedError(
        capability,
        NODE_API_VERSION,
        PLANNED.get(capability)
      )
    },
    capabilities: () => Object.freeze([...CAPABILITIES.keys()]),
    forMajor,
    sameEntity: isSameEntity,
    adopt(handle: unknown) {
      const token = handleToken(handle)
      // Only node handles are adoptable today; slots and widgets are reached
      // through their owning node, so adopting one in isolation would hand back
      // something with no context.
      return token?.kind === 'node' ? graph.node(token.id) : undefined
    },
    graph,
    settings,
    get constants() {
      return apiConstants()
    },
    isInteracting,
    onNodeMoved: createNodeMoveObserver((id) => graph.node(id)),
    onNodeDragEnd: createNodeDragEndObserver((id) => graph.node(id)),
    defs: defs.forMajor((nodeId) => graph.node(nodeId)!)
  })
}

export function createComfyApi(
  getGraph: () => LGraph | null | undefined,
  major: number = LATEST_MAJOR
): Comfy {
  const byMajor = new Map<number, Comfy>()
  // One registry across all majors: a def is registered once, so every major's
  // extensions have to be applied in that single pass.
  const defs = createDefRegistry()

  const forMajor = (requested: number): Comfy => {
    if (!SUPPORTED_MAJORS.includes(requested)) {
      throw new ComfyUnsupportedError(
        `API major ${requested}`,
        NODE_API_VERSION
      )
    }
    let instance = byMajor.get(requested)
    if (!instance) {
      instance = buildMajor(requested, getGraph, forMajor, defs)
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
  defRegistries
    .get(singleton)
    ?.applyTo(nodeType as { prototype: Partial<LGraphNode> }, rawDef)
}

let singleton: Comfy | undefined

/**
 * The app-wide instance. The graph provider is injected by the app layer rather
 * than imported here, so this module stays a leaf: it depends on litegraph
 * types only, never on stores or the app.
 */
export function useComfyApi(getGraph: () => LGraph | null | undefined): Comfy {
  singleton ??= createComfyApi(getGraph)
  return singleton
}

/** Test seam — drops the memoised instance. */
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
  getGraph: () => LGraph | null | undefined
): Comfy {
  const comfy = useComfyApi(getGraph)
  window.comfy = comfy
  return comfy
}
