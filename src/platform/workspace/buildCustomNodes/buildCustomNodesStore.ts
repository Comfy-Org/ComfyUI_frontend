import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import type {
  BuildCustomNodesEvent,
  BuildCustomNodesState,
  BuildSession
} from '@/platform/workspace/buildCustomNodes/buildCustomNodesFlow'
import {
  isRunning,
  reduceBuildCustomNodes
} from '@/platform/workspace/buildCustomNodes/buildCustomNodesFlow'
import { buildCustomNodesService } from '@/platform/workspace/buildCustomNodes/buildCustomNodesService'
import type { NodePack } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import type { NodePackVersionChoice } from '@/platform/workspace/buildCustomNodes/nodePackChoice'
import { toBuildCustomNode } from '@/platform/workspace/buildCustomNodes/nodePackChoice'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

export const BUILD_CUSTOM_NODES_POLL_MS = 3000

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * The Extensions node picker on Comfy Cloud: the packs picked for the
 * deployment's Build, then the build of a new Release and the move of the
 * deployment to it. The build and the move keep going after the dialog closes.
 */
export const useBuildCustomNodesStore = defineStore('buildCustomNodes', () => {
  const state = shallowRef<BuildCustomNodesState>({ phase: 'idle' })

  function dispatch(event: BuildCustomNodesEvent) {
    state.value = reduceBuildCustomNodes(state.value, event)
  }

  async function load(deploymentId: string, deploymentName: string) {
    dispatch({ type: 'opened', deploymentId, deploymentName })
    const outcome =
      await buildCustomNodesService.getDeploymentBuild(deploymentId)
    dispatch(
      outcome.ok
        ? { type: 'loaded', build: outcome.value }
        : { type: 'loadFailed', message: outcome.message }
    )
  }

  function open(deployment: WorkspaceDeployment): Promise<void> {
    if (isRunning(state.value)) return Promise.resolve()
    return load(
      deployment.deployment_id,
      deployment.deployment_name ??
        deployment.build_name ??
        deployment.deployment_id
    )
  }

  function reload(): Promise<void> {
    const current = state.value
    if (current.phase !== 'loadFailed') return Promise.resolve()
    return load(current.deploymentId, current.deploymentName)
  }

  function togglePack(pack: NodePack, choice: NodePackVersionChoice) {
    dispatch({ type: 'packToggled', pack, choice })
  }

  function chooseVersion(pack: NodePack, choice: NodePackVersionChoice) {
    dispatch({ type: 'versionChosen', pack, choice })
  }

  function review() {
    dispatch({ type: 'reviewRequested' })
  }

  function backToPicking() {
    dispatch({ type: 'backToPicking' })
  }

  function dismiss() {
    dispatch({ type: 'dismissed' })
  }

  function isFollowing(releaseId: string): boolean {
    const current = state.value
    return (
      current.phase === 'building' && current.release?.release_id === releaseId
    )
  }

  function isRedeploying(): boolean {
    return state.value.phase === 'redeploying'
  }

  function showLanded(session: BuildSession, version: number) {
    const toast = useToast()
    const id = toast.success(
      t('buildCustomNodes.landed.title', {
        deployment: session.deploymentName,
        build: session.build.build.name,
        version
      }),
      {
        description: t('buildCustomNodes.landed.body', session.picks.length),
        actions: [
          {
            label: t('buildCustomNodes.landed.later'),
            onClick: () => toast.close(id)
          },
          {
            label: t('buildCustomNodes.landed.reload'),
            onClick: () => window.location.reload()
          }
        ]
      }
    )
  }

  async function followMove(
    session: BuildSession,
    releaseId: string,
    version: number
  ) {
    while (isRedeploying()) {
      await wait(BUILD_CUSTOM_NODES_POLL_MS)
      if (!isRedeploying()) return
      const outcome = await buildCustomNodesService.getDeploymentBuild(
        session.deploymentId
      )
      if (!outcome.ok) continue
      if (outcome.value.release.release_id === releaseId) {
        dispatch({ type: 'moveLanded' })
        showLanded(session, version)
        void useDeploymentPickStore().load()
        return
      }
      if (outcome.value.pending_update === null)
        dispatch({ type: 'moveRefused', message: null })
    }
  }

  async function moveProduction() {
    const current = state.value
    if (current.phase !== 'redeploying') return
    const { session, release } = current
    const moved = await buildCustomNodesService.moveToRelease(
      session.deploymentId,
      release.release_id,
      session.build.revision
    )
    if (!moved.ok) {
      dispatch({ type: 'moveRefused', message: moved.message })
      return
    }
    await followMove(session, release.release_id, release.version)
  }

  async function followRelease(deploymentId: string, releaseId: string) {
    while (isFollowing(releaseId)) {
      await wait(BUILD_CUSTOM_NODES_POLL_MS)
      if (!isFollowing(releaseId)) return
      const outcome = await buildCustomNodesService.getRelease(
        deploymentId,
        releaseId
      )
      if (outcome.ok)
        dispatch({ type: 'releaseProgressed', release: outcome.value })
    }
    await moveProduction()
  }

  async function startBuild(deploymentId: string) {
    const started = await buildCustomNodesService.startRelease(deploymentId)
    if (!started.ok) {
      dispatch({ type: 'refused', message: started.message })
      return
    }
    dispatch({ type: 'releaseStarted', release: started.value, at: Date.now() })
    await followRelease(deploymentId, started.value.release_id)
  }

  async function submit() {
    const current = state.value
    if (current.phase !== 'reviewing') return
    const { session } = current
    dispatch({ type: 'submitted' })
    const saved = await buildCustomNodesService.saveCustomNodes(
      session.deploymentId,
      session.build.build.updated_at,
      [
        ...session.build.build.custom_nodes,
        ...session.picks.map(toBuildCustomNode)
      ]
    )
    if (!saved.ok) {
      dispatch({ type: 'refused', message: saved.message })
      return
    }
    dispatch({ type: 'saved', updatedAt: saved.value.updated_at })
    await startBuild(session.deploymentId)
  }

  async function retryBuild() {
    const current = state.value
    if (current.phase !== 'buildFailed') return
    dispatch({ type: 'retried' })
    await startBuild(current.session.deploymentId)
  }

  async function retryMove() {
    const current = state.value
    if (current.phase !== 'moveFailed') return
    const outcome = await buildCustomNodesService.getDeploymentBuild(
      current.session.deploymentId
    )
    if (!outcome.ok) {
      dispatch({ type: 'moveRefused', message: outcome.message })
      return
    }
    dispatch({ type: 'moveRetried', build: outcome.value })
    await moveProduction()
  }

  async function fetchReleaseLog(): Promise<string | null> {
    const current = state.value
    if (current.phase !== 'building' || !current.release) return null
    const outcome = await buildCustomNodesService.getReleaseLog(
      current.session.deploymentId,
      current.release.release_id
    )
    return outcome.ok ? outcome.value : null
  }

  return {
    state,
    open,
    reload,
    togglePack,
    chooseVersion,
    review,
    backToPicking,
    dismiss,
    submit,
    retryBuild,
    retryMove,
    fetchReleaseLog
  }
})
