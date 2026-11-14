import { defineStore } from 'pinia'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type {
  EditorGpuChange,
  GpuSessionEvent,
  GpuSessionState,
  IdleMinutes
} from '@/platform/workspace/gpuSession'
import {
  INITIAL_GPU_SESSION,
  parseGpuSessionMessage,
  readCanChangeEditorGpu,
  readEditorGpuSettings,
  reduceGpuSession
} from '@/platform/workspace/gpuSession'
import type { GpuRequestHold } from '@/platform/workspace/gpuStartingFetch'
import { holdWhileGpuStarts } from '@/platform/workspace/gpuStartingFetch'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'

const HOLD_FOR_READY_MS = 10 * 60 * 1000

type GpuStatus = 'starting' | 'on' | 'unavailable'

type GpuChangeRefusal = 'ownerOnly' | 'failed'

function endsTheSession(event: GpuSessionEvent): boolean {
  switch (event.type) {
    case 'messageReceived':
      return (
        event.message.state === 'ended' &&
        (event.message.deployment_id ?? event.deploymentId) ===
          event.deploymentId
      )
    case 'changeSaved':
      return 'on' in event.change && (!event.change.on || event.gpu === 'off')
    case 'gpuAnswered':
      return event.answer === 'off'
  }
}

/**
 * The editor's GPU toggle for the picked deployment, shown only when its list
 * entry carries `editor_gpu`, and the GPU session the server reports for it.
 */
export const useGpuSessionStore = defineStore('gpuSession', () => {
  const pickStore = useDeploymentPickStore()
  const workspaceStore = useTeamWorkspaceStore()

  const state = shallowRef(INITIAL_GPU_SESSION)
  const saving = shallowRef(false)
  const readyWaiters = new Set<(ready: boolean) => void>()
  let installed = false
  let holdGeneration = 0
  let overrideGeneration = 0
  let uninstall = () => {}
  onScopeDispose(() => uninstall())

  const deploymentId = computed(
    () => pickStore.pickedDeployment?.deployment_id ?? null
  )
  const listed = computed(() =>
    readEditorGpuSettings(pickStore.pickedDeployment)
  )
  const available = computed(() => listed.value !== null)
  const canChange = computed(() =>
    readCanChangeEditorGpu(pickStore.pickedDeployment)
  )
  const settings = computed(() =>
    listed.value ? { ...listed.value, ...state.value.changed } : null
  )
  const session = computed(() => state.value.session)
  const status = computed<GpuStatus | null>(() => {
    if (!settings.value?.on) return null
    switch (state.value.gpu) {
      case 'ready':
        return 'on'
      case 'starting':
        return 'starting'
      case 'unavailable':
        return 'unavailable'
      case 'idle':
        return null
    }
  })

  function settleWaiters(ready: boolean) {
    for (const settle of readyWaiters) settle(ready)
  }

  function settleWaitersFor(gpu: GpuSessionState['gpu']) {
    if (gpu === 'ready') settleWaiters(true)
    else if (gpu !== 'starting') settleWaiters(false)
  }

  function endHolds() {
    holdGeneration++
    settleWaiters(false)
  }

  async function keepChangesUntilListed() {
    const asked = overrideGeneration
    const listedSince = await pickStore.refresh()
    if (listedSince && asked === overrideGeneration) {
      state.value = { ...state.value, changed: {} }
    }
  }

  function dispatch(event: GpuSessionEvent) {
    const changedBefore = state.value.changed
    state.value = reduceGpuSession(state.value, event)
    if (endsTheSession(event)) endHolds()
    settleWaitersFor(state.value.gpu)
    if (state.value.changed !== changedBefore) overrideGeneration++
  }

  watch(
    deploymentId,
    () => {
      holdGeneration++
      state.value = INITIAL_GPU_SESSION
      settleWaiters(false)
    },
    { flush: 'sync' }
  )

  function waitReady(): Promise<boolean> {
    if (state.value.gpu === 'ready') return Promise.resolve(true)
    return new Promise((resolve) => {
      const settle = (ready: boolean) => {
        clearTimeout(timeout)
        readyWaiters.delete(settle)
        resolve(ready)
      }
      const timeout = setTimeout(() => settle(false), HOLD_FOR_READY_MS)
      readyWaiters.add(settle)
    })
  }

  function holdForRequest(): GpuRequestHold {
    const sentFor = holdGeneration
    const stillCurrent = () => holdGeneration === sentFor
    return {
      answered: (answer) => {
        if (stillCurrent()) dispatch({ type: 'gpuAnswered', answer })
      },
      waitReady: () => (stillCurrent() ? waitReady() : Promise.resolve(false))
    }
  }

  function receiveGpuSession(event: CustomEvent<unknown>) {
    const message = parseGpuSessionMessage(event.detail)
    const id = deploymentId.value
    if (message && id) {
      dispatch({ type: 'messageReceived', message, deploymentId: id })
    }
  }

  function install() {
    if (installed) return
    installed = true
    const pageFetch = window.fetch
    api.addCustomEventListener('gpu_session', receiveGpuSession)
    window.fetch = holdWhileGpuStarts(pageFetch.bind(window), {
      forRequest: holdForRequest
    })
    uninstall = () => {
      api.removeCustomEventListener('gpu_session', receiveGpuSession)
      window.fetch = pageFetch
      endHolds()
    }
  }

  async function save(
    change: EditorGpuChange
  ): Promise<GpuChangeRefusal | null> {
    const workspaceId = workspaceStore.workspaceId
    const id = deploymentId.value
    if (!workspaceId || !id || saving.value) return null
    saving.value = true
    try {
      const gpu = await workspaceApi.setEditorGpu(workspaceId, id, change)
      if (deploymentId.value === id) {
        dispatch({ type: 'changeSaved', change, gpu })
        void keepChangesUntilListed()
      }
      return null
    } catch (err) {
      if (err instanceof WorkspaceApiError && err.status === 403) {
        return 'ownerOnly'
      }
      reportError(err, {
        surface: 'workspace',
        errorType: 'error_saving_editor_gpu',
        level: 'warning'
      })
      return 'failed'
    } finally {
      saving.value = false
    }
  }

  function setOn(on: boolean) {
    return save({ on })
  }

  function setIdleMinutes(minutes: IdleMinutes) {
    return save({ idle_minutes: minutes })
  }

  function setEndOnClose(endOnClose: boolean) {
    return save({ end_on_close: endOnClose })
  }

  return {
    available,
    canChange,
    settings,
    session,
    status,
    saving,
    install,
    setOn,
    setIdleMinutes,
    setEndOnClose
  }
})
