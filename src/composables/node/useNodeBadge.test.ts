import { render } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'
import { app } from '@/scripts/app'

import { useNodeBadge } from './useNodeBadge'

const mocks = vi.hoisted(() => ({
  disposeNodeBadges: vi.fn(),
  installNodeBadges: vi.fn(),
  registerExtension: vi.fn()
}))

vi.mock('@/systems/badgeSystem', () => ({
  installNodeBadges: mocks.installNodeBadges
}))
vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: () => ({
    isExtensionInstalled: () => false,
    registerExtension: mocks.registerExtension
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
    mocks.installNodeBadges.mockReturnValue(mocks.disposeNodeBadges)
  })

  it('disposes the legacy badge provider when its owner unmounts', async () => {
    const { unmount } = render(
      defineComponent({
        setup() {
          useNodeBadge()
          return () => null
        }
      })
    )
    const extension = mocks.registerExtension.mock.calls[0][0] as ComfyExtension
    await extension.init?.(app)

    unmount()

    expect(mocks.disposeNodeBadges).toHaveBeenCalledOnce()
  })
})
