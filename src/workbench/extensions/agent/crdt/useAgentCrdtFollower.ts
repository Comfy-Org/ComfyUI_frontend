import { computed, onBeforeUnmount, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useAuthStore } from '@/stores/authStore'

import { recordDevEvent } from './devPanelLog'
import type { DocFrameTransport, DocOp } from './docFrameClient'
import { DocFrameClient } from './docFrameClient'
import { resolveFollowerEnabled } from './followerGate'
import { LayoutFollowerBridge } from './layoutFollowerBridge'
import { LitegraphMutator } from './litegraphMutator'
import { SemanticProjector } from './semanticProjector'

// Resolved once per page load ("per session"): build-time env, overridable at
// runtime via `?agentCrdtFollower=1|0` / localStorage so predeploy-built
// bundles (which never receive the env) can still enable the follower. R1a.
const enabled = resolveFollowerEnabled({
  buildFlag: import.meta.env.VITE_AGENT_CRDT_FOLLOWER,
  search: window.location.search,
  storage: safeLocalStorage()
})

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// FE-1902: the doc id is otherwise held only in memory (set on turn ack), so a
// panel remount / page reload loses the binding until the NEXT turn ack.
// Persist it per-tab in sessionStorage so a remount can rebind immediately.
const DOC_ID_SESSION_KEY = 'Comfy.Agent.CrdtDocId'

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function persistDocId(id: string): void {
  try {
    safeSessionStorage()?.setItem(DOC_ID_SESSION_KEY, id)
  } catch {
    // Quota / privacy mode: persistence is best-effort.
  }
}

function readPersistedDocId(): string | null {
  try {
    return safeSessionStorage()?.getItem(DOC_ID_SESSION_KEY) ?? null
  } catch {
    return null
  }
}

function clearPersistedDocId(): void {
  try {
    safeSessionStorage()?.removeItem(DOC_ID_SESSION_KEY)
  } catch {
    // Best-effort.
  }
}

export interface AgentCrdtStatus {
  enabled: boolean
  connected: boolean
  workflowId: string | null
  updatesApplied: number
  lastFrameType: string | null
}

export const apiTransport: DocFrameTransport = {
  send(frame) {
    // Never throws: a closed socket is a recoverable state, not an error. See
    // DocFrameTransport.send — throwing here aborted both the immediate
    // subscribe watcher and the unmount hook.
    if (api.socket?.readyState !== WebSocket.OPEN) return false
    api.socket.send(frame)
    return true
  },
  addEventListener(type, listener) {
    api.addCustomEventListener(type, listener)
  },
  removeEventListener(type, listener) {
    api.removeCustomEventListener(type, listener)
  }
}

