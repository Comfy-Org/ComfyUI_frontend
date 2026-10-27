import { defineAsyncComponent, watch } from 'vue'
import { storeToRefs } from 'pinia'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { i18n } from '@/i18n'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useTelemetry } from '@/platform/telemetry'
import type {
  AgentConsentDecision,
  AgentConsentOfferExit,
  AgentConsentTrigger
} from '@/platform/telemetry/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useToast } from '@/components/ui/toast/toastStore'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useDialogStore } from '@/stores/dialogStore'
import { AGENT_DOCS_URL } from '@/workbench/extensions/agent/agentDocs'
import {
  clearPendingSignInAccept,
  readPendingSignInAccept,
  ownsPendingSignInAccept,
  bindPendingSignInAccept,
  writePendingSignInAccept
} from '@/workbench/extensions/agent/services/agent/pendingSignInAccept'
import type { PendingSignInAccept } from '@/workbench/extensions/agent/services/agent/pendingSignInAccept'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentConsentIntroductionStore } from '@/workbench/extensions/agent/stores/agent/agentConsentIntroductionStore'

export const CONSENT_DIALOG_KEY = 'agent-consent'
const CONSENT_MEDIA_BASE = 'https://media.comfy.org/website/comfy-agent'
const CONSENT_VIDEO_SOURCES = [
  {
    src: `${CONSENT_MEDIA_BASE}/agent-consent-v2-1280.webm`,
    type: 'video/webm'
  },
  {
    src: `${CONSENT_MEDIA_BASE}/agent-consent-v2-1280.mp4`,
    type: 'video/mp4'
  }
]
const CONSENT_POSTER_SRC = `${CONSENT_MEDIA_BASE}/agent-consent-v2-poster.jpg`

const AgentConsentCard = defineAsyncComponent(
  () =>
    import('@/workbench/extensions/agent/components/agent/AgentConsentCard.vue')
)

export interface ConsentOfferHooks {
  /** Asked right before the card mounts, after every await that precedes it. */
  canShow?: () => boolean
}

