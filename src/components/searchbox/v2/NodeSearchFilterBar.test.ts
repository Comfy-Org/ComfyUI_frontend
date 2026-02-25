import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import NodeSearchFilterBar from '@/components/searchbox/v2/NodeSearchFilterBar.vue'
import {
  createMockNodeDef,
  setupTestPinia,
  testI18n
} from '@/components/searchbox/v2/__test__/testUtils'
import { useNodeDefStore } from '@/stores/nodeDefStore'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(() => undefined),
    set: vi.fn()
  }))
}))

describe(NodeSearchFilterBar, () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setupTestPinia()
    useNodeDefStore().updateNodeDefs([
      createMockNodeDef({
        name: 'ImageNode',
        input: { required: { image: ['IMAGE', {}] } },
        output: ['IMAGE']
      })
    ])
  })

  async function createWrapper(props = {}) {
    const wrapper = mount(NodeSearchFilterBar, {
      props,
      global: {
        plugins: [testI18n],
        stubs: {
          NodeSearchTypeFilterPopover: {
            template: '<div data-testid="popover"><slot /></div>',
            props: ['chip', 'selectedValues']
          }
        }
      }
    })
    await nextTick()
    return wrapper
  }

  it('should render Extensions button and Input/Output popover triggers', async () => {
    const wrapper = await createWrapper()

    const buttons = wrapper.findAll('button')
    const texts = buttons.map((b) => b.text())
    expect(texts).toContain('Extensions')
    expect(texts).toContain('Input')
    expect(texts).toContain('Output')
  })

  it('should render conditional category buttons when matching nodes exist', async () => {
    useNodeDefStore().updateNodeDefs([
      createMockNodeDef({
        name: 'BlueprintNode',
        category: 'Subgraph Blueprints/MyBlueprint'
      }),
      createMockNodeDef({
        name: 'ApiNode',
        api_node: true
      }),
      createMockNodeDef({
        name: 'EssentialNode',
        essentials_category: 'basic'
      })
    ])
    await nextTick()

    const wrapper = await createWrapper()
    const texts = wrapper.findAll('button').map((b) => b.text())
    expect(texts).toContain('Blueprints')
    expect(texts).toContain('Partner Nodes')
    expect(texts).toContain('Essentials')
  })

  it('should emit selectCategory when category button is clicked', async () => {
    const wrapper = await createWrapper()

    const extensionsBtn = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Extensions')!
    await extensionsBtn.trigger('click')

    expect(wrapper.emitted('selectCategory')![0]).toEqual(['custom'])
  })

  it('should apply active styling when activeCategory matches', async () => {
    const wrapper = await createWrapper({ activeCategory: 'custom' })

    const extensionsBtn = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Extensions')!

    expect(extensionsBtn.classes()).toContain('bg-base-foreground')
  })
})
