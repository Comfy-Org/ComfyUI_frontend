import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import LayerEditorContent from '@/components/layerEditor/LayerEditorContent.vue'
import TopBarHeader from '@/components/layerEditor/dialog/TopBarHeader.vue'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { toNodeId } from '@/types/nodeId'

const { saveComposite, session } = vi.hoisted(() => ({
  saveComposite: vi.fn().mockResolvedValue(undefined),
  session: {
    dispose: vi.fn(),
    editor: { history: { clear: vi.fn() } },
    imageLayers: { value: [] },
    loadImages: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('@/composables/layerEditor/useLayerEditorSession', () => ({
  useLayerEditorSession: () => session
}))
vi.mock('@/composables/compositor/useCompositorSaver', () => ({
  useCompositorSaver: () => ({ saveComposite })
}))
vi.mock('@/composables/compositor/useCompositorLayers', () => ({
  getCompositorBBoxes: () => [],
  getCompositorInputsFingerprint: () => [],
  getCompositorLayers: () => []
}))
vi.mock('@/composables/compositor/compositorLayerState', () => ({
  applyLayerState: vi.fn(),
  parseLayerState: () => null,
  resolveInitialLayerState: () => null
}))
vi.mock('@/composables/compositor/compositorWidgets', () => ({
  getCompositorWidgetValue: () => ''
}))
vi.mock('@/scripts/api', () => ({
  api: { apiURL: (url: string) => url }
}))
vi.mock('@/scripts/app', () => ({
  app: { getRandParam: () => '' }
}))
vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({ getNodeImageUrls: () => [] })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { cancel: 'Cancel', save: 'Save' },
      layerEditor: { title: 'Layer Editor' }
    }
  }
})

describe('LayerEditorContent', () => {
  const node = { id: toNodeId(1) } as unknown as LGraphNode

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('places Save in the header and saves the composite', async () => {
    const user = userEvent.setup()
    render(TopBarHeader, { global: { plugins: [i18n] } })
    render(LayerEditorContent, {
      props: { node, mode: 'compositor' },
      global: {
        plugins: [i18n],
        stubs: {
          LayerEditorCanvas: true,
          LayerEditorToolbar: true,
          LayerPanel: true,
          LayerPropertiesPanel: true
        }
      }
    })

    const saveButton = await within(screen.getByRole('group')).findByRole(
      'button',
      {
        name: 'Save'
      }
    )
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()

    await user.click(saveButton)

    expect(saveComposite).toHaveBeenCalledWith(session, node)
  })
})
