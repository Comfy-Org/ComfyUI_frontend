import { describe, expect, it, vi } from 'vitest'

import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/platform/settings/types'
import { api } from '@/scripts/api'

import { useAgentExtensionActions } from './useAgentExtensionActions'

vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry/reportError'))

const EXTENSION = {
  name: 'agent.tools.sidebar',
  provenance: { createdBy: 'comfy-agent' as const }
}

async function loadSettings(values: Partial<Settings> = {}) {
  const settingStore = useSettingStore()
  vi.mocked(api.getSettings).mockResolvedValue(values as Settings)
  await settingStore.load()
  // Core registers this setting at boot; the change event only fires for a
  // registered setting, which is what the extension-facing bridge consumes.
  settingStore.addSetting({
    id: 'Comfy.Extension.Disabled',
    name: 'Disabled extension names',
    type: 'hidden',
    defaultValue: [] as string[]
  })
  return settingStore
}

describe('useAgentExtensionActions', () => {
  it('persists the disable, publishes it locally, then reloads', async () => {
    const settingStore = await loadSettings()
    vi.mocked(api.storeSetting).mockResolvedValue(new Response())
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()
    const changed = vi.fn()
    settingStore.onSettingChanged(changed)
    useExtensionStore().registerExtension(EXTENSION)

    await expect(
      useAgentExtensionActions().disableExtension(EXTENSION)
    ).resolves.toBe(true)

    expect(api.storeSetting).toHaveBeenCalledExactlyOnceWith(
      'Comfy.Extension.Disabled',
      ['agent.tools.sidebar']
    )
    expect(settingStore.settingValues['Comfy.Extension.Disabled']).toEqual([
      'agent.tools.sidebar'
    ])
    // The canonical change event is what the extension-facing `<id>.change`
    // bridge listens to, so a direct store assignment would silently drop it.
    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'Comfy.Extension.Disabled' })
    )
    expect(reload).toHaveBeenCalledOnce()
  })

  it('applies a saved-but-unapplied disable without writing the name twice', async () => {
    await loadSettings({
      'Comfy.Extension.Disabled': ['agent.tools.sidebar']
    })
    vi.mocked(api.storeSetting).mockResolvedValue(new Response())
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()
    // Saved while the extension kept running: the runtime disabled set is
    // snapshotted at load, so it is still registered and active.
    useExtensionStore().registerExtension(EXTENSION)

    await expect(
      useAgentExtensionActions().disableExtension(EXTENSION)
    ).resolves.toBe(true)

    expect(api.storeSetting).not.toHaveBeenCalled()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('does nothing when the extension is already disabled at runtime', async () => {
    await loadSettings({
      'Comfy.Extension.Disabled': ['agent.tools.sidebar']
    })
    vi.mocked(api.storeSetting).mockResolvedValue(new Response())
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()
    useExtensionStore().loadDisabledExtensionNames(['agent.tools.sidebar'])

    await expect(
      useAgentExtensionActions().disableExtension(EXTENSION)
    ).resolves.toBe(false)

    expect(api.storeSetting).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })
})
