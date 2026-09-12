import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      cameraAngle: {
        cameraView: 'Camera',
        objectView: 'Object',
        cameraViewTooltip: 'Move the camera',
        objectViewTooltip: 'Turn the subject',
        horizontalLabel: 'Horizontal angle',
        verticalLabel: 'Vertical angle',
        zoomLabel: 'Shot size',
        preview: 'Preview',
        showPreview: 'Show shot preview',
        hidePreview: 'Hide shot preview',
        horizontal: { front: 'Front', back: 'Back' },
        vertical: { eyeLevel: 'Eye level', highAngle: 'High angle' },
        zoom: { medium: 'Medium shot', closeUp: 'Close-up' },
        faces: {
          back: 'BACK',
          left: 'LEFT',
          right: 'RIGHT',
          top: 'TOP',
          bottom: 'BOTTOM'
        }
      }
    }
  }
})

type ApiMocks = Record<string, ReturnType<typeof vi.fn>>

const holder = vi.hoisted(() => ({
  toolbarWidth: null as { value: number } | null,
  state: null as { value: Record<string, number> } | null,
  viewMode: null as { value: string } | null,
  prompt: null as { value: string } | null,
  previewVisible: null as { value: boolean } | null,
  api: null as ApiMocks | null
}))

vi.mock<unknown>(import('@vueuse/core'), async (importOriginal) => {
  const { ref } = await import('vue')
  const width = ref(600)
  holder.toolbarWidth = width
  return {
    ...(await importOriginal()),
    useElementSize: () => ({ width, height: ref(400) })
  }
})

vi.mock<unknown>(import('@/composables/useCameraAngle'), async () => {
  const { ref } = await import('vue')
  const state = ref({ horizontal: 0, vertical: 0, zoom: 5 })
  const viewMode = ref('camera')
  const prompt = ref('front view eye-level shot medium shot')
  const previewVisible = ref(false)
  const api = {
    initialize: vi.fn(),
    cleanup: vi.fn(),
    handleMouseEnter: vi.fn(),
    handleMouseLeave: vi.fn(),
    setViewMode: vi.fn(),
    setPreviewVisible: vi.fn(),
    setField: vi.fn()
  }
  holder.state = state
  holder.viewMode = viewMode
  holder.prompt = prompt
  holder.previewVisible = previewVisible
  holder.api = api
  return {
    useCameraAngle: () => ({ ...api, state, viewMode, prompt, previewVisible })
  }
})

const { getNodeByLocatorIdMock } = vi.hoisted(() => ({
  getNodeByLocatorIdMock: vi.fn(() => ({ id: 7 }))
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { rootGraphOrUndefined: {} }
}))
vi.mock<unknown>(import('@/utils/graphTraversalUtil'), () => ({
  getNodeByLocatorId: getNodeByLocatorIdMock
}))

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { toNodeId } from '@/types/nodeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import CameraAngle from './CameraAngle.vue'

const SelectStub = defineComponent({
  name: 'Select',
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  template: `
    <div data-testid="preset-select" :data-value="modelValue">
      <button data-testid="pick-back" @click="$emit('update:modelValue', 'back')">back</button>
      <button data-testid="pick-close-up" @click="$emit('update:modelValue', 'closeUp')">close-up</button>
      <slot />
    </div>
  `
})
const Passthrough = defineComponent({
  name: 'SelectPassthrough',
  template: '<slot />'
})

function makeWidget(): SimplifiedWidget {
  return {
    name: 'view',
    type: 'cameraAngle',
    value: 'camera',
    options: {},
    nodeLocatorId: createNodeLocatorId(null, toNodeId(7))
  }
}

function renderComponent() {
  return render(CameraAngle, {
    props: { widget: makeWidget() },
    global: {
      plugins: [i18n],
      directives: { tooltip: {} },
      stubs: {
        Select: SelectStub,
        SelectContent: Passthrough,
        SelectTrigger: Passthrough,
        SelectValue: Passthrough,
        SelectItem: Passthrough
      }
    }
  })
}

function api(): ApiMocks {
  return holder.api!
}

describe('CameraAngle', () => {
  beforeEach(() => {
    useCanvasStore().currentGraph = new LGraph()
    holder.state!.value = { horizontal: 0, vertical: 0, zoom: 5 }
    holder.viewMode!.value = 'camera'
    holder.previewVisible!.value = false
    holder.toolbarWidth!.value = 600
    Object.values(api()).forEach((fn) => fn.mockClear())
  })

  it('initializes the viewport on mount and cleans up on unmount', () => {
    const { unmount } = renderComponent()
    expect(getNodeByLocatorIdMock).toHaveBeenCalledWith(
      expect.anything(),
      createNodeLocatorId(null, toNodeId(7))
    )
    expect(api().initialize).toHaveBeenCalledOnce()

    unmount()
    expect(api().cleanup).toHaveBeenCalledOnce()
  })

  it('switches to object view from the toolbar', async () => {
    renderComponent()
    const user = userEvent.setup()

    expect(screen.getByRole('button', { name: 'Camera' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await user.click(screen.getByRole('button', { name: 'Object' }))

    expect(api().setViewMode).toHaveBeenCalledWith('object')
  })

  it('toggles the shot preview from the toolbar and disables it in object view', async () => {
    renderComponent()
    const user = userEvent.setup()

    const button = screen.getByRole('button', { name: 'Show shot preview' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await user.click(button)
    expect(api().setPreviewVisible).toHaveBeenCalledWith(true)

    holder.viewMode!.value = 'object'
    await nextTick()
    expect(
      screen.getByRole('button', { name: 'Show shot preview' })
    ).toBeDisabled()
  })

  it('collapses the toolbar to icons when it gets narrow', async () => {
    renderComponent()
    expect(screen.getByRole('button', { name: 'Object' })).toHaveTextContent(
      'Object'
    )

    holder.toolbarWidth!.value = 300
    await nextTick()

    const button = screen.getByRole('button', { name: 'Object' })
    expect(button).not.toHaveTextContent('Object')
    expect(
      screen.getByRole('button', { name: 'Show shot preview' })
    ).not.toHaveTextContent('Preview')
  })

  it('shows the prompt that will be output', () => {
    renderComponent()
    expect(screen.getByTestId('camera-angle-prompt')).toHaveTextContent(
      'front view eye-level shot medium shot'
    )
  })

  it('reflects the current buckets in the preset selects', () => {
    holder.state!.value = { horizontal: 180, vertical: 50, zoom: 9 }
    renderComponent()

    const values = screen
      .getAllByTestId('preset-select')
      .map((el) => el.dataset.value)
    expect(values).toEqual(['back', 'highAngle', 'closeUp'])
  })

  it('applies a preset value when a bucket is chosen', async () => {
    renderComponent()
    const user = userEvent.setup()

    const [horizontal, , zoom] = screen.getAllByTestId('preset-select')
    await user.click(within(horizontal).getByTestId('pick-back'))
    await user.click(within(zoom).getByTestId('pick-close-up'))

    expect(api().setField).toHaveBeenCalledWith('horizontal', 180)
    expect(api().setField).toHaveBeenCalledWith('zoom', 8)
  })
})
