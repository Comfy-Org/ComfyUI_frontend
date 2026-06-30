import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { EssentialTile } from '@/constants/essentialsNodes'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import EssentialNodeCard from './EssentialNodeCard.vue'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn().mockReturnValue('left')
  })
}))

const { mockStartDrag, mockHandleNativeDrop, mockIsPlacingNode } = vi.hoisted(
  () => ({
    mockStartDrag: vi.fn(),
    mockHandleNativeDrop: vi.fn(),
    mockIsPlacingNode: { value: false }
  })
)

vi.mock('@/composables/node/useNodeDragToCanvas', () => ({
  useNodeDragToCanvas: () => ({
    startDrag: mockStartDrag,
    handleNativeDrop: mockHandleNativeDrop,
    isDragging: mockIsPlacingNode
  })
}))

vi.mock('@/components/node/NodePreviewCard.vue', () => ({
  default: {
    template: '<div class="mock-preview" data-testid="node-preview" />'
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      essentials: {
        LoadImage: 'Load Image'
      }
    }
  }
})

function createNodeDef(name: string): ComfyNodeDefV1 {
  return {
    name,
    display_name: name,
    category: 'test',
    python_module: 'nodes',
    description: '',
    input: { required: {}, optional: {} },
    output: [],
    output_name: [],
    output_is_list: [],
    output_node: false
  }
}

const REGISTERED_TILE: EssentialTile = {
  icon: 'icon-s1.5-[lucide--image-up]',
  media: 'image',
  nodeName: 'LoadImage'
}

const UNRESOLVED_TILE: EssentialTile = {
  icon: 'icon-[comfy--node]',
  nodeName: 'NotARegisteredNode'
}

describe('EssentialNodeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    useNodeDefStore().updateNodeDefs([createNodeDef('LoadImage')])
  })

  function renderComponent(tile: EssentialTile = REGISTERED_TILE) {
    const user = userEvent.setup()
    const { container } = render(EssentialNodeCard, {
      props: { tile },
      global: {
        plugins: [i18n],
        stubs: {
          Teleport: true
        }
      }
    })
    return { user, container }
  }

  function getCard(container: Element) {
    /* eslint-disable testing-library/no-container, testing-library/no-node-access */
    return container.querySelector('[draggable]') as HTMLElement
    /* eslint-enable testing-library/no-container, testing-library/no-node-access */
  }

  describe('rendering', () => {
    it('should display the tile label', () => {
      renderComponent()
      expect(screen.getAllByText('LoadImage').length).toBeGreaterThan(0)
    })

    it('should render the tile icon', () => {
      const { container } = renderComponent()
      /* eslint-disable testing-library/no-container, testing-library/no-node-access */
      const icon = container.querySelector('i')
      /* eslint-enable testing-library/no-container, testing-library/no-node-access */
      expect(icon).toHaveClass('icon-s1.5-[lucide--image-up]')
    })

    it('should set data-node-name attribute', () => {
      const { container } = renderComponent()
      expect(getCard(container)).toHaveAttribute('data-node-name', 'LoadImage')
    })

    it('should be draggable when the tile resolves to a node def', () => {
      const { container } = renderComponent()
      expect(getCard(container)).toHaveAttribute('draggable', 'true')
    })

    it('should not be draggable when the tile does not resolve', () => {
      const { container } = renderComponent(UNRESOLVED_TILE)
      expect(getCard(container)).toHaveAttribute('draggable', 'false')
    })
  })

  describe('click to add', () => {
    it('should start drag-to-canvas on click', async () => {
      const { user, container } = renderComponent()

      await user.click(getCard(container))

      expect(mockStartDrag).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'LoadImage' })
      )
    })

    it('should do nothing on click when the tile does not resolve', async () => {
      const { user, container } = renderComponent(UNRESOLVED_TILE)

      await user.click(getCard(container))

      expect(mockStartDrag).not.toHaveBeenCalled()
    })
  })

  describe('drag and drop', () => {
    it('should call startDrag on dragstart', async () => {
      const { container } = renderComponent()

      await fireEvent.dragStart(getCard(container))

      expect(mockStartDrag).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'LoadImage' }),
        { mode: 'native' }
      )
    })

    it('should call handleNativeDrop on dragend', async () => {
      const { container } = renderComponent()

      await fireEvent.dragEnd(getCard(container))

      expect(mockHandleNativeDrop).toHaveBeenCalled()
    })

    it('should not start drag when the tile does not resolve', async () => {
      const { container } = renderComponent(UNRESOLVED_TILE)

      await fireEvent.dragStart(getCard(container))

      expect(mockStartDrag).not.toHaveBeenCalled()
    })
  })

  describe('hover preview', () => {
    it('should show preview on mouseenter', async () => {
      const { user, container } = renderComponent()

      await user.hover(getCard(container))

      expect(screen.getByTestId('node-preview')).toBeInTheDocument()
    })

    it('should hide preview after mouseleave', async () => {
      const { user, container } = renderComponent()

      await user.hover(getCard(container))
      expect(screen.getByTestId('node-preview')).toBeInTheDocument()

      await user.unhover(getCard(container))
      expect(screen.queryByTestId('node-preview')).not.toBeInTheDocument()
    })

    it('should not show preview when the tile does not resolve', async () => {
      const { user, container } = renderComponent(UNRESOLVED_TILE)

      await user.hover(getCard(container))

      expect(screen.queryByTestId('node-preview')).not.toBeInTheDocument()
    })
  })
})
