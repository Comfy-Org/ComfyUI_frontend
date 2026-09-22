import { readWorkspaceLink } from '@comfyorg/account-core/workspaceLink'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { LocationQueryRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useToastStore } from '@/platform/updates/common/toastStore'

import { useWorkspaceSwitch } from './useWorkspaceSwitch'
import { useTeamWorkspaceStore } from '../stores/teamWorkspaceStore'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.WORKSPACE

/** Builds the `URLSearchParams` `readWorkspaceLink` expects from just the `workspace` key, preserving a repeated value so it still reads as `invalid`. */
function workspaceSearchParams(query: LocationQueryRaw): URLSearchParams {
  const params = new URLSearchParams()
  const value = query.workspace
  const values = Array.isArray(value) ? value : [value]
  for (const entry of values) {
    if (typeof entry === 'string') params.append('workspace', entry)
  }
  return params
}

/**
 * Opens the workspace a `?workspace=` deep link names, before any other URL
 * action loader runs — so `?settings=plan-credits&workspace=w-1` opens
 * Settings on the requested workspace rather than the active one.
 *
 * A navigation destination: a member switches into the named workspace: a
 * non-member, a gone workspace, or an invalid link stays on the active
 * workspace, but always says which one that is via a toast, per the
 * workspace deep-link contract (`@comfyorg/account-core/workspaceLink`).
 * Absent is a silent no-op. Survives the login redirect via the
 * preserved-query system, like the other loaders.
 */
export function useWorkspaceUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const toastStore = useToastStore()
  const { switchWorkspace } = useWorkspaceSwitch()
  const { activeWorkspace, workspaceName } = storeToRefs(
    useTeamWorkspaceStore()
  )

  function notifyStayed() {
    toastStore.add({
      severity: 'info',
      summary: t(
        'workspace.deepLinkStayed',
        { workspaceName: workspaceName.value },
        { escapeParameter: false }
      )
    })
  }

  /** Strips `workspace`, keeping other params, and clears the stash. Must
   * complete before a workspace switch reloads the page, or the reload would
   * re-trigger this loader on the same link. */
  async function stripParam(query: LocationQueryRaw) {
    const cleanQuery = { ...query }
    delete cleanQuery.workspace
    try {
      await router.replace({ query: cleanQuery })
    } catch (error) {
      console.warn('[useWorkspaceUrlLoader] Failed to clean URL params:', error)
    }
    clearPreservedQuery(NAMESPACE)
  }

  /** Reads `?workspace=`, strips it, and switches (or explains why not). */
  async function loadWorkspaceFromUrl() {
    hydratePreservedQuery(NAMESPACE)
    const query =
      mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query
    if (query.workspace === undefined) return

    const link = readWorkspaceLink(workspaceSearchParams(query))

    if (link.status === 'absent') {
      await stripParam(query)
      return
    }

    if (link.status === 'invalid') {
      await stripParam(query)
      notifyStayed()
      return
    }

    // Already there: strip and say nothing, nothing changed.
    if (link.workspaceId === activeWorkspace.value?.id) {
      await stripParam(query)
      return
    }

    // Strip before switching: a successful switch reloads the page
    // synchronously, so nothing after that call runs.
    await stripParam(query)
    const switched = await switchWorkspace(link.workspaceId)
    if (!switched) {
      notifyStayed()
    }
  }

  return {
    loadWorkspaceFromUrl
  }
}
