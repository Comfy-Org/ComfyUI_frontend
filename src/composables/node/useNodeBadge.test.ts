import { render } from '@testing-library/vue'
import { defineComponent, nextTick, ref, toRef } from 'vue'
import type { Ref } from 'vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { fromPartial } from '@total-typescript/shoehorn'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { NodeBadgeMode } from '@/types/nodeSource'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/scripts/app'

const mocks = vi.hoisted(() => ({
  installNodeBadges: vi.fn()
}))

let badgeMode: Ref<string | undefined>
let showApiPricingBadge: Ref<boolean | undefined>
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
let canvasStore: ReturnType<typeof useCanvasStore>

vi.mock(import('@/systems/badgeSystem'), () => ({
  installNodeBadges: mocks.installNodeBadges
}))
vi.mock<unknown>(import('@/composables/node/useNodePricing'), () => ({
  useNodePricing: () => ({ pricingRevision })
}))
vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    get canvas() {
      return canvasStore.canvas
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
    const settings = useSettingStore().settingValues
    badgeMode = toRef(settings, 'Comfy.NodeBadge.NodeIdBadgeMode')
    showApiPricingBadge = toRef(settings, 'Comfy.NodeBadge.ShowApiPricing')
    canvasStore = useCanvasStore()
    badgeMode.value = NodeBadgeMode.None
    showApiPricingBadge.value = false
    pricingRevision.value = 0
    canvasEventListeners.clear()
    canvasStore.canvas = fromPartial<LGraphCanvas>(canvas)
  })

  it('keeps the extension-owned provider installed across canvas remounts', async () => {
    const firstMount = renderComposable()
    const extension = vi.mocked(useExtensionStore().registerExtension).mock
      .calls[0][0]
    await extension.init?.(app)

    firstMount.unmount()

    const secondMount = renderComposable()

    expect(useExtensionStore().registerExtension).toHaveBeenCalledOnce()
    expect(mocks.installNodeBadges).toHaveBeenCalledOnce()

    secondMount.unmount()
  })

  it('allows badge settings to change before the canvas is ready', async () => {
    canvasStore.canvas = null
    const component = renderComposable()

    badgeMode.value = NodeBadgeMode.ShowAll
    await nextTick()

    expect(canvas.setDirty).not.toHaveBeenCalled()

    canvasStore.canvas = fromPartial<LGraphCanvas>(canvas)
    badgeMode.value = NodeBadgeMode.None
    await nextTick()

    expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
    component.unmount()
  })

  it('allows pricing to update before the canvas is ready', async () => {
    showApiPricingBadge.value = true
    canvasStore.canvas = null
    const component = renderComposable()

    pricingRevision.value++
    await nextTick()

    expect(canvas.setDirty).not.toHaveBeenCalled()

    canvasStore.canvas = fromPartial<LGraphCanvas>(canvas)
    pricingRevision.value++
    await nextTick()

    expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
    component.unmount()
  })

  it('allows the canvas to be removed before a graph event arrives', async () => {
    const component = renderComposable()
    const extension = vi.mocked(useExtensionStore().registerExtension).mock
      .calls[0][0]
    await extension.init?.(app)
    canvasStore.canvas = null

    canvasEventListeners.get('litegraph:set-graph')?.(
      new Event('litegraph:set-graph')
    )

    expect(canvas.setDirty).not.toHaveBeenCalled()

    canvasStore.canvas = fromPartial<LGraphCanvas>(canvas)
    canvasEventListeners.get('litegraph:set-graph')?.(
      new Event('litegraph:set-graph')
    )

    expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
    component.unmount()
  })
})
