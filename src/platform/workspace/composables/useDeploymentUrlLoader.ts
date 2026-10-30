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
const ENVIRONMENT_NAMESPACE = PRESERVED_QUERY_NAMESPACES.ENVIRONMENT
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

function linkQuery(routeQuery: LocationQueryRaw): LocationQueryRaw {
  hydratePreservedQuery(WORKSPACE_NAMESPACE)
  hydratePreservedQuery(DEPLOYMENT_NAMESPACE)
  hydratePreservedQuery(ENVIRONMENT_NAMESPACE)
  const withWorkspace =
    mergePreservedQueryIntoQuery(WORKSPACE_NAMESPACE, routeQuery) ?? routeQuery
  const withDeployment =
    mergePreservedQueryIntoQuery(DEPLOYMENT_NAMESPACE, withWorkspace) ??
    withWorkspace
  return (
    mergePreservedQueryIntoQuery(ENVIRONMENT_NAMESPACE, withDeployment) ??
    withDeployment
  )
}

type DeploymentLink =
  | { kind: 'absent' }
  | { kind: 'invalidEnvironment' }
  | { kind: 'invalidTarget' }
  | { kind: 'target'; workspaceId: string; deploymentId: string | null }

function isInvalidStandardTarget(query: LocationQueryRaw) {
  return (
    'environment' in query &&
    (readLinkValue(query.environment) !== 'standard' || 'deployment' in query)
  )
}

function readDeploymentLink(query: LocationQueryRaw): DeploymentLink {
  if (!('deployment' in query) && !('environment' in query))
    return { kind: 'absent' }
  if (isInvalidStandardTarget(query)) return { kind: 'invalidEnvironment' }
  const workspaceId = readLinkValue(query.workspace)
  if (!workspaceId) return { kind: 'invalidTarget' }
  if ('environment' in query)
    return { kind: 'target', workspaceId, deploymentId: null }
  const deploymentId = readLinkValue(query.deployment)
  if (!deploymentId) return { kind: 'invalidTarget' }
  return { kind: 'target', workspaceId, deploymentId }
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
 * Resolves workspace and browser environment links: cross-workspace switches retain the link for the reload; target-workspace picks strip it first.
 * `environment=standard` clears this browser's selection; API-key sessions strip environment targets, while signed-out intent is preserved by the query tracker until authentication.
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
    keys: ('workspace' | 'deployment' | 'environment')[]
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
    clearPreservedQuery(ENVIRONMENT_NAMESPACE)
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
    await stripParams(query, ['workspace', 'deployment', 'environment'])
    notifyWorkspaceRefused()
    return false
  }

  /**
   * In the named workspace: strip the link, then pick. Returns `true` when
   * the pick took and the page is reloading onto the deployment.
   */
  async function pickDeployment(
    query: LocationQueryRaw,
    deploymentId: string | null
  ): Promise<boolean> {
    await stripParams(query, ['workspace', 'deployment', 'environment'])
    const outcome = await pickStore.pickFromLink(deploymentId)
    if (outcome.kind === 'timedOut') {
      toast.error(
        t(
          deploymentId === null
            ? 'deploymentSwitcher.linkEnvironmentTimedOut'
            : 'deploymentSwitcher.linkTimedOut'
        ),
        { duration: 8000 }
      )
    }
    if (outcome.kind === 'refused') {
      toast.error(
        t(
          deploymentId === null
            ? 'deploymentSwitcher.linkEnvironmentRefused'
            : 'deploymentSwitcher.linkRefused'
        ),
        {
          description: outcome.message,
          duration: 8000
        }
      )
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
    const link = readDeploymentLink(query)
    if (link.kind === 'absent') return false
    if (link.kind === 'invalidEnvironment') {
      await stripParams(query, ['workspace', 'deployment', 'environment'])
      toast.error(t('deploymentSwitcher.linkEnvironmentInvalid'), {
        duration: 8000
      })
      return false
    }

    if (link.kind === 'invalidTarget' || isApiKeyLogin.value) {
      await stripParams(query, ['deployment', 'environment'])
      return false
    }
    if (activeWorkspace.value?.id !== link.workspaceId) {
      return openWorkspace(query, link.workspaceId, switchedTo)
    }
    return pickDeployment(query, link.deploymentId)
  }

  return {
    loadDeploymentFromUrl
  }
}
