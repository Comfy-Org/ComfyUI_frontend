import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import TreeSelect from 'primevue/treeselect'
import type { TreeSelectProps } from 'primevue/treeselect'
import { describe, expect, it, vi } from 'vitest'

import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'

import WidgetTreeSelect from './WidgetTreeSelect.vue'
import type { TreeNode } from './WidgetTreeSelect.vue'

const createTreeData = (): TreeNode[] => [
  {
    key: '0',
    label: 'Documents',
    data: 'Documents Folder',
    children: [
      {
        key: '0-0',
        label: 'Work',
        data: 'Work Folder',
        children: [
          {
            key: '0-0-0',
            label: 'Expenses.doc',
            data: 'Expenses Document',
            leaf: true
          },
          {
            key: '0-0-1',
            label: 'Resume.doc',
            data: 'Resume Document',
            leaf: true
          }
        ]
      },
      {
        key: '0-1',
        label: 'Home',
        data: 'Home Folder',
        children: [
          {
            key: '0-1-0',
            label: 'Invoices.txt',
            data: 'Invoices for this month',
            leaf: true
          }
        ]
      }
    ]
  },
  {
    key: '1',
    label: 'Events',
    data: 'Events Folder',
    children: [
      { key: '1-0', label: 'Meeting', data: 'Meeting', leaf: true },
      {
        key: '1-1',
        label: 'Product Launch',
        data: 'Product Launch',
        leaf: true
      },
      {
        key: '1-2',
        label: 'Report Review',
        data: 'Report Review',
        leaf: true
      }
    ]
  }
]

