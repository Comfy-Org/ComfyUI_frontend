import { usePreferredReducedMotion } from '@vueuse/core'
import { computed, onBeforeUnmount, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { api } from '@/scripts/api'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { createUuidv4 } from '@/utils/uuid'

import { recordDevEvent } from './devPanelLog'
import type { DocFrameTransport, DocUpdate } from './docFrameClient'
import { DocFrameClient } from './docFrameClient'
import type { MutationsForTarget } from './ecsFollowerAdapter'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import type { GraphOperation } from './graphOperations'
import type { GraphReplayState } from './graphReplayQueue'
import { GraphReplayQueue } from './graphReplayQueue'
import { LayoutFollowerBridge } from './layoutFollowerBridge'
import type { OpsResultView } from './opSender'
import { createOpSender } from './opSender'
import { resolveReplayEnabled } from './replayGate'

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

/**
 * Recency heartbeat budget (BE-9740's FE half): a bound, healthy channel that
 * delivers NO doc-scoped frame for this long gets ONE active probe - a
 * resubscribe whose state-vector catch-up is a no-op on a healthy channel and
 * exactly the observed recovery on a stale one. A stale channel and an idle
 * workflow look identical passively, so expiry probes instead of alarming.
 */
export const STALE_AFTER_MS = 30_000

export interface AgentCrdtStatus {
  enabled: boolean
  connected: boolean
  workflowId: string | null
  updatesApplied: number
  lastFrameType: string | null
  /** mm3-20 Option-B PoC: presentation-only replay state; `idle` when gated off. */
  replayState: GraphReplayState
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
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

export function useAgentCrdtFollower(
  workflowId: Ref<string | null>,
  graphMutations: MutationsForTarget,
  userId: () => string | null = () => null,
  isTargetActive: Ref<boolean> = ref(true)
) {
  const connected = ref(false)
  const updatesApplied = ref(0)
  const lastFrameType = ref<string | null>(null)
  const subscribedWorkflowId = ref<string | null>(null)

  // Dev-panel tap (poc-4): log every outbound frame with its delivery result.
  // Wraps locally instead of modifying the exported apiTransport, whose
  // never-throw contract is covered by tests.
  const transport: DocFrameTransport = {
    send(frame) {
      const delivered = apiTransport.send(frame)
      let parsed: unknown = frame
      try {
        parsed = JSON.parse(frame)
      } catch {
        // Leave the raw string.
      }
      recordDevEvent('ws_out', { delivered, frame: parsed })
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
  const adapter = new EcsFollowerAdapter(graphMutations)
  const tabId = createUuidv4()
  const sender = createOpSender({
    sendOps: (target, tab, ops) => client.sendOps(target, tab, ops),
    onOpsResult(listener) {
      const handler: EventListener = (event) => {
        if (!(event instanceof CustomEvent)) return
        const detail = event.detail as OpsResultView & { failed?: unknown }
        listener({
          ok: detail.ok,
          applied: detail.applied,
          skipped: detail.skipped,
          ...(detail.failed && typeof detail.failed === 'object'
            ? { failure: detail.failed as OpsResultView['failure'] }
            : {})
        })
      }
      bridge.addEventListener('doc_ops_result', handler)
      return () => bridge.removeEventListener('doc_ops_result', handler)
    },
    workflowId: () => bridge.subscribedWorkflowId,
    tab: tabId,
    actor: () => `human:${userId() ?? 'anonymous'}:${tabId}`,
    baseVersion: () => bridge.lastSequence,
    onBatchSettled: (outcome) => recordDevEvent('human_ops_settled', outcome)
  })

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
  let knownDocLinkIds: Set<string> = new Set()
  // mm3-23: link records carry `origin_id`/`target_id` verbatim from the
  // definition's serialized link objects (comfy-multi-player `mint.js`
  // `definitionLinkKey`/`cloneForMap`) - read them so the replay queue can
  // hold a link back until its endpoint node is revealed, instead of
  // revealing every link in its own pass.
  const currentDocLinkRecords = (): Map<
    string,
    { originId: string; targetId: string }
  > => {
    try {
      const doc = bridge.follower.doc as unknown as {
        getMap: (k: string) => { toJSON: () => Record<string, unknown> }
      }
      const raw = doc.getMap('links').toJSON()
      const out = new Map<string, { originId: string; targetId: string }>()
      for (const [key, value] of Object.entries(raw)) {
        const record = value as Record<string, unknown> | null
        const originId = record?.origin_id
        const targetId = record?.target_id
        if (typeof originId === 'string' && typeof targetId === 'string') {
          out.set(key, { originId, targetId })
        } else if (
          typeof originId === 'number' &&
          typeof targetId === 'number'
        ) {
          out.set(key, {
            originId: String(originId),
            targetId: String(targetId)
          })
        }
      }
      return out
    } catch {
      return new Map()
    }
  }
  // mm3-20 Option-B PoC: a presentation-only replay queue. The doc and the
  // ECS graph are ALWAYS fully applied by `adapter.applyFrame` above; the
  // queue only paces which node/link ids are considered "revealed" so a
  // client can render a veil over the rest. Gated off by default; resolved
  // once per composable instance so a mid-session toggle never splits a
  // batch. Reduced-motion users get every batch fast-forwarded.
  const replayEnabled = resolveReplayEnabled({
    buildFlag: (import.meta.env as Record<string, string | undefined>)
      .VITE_AGENT_GRAPH_REPLAY,
    search: typeof window === 'undefined' ? '' : window.location.search,
    storage: safeLocalStorage()
  })
  const reducedMotion = usePreferredReducedMotion()
  const replayState = ref<GraphReplayState>('idle')
  // mm3-21: pending node ids, mirrored into a ref so a canvas veil can render
  // reactively. Read fresh from the queue after every mutation rather than
  // computed from the step/state payloads, since a step only reports what
  // changed, not the remaining pending set.
  const pendingReplayNodeIds = ref<ReadonlySet<string>>(new Set())
  const replayQueue = new GraphReplayQueue({
    nodeExists: (id) => currentDocNodeIds().has(id),
    onStep: (step) => {
      recordDevEvent('replay_step', step)
      pendingReplayNodeIds.value = replayQueue.pendingNodeIds
    },
    onStateChange: (state) => {
      replayState.value = state
      recordDevEvent('replay_state', { state })
      pendingReplayNodeIds.value = replayQueue.pendingNodeIds
    }
  })
  const settleReplay = () => {
    if (replayEnabled) replayQueue.fastForward()
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

  // The recency heartbeat: armed only while a subscribe is CONFIRMED (bound +
  // healthy by definition), slid forward by every doc-scoped frame, cancelled
  // by the same lifecycle exits as the subscribe retry. The probe is
  // `resubscribe()` (not `reconcile()`, which no-ops while intent equals
  // reality - and a stale channel's intent DOES equal reality).
  let staleProbeTimer: ReturnType<typeof setTimeout> | null = null

  const clearStaleProbe = (): void => {
    if (staleProbeTimer !== null) {
      clearTimeout(staleProbeTimer)
      staleProbeTimer = null
    }
  }

  const armStaleProbe = (): void => {
    clearStaleProbe()
    staleProbeTimer = setTimeout(() => {
      staleProbeTimer = null
      recordDevEvent('stale_probe', {
        workflowId: subscribedWorkflowId.value
      })
      bridge.resubscribe()
      armStaleProbe()
    }, STALE_AFTER_MS)
  }

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
    if (!isTargetActive.value) return
    const ok = event.detail?.ok === true
    connected.value = ok
    lastFrameType.value = event.type
    recordDevEvent('doc_subscribed', event.detail ?? null)
    if (ok) {
      clearSubscribeRetry()
      armStaleProbe()
      // FE-1902 (poc-3): only a CONFIRMED binding is worth rebinding to after
      // a remount — persist on ok, not on intent.
      if (subscribedWorkflowId.value !== null)
        persistDocId(subscribedWorkflowId.value)
    } else {
      clearStaleProbe()
      scheduleSubscribeRetry()
    }
  }
  const onUpdate: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const update = event.detail as DocUpdate
    if (
      !isTargetActive.value ||
      update.workflowId !== subscribedWorkflowId.value
    )
      return
    if (staleProbeTimer !== null) armStaleProbe()
    updatesApplied.value = bridge.follower.updatesApplied
    lastFrameType.value = event.type
    adapter.applyFrame(update)
    recordDevEvent('doc_update', {
      workflowId: update.workflowId,
      seq: update.seq,
      actor: update.actor,
      bytes: update.update instanceof Uint8Array ? update.update.length : null
    })
    const ids = currentDocNodeIds()
    const added = [...ids].filter((id) => !knownDocNodeIds.has(id))
    const removed = [...knownDocNodeIds].filter((id) => !ids.has(id))
    if (added.length > 0 || removed.length > 0)
      recordDevEvent('doc_nodes_changed', { added, removed })
    knownDocNodeIds = ids
    const linkRecords = currentDocLinkRecords()
    const linkIds = new Set(linkRecords.keys())
    const addedLinkIds = [...linkIds].filter((id) => !knownDocLinkIds.has(id))
    knownDocLinkIds = linkIds
    if (replayEnabled && (added.length > 0 || addedLinkIds.length > 0)) {
      const addedLinks = addedLinkIds.flatMap((id) => {
        const record = linkRecords.get(id)
        if (!record) return []
        return [{ id, originId: record.originId, targetId: record.targetId }]
      })
      replayQueue.enqueueBatch({ nodeIds: added, links: addedLinks })
      if (reducedMotion.value === 'reduce') replayQueue.fastForward()
    }
  }
  const onOpsResult: EventListener = (event) => {
    if (staleProbeTimer !== null) armStaleProbe()
    lastFrameType.value = event.type
    if (event instanceof CustomEvent) {
      recordDevEvent('doc_ops_result', event.detail ?? null)
    }
  }
  const onDocReset: EventListener = (event) => {
    const detail =
      event instanceof CustomEvent
        ? (event.detail as {
            workflowId?: string
            actor?: string
            seq?: number
          })
        : undefined
    if (
      !isTargetActive.value ||
      detail?.workflowId !== subscribedWorkflowId.value
    )
      return
    const context: RemoteMutationContext = {
      source: 'agent-remote',
      actor: detail?.actor ?? 'agent-reset',
      opId: `doc-reset:${detail?.seq ?? 'unknown'}`
    }
    if (detail?.workflowId !== undefined)
      adapter.clearForReset(detail.workflowId, context)
    connected.value = false
    updatesApplied.value = 0
    lastFrameType.value = event.type
    clearStaleProbe()
    knownDocNodeIds = new Set()
    knownDocLinkIds = new Set()
    settleReplay()
    recordDevEvent(
      'doc_reset',
      event instanceof CustomEvent ? (event.detail ?? null) : null
    )
  }
  const onFollowerReplaced: EventListener = (event) => {
    // Gate on this composable's own INTENT, not the bridge's send REALITY
    // (`bridge.subscribedWorkflowId`): a doc replacement while the socket is
    // down leaves reality null, but the adapter must still be rebound to the
    // new doc — otherwise it keeps observing the destroyed one and goes deaf
    // when the socket recovers and updates land in the replacement.
    if (!(event instanceof CustomEvent)) return
    const detail = event.detail as { workflowId?: unknown } | null
    const workflowId = detail?.workflowId
    if (
      isTargetActive.value &&
      typeof workflowId === 'string' &&
      workflowId === subscribedWorkflowId.value
    ) {
      updatesApplied.value = 0
      adapter.clearForReset(workflowId, {
        source: 'agent-remote',
        actor: 'agent-lineage',
        opId: `follower-replaced:${workflowId}`
      })
      adapter.bind(workflowId, bridge.follower)
      knownDocNodeIds = new Set()
      knownDocLinkIds = new Set()
      // mm3-23: the replacement doc's lineage broke from the one the queue was
      // pacing reveals against - force everything pending out now rather than
      // let it sit veiled behind a doc that no longer exists.
      settleReplay()
    }
  }
  const onSchemaError: EventListener = (event) => {
    // KA-11 fail-closed: the bridge refused to propagate an unreadable doc, so
    // nothing was projected. Surface it as its own status rather than as a
    // generic "disconnected", which is indistinguishable from "never connected".
    connected.value = false
    lastFrameType.value = event.type
    clearStaleProbe()
    const detail =
      event instanceof CustomEvent
        ? (event.detail as { workflowId?: string } | null)
        : null
    if (detail?.workflowId !== undefined)
      adapter.discardPending(detail.workflowId)
    recordDevEvent(
      'schema_error',
      event instanceof CustomEvent ? (event.detail ?? null) : null
    )
  }
  const onReconnected: EventListener = () => {
    connected.value = false
    clearStaleProbe()
    recordDevEvent('reconnected', null)
    // mm3-23: a mid-replay socket drop must never leave the view stuck
    // showing a stale partial reveal while the follower is disconnected -
    // reveal everything pending now; the resubscribe below will re-derive
    // fresh adds/removes against the settled state once reconnected.
    settleReplay()
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
  bridge.addEventListener('follower_replaced', onFollowerReplaced)
  bridge.addEventListener('schema_error', onSchemaError)
  api.addEventListener('reconnected', onReconnected)
  api.addEventListener('status', onSocketActivity)

  // FE-1902 (poc-3): distinguish the mount-time null (in-memory doc id died
  // with the previous mount — rebind from sessionStorage) from a later null
  // (a REAL detach, e.g. new chat — drop the persisted id too).
  let initialBind = true
  let boundWorkflowId: string | null = null
  watch(
    [workflowId, isTargetActive],
    ([next, active]) => {
      clearSubscribeRetry()
      clearStaleProbe()
      connected.value = false
      knownDocNodeIds = new Set()
      knownDocLinkIds = new Set()
      settleReplay()
      if (!active) {
        if (next !== null) initialBind = false
        if (boundWorkflowId !== null) {
          adapter.unbind(boundWorkflowId)
          boundWorkflowId = null
        }
        subscribedWorkflowId.value = null
        bridge.unsubscribe()
        return
      }
      if (next === null) {
        const persisted = initialBind ? readPersistedDocId() : null
        initialBind = false
        if (persisted !== null) {
          recordDevEvent('rebind', { workflowId: persisted })
          if (boundWorkflowId !== persisted) {
            if (boundWorkflowId !== null) adapter.unbind(boundWorkflowId)
            adapter.bind(persisted, bridge.follower)
            boundWorkflowId = persisted
          }
          subscribedWorkflowId.value = persisted
          bridge.subscribe(persisted)
          return
        }
        clearPersistedDocId()
        if (boundWorkflowId !== null) {
          adapter.unbind(boundWorkflowId)
          boundWorkflowId = null
        }
        subscribedWorkflowId.value = null
        bridge.unsubscribe()
        return
      }
      initialBind = false
      if (boundWorkflowId !== next) {
        if (boundWorkflowId !== null) adapter.unbind(boundWorkflowId)
        adapter.bind(next, bridge.follower)
        boundWorkflowId = next
      }
      subscribedWorkflowId.value = next
      bridge.subscribe(next)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    // Teardown must be total. Anything that survives would apply every later
    // update twice after a remount.
    try {
      clearSubscribeRetry()
      clearStaleProbe()
      replayQueue.clear()
      api.removeEventListener('reconnected', onReconnected)
      api.removeEventListener('status', onSocketActivity)
      bridge.removeEventListener('doc_subscribed', onSubscribed)
      bridge.removeEventListener('doc_update', onUpdate)
      bridge.removeEventListener('doc_ops_result', onOpsResult)
      bridge.removeEventListener('doc_reset', onDocReset)
      bridge.removeEventListener('follower_replaced', onFollowerReplaced)
      bridge.removeEventListener('schema_error', onSchemaError)
      sender.detach()
      adapter.destroy()
      bridge.destroy()
    } finally {
      client.destroy()
    }
  })

  const status = computed<AgentCrdtStatus>(() => ({
    enabled: true,
    connected: connected.value,
    workflowId: subscribedWorkflowId.value,
    updatesApplied: updatesApplied.value,
    lastFrameType: lastFrameType.value,
    replayState: replayState.value
  }))

  return {
    status: readonly(status),
    enqueueHumanOperations: (operations: GraphOperation[]) =>
      sender.enqueue(operations),
    // mm3-21: presentation-only, for a canvas veil over not-yet-revealed
    // nodes. Empty whenever the replay gate is off (queue never enqueues).
    pendingReplayNodeIds: readonly(pendingReplayNodeIds)
  }
}
