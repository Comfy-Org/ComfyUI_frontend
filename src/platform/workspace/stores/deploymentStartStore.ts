import { defineStore } from 'pinia'
import { shallowRef, watch } from 'vue'

import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import { reportError } from '@comfyorg/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type {
  DeploymentStartOutcome,
  DeploymentStartRefusal,
  DeploymentStartEvent,
  DeploymentStarts
} from '@/platform/workspace/deploymentStartState'
import { reduceDeploymentStarts } from '@/platform/workspace/deploymentStartState'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const REFUSALS_BY_STATUS = new Map<number, DeploymentStartRefusal>([
  [402, 'noCredits'],
  [403, 'unavailable'],
  [404, 'unavailable'],
  [405, 'unavailable'],
  [429, 'tooManyRunning'],
  [501, 'unavailable']
])

function refusalFor(err: WorkspaceApiError): DeploymentStartRefusal {
  if (err.status === 429 && err.code === undefined) return 'failed'
  return (
    (err.status !== undefined && REFUSALS_BY_STATUS.get(err.status)) || 'failed'
  )
}

async function startDeployment(
  workspaceId: string,
  deploymentId: string
): Promise<DeploymentStartOutcome> {
  try {
    const started = await workspaceApi.startDeployment(
      workspaceId,
      deploymentId
    )
    return { ok: true, status: started.status }
  } catch (err) {
    if (!(err instanceof WorkspaceApiError)) {
      reportError(err, {
        surface: 'workspace',
        errorType: 'error_starting_deployment'
      })
      return { ok: false, reason: 'failed', message: null }
    }
    return {
      ok: false,
      reason: refusalFor(err),
      message: err.code === undefined ? null : err.message || null
    }
  }
}

/**
 * The Starts this page asked for (DES-1279). A Start ends when the listing
 * shows the deployment ready, or when the server refuses it or it fails to
 * come up. A taken Start counts only once a listing asked for after it has
 * landed, so a listing sent before it cannot read as a failure.
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
    const current = starts.value.get(deploymentId)
    if (current && current.phase !== 'refused') return
    dispatch({ type: 'requested', deploymentId })
    const outcome = await startDeployment(workspaceId, deploymentId)
    if (outcome.ok) await pickStore.load()
    dispatch({ type: 'answered', deploymentId, outcome })
  }

  return { starts, start }
})
