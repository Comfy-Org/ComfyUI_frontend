import { usePreservedQueryDeepLink } from '@/platform/navigation/composables/usePreservedQueryDeepLink'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useWorkspaceDialogs } from '@/platform/workspace/composables/useWorkspaceDialogs'

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
  const deepLink = usePreservedQueryDeepLink(NAMESPACE)
  const { showTeamWorkspacesDialog } = useWorkspaceDialogs()

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
      await showTeamWorkspacesDialog()
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
