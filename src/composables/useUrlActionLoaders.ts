import { useRouter } from 'vue-router'

import { useAssetsUrlLoader } from '@/platform/assets/composables/useAssetsUrlLoader'
import { usePaymentReturnUrlLoader } from '@/platform/cloud/subscription/composables/usePaymentReturnUrlLoader'
import { usePricingTableUrlLoader } from '@/platform/cloud/subscription/composables/usePricingTableUrlLoader'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { useTopUpUrlLoader } from '@/platform/cloud/subscription/composables/useTopUpUrlLoader'
import { isCloud } from '@/platform/distribution/types'
import { useSettingsUrlLoader } from '@/platform/settings/composables/useSettingsUrlLoader'
import { reportError } from '@/platform/telemetry/reportError'
import { useCreateWorkspaceUrlLoader } from '@/platform/workspace/composables/useCreateWorkspaceUrlLoader'
import { useInviteUrlLoader } from '@/platform/workspace/composables/useInviteUrlLoader'

/** One loader's failure must not keep the rest of the boot chain from running,
 * and a deep link that cannot be served is not worth a visible error. */
async function attempt(what: string, run: () => void | Promise<void>) {
  try {
    await run()
  } catch (error) {
    console.error(`[UrlActionLoaders] Failed to ${what}:`, error)
  }
}

/**
 * Aggregates the query-param "deep link" loaders the cloud app checks on mount
 * (`?invite`, `?create_workspace`, `?pricing`, `?topup`, `?settings`,
 * `?assets`), then recovers an interrupted checkout. The loaders are
 * instantiated in setup so their `useRoute`/`useRouter` resolve; call
 * `runUrlActionLoaders()` from `onMounted` once the app is ready.
 */
/** Every param a loader above consumes, stripped centrally as a backstop. */
const HANDLED_PARAMS = [
  'invite',
  'create_workspace',
  'pricing',
  'stop',
  'cycle',
  'topup',
  'settings',
  'assets'
]

export function useUrlActionLoaders() {
  const router = useRouter()

  // Every one of these is cloud-only, so they are created and guarded together.
  const cloud = isCloud
    ? {
        invite: useInviteUrlLoader(),
        createWorkspace: useCreateWorkspaceUrlLoader(),
        pricingTable: usePricingTableUrlLoader(),
        topUp: useTopUpUrlLoader(),
        settings: useSettingsUrlLoader(),
        assets: useAssetsUrlLoader(),
        paymentReturn: usePaymentReturnUrlLoader(),
        subscriptionDialog: useSubscriptionDialog()
      }
    : undefined

  async function runUrlActionLoaders() {
    if (!cloud) return

    // Accept workspace invite from URL if present (e.g., ?invite=TOKEN).
    await cloud.invite.loadInviteFromUrl()

    // Open create workspace dialog from URL if present (e.g., ?create_workspace=1).
    await attempt('load create workspace from URL', () =>
      cloud.createWorkspace.loadCreateWorkspaceFromUrl()
    )

    // Open the pricing table from URL if present (e.g., ?pricing=1 / ?pricing=team).
    await attempt('load pricing table from URL', () =>
      cloud.pricingTable.loadPricingTableFromUrl()
    )

    // Open the credit top-up dialog from URL if present (e.g., ?topup=1).
    // Not gated on the team-workspaces flag: it also drives personal/legacy users.
    await attempt('load top-up dialog from URL', () =>
      cloud.topUp.loadTopUpFromUrl()
    )

    // Open a Settings panel from URL if present (e.g. ?settings=plan-credits).
    await attempt('load settings panel from URL', () =>
      cloud.settings.loadSettingsFromUrl()
    )

    // Open the Assets sidebar panel from URL if present (e.g. ?assets=1).
    await attempt('open assets panel from URL', () =>
      cloud.assets.loadAssetsFromUrl()
    )

    // Handle the return leg of a redirect payment (Stripe appends
    // payment_intent/redirect_status params): strip the params and refresh
    // billing status so the pending checkout resumes polling immediately.
    await attempt('handle payment return from URL', () =>
      cloud.paymentReturn.loadPaymentReturnFromUrl()
    )

    // Most loaders issue their own cleanup replace and do not wait for it, so
    // two deep links in one URL can race: the later navigation cancels the
    // earlier one and leaves its param behind. Whatever survived that, this
    // removes once every loader has had its turn.
    await attempt('clear handled deep-link params from the URL', async () => {
      const query = { ...router.currentRoute.value.query }
      if (!HANDLED_PARAMS.some((param) => param in query)) return
      for (const param of HANDLED_PARAMS) delete query[param]
      await router.replace({ query })
    })

    // Reopen a checkout that was interrupted by a redirect payment. Runs here,
    // not during workspace init, so the first-run and Templates overlays are
    // already settled and the recovered dialog is reachable. Deliberately not
    // awaited: the resume only settles once the recovered operation reaches a
    // terminal status, which for an abandoned checkout can take hours, and the
    // boot chain (emit('ready'), the tour, telemetry) must not wait on it.
    void (async () =>
      cloud.subscriptionDialog.resumePendingPricingFlow())().catch((error) => {
      reportError(error, {
        errorType: 'billing_pending_checkout_resume_failure'
      })
    })
  }

  return { runUrlActionLoaders }
}
