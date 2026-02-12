import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

import EssentialNodeCard from './EssentialNodeCard.vue'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn().mockReturnValue('left')
  })
}))

vi.mock('@/composables/node/useNodeDragToCanvas', () => ({
  useNodeDragToCanvas: () => ({
    startDrag: vi.fn(),
    handleNativeDrop: vi.fn(),
    cancelDrag: vi.fn()
  })
}))

vi.mock('@/components/node/NodePreviewCard.vue', () => ({
  default: { template: '<div class="mock-preview" />' }
}))

describe('EssentialNodeCard', () => {
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
      label: 'Test Node',
      icon: 'icon-[comfy--node]',
      type: 'node',
      totalLeaves: 1,
      data
    }
  }

  function mountComponent(
    node: RenderedTreeExplorerNode<ComfyNodeDefImpl> = createMockNode()
  ) {
    return mount(EssentialNodeCard, {
      props: { node },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })
  }

  describe('rendering', () => {
    it('should display the node display_name', () => {
      const wrapper = mountComponent(
        createMockNode({ display_name: 'Load Image' })
      )
      expect(wrapper.text()).toContain('Load Image')
    })

    it('should set data-node-name attribute', () => {
      const wrapper = mountComponent(
        createMockNode({ display_name: 'Save Image' })
      )
      const card = wrapper.find('[data-node-name]')
      expect(card.attributes('data-node-name')).toBe('Save Image')
    })

    it('should be draggable', () => {
      const wrapper = mountComponent()
      const card = wrapper.find('[draggable]')
      expect(card.attributes('draggable')).toBe('true')
    })
  })

  describe('icon generation', () => {
    it('should use kebab-case of node name for icon', () => {
      const wrapper = mountComponent(createMockNode({ name: 'LoadImage' }))
      const icon = wrapper.find('i')
      expect(icon.classes()).toContain('icon-[comfy--load-image]')
    })

    it('should use kebab-case for SaveImage', () => {
      const wrapper = mountComponent(createMockNode({ name: 'SaveImage' }))
      const icon = wrapper.find('i')
      expect(icon.classes()).toContain('icon-[comfy--save-image]')
    })

    it('should use kebab-case for ImageCrop', () => {
      const wrapper = mountComponent(createMockNode({ name: 'ImageCrop' }))
      const icon = wrapper.find('i')
      expect(icon.classes()).toContain('icon-[comfy--image-crop]')
    })

    it('should use kebab-case for complex node names', () => {
      const wrapper = mountComponent(
        createMockNode({ name: 'RecraftRemoveBackgroundNode' })
      )
      const icon = wrapper.find('i')
      expect(icon.classes()).toContain(
        'icon-[comfy--recraft-remove-background-node]'
      )
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
      const wrapper = mountComponent(node)
      const icon = wrapper.find('i')
      expect(icon.classes()).toContain('icon-[comfy--node]')
    })
  })

  describe('events', () => {
    it('should emit click event when clicked', async () => {
      const node = createMockNode()
      const wrapper = mountComponent(node)

      await wrapper.find('div').trigger('click')

      expect(wrapper.emitted('click')).toBeTruthy()
      expect(wrapper.emitted('click')?.[0]).toEqual([node])
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
      const wrapper = mountComponent(node)

      await wrapper.find('div').trigger('click')

      expect(wrapper.emitted('click')).toBeFalsy()
    })
  })

  describe('drag and drop', () => {
    it('should handle dragstart event', async () => {
      const wrapper = mountComponent()
      const card = wrapper.find('div')

      await card.trigger('dragstart')
    })

    it('should handle dragend event', async () => {
      const wrapper = mountComponent()
      const card = wrapper.find('div')

      await card.trigger('dragend')
    })
  })

  describe('hover preview', () => {
    it('should handle mouseenter event', async () => {
      const wrapper = mountComponent()
      const card = wrapper.find('div')

      await card.trigger('mouseenter')
    })

    it('should handle mouseleave event', async () => {
      const wrapper = mountComponent()
      const card = wrapper.find('div')

      await card.trigger('mouseleave')
    })
  })
})
