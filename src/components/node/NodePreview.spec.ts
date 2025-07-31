import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'

import NodePreview from './NodePreview.vue'

describe('NodePreview', () => {
  let i18n: ReturnType<typeof createI18n>
  let pinia: ReturnType<typeof createPinia>

  beforeAll(() => {
    // Create a Vue app instance for PrimeVue
    const app = createApp({})
    app.use(PrimeVue)

    // Create i18n instance
    i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          g: {
            preview: 'Preview'
          }
        }
      }
    })

    // Create pinia instance
    pinia = createPinia()
  })

  const mockNodeDef: ComfyNodeDefV2 = {
    name: 'TestNode',
    display_name:
      'Test Node With A Very Long Display Name That Should Overflow',
    category: 'test',
    output_node: false,
    inputs: {
      test_input: {
        name: 'test_input',
        type: 'STRING',
        tooltip: 'Test input'
      }
    },
    outputs: [],
    python_module: 'test_module',
    description: 'Test node description'
  }

  const mountComponent = (nodeDef: ComfyNodeDefV2 = mockNodeDef) => {
    return mount(NodePreview, {
      global: {
        plugins: [PrimeVue, i18n, pinia],
        stubs: {
          // Stub stores if needed
        }
      },
      props: {
        nodeDef
      }
    })
  }

  it('renders node preview with correct structure', () => {
    const wrapper = mountComponent()

    expect(wrapper.find('._sb_node_preview').exists()).toBe(true)
    expect(wrapper.find('.node_header').exists()).toBe(true)
    expect(wrapper.find('._sb_preview_badge').text()).toBe('Preview')
  })

  it('applies overflow-ellipsis class to node header for text truncation', () => {
    const wrapper = mountComponent()
    const nodeHeader = wrapper.find('.node_header')

    expect(nodeHeader.classes()).toContain('overflow-ellipsis')
    expect(nodeHeader.classes()).toContain('mr-4')
  })

  it('sets title attribute on node header with full display name', () => {
    const wrapper = mountComponent()
    const nodeHeader = wrapper.find('.node_header')

    expect(nodeHeader.attributes('title')).toBe(mockNodeDef.display_name)
  })

  it('displays truncated long node names with ellipsis', () => {
    const longNameNodeDef: ComfyNodeDefV2 = {
      ...mockNodeDef,
      display_name:
        'This Is An Extremely Long Node Name That Should Definitely Be Truncated With Ellipsis To Prevent Layout Issues'
    }

    const wrapper = mountComponent(longNameNodeDef)
    const nodeHeader = wrapper.find('.node_header')

    // Verify the title attribute contains the full name
    expect(nodeHeader.attributes('title')).toBe(longNameNodeDef.display_name)

    // Verify overflow handling classes are applied
    expect(nodeHeader.classes()).toContain('overflow-ellipsis')

    // The actual text content should still be the full name (CSS handles truncation)
    expect(nodeHeader.text()).toContain(longNameNodeDef.display_name)
  })

  it('handles short node names without issues', () => {
    const shortNameNodeDef: ComfyNodeDefV2 = {
      ...mockNodeDef,
      display_name: 'Short'
    }

    const wrapper = mountComponent(shortNameNodeDef)
    const nodeHeader = wrapper.find('.node_header')

    expect(nodeHeader.attributes('title')).toBe('Short')
    expect(nodeHeader.text()).toContain('Short')
  })

  it('applies proper spacing to the dot element', () => {
    const wrapper = mountComponent()
    const headdot = wrapper.find('.headdot')

    expect(headdot.classes()).toContain('pr-3')
  })
})