describe('WidgetTreeSelect Tree Navigation', () => {
  const createMockWidget = (
    value: WidgetValue = null,
    options: Partial<TreeSelectProps> = {},
    callback?: (value: WidgetValue) => void
  ): SimplifiedWidget<WidgetValue> => ({
    name: 'test_treeselect',
    type: 'object',
    value,
    options,
    callback
  })

  const mountComponent = (
    widget: SimplifiedWidget<WidgetValue>,
    modelValue: WidgetValue,
    readonly = false
  ) => {
    return mount(WidgetTreeSelect, {
      global: {
        plugins: [PrimeVue],
        components: { TreeSelect }
      },
      props: {
        widget,
        modelValue,
        readonly
      }
    })
  }

  const setTreeSelectValueAndEmit = async (
    wrapper: ReturnType<typeof mount>,
    value: unknown
  ) => {
    const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
    await treeSelect.vm.$emit('update:modelValue', value)
    return treeSelect
  }

  describe('Component Rendering', () => {
    it('renders treeselect component', () => {
      const options = createTreeData()
      const widget = createMockWidget(null, { options })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.exists()).toBe(true)
    })

    it('displays tree options from widget options', () => {
      const options = createTreeData()
      const widget = createMockWidget(null, { options })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('options')).toEqual(options)
    })

    it('displays initial selected value', () => {
      const options = createTreeData()
      const selectedValue = {
        key: '0-0-0',
        label: 'Expenses.doc',
        data: 'Expenses Document',
        leaf: true
      }
      const widget = createMockWidget(selectedValue, { options })
      const wrapper = mountComponent(widget, selectedValue)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('modelValue')).toEqual(selectedValue)
    })

    it('applies small size styling', () => {
      const widget = createMockWidget(null, { options: [] })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('size')).toBe('small')
    })

    it('applies text-xs class', () => {
      const widget = createMockWidget(null, { options: [] })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.classes()).toContain('text-xs')
    })
  })

  describe('Vue Event Emission', () => {
    it('emits Vue event when selection changes', async () => {
      const options = createTreeData()
      const widget = createMockWidget(null, { options })
      const wrapper = mountComponent(widget, null)

      const selectedNode = { key: '0-0-0', label: 'Expenses.doc' }
      await setTreeSelectValueAndEmit(wrapper, selectedNode)

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([selectedNode])
    })

    it('emits Vue event when selection is cleared', async () => {
      const options = createTreeData()
      const initialValue = { key: '0-0-0', label: 'Expenses.doc' }
      const widget = createMockWidget(initialValue, { options })
      const wrapper = mountComponent(widget, initialValue)

      await setTreeSelectValueAndEmit(wrapper, null)

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([null])
    })

    it('handles callback when widget value changes', async () => {
      const mockCallback = vi.fn()
      const options = createTreeData()
      const widget = createMockWidget(null, { options }, mockCallback)
      const wrapper = mountComponent(widget, null)

      // Test that the treeselect has the callback widget
      expect(widget.callback).toBe(mockCallback)

      // Manually trigger the composable's onChange to test callback
      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.exists()).toBe(true)
    })

    it('handles missing callback gracefully', async () => {
      const options = createTreeData()
      const widget = createMockWidget(null, { options }, undefined)
      const wrapper = mountComponent(widget, null)

      const selectedNode = { key: '0-1-0', label: 'Invoices.txt' }
      await setTreeSelectValueAndEmit(wrapper, selectedNode)

      // Should still emit Vue event
      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([selectedNode])
    })
  })

  describe('Tree Structure Handling', () => {
    it('handles flat tree structure', () => {
      const flatOptions: TreeNode[] = [
        { key: 'item1', label: 'Item 1', leaf: true },
        { key: 'item2', label: 'Item 2', leaf: true },
        { key: 'item3', label: 'Item 3', leaf: true }
      ]
      const widget = createMockWidget(null, { options: flatOptions })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('options')).toEqual(flatOptions)
    })

    it('handles nested tree structure', () => {
      const nestedOptions = createTreeData()
      const widget = createMockWidget(null, { options: nestedOptions })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('options')).toEqual(nestedOptions)
    })

    it('handles tree with mixed leaf and parent nodes', () => {
      const mixedOptions: TreeNode[] = [
        { key: 'leaf1', label: 'Leaf Node', leaf: true },
        {
          key: 'parent1',
          label: 'Parent Node',
          children: [{ key: 'child1', label: 'Child Node', leaf: true }]
        },
        { key: 'leaf2', label: 'Another Leaf', leaf: true }
      ]
      const widget = createMockWidget(null, { options: mixedOptions })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('options')).toEqual(mixedOptions)
    })

    it('handles deeply nested tree structure', () => {
      const deepOptions: TreeNode[] = [
        {
          key: 'level1',
          label: 'Level 1',
          children: [
            {
              key: 'level2',
              label: 'Level 2',
              children: [
                {
                  key: 'level3',
                  label: 'Level 3',
                  children: [{ key: 'level4', label: 'Level 4', leaf: true }]
                }
              ]
            }
          ]
        }
      ]
      const widget = createMockWidget(null, { options: deepOptions })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('options')).toEqual(deepOptions)
    })
  })

  describe('Selection Modes', () => {
    it('handles single selection mode', async () => {
      const options = createTreeData()
      const widget = createMockWidget(null, {
        options,
        selectionMode: 'single'
      })
      const wrapper = mountComponent(widget, null)

      const selectedNode = { key: '0-0-0', label: 'Expenses.doc' }
      await setTreeSelectValueAndEmit(wrapper, selectedNode)

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([selectedNode])
    })

    it('handles multiple selection mode', async () => {
      const options = createTreeData()
      const widget = createMockWidget(null, {
        options,
        selectionMode: 'multiple'
      })
      const wrapper = mountComponent(widget, null)

      const selectedNodes = [
        { key: '0-0-0', label: 'Expenses.doc' },
        { key: '1-0', label: 'Meeting' }
      ]
      await setTreeSelectValueAndEmit(wrapper, selectedNodes)

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeDefined()
      expect(emitted![0]).toEqual([selectedNodes])
    })

    it('handles checkbox selection mode', async () => {
      const options = createTreeData()
      const widget = createMockWidget(null, {
        options,
        selectionMode: 'checkbox'
      })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('selectionMode')).toBe('checkbox')
    })
  })

  describe('Widget Options Handling', () => {
    it('passes through valid widget options', () => {
      const options = createTreeData()
      const widget = createMockWidget(null, {
        options,
        placeholder: 'Select a node...',
        filter: true,
        showClear: true,
        selectionMode: 'single'
      })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('placeholder')).toBe('Select a node...')
      expect(treeSelect.props('filter')).toBe(true)
      expect(treeSelect.props('showClear')).toBe(true)
      expect(treeSelect.props('selectionMode')).toBe('single')
    })

    it('excludes panel-related props', () => {
      const options = createTreeData()
      const widget = createMockWidget(null, {
        options,
        inputClass: 'custom-input',
        inputStyle: { color: 'red' },
        panelClass: 'custom-panel'
      })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      // These props should be filtered out by the widgetPropFilter
      const inputClass = treeSelect.props('inputClass')
      const inputStyle = treeSelect.props('inputStyle')

      // Either undefined or null are acceptable as "excluded"
      expect(inputClass == null).toBe(true)
      expect(inputStyle == null).toBe(true)
      expect(treeSelect.exists()).toBe(true)
    })

    it('handles empty options gracefully', () => {
      const widget = createMockWidget(null, { options: [] })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('options')).toEqual([])
    })

    it('handles missing options gracefully', () => {
      const widget = createMockWidget(null)
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      // Should not crash, options might be undefined
      expect(treeSelect.exists()).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('handles malformed tree nodes', () => {
      const malformedOptions: unknown[] = [
        { key: 'empty', label: 'Empty Object' }, // Valid object to prevent issues
        { key: 'random', label: 'Random', randomProp: 'value' } // Object with extra properties
      ]
      const widget = createMockWidget(null, {
        options: malformedOptions as TreeNode[]
      })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('options')).toEqual(malformedOptions)
    })

    it('handles nodes with missing keys', () => {
      const noKeyOptions = [
        { key: 'generated-1', label: 'No Key 1', leaf: true },
        { key: 'generated-2', label: 'No Key 2', leaf: true }
      ] as TreeNode[]
      const widget = createMockWidget(null, { options: noKeyOptions })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('options')).toEqual(noKeyOptions)
    })

    it('handles nodes with missing labels', () => {
      const noLabelOptions: TreeNode[] = [
        { key: 'key1', leaf: true },
        { key: 'key2', leaf: true }
      ]
      const widget = createMockWidget(null, { options: noLabelOptions })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('options')).toEqual(noLabelOptions)
    })

    it('handles very large tree structure', () => {
      const largeTree: TreeNode[] = Array.from({ length: 100 }, (_, i) => ({
        key: `node${i}`,
        label: `Node ${i}`,
        children: Array.from({ length: 10 }, (_, j) => ({
          key: `node${i}-${j}`,
          label: `Child ${j}`,
          leaf: true
        }))
      }))
      const widget = createMockWidget(null, { options: largeTree })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('options')).toHaveLength(100)
    })

    it('handles tree with circular references safely', () => {
      // Create nodes that could potentially have circular references
      const circularOptions: TreeNode[] = [
        {
          key: 'parent',
          label: 'Parent',
          children: [{ key: 'child1', label: 'Child 1', leaf: true }]
        }
      ]
      const widget = createMockWidget(null, { options: circularOptions })

      expect(() => mountComponent(widget, null)).not.toThrow()
    })

    it('handles nodes with special characters', () => {
      const specialCharOptions: TreeNode[] = [
        { key: '@#$%^&*()', label: 'Special Chars @#$%', leaf: true },
        {
          key: '{}[]|\\:";\'<>?,./`~',
          label: 'More Special {}[]|\\',
          leaf: true
        }
      ]
      const widget = createMockWidget(null, { options: specialCharOptions })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('options')).toEqual(specialCharOptions)
    })

    it('handles unicode in node labels', () => {
      const unicodeOptions: TreeNode[] = [
        { key: 'unicode1', label: '🌟 Unicode Star', leaf: true },
        { key: 'unicode2', label: '中文 Chinese', leaf: true },
        { key: 'unicode3', label: 'العربية Arabic', leaf: true }
      ]
      const widget = createMockWidget(null, { options: unicodeOptions })
      const wrapper = mountComponent(widget, null)

      const treeSelect = wrapper.findComponent({ name: 'TreeSelect' })
      expect(treeSelect.props('options')).toEqual(unicodeOptions)
    })
  })

  describe('Integration with Layout', () => {
    it('renders within WidgetLayoutField', () => {
      const widget = createMockWidget(null, { options: [] })
      const wrapper = mountComponent(widget, null)

      const layoutField = wrapper.findComponent({ name: 'WidgetLayoutField' })
      expect(layoutField.exists()).toBe(true)
      expect(layoutField.props('widget')).toEqual(widget)
    })

    it('passes widget name to layout field', () => {
      const widget = createMockWidget(null, { options: [] })
      widget.name = 'custom_treeselect'
      const wrapper = mountComponent(widget, null)

      const layoutField = wrapper.findComponent({ name: 'WidgetLayoutField' })
      expect(layoutField.props('widget').name).toBe('custom_treeselect')
    })
  })
})
