import { useRoute, useRouter } from 'vue-router'

import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.ASSETS
const ASSETS_TAB_ID = 'assets'

/**
 * Opens the Assets sidebar panel from an `?assets=1` deep link, so external
 * surfaces like comfy.org can send a visitor from a saved generation to the
 * library that holds the rest of them.
 *
 * Only `1` opens the panel; any other value is a silent no-op with the param
 * stripped. Survives the login redirect via the preserved-query system, like
 * the settings and top-up URL loaders.
 */
export function useAssetsUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const sidebarTabStore = useSidebarTabStore()

  /** Reads `?assets=`, strips it, and opens the Assets panel. */
  function loadAssetsFromUrl() {
    hydratePreservedQuery(NAMESPACE)
    const query =
      mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query
    const param = query.assets
    if (param === undefined) return

    // Strip the param (even an unrecognized value) and write the clean URL in
    // a single replace, so the URL is clean even if the replace rejects.
    const cleanQuery = { ...query }
    delete cleanQuery.assets
    router.replace({ query: cleanQuery }).catch((error) => {
      console.warn('[useAssetsUrlLoader] Failed to clean URL params:', error)
    })
    clearPreservedQuery(NAMESPACE)

    if (param !== '1') return

    // Assigned rather than toggled: a deep link must leave the panel open,
    // including for a visitor who already had it open.
    sidebarTabStore.activeSidebarTabId = ASSETS_TAB_ID
  }

  return {
    loadAssetsFromUrl
  }
}
