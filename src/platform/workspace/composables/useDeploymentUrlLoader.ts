import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { LocationQueryRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

import { useToast } from '@/components/ui/toast/toastStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'

import { useWorkspaceSwitch } from './useWorkspaceSwitch'

const WORKSPACE_NAMESPACE = PRESERVED_QUERY_NAMESPACES.WORKSPACE
const DEPLOYMENT_NAMESPACE = PRESERVED_QUERY_NAMESPACES.DEPLOYMENT
const SWITCH_KEY = WORKSPACE_STORAGE_KEYS.DEPLOYMENT_LINK_SWITCH

/**
 * One usable value: a non-empty string. Null for absent, empty, a bare
 * `?deployment` (null), and a repeated value (an array, or the stash's `,`
 * join of one), so a link that names two deployments picks neither.
 */
function readLinkValue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  return value && !value.includes(',') ? value : null
}

/** The link's query: the URL's, plus what the sign-in redirect stashed. */
function linkQuery(routeQuery: LocationQueryRaw): LocationQueryRaw {
  hydratePreservedQuery(WORKSPACE_NAMESPACE)
  hydratePreservedQuery(DEPLOYMENT_NAMESPACE)
  const withWorkspace =
    mergePreservedQueryIntoQuery(WORKSPACE_NAMESPACE, routeQuery) ?? routeQuery
  return (
    mergePreservedQueryIntoQuery(DEPLOYMENT_NAMESPACE, withWorkspace) ??
    withWorkspace
  )
}

/**
 * The workspace this page switched to for a deployment link, taken once: the
 * next boot reads and drops it, so a switch that did not land is never tried
 * again.
 */
function takeSwitchTarget(): string | null {
  try {
    const id = sessionStorage.getItem(SWITCH_KEY)
    sessionStorage.removeItem(SWITCH_KEY)
    return id
  } catch {
    return null
  }
}

function setSwitchTarget(workspaceId: string | null): boolean {
  try {
    if (workspaceId === null) sessionStorage.removeItem(SWITCH_KEY)
    else sessionStorage.setItem(SWITCH_KEY, workspaceId)
    return true
  } catch {
    return false
  }
}

/**
 * Opens the editor on the deployment a link names (BE-20294):
 * `/?workspace=<workspace id>&deployment=<deployment id>`. Runs before the
 * `?workspace=` loader and owns both params when `deployment` is present.
 *
 * In another workspace it switches there first, keeping both params so the
 * boot after the switch's reload picks; a switch that fails, or that did not
 * land after its reload, stays in the active workspace and says so. In the
 * named workspace it strips both params, then picks with the switcher's own
 * request, which reloads onto the deployment's nodes; a refused pick (outside
 * the rollout, a deployment gone or not the workspace's) shows the server's
 * reason and changes nothing. A link without both values, or an API-key
 * session (bound to one workspace, no pick), does nothing but drop
 * `deployment`. Signed out, the router sends the person to sign in with the
 * full path, query included, to come back to; both params are also stashed
 * by the preserved-query tracker.
 */
export function useDeploymentUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const toast = useToast()
  const { isApiKeyLogin } = useCurrentUser()
  const { switchWorkspace } = useWorkspaceSwitch()
  const { activeWorkspace, workspaceName } = storeToRefs(
    useTeamWorkspaceStore()
  )
  const pickStore = useDeploymentPickStore()

  /** Strips the given params, keeping the rest, and clears their stashes.
   * Must complete before a pick reloads the page, or the reload would run
   * the link again. */
  async function stripParams(
    query: LocationQueryRaw,
    keys: ('workspace' | 'deployment')[]
  ) {
    const cleanQuery = { ...query }
    for (const key of keys) delete cleanQuery[key]
    try {
      await router.replace({ query: cleanQuery })
    } catch (error) {
      console.warn(
        '[useDeploymentUrlLoader] Failed to clean URL params:',
        error
      )
    }
    if (keys.includes('workspace')) clearPreservedQuery(WORKSPACE_NAMESPACE)
    clearPreservedQuery(DEPLOYMENT_NAMESPACE)
  }

  function notifyWorkspaceRefused() {
    toast.error(
      t(
        'deploymentSwitcher.linkWorkspaceRefused',
        { workspaceName: workspaceName.value },
        { escapeParameter: false }
      ),
      { duration: 8000 }
    )
  }

  /**
   * In another workspace: switch there, keeping the link for the boot after
   * the switch's reload. Returns `true` when that reload is in flight.
   */
  async function openWorkspace(
    query: LocationQueryRaw,
    workspaceId: string,
    switchedTo: string | null
  ): Promise<boolean> {
    // A switch this link already made did not land: never reload again.
    if (switchedTo !== workspaceId && setSwitchTarget(workspaceId)) {
      if (await switchWorkspace(workspaceId)) return true
      setSwitchTarget(null)
    }
    await stripParams(query, ['workspace', 'deployment'])
    notifyWorkspaceRefused()
    return false
  }

  /**
   * In the named workspace: strip the link, then pick. Returns `true` when
   * the pick took and the page is reloading onto the deployment.
   */
  async function pickDeployment(
    query: LocationQueryRaw,
    deploymentId: string
  ): Promise<boolean> {
    await stripParams(query, ['workspace', 'deployment'])
    const outcome = await pickStore.pickFromLink(deploymentId)
    if (outcome.kind === 'timedOut') {
      toast.error(t('deploymentSwitcher.linkTimedOut'), { duration: 8000 })
    }
    if (outcome.kind === 'refused') {
      toast.error(t('deploymentSwitcher.linkRefused'), {
        description: outcome.message,
        duration: 8000
      })
    }
    return outcome.kind === 'picked'
  }

  /**
   * Reads the link and acts on it. Returns `true` when a reload is in flight
   * (a workspace switch or a pick), so the caller stops running loaders.
   */
  async function loadDeploymentFromUrl(): Promise<boolean> {
    const query = linkQuery(route.query)
    const switchedTo = takeSwitchTarget()
    if (!('deployment' in query)) return false

    const workspaceId = readLinkValue(query.workspace)
    const deploymentId = readLinkValue(query.deployment)
    // `workspace` stays for its own loader, which opens the workspace alone.
    if (!workspaceId || !deploymentId || isApiKeyLogin.value) {
      await stripParams(query, ['deployment'])
      return false
    }
    if (activeWorkspace.value?.id !== workspaceId) {
      return openWorkspace(query, workspaceId, switchedTo)
    }
    return pickDeployment(query, deploymentId)
  }

  return {
    loadDeploymentFromUrl
  }
}
