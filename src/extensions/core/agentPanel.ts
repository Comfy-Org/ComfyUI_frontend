import { whenever } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import {
  authenticatedRemoteConfigState,
  remoteConfigRevision
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type { AgentConsentNotOfferedReason } from '@/platform/telemetry/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useFirstRunEntry } from '@/renderer/extensions/firstRunTour/gettingStarted/firstRunEntry'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExtensionService } from '@/services/extensionService'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'
import {
  notifyRestoreMintersAfterGraphConfigure,
  notifyRestoreMintersBeforeGraphLoad,
  notifyRestoreMintersGraphLoadError
} from '@/workbench/extensions/agent/crdt/restoreOpMinter'

/** Upper bound on how long readiness consumers wait for a gate decision. */
export const GATE_SETTLE_TIMEOUT_MS = 5_000

const CONSENT_AUTO_SHOWN_PREFIX = 'Comfy.AgentConsent.AutoShown'

function automaticConsentOfferScope(
  {
    activationOpenedPanel,
    panelOpen,
    userId,
    workspaceId,
    workspaceSwitching
  }: {
    activationOpenedPanel: boolean
    panelOpen: boolean
    userId: string | undefined
    workspaceId: string | null
    workspaceSwitching: boolean
  },
  onMissingScope: () => void,
  onActivatedPanel: () => void
): [userId: string, workspaceId: string] | null {
  if (!userId || !workspaceId || workspaceSwitching) {
    onMissingScope()
    return null
  }
  if (activationOpenedPanel && panelOpen) {
    onActivatedPanel()
    return null
  }
  return [userId, workspaceId]
}

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
      notifyRestoreMintersBeforeGraphLoad()
      const agentPanelStore = useAgentPanelStore()
      if (!agentPanelStore.isVisible || !agentPanelStore.consentAccepted) return

      const nodeSelectionStore = useAgentNodeSelectionStore()
      nodeSelectionStore.beginWorkflowLoad()
    },
    afterLoadGraph(app) {
      const agentPanelStore = useAgentPanelStore()
      const nodeSelectionStore = useAgentNodeSelectionStore()
      if (!nodeSelectionStore.isLoadingWorkflow) return
      if (!agentPanelStore.isVisible || !agentPanelStore.consentAccepted) {
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
      notifyRestoreMintersGraphLoadError()
      const nodeSelectionStore = useAgentNodeSelectionStore()
      if (nodeSelectionStore.isLoadingWorkflow) {
        nodeSelectionStore.finishWorkflowLoad()
      }
    },
    afterConfigureGraph() {
      notifyRestoreMintersAfterGraphConfigure()
    },
    setup() {
      const agentPanelStore = useAgentPanelStore()
      const consentStore = useAgentConsentStore()
      const { enabled } = storeToRefs(agentPanelStore)
      const workspaceStore = useTeamWorkspaceStore()
      const { resolvedUserInfo, isAuthInitialized, isLoggedIn } =
        useCurrentUser()
      const { withConsent } = useAgentConsent()
      const { firstRunHoldsScreen, whenStartupDecided } = useFirstRunEntry()
      const onboardingTourStore = useOnboardingTourStore()
      registerWorkflowTabActivityTracker(enabled)

      watch(
        () => consentStore.accepted,
        (value) => {
          agentPanelStore.consentAccepted = value
        },
        { immediate: true, flush: 'sync' }
      )

      const screenHolder = (): AgentConsentNotOfferedReason | null =>
        firstRunHoldsScreen.value
          ? 'first_run_screen'
          : onboardingTourStore.activeTour !== null
            ? 'tour_active'
            : null
      const screenIsClear = computed(() => screenHolder() === null)

      const reportedWithheld = new Set<string>()
      const offerHeld = ref(false)
      let activationOpenedPanel = false
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

      const offerEligible = (): boolean =>
        agentPanelStore.enabled &&
        isLoggedIn.value &&
        !consentStore.isChecking &&
        !consentStore.accepted

      let autoShowInFlight = false
      const offerConsentUnprompted = (): void => {
        if (autoShowInFlight) return
        if (!offerEligible()) return
        // Must precede prepareAutoShow, which burns the one-shot key.
        const held = screenHolder()
        if (held) {
          withholdOffer(held)
          offerHeld.value = true
          return
        }

        const offerScope = automaticConsentOfferScope(
          {
            activationOpenedPanel,
            panelOpen: agentPanelStore.isOpen,
            userId: resolvedUserInfo.value?.id,
            workspaceId: workspaceStore.activeWorkspaceId,
            workspaceSwitching: workspaceStore.isSwitching
          },
          () => undefined,
          () => {
            useTelemetry()?.trackAgentConsentOfferExited({
              exit: 'activation_opened_panel',
              stage: 'offer',
              retry_armed: false
            })
            offerHeld.value = false
          }
        )
        if (!offerScope) return
        const [userId, workspaceId] = offerScope
        const key = `${CONSENT_AUTO_SHOWN_PREFIX}.${userId}.${workspaceId}`
        const autoShow = prepareAutoShow(key)
        if (autoShow === 'storage_unavailable') withholdOffer(autoShow)
        if (autoShow !== 'ready') return

        const offeredIdentity = consentStore.identity
        autoShowInFlight = true
        agentPanelStore.suppressRestoredOpen()
        void withConsent(
          () => {
            if (!agentPanelStore.enabled || agentPanelStore.isOpen) return
            agentPanelStore.open('automatic_consent')
          },
          {
            onShown: () => {
              writeAutoShown(key, true)
            },
            canShow: () => {
              const heldAtMount = screenHolder()
              if (heldAtMount) {
                withholdOffer(heldAtMount, userId, workspaceId)
                offerHeld.value = true
              }
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

      let activationPending = false
      let activationOffered = false
      const openWhenStartupDecided = (): void => {
        if (!agentPanelStore.enabled || activationPending || activationOffered)
          return
        activationPending = true
        whenStartupDecided()
          .then((decided) => {
            if (decided && agentPanelStore.enabled) {
              activationOffered = true
              if (!agentPanelStore.isOpen) {
                agentPanelStore.open('activation')
                activationOpenedPanel = true
              }
            }
          })
          .catch((error: unknown) => {
            reportError(error, {
              errorType: 'agent_panel_activation_failure'
            })
          })
          .finally(() => {
            activationPending = false
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
      watch(
        () => onboardingTourStore.activeTour,
        (tour) => {
          if (tour === null) loadConsentIfEligible()
        }
      )
      setupFlagGate(
        loadConsentIfEligible,
        openWhenStartupDecided,
        () => isAuthInitialized.value && resolvedUserInfo.value === null
      )
    }
  })
}

function setupFlagGate(
  loadConsentIfEligible: () => void,
  openWhenStartupDecided: () => void,
  isSignedOut: () => boolean
): void {
  const agentPanelStore = useAgentPanelStore()
  const { flags } = useFeatureFlags()

  watch(
    () =>
      [
        import.meta.env.MODE === 'development' ||
          flags.agentInAppExperienceEnabled,
        remoteConfigRevision.value
      ] as const,
    ([enabled]) => {
      agentPanelStore.enabled = enabled
      loadConsentIfEligible()
      openWhenStartupDecided()
      if (!enabled) {
        const nodeSelectionStore = useAgentNodeSelectionStore()
        if (nodeSelectionStore.isLoadingWorkflow)
          nodeSelectionStore.finishWorkflowLoad()
      }
    },
    { immediate: true }
  )

  const settle = (): void => {
    agentPanelStore.gateSettled = true
  }
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  const clearSettleTimer = (): void => {
    clearTimeout(settleTimer)
    settleTimer = undefined
  }
  const scheduleSignedOutFallback = (): void => {
    clearSettleTimer()
    settleTimer = setTimeout(() => {
      if (isSignedOut()) settle()
    }, GATE_SETTLE_TIMEOUT_MS)
  }
  watch(
    () =>
      [
        import.meta.env.MODE === 'development' ||
          authenticatedRemoteConfigState.value === 'authenticated' ||
          authenticatedRemoteConfigState.value === 'error',
        isSignedOut()
      ] as const,
    ([decided, signedOut]) => {
      agentPanelStore.gateSettled = decided
      clearSettleTimer()
      if (!decided && signedOut) scheduleSignedOutFallback()
    },
    { immediate: true }
  )
}
