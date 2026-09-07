import { render } from '@testing-library/vue'
import { defineComponent, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'

import { useNodeBadge } from './useNodeBadge'

const mocks = vi.hoisted(() => ({
  extensionInstalled: false,
  installNodeBadges: vi.fn(),
  registerExtension: vi.fn()
}))

vi.mock('@/systems/badgeSystem', () => ({
  installNodeBadges: mocks.installNodeBadges
}))
vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: () => ({
    isExtensionInstalled: () => mocks.extensionInstalled,
    registerExtension: (extension: ComfyExtension) => {
      mocks.extensionInstalled = true
      mocks.registerExtension(extension)
    }
  })
}))
vi.mock('@/composables/node/useNodePricing', () => ({
  useNodePricing: () => ({ pricingRevision: { value: 0 } })
}))
vi.mock('@/scripts/app', () => ({
  app: {
    ui: { settings: { dispatchChange: vi.fn() } },
    canvas: {
      canvas: document.createElement('canvas'),
      setDirty: vi.fn()
    }
  }
}))

describe('useNodeBadge', () => {
  beforeEach(() => {
    mocks.extensionInstalled = false
  })

  it('defers badge redraws until the canvas is ready and stops on unmount', async () => {
    const settings = useSettingStore()
    const canvasStore = useCanvasStore()
    const canvas = app.canvas
    const view = render(
      defineComponent({
        setup() {
          useNodeBadge()
          return () => null
        }
      })
    )

    try {
      Reflect.set(app, 'canvas', undefined)
      settings.addSetting({
        id: 'Comfy.NodeBadge.ShowApiPricing',
        name: 'Show API pricing',
        type: 'boolean',
        defaultValue: true
      })
      await expect(nextTick()).resolves.toBeUndefined()
      expect(canvas.setDirty).not.toHaveBeenCalled()

      app.canvas = canvas
      canvasStore.canvas = canvas
      await nextTick()
      expect(canvas.setDirty).toHaveBeenCalledExactlyOnceWith(true, true)

      settings.settingValues['Comfy.NodeBadge.ShowApiPricing'] = false
      await nextTick()
      expect(canvas.setDirty).toHaveBeenCalledTimes(2)

      view.unmount()
      settings.settingValues['Comfy.NodeBadge.ShowApiPricing'] = true
      await nextTick()
      expect(canvas.setDirty).toHaveBeenCalledTimes(2)
    } finally {
      view.unmount()
      app.canvas = canvas
      canvasStore.canvas = null
      canvasStore.$dispose()
    }
  })

  it('keeps the extension-owned provider installed across canvas remounts', async () => {
    const firstMount = render(
      defineComponent({
        setup() {
          useNodeBadge()
          return () => null
        }
      })
    )
    const extension = mocks.registerExtension.mock.calls[0][0] as ComfyExtension
    await extension.init?.(app)

    firstMount.unmount()

    const secondMount = render(
      defineComponent({
        setup() {
          useNodeBadge()
          return () => null
        }
      })
    )

    expect(mocks.registerExtension).toHaveBeenCalledOnce()
    expect(mocks.installNodeBadges).toHaveBeenCalledOnce()

    secondMount.unmount()
  })
})
