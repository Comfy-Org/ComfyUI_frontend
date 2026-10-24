import { useRoute, useRouter } from 'vue-router'

import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { showSettingsPanel } from '@/platform/settings/composables/useSettingsDialog'
import type {
  ExtensionFilterType,
  SettingPanelType
} from '@/platform/settings/types'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.SETTINGS

const DEEP_LINKABLE_PANELS: Record<string, SettingPanelType> = {
  extension: 'extension',
  'plan-credits': 'workspace',
  members: 'workspace-members'
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
const EXTENSION_FILTER_PARAMS: Record<string, ExtensionFilterType> = {
  agent: 'agentCreated'
}

export function useSettingsUrlLoader() {
  const route = useRoute()
  const router = useRouter()

  async function loadSettingsFromUrl() {
    hydratePreservedQuery(NAMESPACE)
    const query =
      mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query
    const param = query.settings
    if (param === undefined) return

    const filter = query.filter
    const extensionFilter =
      param === 'extension' && typeof filter === 'string'
        ? EXTENSION_FILTER_PARAMS[filter]
        : undefined

    const cleanQuery = { ...query }
    delete cleanQuery.settings
    if (extensionFilter) delete cleanQuery.filter
    const stripped = router.replace({ query: cleanQuery }).catch((error) => {
      console.warn('[useSettingsUrlLoader] Failed to clean URL params:', error)
    })
    clearPreservedQuery(NAMESPACE)

    if (
      typeof param === 'string' &&
      param &&
      Object.hasOwn(DEEP_LINKABLE_PANELS, param)
    ) {
      showSettingsPanel(DEEP_LINKABLE_PANELS[param], { extensionFilter })
    }

    await stripped
  }

  return {
    loadSettingsFromUrl
  }
}
