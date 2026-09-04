import { describe, expect, it, vi } from 'vitest'

import { useContextKeyStore } from '@/platform/keybindings/contextKeyStore'
import { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { Keybinding } from '@/platform/keybindings/types'
import type { ComfyExtension } from '@/types/comfy'

import { shouldLoadExtension, useExtensionService } from './extensionService'

vi.mock('@/scripts/app', () => ({ app: {} }))
vi.mock('@/scripts/api', () => ({ api: {} }))
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: () => [], addSetting: vi.fn() })
}))

describe('shouldLoadExtension', () => {
  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'skips the inlined Cloud extension %s in cloud builds',
    (extension) => {
      expect(shouldLoadExtension(extension, true)).toBe(false)
    }
  )

  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'keeps the legacy path %s available outside cloud builds',
    (extension) => {
      expect(shouldLoadExtension(extension, false)).toBe(true)
    }
  )

  it('skips core extensions that load through the core entry point', () => {
    expect(shouldLoadExtension('/extensions/core/foo.js', false)).toBe(false)
  })

  it('loads other extensions', () => {
    expect(shouldLoadExtension('/extensions/comfyui-foo/main.js', true)).toBe(
      true
    )
  })
})

describe('registerExtension keybindings', () => {
  it('registers a dialog-scoped keybinding', () => {
    useExtensionService().registerExtension({
      name: 'Test.Scoped',
      keybindings: [
        {
          combo: { key: 'z', ctrl: true },
          commandId: 'Test.MaskUndo',
          dialogKey: 'global-mask-editor'
        }
      ]
    })

    expect(
      useKeybindingStore().getKeybindings(
        new KeyComboImpl({ key: 'z', ctrl: true }),
        'global-mask-editor'
      )[0]?.commandId
    ).toBe('Test.MaskUndo')
  })

  it('rejects a malformed keybinding with a toast and registers nothing', () => {
    const toast = vi.spyOn(useToastStore(), 'add')
    const extension: ComfyExtension = {
      name: 'Test.Broken',
      keybindings: [{ combo: { key: 'k', ctrl: true } } as Keybinding]
    }

    useExtensionService().registerExtension(extension)

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.stringContaining('Test.Broken: invalid keybinding')
      })
    )
    expect(
      useKeybindingStore().getKeybindings(
        new KeyComboImpl({ key: 'k', ctrl: true })
      )
    ).toEqual([])
  })

  it('registers context keys under the extension name', () => {
    useExtensionService().registerExtension({
      name: 'Test.Keys',
      contextKeys: ['wasdMode']
    })

    const contextKeys = useContextKeyStore()
    expect(contextKeys.ownerOf('Test.Keys.wasdMode')).toBe('Test.Keys')
    expect(contextKeys.set('Test.Keys.wasdMode', true)).toBe(true)
  })

  it('rejects contextKeys that are not a list of names', () => {
    const toast = vi.spyOn(useToastStore(), 'add')
    const extension: ComfyExtension = {
      name: 'Test.BadKeys',
      contextKeys: { wasdMode: true } as unknown as string[]
    }

    useExtensionService().registerExtension(extension)

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.stringContaining('Test.BadKeys')
      })
    )
    expect(useContextKeyStore().ownerOf('Test.BadKeys.wasdMode')).toBe(
      undefined
    )
  })

  it('rejects a keybinding whose when clause does not parse', () => {
    const toast = vi.spyOn(useToastStore(), 'add')

    useExtensionService().registerExtension({
      name: 'Test.BadWhen',
      keybindings: [
        { combo: { key: 'w' }, commandId: 'Test.Pan', when: 'a || b' }
      ]
    })

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.stringContaining('Invalid when clause')
      })
    )
    expect(
      useKeybindingStore().getKeybindings(new KeyComboImpl({ key: 'w' }))
    ).toEqual([])
  })
})
