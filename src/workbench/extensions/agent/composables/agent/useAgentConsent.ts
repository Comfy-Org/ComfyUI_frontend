import { defineAsyncComponent, watch } from 'vue'
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
import { useToast } from '@/components/ui/toast/toastStore'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useDialogStore } from '@/stores/dialogStore'
import { AGENT_DOCS_URL } from '@/workbench/extensions/agent/agentDocs'
import { recordConsentOfferDeclined } from '@/workbench/extensions/agent/services/agent/consentOfferDeclined'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentConsentIntroductionStore } from '@/workbench/extensions/agent/stores/agent/agentConsentIntroductionStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

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
  onShown?: () => void
  /** Asked right before the card mounts, after every await that precedes it. */
  canShow?: () => boolean
}

type ConsentCardError = 'save' | 'load' | 'signIn'

const CARD_ERROR_TYPE = {
  save: 'agent_consent_setting_write_failure',
  load: 'agent_consent_setting_load_failure',
  signIn: 'agent_consent_sign_in_failure'
} as const

export function useAgentConsent() {
  const dialogStore = useDialogStore()
  const { showSignInDialog } = useAuthDialogs()
  const consentStore = useAgentConsentStore()
  const introductionStore = useAgentConsentIntroductionStore()
  const agentPanelStore = useAgentPanelStore()
  const toast = useToast()
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
    { onShown, canShow }: ConsentOfferHooks = {},
    initialError: ConsentCardError | '' = ''
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
      let cardError: ConsentCardError | '' = initialError

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

      function showCardError(kind: ConsentCardError, error: unknown): void {
        if (settled) return
        saving = false
        cardError = kind
        if (kind === 'save') saveErrorShown = true
        reportError(error, {
          surface: 'agent',
          errorType: CARD_ERROR_TYPE[kind]
        })
        dialogStore.updateDialog({
          key: CONSENT_DIALOG_KEY,
          contentProps: {
            accepting: false,
            error: kind
          },
          dialogComponentProps: {
            closable: true,
            dismissOnPointerDownOutside: true
          }
        })
      }

      function finishAcceptance(saved: boolean): void {
        if (settled) return
        if (!persistOnAccept) reportOutcome('accepted_pending_sign_in')
        else reportOutcome(saved ? 'accepted' : 'accept_not_persisted')
        closeWith(saved)
      }

      function unlockCard(): void {
        saving = false
        dialogStore.updateDialog({
          key: CONSENT_DIALOG_KEY,
          contentProps: { accepting: false, error: '' },
          dialogComponentProps: {
            closable: true,
            dismissOnPointerDownOutside: true
          }
        })
      }

      async function retryFailedLoad(): Promise<void> {
        await consentStore.load()
        if (expectedIdentity && identity.value !== expectedIdentity) {
          closeWith(false)
          return
        }
        if (accepted.value) {
          finishAcceptance(true)
          return
        }
        unlockCard()
      }

      const accept = async (): Promise<void> => {
        if (saving || settled) return
        markIntroductionResponded()
        saving = true
        const retrying = cardError
        cardError = ''
        dialogStore.updateDialog({
          key: CONSENT_DIALOG_KEY,
          contentProps: { accepting: true, error: '' },
          dialogComponentProps: {
            closable: false,
            dismissOnPointerDownOutside: false
          }
        })

        try {
          if (retrying === 'load') {
            await retryFailedLoad()
            return
          }
          const saved = persistOnAccept
            ? await consentStore.accept(expectedIdentity)
            : true
          finishAcceptance(saved)
        } catch (error) {
          showCardError(retrying === 'load' ? 'load' : 'save', error)
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
          error: initialError,
          onVnodeMounted: () => {
            shown = true
            useTelemetry()?.trackAgentConsentShown({ trigger })
            if (expectedIdentity && identity.value !== expectedIdentity) return
            onShown?.()
          },
          onAccept: () => void accept(),
          onReject: () => {
            if (settled) return
            markIntroductionResponded()
            reportOutcome('rejected')
            if (
              agentPanelStore.onboarding.persistSkipAsRefusal &&
              expectedIdentity &&
              identity.value === expectedIdentity
            )
              void recordConsentOfferDeclined()
            closeWith(false)
          }
        },
        dialogComponentProps: {
          centerOnViewport: true,
          dismissOnPointerDownOutside: true,
          headless: true,
          onClose: () => {
            if (settled) return
            settled = true
            stopScopeWatch()
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
    let cardError: ConsentCardError | '' = ''
    for (;;) {
      if (
        !(await showConsentDialog(trigger, false, undefined, hooks, cardError))
      )
        return null
      introductionStore.isContinuingSignIn = true
      try {
        try {
          if (!(await showSignInDialog())) return null
        } catch (error) {
          reportError(error, {
            surface: 'agent',
            errorType: 'agent_consent_sign_in_failure'
          })
          cardError = 'signIn'
          continue
        }

        try {
          const decisionIdentity = await consentStore.ensureScope()
          if (
            !decisionIdentity ||
            !(await consentStore.accept(decisionIdentity))
          ) {
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
          reportError(error, {
            surface: 'agent',
            errorType: 'agent_consent_setting_write_failure'
          })
          toast.error(t('g.error'), {
            description: t('agent.consent.saveError')
          })
          return null
        }
      } finally {
        introductionStore.isContinuingSignIn = false
      }
    }
  }

  async function requestConsentForCurrentUser(
    trigger: AgentConsentTrigger,
    hooks: ConsentOfferHooks
  ): Promise<string | null> {
    let decisionIdentity: string | null = null
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
      reportError(error, {
        surface: 'agent',
        errorType: 'agent_consent_setting_load_failure'
      })
      if (!reading || !decisionIdentity) {
        reportRequestExit('scope_probe_failed', trigger)
        toast.error(t('g.error'), {
          description: t('agent.consent.loadError')
        })
        return null
      }
      if (
        !(await showConsentDialog(
          trigger,
          true,
          decisionIdentity,
          hooks,
          'load'
        ))
      )
        return null
      return decisionIdentity
    }

    if (identity.value !== decisionIdentity) {
      reportRequestExit('scope_changed_after_read', trigger)
      return null
    }
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
