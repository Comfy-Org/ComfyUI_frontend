import { computed, defineAsyncComponent } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { i18n } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { AGENT_CONSENT_SETTING_ID } from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

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
  const settingStore = useSettingStore()
  const toastStore = useToastStore()
  const { isLoggedIn } = useCurrentUser()
  const { t } = i18n.global

  const accepted = computed(
    () => settingStore.get(AGENT_CONSENT_SETTING_ID) === true
  )

  async function continueAfterConsent(onAccept: () => void): Promise<void> {
    if (!isCloud && !isLoggedIn.value) {
      const signedIn = await dialogService.showSignInDialog()
      if (!signedIn) return
    }
    onAccept()
  }

  function showConsentDialog(): Promise<boolean> {
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
          await settingStore.set(AGENT_CONSENT_SETTING_ID, true)
          closeWith(true)
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
    try {
      await settingStore.load()
      if (settingStore.error) throw settingStore.error
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

    if (!accepted.value && !(await showConsentDialog())) return
    await continueAfterConsent(onAccept)
  }

  return { accepted, withConsent }
}
