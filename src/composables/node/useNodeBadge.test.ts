import { render } from '@testing-library/vue'
import { defineComponent, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'
import { app } from '@/scripts/app'

const mocks = vi.hoisted(() => ({
  extensionInstalled: false,
  installNodeBadges: vi.fn(),
  registerExtension: vi.fn()
}))

const badgeMode = ref(false)
const showApiPricingBadge = ref(false)
const pricingRevision = ref(0)
const canvasEventListeners = new Map<string, EventListener>()
const canvas = {
  canvas: {
    addEventListener: vi.fn((name: string, listener: EventListener) => {
      canvasEventListeners.set(name, listener)
    })
  },
  setDirty: vi.fn()
}
let canvasReady = true

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
  useSettingStore: () => ({
    get: (key: string) =>
      key === 'Comfy.NodeBadge.ShowApiPricing'
        ? showApiPricingBadge.value
        : badgeMode.value
  })
}))
vi.mock('@/composables/node/useNodePricing', () => ({
  useNodePricing: () => ({ pricingRevision })
}))
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    get canvas() {
      return canvasReady ? canvas : undefined
    }
  })
}))
vi.mock('@/scripts/app', () => ({
  app: {
    get canvas() {
      return canvasReady ? canvas : undefined
    }
  }
}))

const { useNodeBadge } = await import('./useNodeBadge')

function renderComposable() {
  return render(
    defineComponent({
      setup() {
        useNodeBadge()
        return () => null
      }
    })
  )
}

describe('useNodeBadge', () => {
  beforeEach(() => {
    mocks.extensionInstalled = false
    badgeMode.value = false
    showApiPricingBadge.value = false
    pricingRevision.value = 0
    canvasEventListeners.clear()
    canvasReady = true
  })

  it('keeps the extension-owned provider installed across canvas remounts', async () => {
    const firstMount = renderComposable()
    const extension = mocks.registerExtension.mock.calls[0][0] as ComfyExtension
    await extension.init?.(app)

    firstMount.unmount()

    const secondMount = renderComposable()

    expect(mocks.registerExtension).toHaveBeenCalledOnce()
    expect(mocks.installNodeBadges).toHaveBeenCalledOnce()

    secondMount.unmount()
  })

  it('allows badge settings to change before the canvas is ready', async () => {
    canvasReady = false
    const component = renderComposable()

    badgeMode.value = true
    await nextTick()

    expect(canvas.setDirty).not.toHaveBeenCalled()
    component.unmount()
  })

  it('allows pricing to update before the canvas is ready', async () => {
    showApiPricingBadge.value = true
    canvasReady = false
    const component = renderComposable()

    pricingRevision.value++
    await nextTick()

    expect(canvas.setDirty).not.toHaveBeenCalled()
    component.unmount()
  })

  it('allows the canvas to be removed before a graph event arrives', async () => {
    const component = renderComposable()
    const extension = mocks.registerExtension.mock.calls[0][0] as ComfyExtension
    await extension.init?.(app)
    canvasReady = false

    canvasEventListeners.get('litegraph:set-graph')?.(
      new Event('litegraph:set-graph')
    )

    expect(canvas.setDirty).not.toHaveBeenCalled()
    component.unmount()
  })
})
