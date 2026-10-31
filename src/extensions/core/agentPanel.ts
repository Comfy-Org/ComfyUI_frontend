import { whenever } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type {
  AgentConsentNotOfferedReason,
  AgentConsentOfferExit,
  AgentConsentOfferStage
} from '@comfyorg/telemetry/types'
import { useFirstRunEntry } from '@/renderer/extensions/firstRunTour/gettingStarted/firstRunEntry'
import {
  CONSENT_DIALOG_KEY,
  useAgentConsent
} from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentConsentIntroductionStore } from '@/workbench/extensions/agent/stores/agent/agentConsentIntroductionStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExtensionService } from '@/platform/extensions/services/extensionService'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  clearPendingSignInAccept,
  hasPendingSignInAccept,
  takePendingSignInAccept
} from '@/workbench/extensions/agent/services/agent/pendingSignInAccept'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { selectedNodeKey } from '@/workbench/extensions/agent/composables/agent/useCanvasSelection'
import { useDialogStore } from '@/stores/dialogStore'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

const ACTIVATION_VISITS_STORAGE_KEY = 'Comfy.AgentPanel.activationVisits'
const AUTOMATIC_ACTIVATION_VISITS = 2

function claimAutomaticActivationVisit(): boolean {
  try {
    const storedVisits = Number(
      localStorage.getItem(ACTIVATION_VISITS_STORAGE_KEY) ?? 0
    )
    const priorVisits =
      Number.isSafeInteger(storedVisits) && storedVisits >= 0 ? storedVisits : 0
    if (priorVisits >= AUTOMATIC_ACTIVATION_VISITS) return false

    localStorage.setItem(ACTIVATION_VISITS_STORAGE_KEY, String(priorVisits + 1))
    return true
  } catch {
    return false
  }
}

function automaticActivationVisitsComplete(): boolean {
  try {
    const storedVisits = Number(
      localStorage.getItem(ACTIVATION_VISITS_STORAGE_KEY) ?? 0
    )
    return Number.isSafeInteger(storedVisits)
      ? storedVisits >= AUTOMATIC_ACTIVATION_VISITS
      : false
  } catch {
    // Storage failures must not turn into an unbounded automatic opener.
    return true
  }
}

let registered = false

