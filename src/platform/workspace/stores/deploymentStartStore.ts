import { defineStore } from 'pinia'
import { shallowRef, watch } from 'vue'

import { WorkspaceApiError,workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { reportError } from '@/platform/telemetry/reportError'
import type {
  DeploymentStartRefusal,
  DeploymentStartEvent,
  DeploymentStarts
} from '@/platform/workspace/deploymentStartState'
import { reduceDeploymentStarts } from '@/platform/workspace/deploymentStartState'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const REFUSALS_BY_CODE = new Map<string, DeploymentStartRefusal>([
  ['PAYMENT_REQUIRED', 'noCredits'],
  ['CONCURRENCY_LIMIT', 'tooManyRunning']
])

const UNAVAILABLE_STATUSES = new Set([403, 404, 405, 501])

function reasonFor(err: WorkspaceApiError): DeploymentStartRefusal {
  const byCode =
    err.code === undefined ? undefined : REFUSALS_BY_CODE.get(err.code)
  if (byCode) return byCode
  if (err.status !== undefined && UNAVAILABLE_STATUSES.has(err.status)) {
    return 'unavailable'
  }
  return 'failed'
}

function refusalOf(err: unknown): {
  reason: DeploymentStartRefusal
  message: string | null
} {
  if (!(err instanceof WorkspaceApiError)) {
    return { reason: 'failed', message: null }
  }
  return {
    reason: reasonFor(err),
    message: err.code === undefined ? null : err.message || null
  }
}

function isUnanswered(err: unknown): boolean {
  return (
    !(err instanceof WorkspaceApiError) ||
    err.status === undefined ||
    err.status >= 500
  )
}

/**
 * The Starts this page asked for: each lasts until the listing after it lands,
 * and a refusal lasts while the listing says the deployment can still start.
 */
export const useDeploymentStartStore = defineStore('deploymentStart', () => {
  const pickStore = useDeploymentPickStore()
  const workspaceStore = useTeamWorkspaceStore()

  const starts = shallowRef<DeploymentStarts>(new Map())

  function dispatch(event: DeploymentStartEvent) {
    starts.value = reduceDeploymentStarts(starts.value, event)
  }

  watch(
    () => pickStore.deployments,
    (deployments) => dispatch({ type: 'listed', deployments })
  )

  async function start(deploymentId: string): Promise<void> {
    const workspaceId = workspaceStore.workspaceId
    if (!workspaceId) return
    if (starts.value.get(deploymentId)?.phase === 'requested') return
    dispatch({ type: 'requested', deploymentId })
    try {
      await workspaceApi.startDeployment(workspaceId, deploymentId)
    } catch (err) {
      if (isUnanswered(err)) {
        reportError(err, {
          surface: 'workspace',
          errorType: 'error_starting_deployment'
        })
      }
      dispatch({ type: 'refused', deploymentId, ...refusalOf(err) })
      return
    }
    pickStore.followStart(deploymentId)
    await pickStore.load()
    dispatch({ type: 'taken', deploymentId })
  }

  return { starts, start }
})
