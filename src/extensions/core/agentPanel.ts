import { whenever } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
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
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExtensionService } from '@/services/extensionService'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useDialogStore } from '@/stores/dialogStore'
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
      const { gettingStartedVisible, whenStartupDecided } = useFirstRunEntry()
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
      /**
       * Reads whether the first-run screen is up *now*, not whether it was up
       * at some point this boot. The distinction is the whole reason the offer
       * used to be lost: `useFirstRunEntry` also exposes `firstRunTookScreen`,
       * a latch that is only ever cleared by a change of user, so a guard built
       * on it keeps reporting `first_run_screen` for the rest of the page's
       * life and the hold below can never release. `gettingStartedVisible` is
       * the ref that actually renders the screen, and it clears on dismissal.
       *
       * The template/share-link path, which is the other thing that used to set
       * `firstRunTookScreen`, only does so once `beginTour` has actually
       * started the first-run tour - so it is already covered, more precisely,
       * by the `tour_active` branch of `screenBusyReason`.
       */
      const screenHolder = (): AgentConsentNotOfferedReason | null =>
        gettingStartedVisible.value ? 'first_run_screen' : screenBusyReason()
      /**
       * Must be the negation of `screenHolder`, not of `screenBusyReason`:
       * release has to agree with hold about what counts as "the screen". When
       * it only knew about tours and dialogs it read as clear while Getting
       * Started was still up, so releasing a first-run hold would have gone
       * straight back into `screenHolder` and re-held on the same tick.
       */
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

      /**
       * Every hold is a deferral. `first_run_screen` used to be excluded here,
       * which made it the one reason that dropped the offer outright rather
       * than queueing it behind the surface that was in the way.
       */
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

      /**
       * Names the endings that `agent_consent_not_offered` cannot: that event
       * reports the surface a deferred offer is queued behind, so an attempt
       * that stops for a reason of its own emits nothing at all today and is
       * indistinguishable in telemetry from a user who was never offered.
       *
       * Three things this deliberately does not route through `withholdOffer`.
       * It returns without emitting when either id is missing - and a missing
       * id is one of the endings that has to be reportable. It returns without
       * emitting once the auto-show key is burned, which would silence every
       * later page load of every user who has seen the card. And its reason
       * enum means "a surface is holding the offer", which none of these are.
       *
       * Dedup is per page load and per (stage, exit), so this reports the
       * *presence* of an ending, never its frequency - `loadConsentIfEligible`
       * is re-driven by the identity watcher, the flag gate, the release
       * watcher and `withConsent`'s settlement, so an undeduplicated count
       * would measure how long the tab was open.
       *
       * There is no "the flag is off" guard here, and that is deliberate rather
       * than an omission. `loadConsentIfEligible` is the only way in, and it
       * returns on an off flag before reaching any ending below - so the guard
       * would have suppressed nothing except the one case worth seeing: a flag
       * that flips off *mid-page-load*, abandoning an offer that was already
       * under way. The unflagged population is kept out by the exit that is
       * deliberately not reported at all, not by a gate here.
       */
      const reportedExits = new Set<string>()
      const reportOfferExit = (
        exit: AgentConsentOfferExit,
        stage: AgentConsentOfferStage
      ): void => {
        const key = `${stage}:${exit}`
        if (reportedExits.has(key)) return
        reportedExits.add(key)
        useTelemetry()?.trackAgentConsentOfferExited({
          exit,
          stage,
          retry_armed: offerHeld.value
        })
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
      /**
       * Which of `offerEligible`'s conditions is unmet, in the order it checks
       * them. Only meaningful when `offerEligible()` is false, and deliberately
       * a separate expression from it: naming the cause must not be able to
       * change the decision.
       *
       * `enabled` is not covered, so this is null when the flag being off is the
       * only thing unmet: an off flag has no value on this event, for the reason
       * on `AgentConsentOfferExit`.
       */
      const offerIneligibility = (): AgentConsentOfferExit | null =>
        !isLoggedIn.value
          ? 'signed_out'
          : consentStore.isChecking
            ? 'consent_unresolved'
            : consentStore.accepted
              ? 'consent_already_accepted'
              : null

      let autoShowInFlight = false
      const offerConsentUnprompted = (): void => {
        // An exit that leaves the hold armed does so on purpose: the condition
        // is transient, so the offer is still owed and the next clear screen
        // has to retry it. `dropHold` marks the exits that are not transient.
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
        const scope = consentScope()
        if (scope && consentCardSeenIn.has(scope)) {
          reportOfferExit('card_already_seen', 'offer')
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
        if (!userId || !workspaceId || workspaceStore.isSwitching) {
          // A switch in progress is reported ahead of the ids it is moving: it
          // explains an absent workspace id, so labelling that case
          // `workspace_unresolved` would hide the more specific cause. The
          // condition above is unchanged either way - only the label differs.
          reportOfferExit(
            workspaceStore.isSwitching
              ? 'workspace_switching'
              : !userId
                ? 'account_unresolved'
                : 'workspace_unresolved',
            'offer'
          )
          return
        }
        const key = `${CONSENT_AUTO_SHOWN_PREFIX}.${userId}.${workspaceId}`
        const autoShow = prepareAutoShow(key)
        // `storage_unavailable` already has a reason on
        // `agent_consent_not_offered`, so it is not reported twice.
        if (autoShow === 'storage_unavailable') withholdOffer(autoShow)
        if (autoShow !== 'ready') {
          if (autoShow === 'already_offered')
            reportOfferExit('already_offered', 'offer')
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
            else {
              // An undecided boot that is also ineligible reported nothing at
              // all: `boot_undecided` is gated on eligibility, so the forfeited
              // offer looked identical to one that was never owed.
              const ineligible = offerIneligibility()
              if (ineligible) reportOfferExit(ineligible, 'startup')
            }
          })
          .catch((error: unknown) => {
            reportOfferExit('startup_probe_failed', 'startup')
            reportError(error, {
              errorType: 'agent_consent_auto_offer_failure'
            })
          })
      }

      const loadConsentIfEligible = (): void => {
        // Neither of these reports. An off flag is not this event's business
        // (see `reportOfferExit`), and an account that has not resolved *yet* is
        // not a lost offer: the watcher below re-drives this the moment
        // `resolvedUserInfo` changes, so the exit has a guaranteed wake-up. It
        // would otherwise fire on essentially every flagged page load, because
        // the flag gate calls this before the auth rail settles - and a value
        // that is present almost always discriminates nothing while looking
        // like the dominant cause. `account_unresolved` is reported only at the
        // `offer` stage, where the id went missing *after* a consent read had
        // already succeeded with it.
        if (!agentPanelStore.enabled || !resolvedUserInfo.value) return
        void consentStore
          .load()
          .then((isAccepted) => {
            if (isAccepted) {
              reportOfferExit('consent_already_accepted', 'load')
              dropHold()
            } else offerWhenStartupDecided()
          })
          .catch((error: unknown) => {
            reportOfferExit('consent_read_failed', 'load')
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
