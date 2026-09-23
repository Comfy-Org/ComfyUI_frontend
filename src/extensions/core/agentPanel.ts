import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { reportError } from '@/platform/telemetry/reportError'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useFirstRunEntry } from '@/renderer/extensions/firstRunTour/gettingStarted/firstRunEntry'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExtensionService } from '@/services/extensionService'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'
import {
  notifyMintPortsAfterGraphConfigure,
  notifyMintPortsBeforeGraphLoad
} from '@/workbench/extensions/agent/crdt/mintPortWiring'

const CONSENT_AUTO_SHOWN_PREFIX = 'Comfy.AgentConsent.AutoShown'

function writeAutoShown(key: string, shown: boolean): boolean {
  try {
    localStorage.setItem(key, String(shown))
    return true
  } catch {
    return false
  }
}

function prepareAutoShow(key: string): boolean {
  try {
    if (localStorage.getItem(key) === 'true') return false
    return writeAutoShown(key, false)
  } catch {
    return false
  }
}

let registered = false

/**
 * Owns the local-dirty-tracking suppression window(s) graph loads open in
 * `beforeLoadGraph`. Two loads can genuinely overlap - e.g. two rapid tab
 * switches, each an async `loadGraphData` call - and each one's
 * `beforeLoadGraph` opens the same underlying suppression before either
 * finishes. A single boolean flag cannot tell those apart: whichever load
 * finishes first (success or error) would close the flag while the other is
 * still mid-`configure`, and that other load's own structural writes would
 * then get misread as a human edit and wrongly marked dirty.
 *
 * A depth counter fixes that: every `beforeLoadGraph` increments it and
 * opens the store's suppression only on the 0 -> 1 transition; every
 * matching completion (`afterConfigureGraph` or `onGraphLoadError`, in
 * either order) decrements it and closes the suppression only once the
 * count is back at 0, i.e. once every overlapping load that opened it has
 * also finished. `app.ts`'s `loadGraphData` mirrors this: a single try
 * wraps its entire body from right after `beforeLoadGraph` through
 * `rootGraph.configure` succeeding (asset-scan resets, `clean()`, workflow
 * cloning, `validateWorkflow`, reroute-migration inspection, subgraph
 * loading, a `beforeConfigureGraph` extension hook throwing, or a
 * node-replacement load failure), so every one of those paths also routes
 * through `onGraphLoadError` and this counter's decrement is never skipped.
 * A leaked-open suppression would misread every later context-less user
 * edit as structural and never mark it dirty again.
 */
let widgetDirtySuppressionDepth = 0

function openWidgetDirtySuppression(): void {
  widgetDirtySuppressionDepth++
  if (widgetDirtySuppressionDepth > 1) return
  useWidgetValueStore().beginLocalDirtyTrackingSuppression()
}

function closeWidgetDirtySuppression(): void {
  if (widgetDirtySuppressionDepth === 0) return
  widgetDirtySuppressionDepth--
  if (widgetDirtySuppressionDepth > 0) return
  useWidgetValueStore().endLocalDirtyTrackingSuppression()
}

