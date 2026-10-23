import { describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { useToast } from '@/components/ui/toast/toastStore'
import { useExtensionStore } from '@/stores/extensionStore'

import { disableAgentExtensions } from './agentExtensionService'

vi.mock(import('@/platform/telemetry/reportError'))

describe('disableAgentExtensions', () => {
  it('persists one disable strategy per extension before reloading', async () => {
    const extensionStore = useExtensionStore()
    const settingStore = useSettingStore()
    extensionStore.loadExtensionPackPaths(['/extensions/cushions/'], [])
    const packed = { name: 'agent.cushions.toolbar' }
    const standalone = {
      name: 'manual.toolbar',
      provenance: { createdBy: 'comfy-agent' as const }
    }
    const setSettings = vi.spyOn(settingStore, 'setMany').mockResolvedValue()
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()

    const disabled = await disableAgentExtensions([packed, standalone])

    expect(disabled).toBe(true)
    expect(setSettings).toHaveBeenCalledExactlyOnceWith({
      'Comfy.Extension.Disabled': ['manual.toolbar'],
      'Comfy.Extension.DisabledPacks': ['/extensions/cushions/']
    })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reports a failed disable once and returns a handled failure', async () => {
    const failure = new Error('settings unavailable')
    vi.spyOn(useSettingStore(), 'setMany').mockRejectedValue(failure)

    const disabled = await disableAgentExtensions([
      { name: 'agent.cushions.toolbar' }
    ])

    expect(disabled).toBe(false)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
      errorType: 'failure_disabling_agent_extension',
      surface: 'platform',
      context: { extension_names: ['agent.cushions.toolbar'] }
    })
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'error',
        title: "Couldn't disable the extension. Try again."
      })
    ])
  })
})
