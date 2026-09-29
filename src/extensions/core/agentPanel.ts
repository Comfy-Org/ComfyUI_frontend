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
import {
  CONSENT_DIALOG_KEY,
  useAgentConsent
} from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import {
  notifyRestoreMintersAfterGraphConfigure,
  notifyRestoreMintersBeforeGraphLoad,
  notifyRestoreMintersGraphLoadError
} from '@/workbench/extensions/agent/crdt/restoreOpMinter'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExtensionService } from '@/services/extensionService'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useDialogStore } from '@/stores/dialogStore'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'

/** Upper bound on how long readiness consumers wait for a gate decision. */
export const GATE_SETTLE_TIMEOUT_MS = 5_000

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
      const { isAuthInitialized, resolvedUserInfo, isLoggedIn } =
        useCurrentUser()
      const { withConsent } = useAgentConsent()
      const { firstRunHoldsScreen, whenStartupDecided } = useFirstRunEntry()
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
      const screenHolder = (): AgentConsentNotOfferedReason | null =>
        firstRunHoldsScreen.value ? 'first_run_screen' : screenBusyReason()
      const screenIsClear = computed(() => screenHolder() === null)

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
        offerHeld.value = true
      }
      /**
       * Drops the hold. This is a claim that the offer no longer needs to be
       * retried on this page load - it has just been made, or it has become
       * moot - and it is deliberately *not* what the release watcher does. See
       * the watcher for why those two have to be different things.
       */
      const dropHold = (): void => {
        offerHeld.value = false
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
        // An exit that leaves the hold armed does so on purpose: the condition
        // is transient, so the offer is still owed and the next clear screen
        // has to retry it. `dropHold` marks the exits that are not transient.
        if (autoShowInFlight) return
        if (!offerEligible()) {
          if (consentStore.accepted) dropHold()
          return
        }
        const scope = consentScope()
        if (scope && consentCardSeenIn.has(scope)) {
          dropHold()
          return
        }
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
        if (autoShow !== 'ready') {
          dropHold()
          return
        }

        const offeredIdentity = consentStore.identity
        autoShowInFlight = true
        // The offer is being made now, so it is no longer owed. `canShow` can
        // still re-arm the hold from under this if a surface takes the screen
        // before the card mounts.
        dropHold()
        agentPanelStore.suppressRestoredOpen()
        void withConsent(
          'first_load',
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
              if (heldAtMount) holdOffer(heldAtMount, userId, workspaceId)
              return heldAtMount === null
            }
          }
        ).finally(() => {
          autoShowInFlight = false
          if (consentStore.identity !== offeredIdentity) loadConsentIfEligible()
          // A hold armed while this attempt was in flight was refused by the
          // `autoShowInFlight` guard above, and the release watcher cannot
          // help: the screen may have gone clear again before the guard
          // dropped, and `whenever` only fires on a transition. Settling is
          // the wake-up for that case.
          else if (offerHeld.value && screenIsClear.value)
            loadConsentIfEligible()
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
              if (!agentPanelStore.isOpen) agentPanelStore.open('activation')
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
            if (isAccepted) dropHold()
            else offerWhenStartupDecided()
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
      /**
       * Releasing a hold must not consume it. What the release triggers is
       * asynchronous and exits early in several transient ways - a consent read
       * that rejects, an offer already in flight, a workspace mid-switch, an
       * account not resolved yet - and none of those exits re-arm. Dropping the
       * hold here first turned any one of them into an offer lost for the rest
       * of the page load, and lost *silently*: no card, and no second
       * `agent_consent_not_offered`, because the reason is deduplicated per
       * page load. The hold is dropped only by `dropHold`, at the points where
       * the offer has actually been made or has become moot, so a retry that
       * cannot be made is retried on the next clear screen instead.
       */
      whenever(
        () => offerHeld.value && screenIsClear.value,
        () => {
          loadConsentIfEligible()
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
  // A signed-out session never runs the authenticated /features refresh
  // (WorkspaceAuthGate returns early with no user), so the watch above never
  // reaches a decided state for it.
}