export function registerAgentPanelExtension(): void {
  if (registered) return
  registered = true

  useExtensionService().registerExtension({
    name: 'Comfy.AgentPanel',
    beforeLoadGraph() {
      notifyMintPortsBeforeGraphLoad()
      openWidgetDirtySuppression()
      const agentPanelStore = useAgentPanelStore()
      if (!agentPanelStore.isVisible) return

      const nodeSelectionStore = useAgentNodeSelectionStore()
      nodeSelectionStore.beginWorkflowLoad()
    },
    afterLoadGraph(app) {
      const agentPanelStore = useAgentPanelStore()
      const nodeSelectionStore = useAgentNodeSelectionStore()
      if (!nodeSelectionStore.isLoadingWorkflow) return
      if (!agentPanelStore.isVisible) {
        nodeSelectionStore.finishWorkflowLoad()
        return
      }

      try {
        const canvas = app.canvas
        const workflowStore = useWorkflowStore()
        const workflowPath = workflowStore.activeWorkflow?.path
        const nodes = nodeSelectionStore
          .nodeIds(workflowPath)
          .map((locatorId) => getNodeByLocatorId(app.rootGraph, locatorId))
          .filter(isLGraphNode)
        if (nodes.length === 0) {
          // Nothing was saved for this workflow (e.g. a brand-new, never-saved
          // tab). Disarm the restore guard directly instead of arming it with
          // an empty selection - otherwise it stays armed until the *next*
          // unrelated selection change (such as manually adding a node), which
          // then gets wrongly adopted as "the restored selection".
          nodeSelectionStore.finishWorkflowLoad()
          return
        }
        nodeSelectionStore.restoreNodeIds(
          nodes.map((node) => workflowStore.nodeToNodeLocatorId(node))
        )
        canvas.selectItems(nodes)
      } catch (error) {
        nodeSelectionStore.finishWorkflowLoad()
        throw error
      }
    },
    onGraphLoadError() {
      closeWidgetDirtySuppression()
      const nodeSelectionStore = useAgentNodeSelectionStore()
      if (nodeSelectionStore.isLoadingWorkflow) {
        nodeSelectionStore.finishWorkflowLoad()
      }
    },
    afterConfigureGraph() {
      notifyMintPortsAfterGraphConfigure()
      closeWidgetDirtySuppression()
    },
    setup() {
      const agentPanelStore = useAgentPanelStore()
      const consentStore = useAgentConsentStore()
      const { enabled } = storeToRefs(agentPanelStore)
      const workspaceStore = useTeamWorkspaceStore()
      const { resolvedUserInfo, isLoggedIn } = useCurrentUser()
      const { withConsent } = useAgentConsent()
      const { firstRunTookScreen, whenStartupDecided } = useFirstRunEntry()
      const onboardingTourStore = useOnboardingTourStore()
      registerWorkflowTabActivityTracker(enabled)

      watch(
        () => consentStore.accepted,
        (value) => {
          agentPanelStore.consentAccepted = value
        },
        { immediate: true, flush: 'sync' }
      )

      const onboardingHoldsScreen = (): boolean =>
        firstRunTookScreen.value || onboardingTourStore.activeTour !== null

      let autoShowInFlight = false
      const offerConsentUnprompted = (): void => {
        if (autoShowInFlight) return
        if (!agentPanelStore.enabled || !isLoggedIn.value) return
        if (consentStore.isChecking || consentStore.accepted) return
        // Must precede prepareAutoShow, which burns the one-shot key.
        if (onboardingHoldsScreen()) return

        const userId = resolvedUserInfo.value?.id
        const workspaceId = workspaceStore.activeWorkspaceId
        if (!userId || !workspaceId || workspaceStore.isSwitching) return
        const key = `${CONSENT_AUTO_SHOWN_PREFIX}.${userId}.${workspaceId}`
        if (!prepareAutoShow(key)) return

        const offeredIdentity = consentStore.identity
        autoShowInFlight = true
        agentPanelStore.suppressRestoredOpen()
        void withConsent(
          () => {
            if (!agentPanelStore.enabled) return
            agentPanelStore.open('automatic_consent')
          },
          {
            onShown: () => {
              writeAutoShown(key, true)
            },
            canShow: () => !onboardingHoldsScreen()
          }
        ).finally(() => {
          autoShowInFlight = false
          if (consentStore.identity !== offeredIdentity) loadConsentIfEligible()
        })
      }

      const offerWhenStartupDecided = (): void => {
        // A boot that never reports forfeits this session's automatic offer
        // rather than landing it on a late first-run screen.
        whenStartupDecided()
          .then((decided) => {
            if (decided) offerConsentUnprompted()
          })
          .catch((error: unknown) => {
            reportError(error, {
              errorType: 'agent_consent_auto_offer_failure'
            })
          })
      }

      const loadConsentIfEligible = (): void => {
        if (!agentPanelStore.enabled || !resolvedUserInfo.value) return
        void consentStore
          .load()
          .then((isAccepted) => {
            if (!isAccepted) offerWhenStartupDecided()
          })
          .catch((error: unknown) => {
            reportError(error, {
              errorType: 'agent_consent_setting_load_failure'
            })
          })
      }
      watch(
        [() => resolvedUserInfo.value?.id, () => consentStore.identity],
        loadConsentIfEligible,
        { immediate: true }
      )
      watch(
        () => onboardingTourStore.activeTour,
        (tour) => {
          if (tour === null) loadConsentIfEligible()
        }
      )
      return setupFlagGate(loadConsentIfEligible)
    }
  })
}

async function setupFlagGate(loadConsentIfEligible: () => void): Promise<void> {
  const agentPanelStore = useAgentPanelStore()
  const settle = (): void => {
    agentPanelStore.gateSettled = true
  }
  try {
    const [
      { createPostHogFlagSource, FLAG_SETTLE_TIMEOUT_MS },
      { default: posthog }
    ] = await Promise.all([
      import('@/workbench/extensions/agent/utils/postHogFlagSource'),
      import('posthog-js')
    ])
    const source = createPostHogFlagSource(posthog)
    const sync = (): void => {
      const forceInDev = import.meta.env.MODE === 'development'
      agentPanelStore.enabled = forceInDev || source.isEnabled()
      loadConsentIfEligible()
      if (!agentPanelStore.enabled) {
        const nodeSelectionStore = useAgentNodeSelectionStore()
        if (nodeSelectionStore.isLoadingWorkflow)
          nodeSelectionStore.finishWorkflowLoad()
      }
    }
    source.onChange?.(() => {
      sync()
      settle()
    })
    sync()
    if (import.meta.env.MODE === 'development') settle()
    else setTimeout(settle, FLAG_SETTLE_TIMEOUT_MS)
  } catch (error) {
    settle()
    reportError(error, {
      errorType: 'agent_flag_gate_load_failure',
      tags: {
        failure_kind: 'caught_unexpected',
        feature_area: 'agent',
        operation: 'load',
        outcome: 'failed',
        feature_flag: 'agent_panel',
        feature_flag_state: 'unknown',
        project_context: 'application_bootstrap'
      }
    })
  }
}