export function useAgentConsent() {
  const dialogStore = useDialogStore()
  const { showSignInDialog } = useAuthDialogs()
  const consentStore = useAgentConsentStore()
  const introductionStore = useAgentConsentIntroductionStore()
  const composerStore = useAgentComposerStore()
  const toast = useToast()
  const { isLoggedIn, resolvedUserInfo, isAuthInitialized } = useCurrentUser()
  const workspaceStore = useTeamWorkspaceStore()
  const { accepted, identity, isChecking } = storeToRefs(consentStore)
  const { t } = i18n.global

  /**
   * Names an ending of the consent request that produced neither a card on
   * screen nor a decision.
   *
   * These are the last silent endings on the automatic consent chain.
   * `agent_consent_not_offered` means a named surface is holding the offer and
   * will retry it, and `agent_consent_offer_exited`'s other stages all stop
   * before the consent scope is resolved - so an attempt that got as far as
   * asking and still ended with nothing was indistinguishable in product
   * analytics from a user who was never offered. The failing ones do reach
   * Sentry and RUM through `reportError`, which is why they were easy to
   * believe were covered; `reportError` has no PostHog sink, so none of them
   * were in the funnel denominator `agent_consent_not_offered` is read against.
   *
   * `retry_armed` is reported false rather than read, and that is a code reading
   * rather than a tested fact: `offerConsentUnprompted` calls `dropHold()`
   * immediately before `withConsent`, the only caller that can re-arm is the
   * `canShow` hook, and `canShow` runs after every exit reported here. A
   * re-entrant offer cannot re-arm either - it exits on `autoShowInFlight`
   * before reaching a hold. If that ordering changes, this becomes wrong
   * silently, so the property's doc says which ordering it depends on.
   */
  function reportRequestExit(
    exit: AgentConsentOfferExit,
    trigger: AgentConsentTrigger
  ): void {
    useTelemetry()?.trackAgentConsentOfferExited({
      exit,
      stage: 'request',
      retry_armed: false,
      trigger
    })
  }

  function showConsentDialog(
    trigger: AgentConsentTrigger,
    persistOnAccept = true,
    expectedIdentity?: string,
    { canShow }: ConsentOfferHooks = {}
  ): Promise<boolean> {
    const pendingAccept = readPendingSignInAccept()
    return new Promise<boolean>((resolve) => {
      if (canShow && !canShow()) {
        resolve(false)
        return
      }
      let settled = false
      let saving = false
      let shown = false
      let saveErrorShown = false

      const reportOutcome = (decision: AgentConsentDecision): void => {
        useTelemetry()?.trackAgentConsentResolved({
          decision,
          save_error_shown: saveErrorShown
        })
      }

      const stopScopeWatch = watch(
        [identity, isLoggedIn],
        () => dialogStore.closeDialog({ key: CONSENT_DIALOG_KEY }),
        { flush: 'sync' }
      )

      const closeWith = (result: boolean): void => {
        if (settled) return
        settled = true
        stopScopeWatch()
        dialogStore.closeDialog({ key: CONSENT_DIALOG_KEY })
        resolve(result)
      }

      function markIntroductionResponded(): void {
        if (shown) introductionStore.markResponded()
      }

      function handleSaveFailure(error: unknown): void {
        if (settled) return
        saving = false
        saveErrorShown = true
        reportError(error, {
          surface: 'agent',
          errorType: 'agent_consent_setting_write_failure'
        })
        dialogStore.updateDialog({
          key: CONSENT_DIALOG_KEY,
          contentProps: {
            accepting: false,
            error: t('agent.consent.saveError')
          },
          dialogComponentProps: {
            closable: true,
            dismissOnPointerDownOutside: true
          }
        })
      }

      function finishAcceptance(saved: boolean): void {
        if (settled) return
        if (saved && pendingAccept) clearPendingSignInAccept(pendingAccept)
        if (!persistOnAccept) reportOutcome('accepted_pending_sign_in')
        else reportOutcome(saved ? 'accepted' : 'accept_not_persisted')
        closeWith(saved)
      }

      const accept = async (): Promise<void> => {
        if (saving || settled) return
        markIntroductionResponded()
        saving = true
        dialogStore.updateDialog({
          key: CONSENT_DIALOG_KEY,
          contentProps: { accepting: true, error: '' },
          dialogComponentProps: {
            closable: false,
            dismissOnPointerDownOutside: false
          }
        })

        try {
          const saved = persistOnAccept
            ? await consentStore.accept(expectedIdentity)
            : true
          finishAcceptance(saved)
        } catch (error) {
          handleSaveFailure(error)
        }
      }

      dialogStore.showDialog({
        key: CONSENT_DIALOG_KEY,
        component: AgentConsentCard,
        props: {
          title: t('agent.consent.title'),
          paragraphs: [
            t('agent.consent.body1'),
            t(
              persistOnAccept
                ? 'agent.consent.body2'
                : 'agent.consent.body2BeforeSignIn'
            )
          ],
          videoSources: CONSENT_VIDEO_SOURCES,
          posterSrc: CONSENT_POSTER_SRC,
          docsUrl: AGENT_DOCS_URL,
          requiresSignIn: !persistOnAccept,
          accepting: false,
          error: '',
          onVnodeMounted: () => {
            shown = true
            useTelemetry()?.trackAgentConsentShown({ trigger })
          },
          onAccept: () => void accept(),
          onReject: () => {
            if (settled) return
            markIntroductionResponded()
            if (pendingAccept) clearPendingSignInAccept(pendingAccept)
            reportOutcome('rejected')
            closeWith(false)
          }
        },
        dialogComponentProps: {
          dismissOnPointerDownOutside: true,
          headless: true,
          onClose: () => {
            if (settled) return
            settled = true
            stopScopeWatch()
            if (pendingAccept) clearPendingSignInAccept(pendingAccept)
            if (shown) reportOutcome('dismissed')
            else reportRequestExit('card_closed_before_mount', trigger)
            resolve(false)
          }
        }
      })
    })
  }

  function reportLoadFailure(error: unknown): void {
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_consent_setting_load_failure'
    })
    toast.error(t('g.error'), {
      description: t('agent.consent.loadError')
    })
  }

  function reportSaveFailure(error: unknown): void {
    reportError(error, {
      surface: 'agent',
      errorType: 'agent_consent_setting_write_failure'
    })
    toast.error(t('g.error'), {
      description: t('agent.consent.saveError')
    })
  }

  function bindSamePagePendingAccept(pending: PendingSignInAccept): boolean {
    if (!ownsPendingSignInAccept(pending)) return true
    const userId = resolvedUserInfo.value?.id
    if (!userId) return false
    const bound = bindPendingSignInAccept(pending, {
      userId,
      workspaceId: workspaceStore.activeWorkspaceId ?? undefined
    })
    if (!bound.ok) clearPendingSignInAccept(pending)
    return true
  }

  async function saveAcceptanceAfterSignIn(
    expectedIdentity?: string,
    pending?: PendingSignInAccept
  ): Promise<string | null> {
    try {
      const decisionIdentity =
        expectedIdentity ?? (await consentStore.ensureScope())
      if (decisionIdentity && pending && !bindSamePagePendingAccept(pending))
        return null
      if (!decisionIdentity || !(await consentStore.accept(decisionIdentity))) {
        useTelemetry()?.trackAgentConsentResolved({
          decision: 'accept_not_persisted',
          save_error_shown: false
        })
        return null
      }
      useTelemetry()?.trackAgentConsentResolved({
        decision: 'accepted',
        save_error_shown: false
      })
      return decisionIdentity
    } catch (error) {
      reportSaveFailure(error)
      return null
    }
  }

  function heldDraftText(): string {
    const held = composerStore.submission
    return held?.phase === 'pending' ? held.snapshot.prompt.text : ''
  }

  async function acceptAfterSignIn(
    trigger: AgentConsentTrigger,
    hooks: ConsentOfferHooks
  ): Promise<string | null> {
    if (!(await showConsentDialog(trigger, false, undefined, hooks)))
      return null
    introductionStore.isContinuingSignIn = true
    const result = writePendingSignInAccept(heldDraftText())
    try {
      let signedIn: boolean
      try {
        signedIn = await showSignInDialog()
      } catch (error) {
        reportError(error, {
          surface: 'agent',
          errorType: 'agent_consent_sign_in_failure'
        })
        toast.error(t('g.error'), {
          description: t('agent.consent.signInError')
        })
        return null
      }
      if (!signedIn) return null
      return await saveAcceptanceAfterSignIn(
        undefined,
        result.ok ? result.pending : undefined
      )
    } finally {
      if (result.ok) clearPendingSignInAccept(result.pending)
      introductionStore.isContinuingSignIn = false
    }
  }

  function restorePendingDraft(draft: string): void {
    if (
      draft &&
      !composerStore.draft &&
      composerStore.prompt.references.length === 0 &&
      composerStore.attachments.length === 0 &&
      !composerStore.submission
    )
      composerStore.restorePrompt({ text: draft, references: [] }, [])
  }

  function pendingAcceptForCurrentUser(): {
    pending: PendingSignInAccept
    accountId: string
  } | null {
    const pending = readPendingSignInAccept()
    if (!pending) return null
    if (!isLoggedIn.value) {
      if (isAuthInitialized.value) clearPendingSignInAccept(pending)
      return null
    }
    const accountId = resolvedUserInfo.value?.id
    if (!accountId) return null
    if (pending.scope && pending.scope.userId !== accountId) {
      clearPendingSignInAccept(pending)
      return null
    }
    return { pending, accountId }
  }

  function preparePendingAccept() {
    const prepared = pendingAcceptForCurrentUser()
    if (!prepared) return null
    const { pending, accountId } = prepared
    if (
      !pending.scope?.workspaceId ||
      pending.scope.workspaceId === workspaceStore.activeWorkspaceId
    )
      restorePendingDraft(pending.draft)
    if (pending.scope) return { pending, accountId }
    const bound = bindPendingSignInAccept(pending, { userId: accountId })
    if (bound.ok) return { pending: bound.pending, accountId }
    clearPendingSignInAccept(pending)
    reportSaveFailure(bound.error)
    return null
  }

  function bindPendingWorkspace(
    pending: PendingSignInAccept,
    accountId: string
  ): boolean {
    if (
      pending.scope?.workspaceId &&
      pending.scope.workspaceId !== workspaceStore.activeWorkspaceId
    ) {
      clearPendingSignInAccept(pending)
      return false
    }
    const bound = bindPendingSignInAccept(pending, {
      userId: accountId,
      workspaceId: workspaceStore.activeWorkspaceId ?? undefined
    })
    if (bound.ok) return true
    clearPendingSignInAccept(pending)
    reportSaveFailure(bound.error)
    return false
  }

  async function persistPendingAccept(
    pending: PendingSignInAccept,
    accountId: string,
    decisionIdentity: string
  ): Promise<void> {
    if (!ownsPendingSignInAccept(pending)) return
    if (!bindPendingWorkspace(pending, accountId)) return
    restorePendingDraft(pending.draft)
    const alreadyAccepted = await consentStore.load()
    if (
      identity.value !== decisionIdentity ||
      !ownsPendingSignInAccept(pending)
    )
      return
    if (alreadyAccepted || (await saveAcceptanceAfterSignIn(decisionIdentity)))
      clearPendingSignInAccept(pending)
  }

  async function resumeAcceptAfterReload(): Promise<void> {
    if (introductionStore.isContinuingSignIn) return
    const prepared = preparePendingAccept()
    if (!prepared) return
    const { pending, accountId } = prepared
    if (workspaceStore.isSwitching) return
    const generation = workspaceStore.workspaceTransitionGeneration
    introductionStore.isContinuingSignIn = true
    let decisionIdentity: string | null = null
    const scopeUnchanged = () =>
      resolvedUserInfo.value?.id === accountId &&
      workspaceStore.workspaceTransitionGeneration === generation &&
      (!decisionIdentity || identity.value === decisionIdentity)
    try {
      decisionIdentity = await consentStore.ensureScope()
      if (!scopeUnchanged() || !decisionIdentity) return
      await persistPendingAccept(pending, accountId, decisionIdentity)
    } catch (error) {
      if (scopeUnchanged()) reportLoadFailure(error)
    } finally {
      if (!scopeUnchanged()) clearPendingSignInAccept(pending)
      introductionStore.isContinuingSignIn = false
    }
  }

  async function requestConsentForCurrentUser(
    trigger: AgentConsentTrigger,
    hooks: ConsentOfferHooks
  ): Promise<string | null> {
    let decisionIdentity: string | null
    // Which call is in flight, so the catch can tell a scope probe that failed
    // from a consent read that failed. The error cannot carry that: both raise
    // `AgentConsentAuthenticationError` with the same "account authentication is
    // required" message, `ensureScope` from its own missing user and `load` from
    // the auth header its read needs.
    let reading = false
    try {
      decisionIdentity = await consentStore.ensureScope()
      if (!decisionIdentity) {
        reportRequestExit('scope_changed_before_read', trigger)
        return null
      }
      reading = true
      await consentStore.load()
    } catch (error) {
      reportRequestExit(
        reading ? 'consent_read_failed' : 'scope_probe_failed',
        trigger
      )
      reportLoadFailure(error)
      return null
    }

    if (identity.value !== decisionIdentity) {
      reportRequestExit('scope_changed_after_read', trigger)
      return null
    }
    // Two endings report nothing here, and both are successes rather than
    // silences. `showConsentDialog` returning false because `canShow` said no is
    // already named by the surface that took the screen - the caller's hook
    // holds the offer and `agent_consent_not_offered` carries the reason, so
    // naming it again would double-count one deferral. And consent that is
    // already stored skips the card entirely: this runs on to `onAccept`, which
    // for the automatic offer is the only producer of
    // `agent_panel_opened(source=automatic_consent)`. Reading the absence of a
    // card as a failed offer is the error that mis-ranked gc-17.
    if (
      !accepted.value &&
      !(await showConsentDialog(trigger, true, decisionIdentity, hooks))
    )
      return null
    return decisionIdentity
  }

  async function withConsent(
    trigger: AgentConsentTrigger,
    onAccept: () => void,
    hooks: ConsentOfferHooks = {}
  ): Promise<void> {
    if (introductionStore.isContinuingSignIn) return
    const decisionIdentity = isLoggedIn.value
      ? await requestConsentForCurrentUser(trigger, hooks)
      : await acceptAfterSignIn(trigger, hooks)
    if (
      !decisionIdentity ||
      identity.value !== decisionIdentity ||
      !accepted.value
    )
      return
    onAccept()
  }

  return { accepted, isChecking, withConsent, resumeAcceptAfterReload }
}
