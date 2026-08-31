import { render } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'
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
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: () => false })
}))
vi.mock('@/composables/node/useNodePricing', () => ({
  useNodePricing: () => ({ pricingRevision: { value: 0 } })
}))
vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      canvas: { addEventListener: vi.fn() },
      setDirty: vi.fn()
    }
  }
}))

describe('useNodeBadge', () => {
  beforeEach(() => {
    mocks.extensionInstalled = false
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
