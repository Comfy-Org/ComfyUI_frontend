import { useLocalStorage } from '@vueuse/core'
import { computed, defineAsyncComponent } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { i18n } from '@/i18n'
import { useDialogStore } from '@/stores/dialogStore'

const CONSENT_STORAGE_KEY = 'Comfy.AgentPanel.consentAccepted'
const CONSENT_DIALOG_KEY = 'agent-consent'
const DOCS_URL = 'https://docs.comfy.org/agent-tools/in-app-agent'
const CONSENT_VIDEO_SRC = 'https://media.comfy.org/website/mcp/launch-film.mp4'
const SIGNED_OUT_KEY = 'signed-out'

/**
 * The agent panel is cloud-only and tree-shaken out of OSS builds, but the
 * topbar that gates it ships in every bundle. Load the card lazily so its
 * markup stays out of distributions that can never show it.
 */
const AgentConsentCard = defineAsyncComponent(
  () =>
    import('@/workbench/extensions/agent/components/agent/AgentConsentCard.vue')
)

/**
 * Consent belongs to a person, not a browser, so the record is keyed by user
 * id — a second account on the same profile is asked in its own right.
 */
const acceptedByUser = useLocalStorage<Record<string, boolean>>(
  CONSENT_STORAGE_KEY,
  {}
)

/**
 * `?agentConsent=always` re-asks on every open and does not record the answer,
 * so a demo can be replayed without clearing storage by hand. Read per call so
 * the URL can be changed without a reload.
 */
function alwaysAsk(): boolean {
  return (
    new URLSearchParams(window.location.search).get('agentConsent') === 'always'
  )
}

export function useAgentConsent() {
  const dialogStore = useDialogStore()
  const { resolvedUserInfo } = useCurrentUser()
  const { t } = i18n.global

  const userKey = (): string => resolvedUserInfo.value?.id ?? SIGNED_OUT_KEY

  const accepted = computed<boolean>({
    get: () => acceptedByUser.value?.[userKey()] === true,
    set: (value) => {
      const current = acceptedByUser.value
      acceptedByUser.value = {
        ...(current && typeof current === 'object' ? current : {}),
        [userKey()]: value
      }
    }
  })

  /**
   * Runs `onAccept` immediately once consent is on record, otherwise puts the
   * consent card up first and runs it only if the reader accepts.
   */
  function withConsent(onAccept: () => void): void {
    const replaying = alwaysAsk()
    if (accepted.value && !replaying) {
      onAccept()
      return
    }

    dialogStore.showDialog({
      key: CONSENT_DIALOG_KEY,
      component: AgentConsentCard,
      props: {
        title: t('agent.consent.title'),
        paragraphs: [t('agent.consent.body1'), t('agent.consent.body2')],
        videoSrc: CONSENT_VIDEO_SRC,
        docsUrl: DOCS_URL,
        onAccept: () => {
          if (!replaying) accepted.value = true
          dialogStore.closeDialog({ key: CONSENT_DIALOG_KEY })
          onAccept()
        },
        onReject: () => dialogStore.closeDialog({ key: CONSENT_DIALOG_KEY })
      },
      dialogComponentProps: {
        renderer: 'reka',
        // The mask stays inert so consent is not lost to a stray click, but
        // Escape declines and remains the way out if the card itself ever
        // fails to render.
        dismissableMask: false,
        closeOnEscape: true,
        modal: true,
        headless: true,
        size: 'xl',
        // The card draws its own panel — neutralize the chrome box. It sizes
        // itself with w-full, so the content box needs a real width: w-fit
        // would collapse it to nothing.
        contentClass:
          'w-[min(1040px,calc(100vw-2rem))] border-none bg-transparent shadow-none sm:max-w-[1040px]'
      }
    })
  }

  return { accepted, withConsent }
}
