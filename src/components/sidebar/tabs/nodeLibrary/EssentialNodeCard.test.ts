import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

import EssentialNodeCard from './EssentialNodeCard.vue'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn().mockReturnValue('left')
  })
}))

const { mockStartDrag, mockHandleNativeDrop } = vi.hoisted(() => ({
  mockStartDrag: vi.fn(),
  mockHandleNativeDrop: vi.fn()
}))

vi.mock('@/composables/node/useNodeDragToCanvas', () => ({
  useNodeDragToCanvas: () => ({
    startDrag: mockStartDrag,
    handleNativeDrop: mockHandleNativeDrop
  })
}))

vi.mock('@/components/node/NodePreviewCard.vue', () => ({
  default: {
    template: '<div class="mock-preview" data-testid="node-preview" />'
  }
}))

describe('EssentialNodeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMockNode(
    overrides: Partial<ComfyNodeDefImpl> = {}
  ): RenderedTreeExplorerNode<ComfyNodeDefImpl> {
    const data = {
      name: 'TestNode',
      display_name: 'Test Node',
      ...overrides
    } as ComfyNodeDefImpl

    return {
      key: 'test-key',
      label: data.display_name,
      icon: 'icon-[comfy--node]',
      type: 'node',
      totalLeaves: 1,
      data
    }
  }

  function renderComponent(
    node: RenderedTreeExplorerNode<ComfyNodeDefImpl> = createMockNode()
  ) {
    const onClick = vi.fn()
    const user = userEvent.setup()
    const { container } = render(EssentialNodeCard, {
      props: { node, onClick },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })
    return { user, onClick, container }
  }

  function getCard(container: Element) {
    /* eslint-disable testing-library/no-container, testing-library/no-node-access */
    const card = container.querySelector('[data-node-name]') as HTMLElement
    /* eslint-enable testing-library/no-container, testing-library/no-node-access */
    return card
  }

  describe('rendering', () => {
    it('should display the node display_name', () => {
      renderComponent(createMockNode({ display_name: 'Load Image' }))
      expect(screen.getAllByText('Load Image').length).toBeGreaterThan(0)
    })

    it('should set data-node-name attribute', () => {
      const { container } = renderComponent(
        createMockNode({ display_name: 'Save Image' })
      )
      /* eslint-disable testing-library/no-container, testing-library/no-node-access */
      const card = container.querySelector('[data-node-name]')
      /* eslint-enable testing-library/no-container, testing-library/no-node-access */
      expect(card).toHaveAttribute('data-node-name', 'Save Image')
    })

    it('should be draggable', () => {
      const { container } = renderComponent()
      /* eslint-disable testing-library/no-container, testing-library/no-node-access */
      const card = container.querySelector('[draggable]')
      /* eslint-enable testing-library/no-container, testing-library/no-node-access */
      expect(card).toHaveAttribute('draggable', 'true')
    })
  })

  describe('icon generation', () => {
    it('should use override icon for LoadImage', () => {
      const { container } = renderComponent(
        createMockNode({ name: 'LoadImage' })
      )
      /* eslint-disable testing-library/no-container, testing-library/no-node-access */
      const icon = container.querySelector('i')
      /* eslint-enable testing-library/no-container, testing-library/no-node-access */
      expect(icon).toHaveClass('icon-s1.3-[lucide--image-up]')
    })

    it('should use override icon for SaveImage', () => {
      const { container } = renderComponent(
        createMockNode({ name: 'SaveImage' })
      )
      /* eslint-disable testing-library/no-container, testing-library/no-node-access */
      const icon = container.querySelector('i')
      /* eslint-enable testing-library/no-container, testing-library/no-node-access */
      expect(icon).toHaveClass('icon-s1.3-[lucide--image-down]')
    })

    it('should use override icon for ImageCrop', () => {
      const { container } = renderComponent(
        createMockNode({ name: 'ImageCrop' })
      )
      /* eslint-disable testing-library/no-container, testing-library/no-node-access */
      const icon = container.querySelector('i')
      /* eslint-enable testing-library/no-container, testing-library/no-node-access */
      expect(icon).toHaveClass('icon-s1.3-[lucide--crop]')
    })

    it('should use kebab-case for complex node names', () => {
      const { container } = renderComponent(
        createMockNode({ name: 'RecraftRemoveBackgroundNode' })
      )
      /* eslint-disable testing-library/no-container, testing-library/no-node-access */
      const icon = container.querySelector('i')
      /* eslint-enable testing-library/no-container, testing-library/no-node-access */
      expect(icon).toHaveClass('icon-[comfy--recraft-remove-background-node]')
    })

    it('should use default node icon when nodeDef has no name', () => {
      const node: RenderedTreeExplorerNode<ComfyNodeDefImpl> = {
        key: 'test-key',
        label: 'Test',
        icon: 'icon',
        type: 'node',
        totalLeaves: 1,
        data: undefined
      }
      const { container } = renderComponent(node)
      /* eslint-disable testing-library/no-container, testing-library/no-node-access */
      const icon = container.querySelector('i')
      /* eslint-enable testing-library/no-container, testing-library/no-node-access */
      expect(icon).toHaveClass('icon-[comfy--node]')
    })
  })

  describe('events', () => {
    it('should emit click event when clicked', async () => {
      const node = createMockNode()
      const { user, onClick, container } = renderComponent(node)

      await user.click(getCard(container))

      expect(onClick).toHaveBeenCalledWith(node)
    })

    it('should not emit click when nodeDef is undefined', async () => {
      const node: RenderedTreeExplorerNode<ComfyNodeDefImpl> = {
        key: 'test-key',
        label: 'Test',
        icon: 'icon',
        type: 'node',
        totalLeaves: 1,
        data: undefined
      }
      const { user, onClick, container } = renderComponent(node)

      await user.click(getCard(container))

      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('drag and drop', () => {
    it('should call startDrag on dragstart', async () => {
      const { container } = renderComponent()

      await fireEvent.dragStart(getCard(container))

      expect(mockStartDrag).toHaveBeenCalled()
    })

    it('should call handleNativeDrop on dragend', async () => {
      const { container } = renderComponent()

      await fireEvent.dragEnd(getCard(container))

      expect(mockHandleNativeDrop).toHaveBeenCalled()
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
  })
})
