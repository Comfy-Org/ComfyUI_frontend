import { whenever } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { AGENT_CONSENT_OFFER_DECLINED_SETTING_ID } from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type {
  AgentConsentNotOfferedReason,
  AgentConsentOfferExit,
  AgentConsentOfferStage
} from '@/platform/telemetry/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useFirstRunEntry } from '@/renderer/extensions/firstRunTour/gettingStarted/firstRunEntry'
import {
  CONSENT_DIALOG_KEY,
  useAgentConsent
} from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentConsentIntroductionStore } from '@/workbench/extensions/agent/stores/agent/agentConsentIntroductionStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import {
  notifyRestoreMintersAfterGraphConfigure,
  notifyRestoreMintersBeforeGraphLoad,
  notifyRestoreMintersGraphLoadError
} from '@/workbench/extensions/agent/crdt/restoreOpMinter'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExtensionService } from '@/services/extensionService'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { selectedNodeKey } from '@/workbench/extensions/agent/composables/agent/useCanvasSelection'
import { useDialogStore } from '@/stores/dialogStore'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

const CONSENT_AUTO_SHOWN_PREFIX = 'Comfy.AgentConsent.AutoShown'
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
    onGraphLoadError() {
      notifyRestoreMintersGraphLoadError()
    },
    afterConfigureGraph() {
      notifyRestoreMintersAfterGraphConfigure()
    },
    setup() {
      const agentPanelStore = useAgentPanelStore()
      const consentStore = useAgentConsentStore()
      const introductionStore = useAgentConsentIntroductionStore()
      const { enabled } = storeToRefs(agentPanelStore)
      const workspaceStore = useTeamWorkspaceStore()
      const { resolvedUserInfo, isLoggedIn, isAuthInitialized } =
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
      let lockedStartupOpened = false
      let activationOpenedPanel = false
      whenever(
        () => dialogStore.isDialogOpen(CONSENT_DIALOG_KEY),
        () => {
          const { scope } = introductionStore
          if (scope) consentCardSeenIn.add(scope)
        }
      )

      function introductionOwed(): boolean {
        const { scope } = introductionStore
        return scope !== null && !introductionStore.hasResponded(scope)
      }
      const offerEligible = (): boolean =>
        agentPanelStore.enabled &&
        (agentPanelStore.onboarding.introduceBeforeSignIn
          ? isAuthInitialized.value
          : isLoggedIn.value) &&
        !introductionStore.isContinuingSignIn &&
        (agentPanelStore.onboarding.offerMemory !== 'answered' ||
          introductionOwed()) &&
        !consentStore.isChecking &&
        !consentStore.accepted
      const offerIneligibility = (): AgentConsentOfferExit | null =>
        !agentPanelStore.onboarding.introduceBeforeSignIn && !isLoggedIn.value
          ? 'signed_out'
          : consentStore.isChecking
            ? 'consent_unresolved'
            : consentStore.accepted
              ? 'consent_already_accepted'
              : null

      const missingScopeExit = (
        userId: string | undefined
      ): AgentConsentOfferExit =>
        workspaceStore.isSwitching
          ? 'workspace_switching'
          : !userId
            ? 'account_unresolved'
            : 'workspace_unresolved'

      function prepareConsentCard(
        candidateUserId: string | undefined,
        offeredWorkspaceId: string | null
      ): boolean {
        const held = screenHolder()
        if (held) {
          holdOffer(held, candidateUserId, offeredWorkspaceId ?? undefined)
          return false
        }
        if (agentPanelStore.onboarding.startup !== 'lockedUntilConsent')
          return true
        if (!agentPanelStore.enabled) return false
        if (!agentPanelStore.isOpen) agentPanelStore.open('automatic_consent')
        return true
      }

      function claimOneShotOffer(
        candidateUserId: string | undefined,
        offeredWorkspaceId: string | null
      ): string | null {
        const offerScope = automaticConsentOfferScope(
          {
            activationOpenedPanel,
            panelOpen: agentPanelStore.isOpen,
            userId: candidateUserId,
            workspaceId: offeredWorkspaceId,
            workspaceSwitching: workspaceStore.isSwitching
          },
          () => reportOfferExit(missingScopeExit(candidateUserId), 'offer'),
          () => {
            reportOfferExit('activation_opened_panel', 'offer')
            dropHold()
          }
        )
        if (!offerScope) return null
        const [userId, workspaceId] = offerScope
        const key = `${CONSENT_AUTO_SHOWN_PREFIX}.${userId}.${workspaceId}`
        const autoShow = prepareAutoShow(key)
        if (autoShow === 'ready') return key
        if (autoShow === 'storage_unavailable') withholdOffer(autoShow)
        else reportOfferExit('already_offered', 'offer')
        dropHold()
        return null
      }

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

        const candidateUserId = resolvedUserInfo.value?.id
        const offeredWorkspaceId = workspaceStore.activeWorkspaceId
        const { offerMemory, startup } = agentPanelStore.onboarding
        const key =
          offerMemory === 'shown'
            ? claimOneShotOffer(candidateUserId, offeredWorkspaceId)
            : null
        if (offerMemory === 'shown' && key === null) return

        const offeredIdentity = consentStore.identity
        autoShowInFlight = true
        dropHold()
        if (startup === 'activationVisits')
          agentPanelStore.suppressRestoredOpen()
        void withConsent(
          'first_load',
          () => {
            if (
              !agentPanelStore.enabled ||
              (startup === 'activationVisits' &&
                automaticActivationVisitsComplete()) ||
              agentPanelStore.isOpen
            )
              return
            agentPanelStore.open('automatic_consent')
          },
          {
            onShown: () => {
              if (key) writeAutoShown(key, true)
            },
            canShow: () =>
              prepareConsentCard(candidateUserId, offeredWorkspaceId)
          }
        ).finally(() => finishAutomaticOffer(offeredIdentity))
      }

      function prepareLockedStartup(): boolean {
        if (
          !agentPanelStore.enabled ||
          !isAuthInitialized.value ||
          consentStore.isChecking ||
          consentStore.accepted
        )
          return false
        const held = screenHolder()
        if (held) {
          holdOffer(held)
          return false
        }
        if (lockedStartupOpened) return true
        lockedStartupOpened = true
        if (!agentPanelStore.isOpen) agentPanelStore.open('activation')
        return true
      }

      function prepareStartupPanel(): boolean {
        if (agentPanelStore.onboarding.startup === 'lockedUntilConsent')
          return prepareLockedStartup()
        if (!automaticActivationVisitsComplete() || agentPanelStore.isOpen)
          return true
        reportOfferExit('activation_window_complete', 'startup')
        dropHold()
        return false
      }

      const offerWhenStartupDecided = (): void => {
        whenStartupDecided()
          .then((decided) => {
            if (
              agentPanelStore.onboarding.persistSkipAsRefusal &&
              useSettingStore().get(AGENT_CONSENT_OFFER_DECLINED_SETTING_ID)
            ) {
              reportOfferExit('consent_declined', 'startup')
              dropHold()
              return
            }
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
        if (
          agentPanelStore.onboarding.startup !== 'activationVisits' ||
          !agentPanelStore.enabled ||
          activationPending ||
          activationOffered
        )
          return
        activationPending = true
        whenStartupDecided()
          .then((decided) => {
            if (decided && agentPanelStore.enabled) {
              activationOffered = true
              if (claimAutomaticActivationVisit() && !agentPanelStore.isOpen) {
                agentPanelStore.open('activation')
                activationOpenedPanel = true
              }
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

      const loadConsentIfEligible = (): void => {
        const { introduceBeforeSignIn } = agentPanelStore.onboarding
        if (
          !agentPanelStore.enabled ||
          (introduceBeforeSignIn && !isAuthInitialized.value)
        )
          return
        if (introduceBeforeSignIn && !isLoggedIn.value) {
          offerWhenStartupDecided()
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
