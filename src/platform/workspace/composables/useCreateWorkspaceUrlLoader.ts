import { useRoute, useRouter } from 'vue-router'

import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
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
  const route = useRoute()
  const router = useRouter()
  const dialogService = useDialogService()

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
    hydratePreservedQuery(NAMESPACE)
    const mergedQuery = mergePreservedQueryIntoQuery(NAMESPACE, route.query)
    if (mergedQuery) {
      await router.replace({ query: mergedQuery })
    }

    const query = mergedQuery ?? route.query
    const param = query.create_workspace
    if (!param || typeof param !== 'string') return

    const newQuery = { ...route.query }
    delete newQuery.create_workspace
    router.replace({ query: newQuery }).catch((error) => {
      console.warn(
        '[useCreateWorkspaceUrlLoader] Failed to clean URL params:',
        error
      )
    })
    clearPreservedQuery(NAMESPACE)

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
