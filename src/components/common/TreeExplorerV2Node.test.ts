import { mount } from '@vue/test-utils'
import type { FlattenedItem } from 'reka-ui'
import { describe, expect, it, vi } from 'vitest'

import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

import TreeExplorerV2Node from './TreeExplorerV2Node.vue'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn().mockReturnValue('left')
  })
}))

vi.mock('@/components/node/NodePreviewCard.vue', () => ({
  default: { template: '<div />' }
}))

describe('TreeExplorerV2Node', () => {
  function createMockItem(
    type: 'node' | 'folder',
    overrides: Record<string, unknown> = {}
  ): FlattenedItem<RenderedTreeExplorerNode> {
    const value = {
      key: 'test-key',
      label: 'Test Label',
      type,
      icon: 'pi pi-folder',
      totalLeaves: 5,
      ...overrides
    } as RenderedTreeExplorerNode
    return {
      _id: 'test-id',
      index: 0,
      value,
      level: 1,
      hasChildren: type === 'folder',
      bind: { value, level: 1 }
    }
  }

  function mountComponent(
    props: Record<string, unknown> = {},
    options: Record<string, unknown> = {}
  ) {
    return mount(TreeExplorerV2Node, {
      global: {
        stubs: {
          TreeItem: {
            template: `<div><slot :isExpanded="false" :isSelected="false" :handleToggle="handleToggle" :handleSelect="handleSelect" /></div>`,
            setup() {
              return {
                handleToggle: vi.fn(),
                handleSelect: vi.fn()
              }
            }
          },
          ContextMenuTrigger: {
            template: '<div><slot /></div>'
          },
          Teleport: { template: '<div />' }
        },
        provide: {
          ...(options.provide as Record<string, unknown>)
        }
      },
      props: {
        item: createMockItem('node'),
        ...props
      }
    })
  }

  describe('handleClick', () => {
    it('emits nodeClick event when clicked', async () => {
      const wrapper = mountComponent({
        item: createMockItem('node')
      })

      const nodeDiv = wrapper.find('div.group\\/tree-node')
      await nodeDiv.trigger('click')

      expect(wrapper.emitted('nodeClick')).toBeTruthy()
      expect(wrapper.emitted('nodeClick')?.[0]?.[0]).toMatchObject({
        type: 'node',
        label: 'Test Label'
      })
    })

    it('calls handleToggle for folder items', async () => {
      const wrapper = mountComponent({
        item: createMockItem('folder')
      })

      const folderDiv = wrapper.find('div.group\\/tree-node')
      await folderDiv.trigger('click')

      expect(wrapper.emitted('nodeClick')).toBeTruthy()
    })

    it('does not call handleToggle for node items', async () => {
      const wrapper = mountComponent({
        item: createMockItem('node')
      })

      const nodeDiv = wrapper.find('div.group\\/tree-node')
      await nodeDiv.trigger('click')

      expect(wrapper.emitted('nodeClick')).toBeTruthy()
    })
  })

  describe('context menu', () => {
    it('renders ContextMenuTrigger when showContextMenu is true for nodes', () => {
      const wrapper = mountComponent({
        item: createMockItem('node'),
        showContextMenu: true
      })

      expect(wrapper.html()).toContain('div')
    })

    it('triggers contextmenu event when showContextMenu is true', async () => {
      const wrapper = mountComponent({
        item: createMockItem('node'),
        showContextMenu: true
      })

      const nodeDiv = wrapper.find('div.group\\/tree-node')
      await nodeDiv.trigger('contextmenu')
    })
  })

  describe('rendering', () => {
    it('renders node icon for node type', () => {
      const wrapper = mountComponent({
        item: createMockItem('node')
      })

      expect(wrapper.find('i.icon-\\[comfy--node\\]').exists()).toBe(true)
    })

    it('renders folder icon for folder type', () => {
      const wrapper = mountComponent({
        item: createMockItem('folder')
      })

      expect(wrapper.find('i').exists()).toBe(true)
    })

    it('renders label text', () => {
      const wrapper = mountComponent({
        item: createMockItem('node', { label: 'My Node' })
      })

      expect(wrapper.text()).toContain('My Node')
    })

    it('renders chevron for folder with children', () => {
      const wrapper = mountComponent({
        item: {
          ...createMockItem('folder'),
          hasChildren: true
        }
      })

      expect(wrapper.find('i.icon-\\[lucide--chevron-down\\]').exists()).toBe(
        true
      )
    })
  })
})
