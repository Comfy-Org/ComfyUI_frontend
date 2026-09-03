import { useRoute, useRouter } from 'vue-router'

import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import type { SettingPanelType } from '@/platform/settings/types'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.SETTINGS

const DEEP_LINKABLE_PANELS: Record<string, SettingPanelType> = {
  'plan-credits': 'workspace'
}

/**
 * Opens the Settings dialog on a named panel from a `?settings=` deep link
 * (e.g. `?settings=plan-credits`), so external surfaces like platform.comfy.org
 * can land users directly on the tab where they complete billing actions.
 *
 * Only values in `DEEP_LINKABLE_PANELS` open a panel; any other value is a
 * silent no-op with the param stripped. Survives the login redirect via the
 * preserved-query system, like the top-up URL loader.
 */
export function useSettingsUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const settingsDialog = useSettingsDialog()

  /** Reads `?settings=`, strips it, and opens the mapped Settings panel. */
  function loadSettingsFromUrl() {
    hydratePreservedQuery(NAMESPACE)
    const query =
      mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query
    const param = query.settings
    if (param === undefined) return

    // Strip any present settings param (even unrecognized or malformed values)
    // and write the clean URL in a single replace, so a clean URL is
    // guaranteed even if the replace rejects or no panel matches.
    const cleanQuery = { ...query }
    delete cleanQuery.settings
    router.replace({ query: cleanQuery }).catch((error) => {
      console.warn('[useSettingsUrlLoader] Failed to clean URL params:', error)
    })
    clearPreservedQuery(NAMESPACE)

    if (typeof param !== 'string' || !param) return

    const panel = DEEP_LINKABLE_PANELS[param]

    settingsDialog.show(panel)
  }

  return {
    loadSettingsFromUrl
  }
}
