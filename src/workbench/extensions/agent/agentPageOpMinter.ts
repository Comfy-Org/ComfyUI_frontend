/**
 * The page's owner for the human write leg's op producer.
 *
 * `docOpMinter` mints at the command site — it taps litegraph's graph-intent
 * and graph-restored buses, where the human's intent is still known — so it is
 * the only thing that turns a hand edit into an outbound operation. While it
 * was attached inside `AgentPanelRoot.setup()` its lifetime was the panel's,
 * and `v-if="docked"` in `DockedAgentPanel.vue` makes a one-click panel close
 * an unmount. So a graph edit made with the panel closed minted nothing at
 * all: no operation, no retained batch, nothing for the next acknowledged
 * resubscribe to replay. The sender already survives that close
 * (`retainAgentFollowerSessionsForPage`); its inbox did not.
 *
 * This module gives the producer the session's lifetime instead, which is
 * Stage 2 of
 * `docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md`
 * ("every operation producer joins the session") and discharges
 * `docs/adr/CRDT-REPLAY-0039-retain-exhausted-operations-for-same-page-replay.md`'s
 * open clause by the second implementation it permits. **Both** of the
 * producer's paths come with it, live edits and undo/redo restores, because
 * moving the edit path alone would leave a restore made after a panel close
 * unable to reach the replay path — the same defect in a narrower window.
 *
 * Two rules make it work, and they split the producer's inputs in exactly the
 * way the ADR's session owner already splits a session's:
 *
 * 1. **Session-facing inputs resolve the PAGE-held session on every call**, via
 *    {@link retainedAgentFollowerSession}, never a panel-held handle. The
 *    panel's own consumer lease is released on unmount, after which every
 *    accessor it destructured from `useAgentCrdtFollower` answers with its null
 *    fallback while the session is still alive behind the page claim. Reading
 *    the panel's handle would keep the producer attached and mint nothing,
 *    which is the current defect with extra machinery.
 * 2. **Panel-facing inputs are installed by the live panel and retained across
 *    its unmount.** They are closures over refs and Pinia stores, which outlive
 *    the component; `useAgentSession.stop()` deliberately does not clear
 *    `boundWorkflowId`, which is the same property that already lets the
 *    retained session keep its subscription through a close. A remount installs
 *    its own set with no handoff, because an incomplete handoff is
 *    indistinguishable from a cold start.
 *
 * This module lives beside `agentPageSession.ts` rather than under `crdt/`
 * deliberately: its panel-facing inputs read tab bindings and the active
 * workflow, and ADR CRDT-FOLLOWER-0052 Decision 2 forbids anything under
 * `crdt/` from reading panel state, tab bindings or the active tab.
 */
import type { EffectScope } from 'vue'
import { effectScope, watch } from 'vue'
import { reportError } from '@comfyorg/telemetry/reportError'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { RootGraphId } from '@comfyorg/graph-model/graphScopeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { AgentDocFrameTransport } from './crdt/agentDocFrameTransport'
import type { DocOpMinter } from './crdt/docOpMinter'
import { attachDocOpMinter } from './crdt/docOpMinter'
import { retainedAgentFollowerSessionRef } from './crdt/useAgentCrdtFollower'

/**
 * The producer inputs only a mounted panel can answer. Every one is a closure
 * over a ref or a Pinia store, so it keeps answering after the panel that
 * installed it unmounts — which is the point.
 */
export interface AgentPanelOpMinterInputs {
  /** The product gate. Survives a close: `enabled` is not `isVisible`. */
  isEnabled(): boolean
  /**
   * Whether the bound workflow's tab is the active one and an identity is
   * resolved — the panel's `isFollowerActive`, which is also what the session
   * reads as `isTargetActive`.
   */
  isTargetActive(): boolean
  /** The live root graph, or null when no workflow is open. */
  getGraph(): LGraph | null
  /** Whether `workflow` is the one whose document the session is bound to. */
  isBoundWorkflow(workflow: ComfyWorkflow): boolean
  /** The bound workflow's own serialized root graph id. */
  boundRootGraphId(): RootGraphId | null
  /** Records a local edit to the visible workflow while another, or none, is bound. */
  onUnboundVisibleIntent(rootGraph: LGraph): void
}

interface PageOpMinter {
  readonly transport: AgentDocFrameTransport
  readonly scope: EffectScope
  minter: DocOpMinter | null
  inputs: AgentPanelOpMinterInputs
}

