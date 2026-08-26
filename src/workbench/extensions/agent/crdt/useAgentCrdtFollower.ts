import { computed, onBeforeUnmount, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

// The follower composable is the composition root that wires renderer-layer
// concretes (layout store, litegraph) into the layer-agnostic CRDT seam. This
// is the single, documented workbench→renderer boundary crossing (ADR-009);
// the mutator/projector/diff themselves stay free of renderer imports.
// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
// eslint-disable-next-line import-x/no-restricted-paths
import { LayoutSource } from '@/renderer/core/layout/types'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useAuthStore } from '@/stores/authStore'

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

  const client = new DocFrameClient(apiTransport)
  const bridge = new LayoutFollowerBridge(client)
  const tabId = crypto.randomUUID()
  // Highest doc_update seq seen — used as base_version for human-minted ops.
  // The ws path has no ceiling gate; this only feeds LWW stamps, so a slightly
  // stale value is safe (ties break by [base_version, actor, op_id]).
  let lastSeq = 0
  // Post-ECS main removed the global layout source scope
  // (`LayoutSource.External` / `layoutStore.setSource`), so remote batches
  // apply directly. Echo suppression becomes load-bearing only when the
  // human-op sender lands (KA-6: the follower itself never writes); it must
  // then be rebuilt against per-mutation ECS command sources.
  const mutator = new LitegraphMutator({
    getGraph: () => app.graph ?? null,
    createNode: (type) => LiteGraph.createNode(type),
    runRemoteScope: (apply) => {
      const previousSource = layoutStore.getCurrentSource()
      layoutStore.setSource(LayoutSource.External)
      try {
        apply()
      } finally {
        layoutStore.setSource(previousSource)
      }
    }
  })
  const projector = new SemanticProjector(mutator, { actor: tabId })

  const onSubscribed: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    connected.value = event.detail.ok === true
    lastFrameType.value = event.type
  }
  const onUpdate: EventListener = (event) => {
    updatesApplied.value = bridge.follower.updatesApplied
    lastFrameType.value = event.type
    if (event instanceof CustomEvent && typeof event.detail?.seq === 'number')
      lastSeq = Math.max(lastSeq, event.detail.seq)
    projector.project(bridge.follower.doc)
  }
  const onOpsResult: EventListener = (event) => {
    lastFrameType.value = event.type
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
  }
  const onSchemaError: EventListener = (event) => {
    // KA-11 fail-closed: the bridge refused to propagate an unreadable doc, so
    // nothing was projected. Surface it as its own status rather than as a
    // generic "disconnected", which is indistinguishable from "never connected".
    connected.value = false
    lastFrameType.value = event.type
  }
  const onReconnected: EventListener = () => {
    connected.value = false
    projector.reset()
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

  watch(
    workflowId,
    (next) => {
      connected.value = false
      subscribedWorkflowId.value = next
      projector.reset()
      if (next === null) bridge.unsubscribe()
      else bridge.subscribe(next)
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
  const pocGlobal = window as unknown as Record<string, unknown>
  pocGlobal.__agentCrdtPoc = {
    addNode: pocAddNode,
    sendOps: (ops: DocOp[]) => bridge.sendHumanOps(tabId, ops),
    tabId,
    get lastSeq() {
      return lastSeq
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
