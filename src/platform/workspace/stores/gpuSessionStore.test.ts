import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useGpuSessionStore } from '@/platform/workspace/stores/gpuSessionStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@comfyorg/telemetry/reportError'))

type GpuSessionStore = ReturnType<typeof useGpuSessionStore>

function deploymentWithGpu(
  deploymentId: string,
  gpuFields: Record<string, unknown> = {
    editor_gpu: true,
    can_change_editor_gpu: true
  }
) {
  return {
    deployment_id: deploymentId,
    release_id: 'r-1',
    status: 'ready',
    can_start: false,
    created_at: '2026-10-01T00:00:00Z',
    ...gpuFields
  }
}

function storeForPicked(gpuFields: Record<string, unknown>) {
  const pick = useDeploymentPickStore()
  Object.assign(pick, {
    pickedDeployment: deploymentWithGpu('dep-1', gpuFields)
  })
  vi.spyOn(pick, 'load').mockResolvedValue(undefined)
  Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
  return useGpuSessionStore()
}

const OFF_AND_CHANGEABLE = { editor_gpu: false, can_change_editor_gpu: true }

function gpuStarting(gpu: string) {
  return new Response(JSON.stringify({ code: 'gpu_starting', gpu }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  })
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

/** Sends a `gpu_session` socket message to the listener the store installed. */
function socketSays(detail: Record<string, unknown>) {
  const listener = vi
    .mocked(api.addCustomEventListener)
    .mock.calls.find(([type]) => type === 'gpu_session')?.[1]
  listener?.(new CustomEvent('gpu_session', { detail }))
}

describe('useGpuSessionStore', () => {
  it('drops late answers to requests sent for the deployment picked before', async () => {
    const answers: Array<(response: Response) => void> = []
    const send = vi.mocked(fetch)
    send.mockImplementation(
      () => new Promise((resolve) => answers.push(resolve))
    )
    const pick = useDeploymentPickStore()
    Object.assign(pick, { pickedDeployment: deploymentWithGpu('dep-a') })
    const store = useGpuSessionStore()
    store.install()

    const answeredOff = fetch('/example_pack/preview')
    const answeredStarting = fetch('/example_pack/preview')
    Object.assign(pick, { pickedDeployment: deploymentWithGpu('dep-b') })
    await nextTick()
    answers[0](gpuStarting('off'))
    answers[1](gpuStarting('starting'))
    await flushPromises()

    expect(store.settings?.on).toBe(true)
    expect(store.status).toBeNull()

    socketSays({
      session_id: 's-b',
      deployment_id: 'dep-b',
      state: 'ready',
      runs: []
    })

    await expect(answeredOff).resolves.toHaveProperty('status', 503)
    await expect(answeredStarting).resolves.toHaveProperty('status', 503)
    expect(send).toHaveBeenCalledTimes(2)
    expect(store.status).toBe('on')
    expect(store.session).toMatchObject({ session_id: 's-b', state: 'ready' })
  })

  it.for([
    { name: 'turned off while it started', turnOnFirst: true, end: 'save' },
    { name: 'turned off before it started', turnOnFirst: false, end: 'save' },
    { name: 'ended by the server', turnOnFirst: false, end: 'socket' }
  ] as const)(
    'does not hold a request whose starting answer arrives after the GPU was $name',
    async ({ turnOnFirst, end }) => {
      const answers: Array<(response: Response) => void> = []
      const send = vi.mocked(fetch)
      send.mockImplementation(
        () => new Promise((resolve) => answers.push(resolve))
      )
      vi.mocked(workspaceApi.setEditorGpu).mockResolvedValue('starting')
      const store = storeForPicked(OFF_AND_CHANGEABLE)
      store.install()
      if (turnOnFirst) await store.setOn(true)

      const answered = fetch('/example_pack/preview')
      if (end === 'save') await store.setOn(false)
      else {
        socketSays({
          session_id: 's-1',
          deployment_id: 'dep-1',
          state: 'ended',
          reason: 'idle',
          runs: []
        })
      }
      answers[0](gpuStarting('starting'))

      await expect(answered).resolves.toHaveProperty('status', 503)
      expect(send).toHaveBeenCalledOnce()
      expect(store.status).toBeNull()
    }
  )

  it.for([
    { name: 'another session keeps it on', listed: true },
    { name: 'it was the last session', listed: false }
  ])(
    'after an idle end the toggle shows the setting the listing reports when $name',
    ({ listed }) => {
      const store = storeForPicked({
        editor_gpu: true,
        can_change_editor_gpu: true
      })
      const pick = useDeploymentPickStore()
      store.install()

      socketSays({
        session_id: 's-1',
        deployment_id: 'dep-1',
        state: 'ended',
        reason: 'idle',
        runs: []
      })

      expect(store.settings?.on).toBe(true)
      expect(pick.load).toHaveBeenCalledOnce()

      Object.assign(pick, {
        pickedDeployment: deploymentWithGpu('dep-1', {
          editor_gpu: listed,
          can_change_editor_gpu: true
        }),
        shownListing: 1
      })

      expect(store.settings?.on).toBe(listed)
    }
  )

  it('lets a held request go with its answer when the store is disposed', async () => {
    const send = vi.mocked(fetch)
    send.mockResolvedValue(gpuStarting('starting'))
    vi.mocked(workspaceApi.setEditorGpu).mockResolvedValue('starting')
    const store = storeForPicked(OFF_AND_CHANGEABLE)
    store.install()
    await store.setOn(true)

    const held = fetch('/example_pack/preview')
    await flushPromises()
    store.$dispose()

    await expect(held).resolves.toHaveProperty('status', 503)
    expect(send).toHaveBeenCalledOnce()
  })

  it('puts the page fetch and the socket listener back when the store is disposed', () => {
    const pageFetch = window.fetch
    const store = storeForPicked(OFF_AND_CHANGEABLE)
    store.install()
    expect(window.fetch).not.toBe(pageFetch)

    store.$dispose()

    expect(window.fetch).toBe(pageFetch)
    expect(api.removeCustomEventListener).toHaveBeenCalledWith(
      'gpu_session',
      expect.any(Function)
    )
  })

  it.for([
    {
      name: 'a reload shows another tab saved 3',
      listed: 3,
      askedBeforeSave: 0,
      landed: 1,
      shown: 3
    },
    {
      name: 'a reload shows another tab put back 10',
      listed: 10,
      askedBeforeSave: 0,
      landed: 1,
      shown: 10
    },
    {
      name: 'a listing asked before the save lands',
      listed: 3,
      askedBeforeSave: 5,
      landed: 4,
      shown: 30
    },
    {
      name: 'a later listing lands after the reload failed',
      listed: 3,
      askedBeforeSave: 5,
      landed: 6,
      shown: 3
    }
  ])(
    'after saving 30 idle minutes, when $name the editor shows $shown',
    async ({ listed, askedBeforeSave, landed, shown }) => {
      const store = storeForPicked(OFF_AND_CHANGEABLE)
      const pick = useDeploymentPickStore()
      vi.spyOn(pick, 'listingsAsked').mockReturnValue(askedBeforeSave)
      await store.setIdleMinutes(30)

      Object.assign(pick, {
        pickedDeployment: deploymentWithGpu('dep-1', {
          ...OFF_AND_CHANGEABLE,
          editor_gpu_idle_minutes: listed
        }),
        shownListing: landed
      })

      expect(pick.load).toHaveBeenCalledOnce()
      expect(store.settings?.idleMinutes).toBe(shown)
    }
  )

  it.for([
    {
      name: 'no editor_gpu',
      gpuFields: {},
      available: false,
      canChange: false
    },
    {
      name: 'editor_gpu alone',
      gpuFields: { editor_gpu: false },
      available: true,
      canChange: false
    },
    {
      name: 'editor_gpu and can_change_editor_gpu',
      gpuFields: OFF_AND_CHANGEABLE,
      available: true,
      canChange: true
    }
  ])(
    'with $name the toggle is available: $available, changeable: $canChange',
    ({ gpuFields, available, canChange }) => {
      const store = storeForPicked(gpuFields)

      expect(store.available).toBe(available)
      expect(store.canChange).toBe(canChange)
    }
  )

  it('turning the GPU on saves it and shows the GPU starting', async () => {
    vi.mocked(workspaceApi.setEditorGpu).mockResolvedValue('starting')
    const store = storeForPicked(OFF_AND_CHANGEABLE)

    await expect(store.setOn(true)).resolves.toBeNull()

    expect(workspaceApi.setEditorGpu).toHaveBeenCalledWith('ws-1', 'dep-1', {
      on: true
    })
    expect(store.settings?.on).toBe(true)
    expect(store.status).toBe('starting')
  })

  it.for([
    {
      name: 'idle minutes',
      save: (store: GpuSessionStore) => store.setIdleMinutes(30),
      change: { idle_minutes: 30 },
      saved: { idleMinutes: 30 }
    },
    {
      name: 'close setting',
      save: (store: GpuSessionStore) => store.setEndOnClose(false),
      change: { end_on_close: false },
      saved: { endOnClose: false }
    }
  ])('saves the $name and shows it saved', async ({ save, change, saved }) => {
    const store = storeForPicked(OFF_AND_CHANGEABLE)

    await expect(save(store)).resolves.toBeNull()

    expect(workspaceApi.setEditorGpu).toHaveBeenCalledWith(
      'ws-1',
      'dep-1',
      change
    )
    expect(store.settings).toMatchObject(saved)
  })

  it.for([
    {
      name: 'a 403',
      error: new WorkspaceApiError('Forbidden', 403),
      refusal: 'ownerOnly',
      reports: 0
    },
    {
      name: 'a timeout',
      error: new Error('timeout of 15000ms exceeded'),
      refusal: 'failed',
      reports: 1
    }
  ])(
    'a save that fails with $name answers $refusal and leaves the GPU off',
    async ({ error, refusal, reports }) => {
      vi.mocked(workspaceApi.setEditorGpu).mockRejectedValue(error)
      const store = storeForPicked(OFF_AND_CHANGEABLE)

      await expect(store.setOn(true)).resolves.toBe(refusal)

      expect(store.settings?.on).toBe(false)
      expect(store.saving).toBe(false)
      expect(reportError).toHaveBeenCalledTimes(reports)
    }
  )
})
