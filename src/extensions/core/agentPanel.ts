import { whenever } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type { AgentConsentNotOfferedReason } from '@/platform/telemetry/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useFirstRunEntry } from '@/renderer/extensions/firstRunTour/gettingStarted/firstRunEntry'
import {
  CONSENT_DIALOG_KEY,
  useAgentConsent
} from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExtensionService } from '@/services/extensionService'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useDialogStore } from '@/stores/dialogStore'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'

const CONSENT_AUTO_SHOWN_PREFIX = 'Comfy.AgentConsent.AutoShown'

function writeAutoShown(key: string, shown: boolean): boolean {
  try {
    localStorage.setItem(key, String(shown))
    return true
  } catch {
    return false
  }
}

function wasAutoShown(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

function prepareAutoShow(
  key: string
): 'ready' | 'already_offered' | 'storage_unavailable' {
  try {
    if (localStorage.getItem(key) === 'true') return 'already_offered'
    return writeAutoShown(key, false) ? 'ready' : 'storage_unavailable'
  } catch {
    return 'storage_unavailable'
  }
}

let registered = false

export function registerAgentPanelExtension(): void {
  if (registered) return
  registered = true

  useExtensionService().registerExtension({
    name: 'Comfy.AgentPanel',
    beforeLoadGraph() {
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
      const nodeSelectionStore = useAgentNodeSelectionStore()
      if (nodeSelectionStore.isLoadingWorkflow) {
        nodeSelectionStore.finishWorkflowLoad()
      }
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
      const dialogStore = useDialogStore()
      registerWorkflowTabActivityTracker(enabled)

      watch(
        () => consentStore.accepted,
        (value) => {
          agentPanelStore.consentAccepted = value
        },
        { immediate: true, flush: 'sync' }
      )

      const screenBusyReason = (): 'tour_active' | 'dialog_open' | null =>
        onboardingTourStore.activeTour !== null
          ? 'tour_active'
          : dialogStore.dialogStack.length > 0
            ? 'dialog_open'
            : null
      const screenIsClear = computed(() => screenBusyReason() === null)
      const screenHolder = (): AgentConsentNotOfferedReason | null =>
        firstRunTookScreen.value ? 'first_run_screen' : screenBusyReason()

      const reportedWithheld = new Set<string>()
      const withholdOffer = (
        reason: AgentConsentNotOfferedReason,
        userId = resolvedUserInfo.value?.id,
        workspaceId = workspaceStore.activeWorkspaceId
      ): void => {
        if (!userId || !workspaceId) return
        if (
          wasAutoShown(`${CONSENT_AUTO_SHOWN_PREFIX}.${userId}.${workspaceId}`)
        )
          return
        const key = `${userId}.${workspaceId}:${reason}`
        if (reportedWithheld.has(key)) return
        reportedWithheld.add(key)
        useTelemetry()?.trackAgentConsentNotOffered({ reason })
      }

      const offerHeld = ref(false)
      const holdOffer = (
        reason: AgentConsentNotOfferedReason,
        userId?: string,
        workspaceId?: string
      ): void => {
        withholdOffer(reason, userId, workspaceId)
        if (reason !== 'first_run_screen') offerHeld.value = true
      }

      const consentScope = (): string | null => {
        const userId = resolvedUserInfo.value?.id
        const workspaceId = workspaceStore.activeWorkspaceId
        return userId && workspaceId ? `${userId}.${workspaceId}` : null
      }
      const consentCardSeenIn = new Set<string>()
      whenever(
        () => dialogStore.isDialogOpen(CONSENT_DIALOG_KEY),
        () => {
          const scope = consentScope()
          if (scope) consentCardSeenIn.add(scope)
        }
      )

      const offerEligible = (): boolean =>
        agentPanelStore.enabled &&
        isLoggedIn.value &&
        !consentStore.isChecking &&
        !consentStore.accepted

      let autoShowInFlight = false
      const offerConsentUnprompted = (): void => {
        if (autoShowInFlight) return
        if (!offerEligible()) return
        const scope = consentScope()
        if (scope && consentCardSeenIn.has(scope)) return
        // Must precede prepareAutoShow, which burns the one-shot key.
        const held = screenHolder()
        if (held) {
          holdOffer(held)
          return
        }

        const userId = resolvedUserInfo.value?.id
        const workspaceId = workspaceStore.activeWorkspaceId
        if (!userId || !workspaceId || workspaceStore.isSwitching) return
        const key = `${CONSENT_AUTO_SHOWN_PREFIX}.${userId}.${workspaceId}`
        const autoShow = prepareAutoShow(key)
        if (autoShow === 'storage_unavailable') withholdOffer(autoShow)
        if (autoShow !== 'ready') return

        const offeredIdentity = consentStore.identity
        autoShowInFlight = true
        agentPanelStore.suppressRestoredOpen()
        void withConsent(
          'first_load',
          () => {
            if (!agentPanelStore.enabled) return
            agentPanelStore.open('automatic_consent')
          },
          {
            onShown: () => {
              writeAutoShown(key, true)
            },
            canShow: () => {
              const heldAtMount = screenHolder()
              if (heldAtMount) holdOffer(heldAtMount, userId, workspaceId)
              return heldAtMount === null
            }
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
            else if (offerEligible()) withholdOffer('boot_undecided')
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
      whenever(
        () => offerHeld.value && screenIsClear.value,
        () => {
          offerHeld.value = false
          loadConsentIfEligible()
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
