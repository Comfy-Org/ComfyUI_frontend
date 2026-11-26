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
import { reportLostEdit } from './crdt/reportLostEdit'
import { retainedAgentFollowerSessionRef } from './crdt/useAgentCrdtFollower'

/**
 * Op-producer inputs only a mounted Agent panel can answer. Each is a closure
 * over a ref or a Pinia store, so it keeps answering after that panel
 * unmounts. See `docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md`
 * Stage 2.
 */
export interface AgentPanelOpMinterInputs {
  /** The product gate — `enabled`, which a panel close does not clear. */
  isEnabled(): boolean
  /** Whether the bound workflow's tab is active and an identity is resolved. */
  isTargetActive(): boolean
  /** The live root graph, or null when no workflow is open. */
  getGraph(): LGraph | null
  /** Whether `workflow` is the one whose document the session is bound to. */
  isBoundWorkflow(workflow: ComfyWorkflow): boolean
  /** The bound workflow's own serialized root graph id. */
  boundRootGraphId(): RootGraphId | null
  /** The workflow id a visible root graph is bound to, or null for none. */
  visibleWorkflowIdFor(rootGraph: LGraph): string | null
  /**
   * Observe the signed-in identity changing. The producer stops minting until a
   * panel installs fresh inputs, because {@link isTargetActive} is answered from
   * a panel-scoped identity resolver that freezes on unmount.
   */
  onIdentityChange(listener: () => void): () => void
}

interface PageOpMinter {
  readonly transport: AgentDocFrameTransport
  readonly scope: EffectScope
  minter: DocOpMinter | null
  inputs: AgentPanelOpMinterInputs
  stopObservingIdentity: (() => void) | null
  identityChangedSinceInstall: boolean
}

const minters = new WeakMap<AgentDocFrameTransport, PageOpMinter>()
const liveMinters = new Set<PageOpMinter>()

function installInputs(
  owner: PageOpMinter,
  inputs: AgentPanelOpMinterInputs
): void {
  owner.inputs = inputs
  owner.identityChangedSinceInstall = false
  owner.stopObservingIdentity?.()
  owner.stopObservingIdentity = inputs.onIdentityChange(() => {
    owner.identityChangedSinceInstall = true
  })
}

function mayMint(owner: PageOpMinter): boolean {
  return !owner.identityChangedSinceInstall && owner.inputs.isEnabled()
}

/**
 * Resolve the page's op producer for `transport`, creating it on first use, and
 * install `inputs` as the live panel's answers.
 *
 * The handle carries no `detach`: the producer's lifetime is the page, and a
 * panel close must not be able to stop it. Page teardown goes through
 * {@link destroyAgentPageOpMinters}. See
 * `docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md`
 * Stage 2.
 */
export function retainDocOpMinterForPage(
  transport: AgentDocFrameTransport,
  inputs: AgentPanelOpMinterInputs
): { deliverHeldRestores(): void } {
  const existing = minters.get(transport)
  if (existing !== undefined) {
    installInputs(existing, inputs)
    return { deliverHeldRestores: () => existing.minter?.deliverHeldRestores() }
  }
  const owner: PageOpMinter = {
    transport,
    inputs,
    minter: null,
    scope: effectScope(true),
    stopObservingIdentity: null,
    identityChangedSinceInstall: false
  }
  installInputs(owner, inputs)
  const pageHeldSession = retainedAgentFollowerSessionRef(transport)
  const session = () => pageHeldSession.value
  const attached = attachDocOpMinter({
    isEnabled: () => mayMint(owner),
    isDocBound: () =>
      owner.inputs.isTargetActive() && (session()?.subscriptionSent() ?? false),
    onUnboundLocalIntent: () => session()?.noteUnboundLocalIntent(),
    onUnboundVisibleIntent: (rootGraph: LGraph) => {
      const workflowId = owner.inputs.visibleWorkflowIdFor(rootGraph)
      if (workflowId !== null) session()?.noteUnboundLocalIntent(workflowId)
    },
    isBoundWorkflow: (workflow: ComfyWorkflow) =>
      owner.inputs.isBoundWorkflow(workflow),
    enqueue: (operations) => {
      const current = session()
      if (current === null) {
        reportLostEdit('undeliverable', operations, {
          code: 'no_page_session'
        })
        return
      }
      current.enqueueHumanOperations(operations)
    },
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
  owner.scope.run(() => {
    watch(
      [
        pageHeldSession,
        () => pageHeldSession.value?.status.value.connected ?? false
      ],
      () => attached.deliverHeldRestores()
    )
  })
  return { deliverHeldRestores: () => attached.deliverHeldRestores() }
}

function releaseWithoutPropagating(
  step: 'scope' | 'detach',
  dispose: () => void
): void {
  try {
    dispose()
  } catch (error) {
    try {
      reportError(error, {
        surface: 'agent',
        errorType: 'failure_detaching_agent_page_op_minter',
        tags: { step }
      })
    } catch {
      // A reporter that throws must not abort the teardown it reports on.
    }
  }
}

/**
 * Detach every page-owned op producer. Page teardown and tests only — never
 * reachable from a panel close.
 */
export function destroyAgentPageOpMinters(): void {
  for (const owner of liveMinters) {
    releaseWithoutPropagating('scope', () => owner.scope.stop())
    releaseWithoutPropagating('detach', () => owner.minter?.detach())
    owner.minter = null
    minters.delete(owner.transport)
  }
  liveMinters.clear()
}
