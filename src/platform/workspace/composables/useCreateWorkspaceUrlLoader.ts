import { usePreservedQueryDeepLink } from '@/platform/navigation/composables/usePreservedQueryDeepLink'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useDialogService } from '@/services/dialogService'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.CREATE_WORKSPACE

/**
 * Composable for opening the team workspaces dialog via URL query parameter.
 *
 * Supports URLs like:
 * - /?create_workspace=1 (opens the team workspaces dialog)
 *
 * The parameter is preserved through login redirects via the
 * preserved query system (sessionStorage), following the same pattern
 * as the invite URL loader.
 */
export function useCreateWorkspaceUrlLoader() {
  const dialogService = useDialogService()
  const deepLink = usePreservedQueryDeepLink(NAMESPACE)

  /**
   * Opens the team workspaces dialog if `?create_workspace=1` is present.
   *
   * Flow:
   * 1. Restore preserved query (for post-login redirect)
   * 2. Check for create_workspace param in route.query
   * 3. Open the team workspaces dialog
   * 4. Clean up URL and preserved query
   */
  async function loadCreateWorkspaceFromUrl() {
    const param = await deepLink.hydrateAndRead()
    if (!param || typeof param !== 'string') return

    deepLink.strip()

    try {
      await dialogService.showTeamWorkspacesDialog()
    } catch (error) {
      console.error(
        '[useCreateWorkspaceUrlLoader] Failed to open create workspace dialog:',
        error
      )
    }
  }

  return {
    loadCreateWorkspaceFromUrl
  }
}
