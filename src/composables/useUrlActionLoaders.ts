import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { usePricingTableUrlLoader } from '@/platform/cloud/subscription/composables/usePricingTableUrlLoader'
import { isCloud } from '@/platform/distribution/types'
import { useCreateWorkspaceUrlLoader } from '@/platform/workspace/composables/useCreateWorkspaceUrlLoader'
import { useInviteUrlLoader } from '@/platform/workspace/composables/useInviteUrlLoader'

/**
 * Aggregates the query-param "deep link" loaders the cloud app checks on mount
 * (`?invite`, `?create_workspace`, `?pricing`). The loaders are instantiated in
 * setup so their `useRoute`/`useRouter` resolve; call `runUrlActionLoaders()`
 * from `onMounted` once the app is ready.
 */
export function useUrlActionLoaders() {
  const { flags } = useFeatureFlags()
  const inviteUrlLoader = isCloud ? useInviteUrlLoader() : null
  const createWorkspaceUrlLoader = isCloud
    ? useCreateWorkspaceUrlLoader()
    : null
  const pricingTableUrlLoader = isCloud ? usePricingTableUrlLoader() : null

  async function runUrlActionLoaders() {
    // Accept workspace invite from URL if present (e.g., ?invite=TOKEN).
    // WorkspaceAuthGate ensures flag state is resolved before the app mounts.
    if (inviteUrlLoader && flags.teamWorkspacesEnabled) {
      await inviteUrlLoader.loadInviteFromUrl()
    }

    // Open create workspace dialog from URL if present (e.g., ?create_workspace=1).
    if (createWorkspaceUrlLoader && flags.teamWorkspacesEnabled) {
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
    // Not gated on the team-workspaces flag: it also drives personal/legacy users.
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
  }

  return { runUrlActionLoaders }
}