export function useAgentCrdtFollower(workflowId: Ref<string | null>) {
  const connected = ref(false)
  const updatesApplied = ref(0)
  const lastFrameType = ref<string | null>(null)
  const subscribedWorkflowId = ref<string | null>(null)

  if (!enabled) {
    return {
      status: readonly(
        ref<AgentCrdtStatus>({
          enabled: false,
          connected: false,
          workflowId: null,
          updatesApplied: 0,
          lastFrameType: null
        })
      ),
      sendHumanOps: (_ops: DocOp[]) => undefined
    }
  }

  // Dev-panel tap (poc-4): log every outbound frame with its delivery result.
  // Wraps locally instead of modifying the exported apiTransport, whose
  // never-throw contract is covered by tests.
  const transport: DocFrameTransport = {
    send(frame) {
      const delivered = apiTransport.send(frame)
      // Never store the raw string: `sanitizeDetail` redacts by key, so an
      // unparsable frame would bypass it. Record only its length.
      let detail: Record<string, unknown>
      try {
        detail = { delivered, frame: JSON.parse(frame) }
      } catch {
        detail = { delivered, frame: null, unparsed_chars: frame.length }
      }
      recordDevEvent('ws_out', detail)
      return delivered
    },
    addEventListener(type, listener) {
      apiTransport.addEventListener(type, listener)
    },
    removeEventListener(type, listener) {
      apiTransport.removeEventListener(type, listener)
    }
  }
  const client = new DocFrameClient(transport)
  const bridge = new LayoutFollowerBridge(client)
  const tabId = crypto.randomUUID()
  // Highest doc_update seq seen — used as base_version for human-minted ops.
  // The ws path has no ceiling gate; this only feeds LWW stamps, so a slightly
  // stale value is safe (ties break by [base_version, actor, op_id]).
  let lastSeq = 0
  let lastOpsResult: unknown = null
  // Post-ECS main removed the global layout source scope
  // (`LayoutSource.External` / `layoutStore.setSource`), so remote batches
  // apply directly. Echo suppression becomes load-bearing only when the
  // human-op sender lands (KA-6: the follower itself never writes); it must
  // then be rebuilt against per-mutation ECS command sources.
  const mutator = new LitegraphMutator({
    getGraph: () => app.graph ?? null,
    createNode: (type) => LiteGraph.createNode(type)
  })
  const projector = new SemanticProjector(mutator, { actor: tabId })

  // Dev-panel tap (poc-4): track the doc's node-id set so the panel can show
  // exactly which nodes each doc_update added/removed. Rebuilt from zero on
  // doc_reset (remint) because the lineage broke.
  let knownDocNodeIds: Set<string> = new Set()
  const currentDocNodeIds = (): Set<string> => {
    try {
      const doc = bridge.follower.doc as unknown as {
        getMap: (k: string) => { toJSON: () => Record<string, unknown> }
      }
      return new Set(Object.keys(doc.getMap('nodes').toJSON()))
    } catch {
      return new Set()
    }
  }

  // FE-1901 (poc-2): a `doc_subscribed {ok:false}` is a SERVER refusal — e.g.
  // the subscribe raced the doc-host before the turn ack minted the doc. The
  // bridge's transport-level reconcile can never repair it: the frame WAS
  // delivered, so intent already equals reality. Retry the subscribe itself
  // with bounded exponential backoff while the desired doc is unchanged.
  const SUBSCRIBE_RETRY_BASE_MS = 500
  const SUBSCRIBE_RETRY_MAX_ATTEMPTS = 6
  let subscribeRetryTimer: ReturnType<typeof setTimeout> | null = null
  let subscribeRetryAttempt = 0

  const clearSubscribeRetry = (): void => {
    if (subscribeRetryTimer !== null) {
      clearTimeout(subscribeRetryTimer)
      subscribeRetryTimer = null
    }
    subscribeRetryAttempt = 0
  }

  const scheduleSubscribeRetry = (): void => {
    if (subscribeRetryTimer !== null) return
    if (subscribeRetryAttempt >= SUBSCRIBE_RETRY_MAX_ATTEMPTS) return
    const target = subscribedWorkflowId.value
    if (target === null) return
    const delay = SUBSCRIBE_RETRY_BASE_MS * 2 ** subscribeRetryAttempt
    subscribeRetryAttempt += 1
    subscribeRetryTimer = setTimeout(() => {
      subscribeRetryTimer = null
      // The desired doc changed while we waited — the watch owns that path.
      if (subscribedWorkflowId.value !== target) return
      recordDevEvent('subscribe_retry', {
        attempt: subscribeRetryAttempt,
        workflowId: target
      })
      bridge.resubscribe()
    }, delay)
  }

  const onSubscribed: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const ok = event.detail?.ok === true
    connected.value = ok
    lastFrameType.value = event.type
    recordDevEvent('doc_subscribed', event.detail ?? null)
    if (ok) {
      clearSubscribeRetry()
      // FE-1902 (poc-3): only a CONFIRMED binding is worth rebinding to after
      // a remount — persist on ok, not on intent.
      if (subscribedWorkflowId.value !== null)
        persistDocId(subscribedWorkflowId.value)
    } else {
      scheduleSubscribeRetry()
    }
  }
  const onUpdate: EventListener = (event) => {
    updatesApplied.value = bridge.follower.updatesApplied
    lastFrameType.value = event.type
    if (event instanceof CustomEvent && typeof event.detail?.seq === 'number')
      lastSeq = Math.max(lastSeq, event.detail.seq)
    projector.project(bridge.follower.doc)
    if (event instanceof CustomEvent) {
      const detail = event.detail as {
        workflowId?: string
        seq?: number
        update?: Uint8Array
        actor?: string
      } | null
      recordDevEvent('doc_update', {
        workflowId: detail?.workflowId,
        seq: detail?.seq,
        actor: detail?.actor,
        bytes:
          detail?.update instanceof Uint8Array ? detail.update.length : null
      })
    }
    const ids = currentDocNodeIds()
    const added = [...ids].filter((id) => !knownDocNodeIds.has(id))
    const removed = [...knownDocNodeIds].filter((id) => !ids.has(id))
    if (added.length > 0 || removed.length > 0)
      recordDevEvent('doc_nodes_changed', { added, removed })
    knownDocNodeIds = ids
  }
  const onOpsResult: EventListener = (event) => {
    lastFrameType.value = event.type
    if (event instanceof CustomEvent) {
      lastOpsResult = event.detail ?? null
      recordDevEvent('doc_ops_result', event.detail ?? null)
    }
  }
  const onDocReset: EventListener = (event) => {
    // Lineage break: the bridge already dropped its doc and resubscribed with
    // an empty state vector. Forget the projected snapshot so the fresh folded
    // state re-materializes from zero instead of diffing against a canvas
    // seeded by the dead lineage.
    connected.value = false
    updatesApplied.value = 0
    lastFrameType.value = event.type
    projector.reset()
    knownDocNodeIds = new Set()
    recordDevEvent(
      'doc_reset',
      event instanceof CustomEvent ? (event.detail ?? null) : null
    )
  }
  const onSchemaError: EventListener = (event) => {
    // KA-11 fail-closed: the bridge refused to propagate an unreadable doc, so
    // nothing was projected. Surface it as its own status rather than as a
    // generic "disconnected", which is indistinguishable from "never connected".
    connected.value = false
    lastFrameType.value = event.type
    recordDevEvent(
      'schema_error',
      event instanceof CustomEvent ? (event.detail ?? null) : null
    )
  }
  const onReconnected: EventListener = () => {
    connected.value = false
    projector.reset()
    recordDevEvent('reconnected', null)
    bridge.resubscribe()
  }
  /**
   * Re-drive subscription intent whenever the socket may have become usable.
   *
   * `reconnected` fires only on a RE-connect (`api.ts` guards the dispatch with
   * `isReconnect`), so it can never repair a follower that mounted while the
   * first socket was still being opened — `createSocket` awaits an auth token
   * before `new WebSocket(...)`, and a panel mounted inside that window used to
   * stay inert forever. The ComfyUI server sends a `status` frame immediately
   * on every accepted connection, first one included, so it is the earliest
   * signal available that the socket can now carry a frame. `reconcile()` is a
   * no-op once intent and reality agree, so the extra `status` traffic costs
   * nothing.
   */
  const onSocketActivity: EventListener = () => {
    bridge.reconcile()
  }

  bridge.addEventListener('doc_subscribed', onSubscribed)
  bridge.addEventListener('doc_update', onUpdate)
  bridge.addEventListener('doc_ops_result', onOpsResult)
  bridge.addEventListener('doc_reset', onDocReset)
  bridge.addEventListener('schema_error', onSchemaError)
  api.addEventListener('reconnected', onReconnected)
  api.addEventListener('status', onSocketActivity)

  // FE-1902 (poc-3): distinguish the mount-time null (in-memory doc id died
  // with the previous mount — rebind from sessionStorage) from a later null
  // (a REAL detach, e.g. new chat — drop the persisted id too).
  let initialBind = true
  watch(
    workflowId,
    (next) => {
      clearSubscribeRetry()
      connected.value = false
      projector.reset()
      knownDocNodeIds = new Set()
      if (next === null) {
        const persisted = initialBind ? readPersistedDocId() : null
        initialBind = false
        if (persisted !== null) {
          recordDevEvent('rebind', { workflowId: persisted })
          subscribedWorkflowId.value = persisted
          bridge.subscribe(persisted)
          return
        }
        clearPersistedDocId()
        subscribedWorkflowId.value = null
        bridge.unsubscribe()
        return
      }
      initialBind = false
      subscribedWorkflowId.value = next
      bridge.subscribe(next)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    // Teardown must be total. Anything that survives keeps a projector wired to
    // the live `app.graph`, so a remount would apply every subsequent update
    // twice. `bridge.destroy()` and the transport send it performs are
    // failure-tolerant by construction now, but the try/finally makes the
    // "client.destroy() always runs" guarantee local and readable.
    try {
      clearSubscribeRetry()
      delete (window as unknown as Record<string, unknown>).__agentCrdtPoc
      api.removeEventListener('reconnected', onReconnected)
      api.removeEventListener('status', onSocketActivity)
      bridge.removeEventListener('doc_subscribed', onSubscribed)
      bridge.removeEventListener('doc_update', onUpdate)
      bridge.removeEventListener('doc_ops_result', onOpsResult)
      bridge.removeEventListener('doc_reset', onDocReset)
      bridge.removeEventListener('schema_error', onSchemaError)
      bridge.destroy()
    } finally {
      client.destroy()
    }
  })

  // ── PoC-only console helper (branch poc/fe-crdt-follower-e2e) ────────────
  // Lets the e2e proof mint a REAL human add_node op from the devtools console
  // / Playwright without waiting for the canvas-command adapter. Mints the
  // exact envelope the doc-host validates: op_id 32-hex, actor
  // `human:<firebase-uid>:<tab>` (server recomputes and rejects mismatches),
  // base_version = last doc_update seq, stamp [base_version, actor], and the
  // full save-format node payload (inserted verbatim by the host applier).
  // The sender tab does NOT apply locally — the doc_update echo is the only
  // application, so there is no double-apply on this path.
  const mintOpId = (): string => {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  const mintNodeId = (): number =>
    2 ** 40 + Math.floor(Math.random() * (2 ** 52 - 2 ** 40))
  const pocAddNode = (
    classType: string,
    pos: [number, number] = [100, 100],
    nodeOverride?: Record<string, unknown>
  ): DocOp => {
    const userId = useAuthStore().userId ?? 'anonymous'
    const actor = `human:${userId}:${tabId}`
    const nodeId = mintNodeId()
    let node: Record<string, unknown>
    if (nodeOverride) {
      node = { ...nodeOverride, id: nodeId, type: classType, pos }
    } else {
      let serialized: Record<string, unknown> | null = null
      try {
        const lgNode = LiteGraph.createNode(classType)
        if (lgNode) {
          lgNode.id = nodeId as unknown as typeof lgNode.id
          lgNode.pos = [...pos]
          serialized = lgNode.serialize() as unknown as Record<string, unknown>
          // The doc host name-keys widgets via the pinned catalog's
          // widget_order; litegraph's positional serialize() can emit MORE
          // entries than the catalog names (e.g. LoadImage's upload-button
          // slot), which the host rejects (invalid_node_payload). Name-keyed
          // objects are accepted as-is (widgetsToYMap), and this litegraph
          // already emits widgets_values_named alongside the positional
          // array — send the named form and drop the extra key.
          if (serialized.widgets_values_named != null) {
            // Filter to real value-bearing widgets: the host's projection
            // throws (opaque 500) on ANY key outside the pinned catalog's
            // widget_order, and control widgets (e.g. LoadImage's `upload`
            // button) serialize a named entry but are not in widget_order.
            const named = serialized.widgets_values_named as Record<
              string,
              unknown
            >
            const filtered: Record<string, unknown> = {}
            for (const [name, value] of Object.entries(named)) {
              const w = lgNode.widgets?.find((x) => x.name === name)
              if (w && w.type !== 'button' && w.serialize !== false) {
                filtered[name] = value
              }
            }
            serialized.widgets_values = filtered
            delete serialized.widgets_values_named
          }
        }
      } catch {
        serialized = null
      }
      node = serialized
        ? { ...serialized, id: nodeId, type: classType, pos }
        : { id: nodeId, type: classType, pos, size: [270, 100] }
    }
    const baseVersion = lastSeq
    const op: DocOp = {
      op: 'add_node',
      op_id: mintOpId(),
      actor,
      base_version: baseVersion,
      stamp: [baseVersion, actor],
      node_id: nodeId,
      class_type: classType,
      pos,
      node
    }
    bridge.sendHumanOps(tabId, [op])
    return op
  }
  // Same envelope/actor path as pocAddNode, for the delete_node op. The host
  // rejects actors whose userId doesn't match the authenticated session, so
  // this must mint from useAuthStore() exactly like pocAddNode does.
  const pocDeleteNode = (
    nodeId: number,
    removedLinks: number[] = []
  ): DocOp => {
    const userId = useAuthStore().userId ?? 'anonymous'
    const actor = `human:${userId}:${tabId}`
    const baseVersion = lastSeq
    const op: DocOp = {
      op: 'delete_node',
      op_id: mintOpId(),
      actor,
      base_version: baseVersion,
      stamp: [baseVersion, actor],
      node_id: nodeId,
      removed_links: removedLinks
    }
    bridge.sendHumanOps(tabId, [op])
    return op
  }
  const pocGlobal = window as unknown as Record<string, unknown>
  pocGlobal.__agentCrdtPoc = {
    addNode: pocAddNode,
    deleteNode: pocDeleteNode,
    // Bind a fresh tab to an existing doc without waiting for a turn ack
    // (gap #2: doc id is otherwise in-memory only, set on turn ack). Drives
    // the same watch → bridge.subscribe path as the real binding.
    bindDoc: (id: string) => {
      // Mirror the watch path so status/persistence agree with the binding
      // (otherwise the dev panel shows "no document" on a live subscription).
      clearSubscribeRetry()
      subscribedWorkflowId.value = id
      bridge.subscribe(id)
    },
    sendOps: (ops: DocOp[]) => bridge.sendHumanOps(tabId, ops),
    resubscribe: () => bridge.resubscribe(),
    reconcile: () => bridge.reconcile(),
    project: () => projector.project(bridge.follower.doc),
    tabId,
    get lastSeq() {
      return lastSeq
    },
    get lastOpsResult() {
      return lastOpsResult
    },
    docNodes: () => {
      const doc = bridge.follower.doc as unknown as {
        getMap: (k: string) => { toJSON: () => Record<string, unknown> }
      }
      try {
        return doc.getMap('nodes').toJSON()
      } catch {
        return null
      }
    },
    get status() {
      return {
        enabled: true,
        connected: connected.value,
        workflowId: subscribedWorkflowId.value,
        updatesApplied: updatesApplied.value,
        lastFrameType: lastFrameType.value
      }
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const status = computed<AgentCrdtStatus>(() => ({
    enabled: true,
    connected: connected.value,
    workflowId: subscribedWorkflowId.value,
    updatesApplied: updatesApplied.value,
    lastFrameType: lastFrameType.value
  }))

  return {
    status: readonly(status),
    // The semantic canvas-command adapter will call this after it moves to
    // @comfyorg/comfy-multi-player. Raw Yjs client updates are never sent.
    sendHumanOps: (ops: DocOp[]) => bridge.sendHumanOps(tabId, ops)
  }
}
