import { defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'

export const CONSENT_DIALOG_KEY = 'agent-consent'
const DOCS_URL = 'https://docs.comfy.org/agent-tools/in-app-agent'
const CONSENT_MEDIA_BASE = 'https://media.comfy.org/website/comfy-agent'
const CONSENT_VIDEO_SRC = `${CONSENT_MEDIA_BASE}/agent-consent-1280.webm`
const CONSENT_VIDEO_SRC_MP4 = `${CONSENT_MEDIA_BASE}/agent-consent-1280.mp4`
const CONSENT_POSTER_SRC = `${CONSENT_MEDIA_BASE}/agent-consent-poster.jpg`

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

  function showConsentDialog(
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

      const closeWith = (result: boolean): void => {
        if (settled) return
        settled = true
        dialogStore.closeDialog({ key: CONSENT_DIALOG_KEY })
        resolve(result)
      }

      function handleSaveFailure(error: unknown): void {
        if (settled) return
        saving = false
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
            if (expectedIdentity && identity.value !== expectedIdentity) return
            onShown?.()
          },
          onAccept: () => void accept(),
          onReject: () => closeWith(false)
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
            resolve(false)
          }
        }
      })
    })
  }

  async function acceptAfterSignIn(
    hooks: ConsentOfferHooks
  ): Promise<string | null> {
    if (!(await showConsentDialog(false, undefined, hooks))) return null
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
    hooks: ConsentOfferHooks
  ): Promise<string | null> {
    let decisionIdentity: string | null
    try {
      decisionIdentity = await consentStore.ensureScope()
      if (!decisionIdentity) return null
      await consentStore.load()
    } catch (error) {
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

    if (identity.value !== decisionIdentity) return null
    if (
      !accepted.value &&
      !(await showConsentDialog(true, decisionIdentity, hooks))
    )
      return null
    return decisionIdentity
  }

  async function withConsent(
    onAccept: () => void,
    hooks: ConsentOfferHooks = {}
  ): Promise<void> {
    const decisionIdentity = isLoggedIn.value
      ? await requestConsentForCurrentUser(hooks)
      : await acceptAfterSignIn(hooks)
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