const minters = new WeakMap<AgentDocFrameTransport, PageOpMinter>()
const liveMinters = new Set<PageOpMinter>()

/**
 * Resolve the page's op producer for this transport, creating it on first use,
 * and install `inputs` as the live panel's answers.
 *
 * The returned handle has no `detach`, by construction: a panel close must not
 * be able to stop the producer, and a handle that cannot express the teardown
 * cannot acquire a caller on a path a panel close reaches. Page teardown goes
 * through {@link destroyAgentPageOpMinters}.
 */
export function retainDocOpMinterForPage(
  transport: AgentDocFrameTransport,
  inputs: AgentPanelOpMinterInputs
): { deliverHeldRestores(): void } {
  const existing = minters.get(transport)
  if (existing !== undefined) {
    existing.inputs = inputs
    return { deliverHeldRestores: () => existing.minter?.deliverHeldRestores() }
  }
  const owner: PageOpMinter = {
    transport,
    inputs,
    minter: null,
    scope: effectScope(true)
  }
  // Read per call, never captured: the page's claim outlives the panel's, so a
  // session read once at attach time would be the wrong one after any document
  // rebind and a null one after the first unmount.
  const held = retainedAgentFollowerSessionRef(transport)
  const session = () => held.value
  const attached = attachDocOpMinter({
    isEnabled: () => owner.inputs.isEnabled(),
    isDocBound: () =>
      owner.inputs.isTargetActive() && (session()?.subscriptionSent() ?? false),
    onUnboundLocalIntent: () => session()?.noteUnboundLocalIntent(),
    onUnboundVisibleIntent: (rootGraph: LGraph) =>
      owner.inputs.onUnboundVisibleIntent(rootGraph),
    isBoundWorkflow: (workflow: ComfyWorkflow) =>
      owner.inputs.isBoundWorkflow(workflow),
    enqueue: (operations) => session()?.enqueueHumanOperations(operations),
    getGraph: () => owner.inputs.getGraph(),
    boundRootGraphId: () => owner.inputs.boundRootGraphId(),
    docInputNames: (nodeId: NodeId) => session()?.docInputNames(nodeId) ?? null,
    docWidgetValue: (nodeId: NodeId, widgetName: string) =>
      session()?.docWidgetValue(nodeId, widgetName),
    docPromotedWidgets: (nodeId: NodeId) =>
      session()?.docPromotedWidgets(nodeId) ?? null,
    mayWritePromotedHost: (nodeId: NodeId) =>
      session()?.mayWritePromotedHost(nodeId) ?? false,
    isPreMintBinding: () => session()?.isPreMintBinding() ?? false,
    docHasSubgraphDefinition: (definitionId: string) =>
      session()?.docHasSubgraphDefinition(definitionId) ?? false,
    onWidgetWriteRefused: (nodeId: NodeId, widgetName: string) =>
      session()?.notifyWidgetWriteRefused(nodeId, widgetName)
  })
  owner.minter = attached
  minters.set(transport, owner)
  liveMinters.add(owner)
  // A restore taken while the document could not receive it is held, and the
  // delivery trigger has to outlive the panel for the same reason the hold
  // does: a reconnect that completes with the panel closed must still release
  // it. Watching the page's claim and the session's own connectivity covers
  // both edges — the claim appearing after a rebind, and the document catching
  // up on a surviving claim. `deliverHeldRestores` is a no-op when nothing is
  // held and when the binding moved, so firing it widely is free.
  owner.scope.run(() => {
    watch([held, () => held.value?.status.value.connected ?? false], () =>
      attached.deliverHeldRestores()
    )
  })
  return { deliverHeldRestores: () => attached.deliverHeldRestores() }
}

/**
 * Detach every page-owned op producer. Page teardown and tests only — **never
 * call this on panel close.**
 */
export function destroyAgentPageOpMinters(): void {
  for (const owner of liveMinters) {
    // Total, for the reason `runPanelTeardown` is: a throw escaping here would
    // abandon the remaining producers and everything page teardown runs after
    // this — the follower sessions and the transport they follow over.
    try {
      owner.scope.stop()
      owner.minter?.detach()
    } catch (error) {
      reportError(error, {
        surface: 'agent',
        errorType: 'failure_detaching_agent_page_op_minter'
      })
    }
    owner.minter = null
    minters.delete(owner.transport)
  }
  liveMinters.clear()
}
