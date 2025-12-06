import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import RightPanelSection from './RightPanelSection.vue'

describe('RightPanelSection', () => {
  beforeAll(() => {
    const app = { use: vi.fn() }
    app.use(PrimeVue)
  })

  const mountComponent = (props = {}, slots = {}) => {
    return mount(RightPanelSection, {
      global: {
        plugins: [PrimeVue]
      },
      props: {
        label: 'Test Section',
        ...props
      },
      slots
    })
  }

  describe('Rendering', () => {
    it('renders with default props', () => {
      const wrapper = mountComponent()
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('button').exists()).toBe(true)
    })

    it('displays label from props', () => {
      const wrapper = mountComponent({ label: 'Custom Label' })
      const button = wrapper.find('button')
      expect(button.text()).toContain('Custom Label')
    })

    it('renders label from slot when provided', () => {
      const wrapper = mountComponent(
        {},
        {
          label: '<span class="custom-label">Slot Label</span>'
        }
      )
      const button = wrapper.find('button')
      expect(button.html()).toContain('custom-label')
      expect(button.text()).toContain('Slot Label')
    })

    it('renders default slot content when expanded', async () => {
      const wrapper = mountComponent(
        {},
        {
          default: '<div class="test-content">Test Content</div>'
        }
      )
      
      // Content should be visible by default (not collapsed)
      expect(wrapper.html()).toContain('test-content')
      expect(wrapper.text()).toContain('Test Content')
    })

    it('renders chevron icon in button', () => {
      const wrapper = mountComponent()
      const icon = wrapper.find('i.icon-\\[lucide--chevron-down\\]')
      expect(icon.exists()).toBe(true)
    })
  })

  describe('Collapse/Expand Functionality', () => {
    it('starts in expanded state by default', () => {
      const wrapper = mountComponent(
        {},
        {
          default: '<div class="content">Content</div>'
        }
      )
      
      expect(wrapper.html()).toContain('content')
    })

    it('starts in collapsed state when defaultCollapse is true', async () => {
      const wrapper = mountComponent(
        { defaultCollapse: true },
        {
          default: '<div class="content">Content</div>'
        }
      )
      
      await nextTick()
      expect(wrapper.html()).not.toContain('content')
    })

    it('toggles collapse state when button is clicked', async () => {
      const wrapper = mountComponent(
        {},
        {
          default: '<div class="content">Content</div>'
        }
      )
      
      const button = wrapper.find('button')
      
      // Initially expanded
      expect(wrapper.html()).toContain('content')
      
      // Click to collapse
      await button.trigger('click')
      await nextTick()
      expect(wrapper.html()).not.toContain('content')
      
      // Click to expand again
      await button.trigger('click')
      await nextTick()
      expect(wrapper.html()).toContain('content')
    })

    it('rotates chevron icon when collapsed', async () => {
      const wrapper = mountComponent()
      const button = wrapper.find('button')
      const icon = wrapper.find('i.icon-\\[lucide--chevron-down\\]')
      
      // Initially not rotated (expanded state)
      expect(icon.classes()).not.toContain('rotate-90')
      
      // Click to collapse
      await button.trigger('click')
      await nextTick()
      
      // Should be rotated when collapsed
      expect(icon.classes()).toContain('rotate-90')
    })

    it('emits update:collapse event when toggled', async () => {
      const wrapper = mountComponent()
      const button = wrapper.find('button')
      
      await button.trigger('click')
      await nextTick()
      
      expect(wrapper.emitted('update:collapse')).toBeTruthy()
      expect(wrapper.emitted('update:collapse')?.[0]).toEqual([true])
    })

    it('supports v-model:collapse binding', async () => {
      const wrapper = mountComponent({ collapse: false })
      const button = wrapper.find('button')
      
      await button.trigger('click')
      await nextTick()
      
      expect(wrapper.emitted('update:collapse')?.[0]).toEqual([true])
    })
  })

  describe('Reactivity', () => {
    it('reacts to defaultCollapse prop changes', async () => {
      const wrapper = mountComponent(
        { defaultCollapse: false },
        {
          default: '<div class="content">Content</div>'
        }
      )
      
      // Initially expanded
      expect(wrapper.html()).toContain('content')
      
      // Change to collapsed
      await wrapper.setProps({ defaultCollapse: true })
      await nextTick()
      
      expect(wrapper.html()).not.toContain('content')
    })

    it('updates when collapse model value changes', async () => {
      const wrapper = mountComponent(
        { collapse: false },
        {
          default: '<div class="content">Content</div>'
        }
      )
      
      // Initially expanded
      expect(wrapper.html()).toContain('content')
      
      // Programmatically collapse
      await wrapper.setProps({ collapse: true })
      await nextTick()
      
      expect(wrapper.html()).not.toContain('content')
    })
  })

  describe('Styling and Classes', () => {
    it('applies correct sticky header styles', () => {
      const wrapper = mountComponent()
      const header = wrapper.find('.sticky')
      
      expect(header.exists()).toBe(true)
      expect(header.classes()).toContain('top-0')
      expect(header.classes()).toContain('z-10')
    })

    it('applies button classes correctly', () => {
      const wrapper = mountComponent()
      const button = wrapper.find('button')
      
      expect(button.classes()).toContain('group')
      expect(button.classes()).toContain('cursor-pointer')
      expect(button.classes()).toContain('w-full')
    })

    it('applies transition class to chevron icon', () => {
      const wrapper = mountComponent()
      const icon = wrapper.find('i')
      
      expect(icon.classes()).toContain('transition-all')
    })

    it('applies hover styles to icon through group', () => {
      const wrapper = mountComponent()
      const icon = wrapper.find('i')
      
      expect(icon.classes()).toContain('group-hover:text-base-foreground')
    })
  })

  describe('Accessibility', () => {
    it('button is keyboard accessible', () => {
      const wrapper = mountComponent()
      const button = wrapper.find('button')
      
      expect(button.element.tagName).toBe('BUTTON')
    })

    it('maintains semantic HTML structure', () => {
      const wrapper = mountComponent()
      
      // Should have a div container
      expect(wrapper.element.tagName).toBe('DIV')
      
      // Should have a button for interaction
      expect(wrapper.find('button').exists()).toBe(true)
    })

    it('label text is accessible', () => {
      const wrapper = mountComponent({ label: 'Test Section' })
      const button = wrapper.find('button')
      
      expect(button.text()).toContain('Test Section')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty label gracefully', () => {
      const wrapper = mountComponent({ label: '' })
      const button = wrapper.find('button')
      
      expect(button.exists()).toBe(true)
      expect(button.text().trim()).toBe('')
    })

    it('handles undefined label', () => {
      const wrapper = mountComponent({ label: undefined })
      expect(wrapper.find('button').exists()).toBe(true)
    })

    it('handles null default slot', () => {
      const wrapper = mountComponent()
      expect(wrapper.exists()).toBe(true)
    })

    it('handles multiple rapid toggle clicks', async () => {
      const wrapper = mountComponent(
        {},
        {
          default: '<div class="content">Content</div>'
        }
      )
      const button = wrapper.find('button')
      
      // Rapidly click multiple times
      await button.trigger('click')
      await button.trigger('click')
      await button.trigger('click')
      await nextTick()
      
      // Should handle all clicks without errors
      expect(wrapper.emitted('update:collapse')).toHaveLength(3)
    })

    it('handles very long label text', () => {
      const longLabel = 'A'.repeat(1000)
      const wrapper = mountComponent({ label: longLabel })
      const span = wrapper.find('span.line-clamp-2')
      
      expect(span.exists()).toBe(true)
      expect(span.text()).toContain('A')
    })
  })

  describe('Integration Scenarios', () => {
    it('works with multiple sections in sequence', () => {
      const wrapper1 = mountComponent({ label: 'Section 1' })
      const wrapper2 = mountComponent({ label: 'Section 2' })
      
      expect(wrapper1.text()).toContain('Section 1')
      expect(wrapper2.text()).toContain('Section 2')
    })

    it('maintains independent state between instances', async () => {
      const wrapper1 = mountComponent(
        { label: 'Section 1' },
        { default: '<div>Content 1</div>' }
      )
      const wrapper2 = mountComponent(
        { label: 'Section 2' },
        { default: '<div>Content 2</div>' }
      )
      
      // Collapse first section
      await wrapper1.find('button').trigger('click')
      await nextTick()
      
      // First should be collapsed
      expect(wrapper1.html()).not.toContain('Content 1')
      // Second should remain expanded
      expect(wrapper2.html()).toContain('Content 2')
    })
  })

  describe('Content Slot Behavior', () => {
    it('renders complex nested content', () => {
      const wrapper = mountComponent(
        {},
        {
          default: `
            <div class="outer">
              <div class="inner">
                <span class="text">Nested Content</span>
              </div>
            </div>
          `
        }
      )
      
      expect(wrapper.html()).toContain('outer')
      expect(wrapper.html()).toContain('inner')
      expect(wrapper.text()).toContain('Nested Content')
    })

    it('renders multiple child elements', () => {
      const wrapper = mountComponent(
        {},
        {
          default: `
            <div class="child-1">Child 1</div>
            <div class="child-2">Child 2</div>
            <div class="child-3">Child 3</div>
          `
        }
      )
      
      expect(wrapper.html()).toContain('child-1')
      expect(wrapper.html()).toContain('child-2')
      expect(wrapper.html()).toContain('child-3')
    })

    it('preserves slot content styling', () => {
      const wrapper = mountComponent(
        {},
        {
          default: '<div style="color: red;" class="styled-content">Styled</div>'
        }
      )
      
      expect(wrapper.html()).toContain('styled-content')
      expect(wrapper.html()).toContain('color: red')
    })
  })

  describe('Performance', () => {
    it('handles rapid mount/unmount cycles', () => {
      for (let i = 0; i < 10; i++) {
        const wrapper = mountComponent()
        expect(wrapper.exists()).toBe(true)
        wrapper.unmount()
      }
    })

    it('efficiently handles large content in slot', () => {
      const largeContent = Array.from({ length: 100 }, (_, i) => 
        `<div class="item-${i}">Item ${i}</div>`
      ).join('')
      
      const wrapper = mountComponent(
        {},
        { default: largeContent }
      )
      
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.html()).toContain('item-0')
      expect(wrapper.html()).toContain('item-99')
    })
  })
})