import { usePricingTableUrlLoader } from '@/platform/cloud/subscription/composables/usePricingTableUrlLoader'
import { useTopUpUrlLoader } from '@/platform/cloud/subscription/composables/useTopUpUrlLoader'
import { isCloud } from '@/platform/distribution/types'
import { useSettingsUrlLoader } from '@/platform/settings/composables/useSettingsUrlLoader'
import { useCreateWorkspaceUrlLoader } from '@/platform/workspace/composables/useCreateWorkspaceUrlLoader'
import { useInviteUrlLoader } from '@/platform/workspace/composables/useInviteUrlLoader'

/**
 * Aggregates the query-param "deep link" loaders the cloud app checks on mount
 * (`?invite`, `?create_workspace`, `?pricing`, `?topup`, `?settings`). The
 * loaders are instantiated in setup so their `useRoute`/`useRouter` resolve;
 * call `runUrlActionLoaders()` from `onMounted` once the app is ready.
 */
export function useUrlActionLoaders() {
  const inviteUrlLoader = isCloud ? useInviteUrlLoader() : null
  const createWorkspaceUrlLoader = isCloud
    ? useCreateWorkspaceUrlLoader()
    : null
  const pricingTableUrlLoader = isCloud ? usePricingTableUrlLoader() : null
  const topUpUrlLoader = isCloud ? useTopUpUrlLoader() : null
  const settingsUrlLoader = isCloud ? useSettingsUrlLoader() : null

  async function runUrlActionLoaders() {
    // Accept workspace invite from URL if present (e.g., ?invite=TOKEN).
    if (inviteUrlLoader) {
      await inviteUrlLoader.loadInviteFromUrl()
    }

    // Open create workspace dialog from URL if present (e.g., ?create_workspace=1).
    if (createWorkspaceUrlLoader) {
      try {
        await createWorkspaceUrlLoader.loadCreateWorkspaceFromUrl()
      } catch (error) {
        console.error(
          '[UrlActionLoaders] Failed to load create workspace from URL:',
          error
        )
      }
    }

    // Open the pricing table from URL if present (e.g., ?pricing=1 / ?pricing=team).
    if (pricingTableUrlLoader) {
      try {
        await pricingTableUrlLoader.loadPricingTableFromUrl()
      } catch (error) {
        console.error(
          '[UrlActionLoaders] Failed to load pricing table from URL:',
          error
        )
      }
    }

    // Open the credit top-up dialog from URL if present (e.g., ?topup=1).
    // Not gated on the team-workspaces flag: it also drives personal/legacy users.
    if (topUpUrlLoader) {
      try {
        await topUpUrlLoader.loadTopUpFromUrl()
      } catch (error) {
        console.error(
          '[UrlActionLoaders] Failed to load top-up dialog from URL:',
          error
        )
      }
    }

    // Open a Settings panel from URL if present (e.g. ?settings=plan-credits).
    if (settingsUrlLoader) {
      try {
        settingsUrlLoader.loadSettingsFromUrl()
      } catch (error) {
        console.error(
          '[UrlActionLoaders] Failed to load settings panel from URL:',
          error
        )
      }
    }
  }

  return { runUrlActionLoaders }
}