export function registerAgentPanelExtension(): void {
  if (registered) return

  useExtensionService().registerExtension({
    name: 'Comfy.AgentPanel',
    beforeLoadGraph() {
      useCanvasStore().stopNodePicking()
    },
    afterLoadGraph(app) {
      const composer = useAgentComposerStore()
      if (composer.nodeScope !== useWorkflowStore().activeWorkflow?.instanceId)
        return
      composer.setNodes(
        composer.nodes.flatMap((reference) => {
          const node = getNodeByLocatorId(
            app.rootGraph,
            selectedNodeKey(reference)
          )
          return node ? [{ ...reference, title: node.title }] : []
        })
      )
    },
    setup() {
      const agentPanelStore = useAgentPanelStore()
      const consentStore = useAgentConsentStore()
      const introductionStore = useAgentConsentIntroductionStore()
      const { enabled } = storeToRefs(agentPanelStore)
      const workspaceStore = useTeamWorkspaceStore()
      const { resolvedUserInfo, isLoggedIn, isAuthInitialized } =
        useCurrentUser()
      const { withConsent, resumeAcceptAfterReload } = useAgentConsent()
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
      const withholdOffer = (reason: AgentConsentNotOfferedReason): void => {
        if (!introductionOwed()) return
        const key = `${introductionStore.scope}:${reason}`
        if (reportedWithheld.has(key)) return
        reportedWithheld.add(key)
        useTelemetry()?.trackAgentConsentNotOffered({ reason })
      }

      const offerHeld = ref(false)
      const holdOffer = (reason: AgentConsentNotOfferedReason): void => {
        withholdOffer(reason)
        offerHeld.value = true
      }

      const dropHold = (): void => {
        offerHeld.value = false
      }

      const reportedExits = new Set<string>()
      const reportOfferExit = (
        exit: AgentConsentOfferExit,
        stage: AgentConsentOfferStage
      ): void => {
        const retryArmed = offerHeld.value
        const key = `${stage}:${exit}:${retryArmed}`
        if (reportedExits.has(key)) return
        reportedExits.add(key)
        useTelemetry()?.trackAgentConsentOfferExited({
          exit,
          stage,
          retry_armed: retryArmed
        })
      }

      const consentCardSeenIn = new Set<string>()
      const launchInActivationWindow = !automaticActivationVisitsComplete()
      whenever(
        () => dialogStore.isDialogOpen(CONSENT_DIALOG_KEY),
        () => {
          const { scope } = introductionStore
          if (scope) consentCardSeenIn.add(scope)
        }
      )

      let signedInThisPage = false
      watch(
        isLoggedIn,
        (loggedIn) => {
          if (loggedIn) signedInThisPage = true
        },
        { immediate: true, flush: 'sync' }
      )

      const sessionEnded = (): boolean => signedInThisPage && !isLoggedIn.value

      function introductionOwed(): boolean {
        const { scope } = introductionStore
        return scope !== null && !introductionStore.hasResponded(scope)
      }
      const offerEligible = (): boolean =>
        agentPanelStore.enabled &&
        isAuthInitialized.value &&
        !sessionEnded() &&
        !introductionStore.isContinuingSignIn &&
        introductionOwed() &&
        !consentStore.isChecking &&
        !consentStore.accepted
      const offerIneligibility = (): AgentConsentOfferExit | null =>
        consentStore.isChecking
          ? 'consent_unresolved'
          : consentStore.accepted
            ? 'consent_already_accepted'
            : null

      let autoShowInFlight = false

      function finishAutomaticOffer(offeredIdentity: string | null): void {
        autoShowInFlight = false
        if (consentStore.identity !== offeredIdentity) loadConsentIfEligible()
        else if (offerHeld.value && screenIsClear.value) loadConsentIfEligible()
      }

      const offerConsentUnprompted = (): void => {
        if (autoShowInFlight) {
          reportOfferExit('offer_in_flight', 'offer')
          return
        }
        if (!offerEligible()) {
          const ineligible = offerIneligibility()
          if (ineligible) reportOfferExit(ineligible, 'offer')
          if (consentStore.accepted) dropHold()
          return
        }
        const { scope } = introductionStore
        if (scope && consentCardSeenIn.has(scope)) {
          reportOfferExit('card_already_seen', 'offer')
          dropHold()
          return
        }
        const held = screenHolder()
        if (held) {
          holdOffer(held)
          return
        }

        const offeredIdentity = consentStore.identity
        autoShowInFlight = true
        dropHold()
        agentPanelStore.suppressRestoredOpen()
        let shownOverClosedPanel = false
        void withConsent(
          'first_load',
          () => {
            if (!agentPanelStore.enabled || agentPanelStore.isOpen) return
            if (automaticActivationVisitsComplete() && !shownOverClosedPanel)
              return
            agentPanelStore.open('automatic_consent')
          },
          {
            canShow: () => {
              const held = screenHolder()
              if (held) holdOffer(held)
              const showing =
                held === null && agentPanelStore.enabled && !sessionEnded()
              if (showing) shownOverClosedPanel = !agentPanelStore.isOpen
              return showing
            }
          }
        ).finally(() => finishAutomaticOffer(offeredIdentity))
      }

      function prepareStartupPanel(): boolean {
        if (!introductionOwed()) {
          dropHold()
          return false
        }
        if (!launchInActivationWindow) {
          reportOfferExit('activation_window_complete', 'startup')
          dropHold()
          return false
        }
        if (introductionStore.canRecordResponse()) return true
        withholdOffer('storage_unavailable')
        dropHold()
        return false
      }

      const offerWhenStartupDecided = (): void => {
        whenStartupDecided()
          .then((decided) => {
            if (!decided) {
              if (offerEligible()) withholdOffer('boot_undecided')
              else {
                const ineligible = offerIneligibility()
                if (ineligible) reportOfferExit(ineligible, 'startup')
              }
              return
            }
            if (!prepareStartupPanel()) return
            offerConsentUnprompted()
          })
          .catch((error: unknown) => {
            reportOfferExit('startup_probe_failed', 'startup')
            reportError(error, {
              surface: 'agent',
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
              if (claimAutomaticActivationVisit() && !agentPanelStore.isOpen)
                agentPanelStore.open('activation')
            }
          })
          .catch((error: unknown) => {
            reportError(error, {
              surface: 'agent',
              errorType: 'agent_panel_activation_failure'
            })
          })
          .finally(() => {
            activationPending = false
          })
      }

      let resumingAccept = false
      let pendingAcceptChecked = false
      let pendingAcceptAccount: string | undefined
      function resumePendingAccept(): boolean {
        if (pendingAcceptChecked) return false
        if (!isLoggedIn.value) {
          pendingAcceptChecked = true
          clearPendingSignInAccept()
          return false
        }
        const accountId = resolvedUserInfo.value?.id
        pendingAcceptAccount ??= accountId
        if (!accountId || workspaceStore.isSwitching)
          return hasPendingSignInAccept()
        pendingAcceptChecked = true
        const draft = takePendingSignInAccept()
        if (draft === null || accountId !== pendingAcceptAccount) return false
        resumingAccept = true
        void resumeAcceptAfterReload(draft).finally(() => {
          resumingAccept = false
          loadConsentIfEligible()
        })
        return true
      }

      const loadConsentIfEligible = (): void => {
        if (!isAuthInitialized.value) return
        if (resumingAccept || resumePendingAccept()) return
        if (!agentPanelStore.enabled) return
        if (!isLoggedIn.value) {
          if (!sessionEnded()) offerWhenStartupDecided()
          return
        }
        if (!resolvedUserInfo.value) return
        const identity = consentStore.identity
        void consentStore
          .load()
          .then((isAccepted) => {
            if (identity !== consentStore.identity) return
            if (isAccepted) {
              reportOfferExit('consent_already_accepted', 'load')
              dropHold()
            } else offerWhenStartupDecided()
          })
          .catch((error: unknown) => {
            reportOfferExit('consent_read_failed', 'load')
            reportError(error, {
              surface: 'agent',
              errorType: 'agent_consent_setting_load_failure'
            })
          })
      }
      watch(
        [
          () => resolvedUserInfo.value?.id,
          () => consentStore.identity,
          () => isAuthInitialized.value
        ],
        loadConsentIfEligible
      )

      whenever(
        () => offerHeld.value && screenIsClear.value,
        () => {
          loadConsentIfEligible()
        }
      )
      setupFlagGate(loadConsentIfEligible, openWhenStartupDecided)
    }
  })
  registered = true
}

function setupFlagGate(
  loadConsentIfEligible: () => void,
  openWhenStartupDecided: () => void
): void {
  const agentPanelStore = useAgentPanelStore()
  const devForcedOn =
    import.meta.env.MODE === 'development' &&
    import.meta.env.VITE_AGENT_STANDALONE === 'true'

  watch(
    () =>
      [
        devForcedOn || agentPanelStore.comfyAgent?.state === 'ready',
        agentPanelStore.comfyAgent
      ] as const,
    ([enabled]) => {
      agentPanelStore.enabled = enabled
      loadConsentIfEligible()
      openWhenStartupDecided()
      if (!enabled) useCanvasStore().stopNodePicking()
    },
    { immediate: true }
  )
  watch(
    () => devForcedOn || agentPanelStore.flagsSettled,
    (settled) => {
      agentPanelStore.gateSettled = settled
    },
    { immediate: true }
  )
}
