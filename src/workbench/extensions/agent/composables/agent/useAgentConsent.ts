import { defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'

const CONSENT_DIALOG_KEY = 'agent-consent'
const DOCS_URL = 'https://docs.comfy.org/agent-tools/in-app-agent'
const CONSENT_VIDEO_SRC = 'https://media.comfy.org/website/mcp/launch-film.mp4'

const AgentConsentCard = defineAsyncComponent(
  () =>
    import('@/workbench/extensions/agent/components/agent/AgentConsentCard.vue')
)

export function useAgentConsent() {
  const dialogStore = useDialogStore()
  const dialogService = useDialogService()
  const consentStore = useAgentConsentStore()
  const toastStore = useToastStore()
  const { isLoggedIn } = useCurrentUser()
  const { accepted, identity } = storeToRefs(consentStore)
  const { t } = i18n.global

  function showConsentDialog(
    persistOnAccept = true,
    expectedIdentity?: string
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false
      let saving = false

      const closeWith = (result: boolean): void => {
        if (settled) return
        settled = true
        dialogStore.closeDialog({ key: CONSENT_DIALOG_KEY })
        resolve(result)
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
      }

      dialogStore.showDialog({
        key: CONSENT_DIALOG_KEY,
        component: AgentConsentCard,
        props: {
          title: t('agent.consent.title'),
          titleId: CONSENT_DIALOG_KEY,
          paragraphs: [t('agent.consent.body1'), t('agent.consent.body2')],
          videoSrc: CONSENT_VIDEO_SRC,
          docsUrl: DOCS_URL,
          accepting: false,
          error: '',
          onAccept: () => void accept(),
          onReject: () => closeWith(false)
        },
        dialogComponentProps: {
          renderer: 'reka',
          dismissableMask: true,
          closeOnEscape: true,
          modal: true,
          headless: true,
          size: 'xl',
          overlayClass: 'bg-black/55',
          contentClass:
            'w-[min(1040px,calc(100vw-2rem))] border-none bg-transparent shadow-none sm:max-w-[1040px]',
          onClose: () => {
            if (settled) return
            settled = true
            resolve(false)
          }
        }
      })
    })
  }

  async function withConsent(onAccept: () => void): Promise<void> {
    if (!isLoggedIn.value) {
      if (!(await showConsentDialog(false))) return
      if (!(await dialogService.showSignInDialog())) return

      try {
        if (!(await consentStore.accept())) return
      } catch (error) {
        reportError(error, {
          errorType: 'agent_consent_setting_write_failure'
        })
        toastStore.add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('agent.consent.saveError')
        })
        return
      }
      onAccept()
      return
    }

    const decisionIdentity = identity.value
    if (!decisionIdentity) return

    try {
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
      return
    }

    if (identity.value !== decisionIdentity) return
    if (!accepted.value && !(await showConsentDialog(true, decisionIdentity)))
      return
    onAccept()
  }

  return { accepted, withConsent }
}
