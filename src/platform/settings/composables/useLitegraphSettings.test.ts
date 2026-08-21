import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useLitegraphSettings } from '@/platform/settings/composables/useLitegraphSettings'
import { useSettingStore } from '@/platform/settings/settingStore'
// Mirrors the exemption in the composable under test.
// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

// The composable drives many settings off one canvas; only `show_info` matters
// here, the rest are present so the other effects don't throw.
const canvas = {
  show_info: false,
  zoom_speed: 1,
  auto_pan_speed: 1,
  links_render_mode: 0,
  min_font_size_for_lod: 0,
  draw: vi.fn(),
  setDirty: vi.fn()
}

const settings = ref<Record<string, unknown>>({})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: (key: string) => settings.value[key]
  }))
}))

function run() {
  const scope = effectScope()
  scope.run(() => useLitegraphSettings())
  return scope
}

describe('useLitegraphSettings', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    settings.value = {
      'Comfy.Graph.CanvasInfo': true,
      'Comfy.Graph.ZoomSpeed': 1,
      'Comfy.Graph.AutoPanSpeed': 1
    }
    canvas.show_info = false
    vi.mocked(useSettingStore).mockClear()
    useCanvasStore().canvas = canvas as never
  })

  it('applies the canvas info setting', () => {
    run()

    expect(canvas.show_info).toBe(true)
  })

  // The overlay is drawn onto the canvas rather than composed in the DOM, so it
  // cannot be hidden with CSS alongside the rest of the chrome.
  it('suppresses the canvas info overlay during node selection mode', async () => {
    const nodeSelectionStore = useAgentNodeSelectionStore()
    run()
    expect(canvas.show_info).toBe(true)

    nodeSelectionStore.isActive = true
    await nextTick()

    expect(canvas.show_info).toBe(false)
  })

  it('restores the overlay on exit without touching the user setting', async () => {
    const nodeSelectionStore = useAgentNodeSelectionStore()
    run()

    nodeSelectionStore.isActive = true
    await nextTick()
    nodeSelectionStore.isActive = false
    await nextTick()

    expect(canvas.show_info).toBe(true)
    expect(settings.value['Comfy.Graph.CanvasInfo']).toBe(true)
  })

  it('leaves the overlay off during the mode when the setting is disabled', async () => {
    const nodeSelectionStore = useAgentNodeSelectionStore()
    settings.value['Comfy.Graph.CanvasInfo'] = false
    run()

    nodeSelectionStore.isActive = true
    await nextTick()
    expect(canvas.show_info).toBe(false)

    nodeSelectionStore.isActive = false
    await nextTick()
    expect(canvas.show_info).toBe(false)
  })
})
