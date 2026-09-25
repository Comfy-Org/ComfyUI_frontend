import { readWorkspaceLink } from '@comfyorg/account-core/workspaceLink'
import type { WorkspaceLinkRead } from '@comfyorg/account-core/workspaceLink'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { LocationQueryRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

import { useToast } from '@/components/ui/toast'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'

import { useWorkspaceSwitch } from './useWorkspaceSwitch'
import { useTeamWorkspaceStore } from '../stores/teamWorkspaceStore'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.WORKSPACE

/**
 * Reads the `workspace` link from a merged query. `undefined` only when the
 * key itself is absent. A repeated value (still possible when the stash
 * predates router.ts's `rejectRepeated`, or from a caller that bypasses the
 * tracker) joins with `,`, outside any real workspace id's charset, so it
 * still resolves to `invalid`. A bare `?workspace` (no `=`) reaches the
 * router as `null` — present but empty — which readWorkspaceLink can't tell
 * apart from truly absent (both serialize to `''` in a URLSearchParams
 * value), so it's classified `invalid` directly here instead.
 */
function readWorkspaceLinkFromQuery(
  query: LocationQueryRaw
): WorkspaceLinkRead | undefined {
  const raw = query.workspace
  if (raw === undefined) return undefined

  const values = Array.isArray(raw) ? raw : [raw]
  if (values.includes(null)) return { status: 'invalid' }

  return readWorkspaceLink(new URLSearchParams({ workspace: values.join(',') }))
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
 * preserved-query system, like the other loaders — a repeated value is
 * stashed joined with `,` (router.ts's `rejectRepeated`), so it still reads
 * as invalid rather than picking one of the colliding values.
 */
export function useWorkspaceUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const toast = useToast()
  const { switchWorkspace } = useWorkspaceSwitch()
  const { activeWorkspace, workspaceName } = storeToRefs(
    useTeamWorkspaceStore()
  )

  function notifyStayed() {
    toast.info(
      t(
        'workspace.deepLinkStayed',
        { workspaceName: workspaceName.value },
        { escapeParameter: false }
      )
    )
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

  /**
   * Reads `?workspace=`, strips it, and switches (or explains why not).
   * Returns `true` when it triggered a switch that will reload the page —
   * the caller must stop running further loaders immediately: `location.reload()`
   * doesn't halt the current script, so a later loader's own URL cleanup
   * (e.g. settings unconditionally strips `?settings=`) can otherwise land
   * on the still-live page and get baked into the URL the reload re-fetches.
   */
  async function loadWorkspaceFromUrl(): Promise<boolean> {
    hydratePreservedQuery(NAMESPACE)
    const query =
      mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query
    const link = readWorkspaceLinkFromQuery(query)
    if (!link) return false

    if (link.status === 'absent') {
      await stripParam(query)
      return false
    }

    if (link.status === 'invalid') {
      await stripParam(query)
      notifyStayed()
      return false
    }

    // Already there: strip and say nothing, nothing changed.
    if (link.workspaceId === activeWorkspace.value?.id) {
      await stripParam(query)
      return false
    }

    await stripParam(query)
    const switched = await switchWorkspace(link.workspaceId)
    if (!switched) {
      notifyStayed()
      return false
    }
    return true
  }

  return {
    loadWorkspaceFromUrl
  }
}
