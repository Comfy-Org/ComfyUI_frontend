import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { useToast } from '@/components/ui/toast/toastStore'
import { useExtensionStore } from '@/stores/extensionStore'

import { disableAgentExtensions } from './agentExtensionService'

vi.mock(import('@/platform/telemetry/reportError'))

vi.mock(import('@/scripts/api'))

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (error: unknown) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('disableAgentExtensions', () => {
  let extensionStore: ReturnType<typeof useExtensionStore>
  let settingStore: ReturnType<typeof useSettingStore>

  beforeEach(() => {
    extensionStore = useExtensionStore()
    settingStore = useSettingStore()
    settingStore.$patch({
      settingValues: {
        'Comfy.Extension.Disabled': ['previous.toolbar'],
        'Comfy.Extension.DisabledPacks': ['/extensions/missing/']
      }
    })
    extensionStore.loadExtensionPackPaths(['/extensions/cushions/'], [])
    vi.mocked(api.storeSettings).mockResolvedValue(new Response())
  })

  const packed = { name: 'agent.cushions.toolbar' }
  const standalone = {
    name: 'manual.toolbar',
    provenance: { createdBy: 'comfy-agent' as const }
  }

  it('persists one disable strategy per extension before reloading', async () => {
    const pending = createDeferred<Response>()
    vi.mocked(api.storeSettings).mockReturnValue(pending.promise)
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()

    const disabling = disableAgentExtensions([
      packed,
      standalone,
      { name: 'pysssss.Locking', provenance: { createdBy: 'comfy-agent' } }
    ])
    try {
      await vi.waitFor(() => expect(api.storeSettings).toHaveBeenCalledOnce())
      expect(reload).not.toHaveBeenCalled()

      pending.resolve(new Response())
      expect(await disabling).toBe(true)

      expect(api.storeSettings).toHaveBeenCalledExactlyOnceWith({
        'Comfy.Extension.Disabled': ['previous.toolbar', 'manual.toolbar'],
        'Comfy.Extension.DisabledPacks': [
          '/extensions/missing/',
          '/extensions/cushions/'
        ]
      })
      expect(reload).toHaveBeenCalledOnce()
    } finally {
      pending.resolve(new Response())
      await disabling
    }
  })

  it('waits for a later queued name edit before reloading', async () => {
    const batchResponse = createDeferred<Response>()
    const nameResponse = createDeferred<Response>()
    vi.mocked(api.storeSettings).mockReturnValue(batchResponse.promise)
    vi.mocked(api.storeSetting).mockReturnValue(nameResponse.promise)
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()

    const disabling = disableAgentExtensions([standalone])
    let nameEdit: ReturnType<
      typeof extensionStore.setExtensionEnabledStates
    > | null = null
    try {
      await vi.waitFor(() => expect(api.storeSettings).toHaveBeenCalledOnce())
      nameEdit = extensionStore.setExtensionEnabledStates({
        'Manual.Toolbar': false
      })

      batchResponse.resolve(new Response())
      await vi.waitFor(() => expect(api.storeSetting).toHaveBeenCalledOnce())
      expect(reload).not.toHaveBeenCalled()

      nameResponse.resolve(new Response())
      await expect(nameEdit).resolves.toEqual({ ok: true, outcome: 'saved' })
      await expect(disabling).resolves.toBe(true)
      expect(reload).toHaveBeenCalledOnce()
    } finally {
      batchResponse.resolve(new Response())
      nameResponse.resolve(new Response())
      await Promise.allSettled([disabling, ...(nameEdit ? [nameEdit] : [])])
    }
  })

  it('reports an unreachable disable once and does not reload', async () => {
    const failure = new Error('settings unavailable')
    vi.mocked(api.storeSettings).mockRejectedValue(failure)
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()

    const disabled = await disableAgentExtensions([packed])

    expect(disabled).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure.message, {
      errorType: 'failure_disabling_agent_extension',
      surface: 'platform',
      tags: { reason: 'unreachable' },
      context: { extension_names: ['agent.cushions.toolbar'] }
    })
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'error',
        title: "Couldn't disable the extension. Try again."
      })
    ])
  })

  it('treats a refused response as a failure and restores both lists', async () => {
    vi.mocked(api.storeSettings).mockResolvedValue(
      new Response(null, { status: 500, statusText: 'Server Error' })
    )
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()

    const disabled = await disableAgentExtensions([packed, standalone])

    expect(disabled).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    expect(settingStore.get('Comfy.Extension.Disabled')).toEqual([
      'previous.toolbar'
    ])
    expect(settingStore.get('Comfy.Extension.DisabledPacks')).toEqual([
      '/extensions/missing/'
    ])
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      '500 Server Error',
      expect.objectContaining({ tags: { reason: 'refused' } })
    )
  })

  it('refuses a duplicate pending disable and permits retry after failure', async () => {
    const pending = createDeferred<Response>()
    vi.mocked(api.storeSettings)
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(new Response())
    vi.spyOn(window.location, 'reload').mockReturnValue()

    const first = disableAgentExtensions([packed])
    try {
      await vi.waitFor(() => expect(api.storeSettings).toHaveBeenCalledOnce())
      await expect(disableAgentExtensions([packed])).resolves.toBe(false)
      expect(api.storeSettings).toHaveBeenCalledOnce()

      pending.reject(new Error('settings unavailable'))
      await expect(first).resolves.toBe(false)

      await expect(disableAgentExtensions([packed])).resolves.toBe(true)
      expect(api.storeSettings).toHaveBeenCalledTimes(2)
    } finally {
      pending.resolve(new Response())
      await first
    }
  })
})
