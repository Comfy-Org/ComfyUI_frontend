import { useLocalStorage } from '@vueuse/core'

import { i18n } from '@/i18n'
import { useDialogStore } from '@/stores/dialogStore'
import AgentConsentCard from '@/workbench/extensions/agent/components/agent/AgentConsentCard.vue'

const CONSENT_STORAGE_KEY = 'Comfy.AgentPanel.consentAccepted'
const CONSENT_DIALOG_KEY = 'agent-consent'
const DOCS_URL = 'https://docs.comfy.org'

/** Shared across callers so a second entry point sees the same answer. */
const accepted = useLocalStorage(CONSENT_STORAGE_KEY, false)

export function useAgentConsent() {
  const dialogStore = useDialogStore()
  const { t } = i18n.global

  /**
   * Runs `onAccept` immediately once consent is on record, otherwise puts the
   * consent card up first and runs it only if the reader accepts.
   */
  function withConsent(onAccept: () => void): void {
    if (accepted.value) {
      onAccept()
      return
    }

    dialogStore.showDialog({
      key: CONSENT_DIALOG_KEY,
      component: AgentConsentCard,
      props: {
        title: t('agent.consent.title'),
        paragraphs: [t('agent.consent.body1'), t('agent.consent.body2')],
        docsUrl: DOCS_URL,
        onAccept: () => {
          accepted.value = true
          dialogStore.closeDialog({ key: CONSENT_DIALOG_KEY })
          onAccept()
        },
        onReject: () => dialogStore.closeDialog({ key: CONSENT_DIALOG_KEY })
      },
      dialogComponentProps: {
        renderer: 'reka',
        // Consent has to be answered, so none of the escape hatches are open.
        closable: false,
        closeOnEscape: false,
        dismissableMask: false,
        modal: true,
        headless: true,
        // The card draws its own panel — neutralize the chrome box.
        contentClass:
          'w-fit max-w-[1040px] border-none bg-transparent shadow-none'
      }
    })
  }

  return { accepted, withConsent }
}
