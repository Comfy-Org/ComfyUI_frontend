import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KeybindingImpl } from '@comfyorg/keybindings/keybinding'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'
import { registerCoreKeybindingCommands } from '@/platform/keybindings/__fixtures__/registerCoreKeybindingCommands'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSuperComfyNavigationStore } from '@/platform/superComfy/stores/superComfyNavigationStore'

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    canvas: null
  }
}))

function keydown(
  key: string,
  modifiers: { ctrlKey?: boolean; altKey?: boolean } = {}
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers
  })
  event.composedPath = vi.fn(() => [document.body])
  return event
}

describe('keybindingService while SuperComfy is open', () => {
  beforeEach(() => {
    vi.mocked(useSettingStore().get).mockImplementation(() => [])
    vi.mocked(useCommandStore().execute).mockResolvedValue(undefined)
    registerCoreKeybindingCommands()
    vi.mocked(useFeatureFlags().flags).superComfyEnabled = true
  })

  it('queues the workflow on Ctrl+Enter while SuperComfy is closed', async () => {
    const service = useKeybindingService()
    service.registerCoreKeybindings()

    await service.keybindHandler(keydown('Enter', { ctrlKey: true }))

    expect(useCommandStore().execute).toHaveBeenCalledWith(
      'Comfy.QueuePrompt',
      { metadata: { trigger_source: 'keybinding' } }
    )
  })

  it('never queues the hidden workflow on Ctrl+Enter while SuperComfy is open', async () => {
    useSuperComfyNavigationStore().open()
    const service = useKeybindingService()
    service.registerCoreKeybindings()

    await service.keybindHandler(keydown('Enter', { ctrlKey: true }))

    expect(useCommandStore().execute).not.toHaveBeenCalled()
  })

  it('still toggles SuperComfy from its own keybinding', async () => {
    useCommandStore().registerCommand({
      id: 'Comfy.ToggleSuperComfy',
      function: () => {}
    })
    useKeybindingStore().addDefaultKeybinding(
      new KeybindingImpl({
        commandId: 'Comfy.ToggleSuperComfy',
        combo: { key: 's', alt: true }
      })
    )
    useSuperComfyNavigationStore().open()

    await useKeybindingService().keybindHandler(keydown('s', { altKey: true }))

    expect(useCommandStore().execute).toHaveBeenCalledWith(
      'Comfy.ToggleSuperComfy'
    )
  })
})
