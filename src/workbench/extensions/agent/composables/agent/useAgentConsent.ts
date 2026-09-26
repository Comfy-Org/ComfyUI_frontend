import { defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { i18n } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import type {
  AgentConsentDecision,
  AgentConsentOfferExit,
  AgentConsentTrigger
} from '@/platform/telemetry/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'

export const CONSENT_DIALOG_KEY = 'agent-consent'
const DOCS_URL = 'https://docs.comfy.org/agent-tools/in-app-agent'
const CONSENT_MEDIA_BASE = 'https://media.comfy.org/website/comfy-agent'
const CONSENT_VIDEO_SRC = `${CONSENT_MEDIA_BASE}/agent-consent-v2-1280.webm`
const CONSENT_VIDEO_SRC_MP4 = `${CONSENT_MEDIA_BASE}/agent-consent-v2-1280.mp4`
const CONSENT_POSTER_SRC = `${CONSENT_MEDIA_BASE}/agent-consent-v2-poster.jpg`

const AgentConsentCard = defineAsyncComponent(
  () =>
    import('@/workbench/extensions/agent/components/agent/AgentConsentCard.vue')
)

export interface ConsentOfferHooks {
  onShown?: () => void
  /** Asked right before the card mounts, after every await that precedes it. */
  canShow?: () => boolean
}

export function useAgentConsent() {
  const dialogStore = useDialogStore()
  const dialogService = useDialogService()
  const consentStore = useAgentConsentStore()
  const toastStore = useToastStore()
  const { isLoggedIn } = useCurrentUser()
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
    { onShown, canShow }: ConsentOfferHooks = {}
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (canShow && !canShow()) {
        resolve(false)
        return
      }
      let settled = false
      let saving = false
      let shown = false
      let saveErrorShown = false

      /**
       * One outcome per card that was on screen, so this event and
       * `agent_consent_shown` stay 1:1 and a shown card with no outcome is a
       * defect rather than a dismissal. `accepted` and `rejected` keep exactly
       * the meaning they already had.
       */
      const reportOutcome = (decision: AgentConsentDecision): void => {
        useTelemetry()?.trackAgentConsentResolved({
          decision,
          save_error_shown: saveErrorShown
        })
      }

      const closeWith = (result: boolean): void => {
        if (settled) return
        settled = true
        dialogStore.closeDialog({ key: CONSENT_DIALOG_KEY })
        resolve(result)
      }

      function handleSaveFailure(error: unknown): void {
        if (settled) return
        saving = false
        // Not an outcome: the card stays open, retryable, with the error on it.
        // The ending it eventually reaches carries this flag instead, which is
        // what separates giving up after a failed save from walking away.
        saveErrorShown = true
        reportError(error, {
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
            dismissableMask: true
          }
        })
      }

      const accept = async (): Promise<void> => {
        if (saving || settled) return
        saving = true
        dialogStore.updateDialog({
          key: CONSENT_DIALOG_KEY,
          contentProps: { accepting: true, error: '' },
          dialogComponentProps: {
            closable: false,
            dismissableMask: false
          }
        })

        try {
          const saved = persistOnAccept
            ? await consentStore.accept(expectedIdentity)
            : true
          // Only a persisted acceptance is `accepted`. Without
          // `persistOnAccept` this card is the first half of the signed-out
          // flow, which still has a sign-in and a real save to clear before
          // consent exists, so that path still reports its own `accepted` once
          // those land - `accepted_pending_sign_in` records that the card half
          // is done without claiming consent that does not exist yet.
          //
          // A save that resolved false neither stored consent nor raised, so it
          // shows no error and closes the card: the user believes they
          // consented. That is the ending this event could not tell from a
          // dismissal, and the whole reason the two are named separately.
          if (!persistOnAccept) reportOutcome('accepted_pending_sign_in')
          else reportOutcome(saved ? 'accepted' : 'accept_not_persisted')
          closeWith(saved)
        } catch (error) {
          handleSaveFailure(error)
        }
      }

      dialogStore.showDialog({
        key: CONSENT_DIALOG_KEY,
        component: AgentConsentCard,
        props: {
          title: t('agent.consent.title'),
          titleId: CONSENT_DIALOG_KEY,
          paragraphs: [t('agent.consent.body1'), t('agent.consent.body2')],
          videoSrc: CONSENT_VIDEO_SRC,
          videoSrcMp4: CONSENT_VIDEO_SRC_MP4,
          posterSrc: CONSENT_POSTER_SRC,
          docsUrl: DOCS_URL,
          accepting: false,
          error: '',
          onVnodeMounted: () => {
            shown = true
            useTelemetry()?.trackAgentConsentShown({ trigger })
            if (expectedIdentity && identity.value !== expectedIdentity) return
            onShown?.()
          },
          onAccept: () => void accept(),
          onReject: () => {
            reportOutcome('rejected')
            closeWith(false)
          }
        },
        dialogComponentProps: {
          renderer: 'reka',
          dismissableMask: true,
          closeOnEscape: true,
          modal: true,
          headless: true,
          overlayClass: 'bg-black/55',
          contentClass:
            'w-[min(640px,calc(100vw-2rem))] border-none bg-transparent shadow-none sm:max-w-[640px]',
          onClose: () => {
            if (settled) return
            settled = true
            // Escape, the overlay mask, or a programmatic close. Reached only
            // when nothing else settled first, so it is exactly the ending that
            // used to emit `agent_consent_shown` and then nothing at all.
            //
            // Before the card renders there is no impression to resolve, and
            // reporting a dismissal against one would break this event's 1:1
            // agreement with `agent_consent_shown` in the other direction - so
            // that window is an ending of the request instead. It is narrow (the
            // card is an async component, so it is the chunk's load time) and
            // its production frequency is unknown rather than assumed to be
            // zero.
            if (shown) reportOutcome('dismissed')
            else reportRequestExit('card_closed_before_mount', trigger)
            resolve(false)
          }
        }
      })
    })
  }

  async function acceptAfterSignIn(
    trigger: AgentConsentTrigger,
    hooks: ConsentOfferHooks
  ): Promise<string | null> {
    if (!(await showConsentDialog(trigger, false, undefined, hooks)))
      return null
    try {
      if (!(await dialogService.showSignInDialog())) return null
    } catch (error) {
      reportError(error, {
        errorType: 'agent_consent_sign_in_failure'
      })
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('agent.consent.signInError')
      })
      return null
    }

    try {
      const decisionIdentity = await consentStore.ensureScope()
      if (!decisionIdentity || !(await consentStore.accept(decisionIdentity)))
        return null
      // The second half of the signed-out flow, so this is the moment consent
      // becomes stored rather than the card's own ending - the card already
      // reported `accepted_pending_sign_in`. No save error can have been shown
      // on it: its accept ran with `persistOnAccept` false and never wrote.
      useTelemetry()?.trackAgentConsentResolved({
        decision: 'accepted',
        save_error_shown: false
      })
      return decisionIdentity
    } catch (error) {
      reportError(error, {
        errorType: 'agent_consent_setting_write_failure'
      })
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('agent.consent.saveError')
      })
      return null
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
      reportError(error, {
        errorType: 'agent_consent_setting_load_failure'
      })
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('agent.consent.loadError')
      })
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

  return { accepted, isChecking, withConsent }
}
