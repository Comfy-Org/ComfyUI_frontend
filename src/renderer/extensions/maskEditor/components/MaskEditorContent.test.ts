import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { assert, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import type { MaskEditorTool } from '@comfyorg/mask-editor/extensionTypes'
import { useMaskEditorExtensionStore } from '@/renderer/extensions/maskEditor/stores/maskEditorExtensionStore'
import { defineComponent } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useMaskEditorDataStore } from '@/renderer/extensions/maskEditor/stores/maskEditorDataStore'
import { useDialogStore } from '@/stores/dialogStore'

import MaskEditorContent from './MaskEditorContent.vue'

const mockBrushPersistence = vi.hoisted(() => ({
  loadAndApply: vi.fn(),
  save: vi.fn()
}))

const mockLoader = vi.hoisted(() => ({
  loadFromNode: vi.fn(async (): Promise<void> => undefined)
}))

vi.mock(
  import('@/renderer/extensions/maskEditor/composables/useBrushPersistence'),
  () => ({ useBrushPersistence: () => mockBrushPersistence })
)

vi.mock(
  import('@/renderer/extensions/maskEditor/composables/useMaskEditorLoader'),
  () => ({ useMaskEditorLoader: () => mockLoader })
)

const canvasError = new Error('canvas initialization failed')
const EditorCanvasStub = defineComponent({
  props: ['baseImage', 'maskImage', 'paintImage', 'brushAdjustment'],
  emits: ['error'],
  setup: () => ({ canvasError }),
  template: `
    <div>
      <img alt="Base" :src="baseImage.src" />
      <img alt="Mask" :src="maskImage.src" />
      <img v-if="paintImage" alt="Paint" :src="paintImage.src" />
      <output aria-label="Brush adjustment">{{ JSON.stringify(brushAdjustment) }}</output>
      <button @click="$emit('error', canvasError)">Fail initialization</button>
      <slot name="extension-tools" />
      <slot name="extension-settings" />
    </div>
  `
})

function renderContent(node = new LGraphNode('Mask editor fixture')) {
  return render(MaskEditorContent, {
    props: { node },
    global: {
      stubs: { EditorCanvas: EditorCanvasStub },
      plugins: [
        createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
      ]
    }
  })
}

function setDecodedImages() {
  const baseImage = new Image()
  baseImage.src = '/base.png'
  const maskImage = new Image()
  maskImage.src = '/mask.png'
  const paintImage = new Image()
  paintImage.src = '/paint.png'
  useMaskEditorDataStore().inputData = {
    baseLayer: { image: baseImage, url: baseImage.src },
    maskLayer: { image: maskImage, url: maskImage.src },
    paintLayer: { image: paintImage, url: paintImage.src },
    sourceRef: { filename: 'base.png' },
    nodeId: toNodeId(1)
  }
}

describe('MaskEditorContent', () => {
  it('hosts registered tool controls and aborts the session when the editor closes', async () => {
    let signal: AbortSignal | undefined
    const tool: MaskEditorTool = {
      id: 'test.canvas-slots',
      label: 'Fixture segmentation',
      createSession(context) {
        signal = context.signal
        return {
          mountPanel(container) {
            container.textContent = 'Segmentation controls'
          }
        }
      }
    }
    const registration = useMaskEditorExtensionStore().registerTool(tool)
    expect(registration.ok).toBe(true)
    setDecodedImages()
    const { unmount } = renderContent()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Fixture segmentation' })
    )

    expect(
      screen.getByRole('button', { name: 'Fixture segmentation' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('Segmentation controls')).toBeInTheDocument()
    assert.exists(signal)
    expect(signal.aborted).toBe(false)

    unmount()

    expect(signal.aborted).toBe(true)
  })

  it('loads the selected node without mounting the canvas before images arrive', () => {
    const node = new LGraphNode('Selected image')
    renderContent(node)

    expect(mockLoader.loadFromNode).toHaveBeenCalledWith(
      node,
      expect.any(AbortSignal)
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('forwards decoded layers and configured brush adjustment to the canvas', async () => {
    vi.mocked(useSettingStore().get)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(2.5)
    renderContent()

    setDecodedImages()

    expect(await screen.findByRole('img', { name: 'Base' })).toHaveAttribute(
      'src',
      'http://localhost:3000/base.png'
    )
    expect(screen.getByRole('img', { name: 'Mask' })).toHaveAttribute(
      'src',
      'http://localhost:3000/mask.png'
    )
    expect(screen.getByRole('img', { name: 'Paint' })).toHaveAttribute(
      'src',
      'http://localhost:3000/paint.png'
    )
    expect(screen.getByLabelText('Brush adjustment')).toHaveTextContent(
      '{"useDominantAxis":true,"brushAdjustmentSpeed":2.5}'
    )
  })

  it('does not mount stale decoded layers while the current load is pending', async () => {
    setDecodedImages()
    let finishLoad = () => {}
    mockLoader.loadFromNode.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishLoad = resolve
        })
    )
    renderContent()

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    finishLoad()

    expect(await screen.findByRole('img', { name: 'Base' })).toBeInTheDocument()
  })

  it('restores brush settings and saves them while clearing app data on unmount', () => {
    const dataStore = useMaskEditorDataStore()
    const { unmount } = renderContent()

    expect(mockBrushPersistence.loadAndApply).toHaveBeenCalledTimes(1)
    unmount()

    expect(mockBrushPersistence.save).toHaveBeenCalledTimes(1)
    expect(dataStore.reset).toHaveBeenCalledTimes(1)
  })

  it('closes the dialog and reports node loading failures', async () => {
    const error = new Error('load failed')
    mockLoader.loadFromNode.mockRejectedValueOnce(error)
    renderContent()

    await waitFor(() =>
      expect(useDialogStore().closeDialog).toHaveBeenCalledTimes(1)
    )
    expect(console.error).toHaveBeenCalledWith(
      '[MaskEditorContent] Initialization failed:',
      error
    )
  })

  it('closes the dialog and reports errors emitted by the canvas', async () => {
    setDecodedImages()
    renderContent()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Fail initialization' })
    )

    expect(useDialogStore().closeDialog).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith(
      '[MaskEditorContent] Initialization failed:',
      canvasError
    )
  })
})
