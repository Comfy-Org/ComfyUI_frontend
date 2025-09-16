import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import InputText from 'primevue/inputtext'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import enMessages from '@/locales/en/main.json'

import NodeHeader from './NodeHeader.vue'

const makeNodeData = (overrides: Partial<VueNodeData> = {}): VueNodeData => ({
  id: '1',
  title: 'KSampler',
  type: 'KSampler',
  mode: 0,
  selected: false,
  executing: false,
  widgets: [],
  inputs: [],
  outputs: [],
  flags: { collapsed: false },
  ...overrides
})

const mountHeader = (
  props?: Partial<InstanceType<typeof NodeHeader>['$props']>
) => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return mount(NodeHeader, {
    global: {
      plugins: [PrimeVue, i18n, createPinia()],
      components: { InputText }
    },
    props: {
      nodeData: makeNodeData(),
      readonly: false,
      collapsed: false,
      ...props
    }
  })
}

describe('NodeHeader.vue', () => {
  it('emits collapse when collapse button is clicked', async () => {
    const wrapper = mountHeader()
    const btn = wrapper.get('[data-testid="node-collapse-button"]')
    await btn.trigger('click')
    expect(wrapper.emitted('collapse')).toBeTruthy()
  })

  it('shows the current node title and updates when prop changes', async () => {
    const wrapper = mountHeader({
      nodeData: makeNodeData({ title: 'Original' })
    })
    // Title visible via EditableText in view mode
    expect(wrapper.get('[data-testid="node-title"]').text()).toContain(
      'Original'
    )

    // Update prop title; should sync displayTitle
    await wrapper.setProps({ nodeData: makeNodeData({ title: 'Updated' }) })
    expect(wrapper.get('[data-testid="node-title"]').text()).toContain(
      'Updated'
    )
  })

  it('allows renaming via double click and emits update:title on confirm', async () => {
    const wrapper = mountHeader({ nodeData: makeNodeData({ title: 'Start' }) })

    // Enter edit mode
    await wrapper.get('[data-testid="node-header-1"]').trigger('dblclick')

    // Edit and confirm (EditableText uses blur or enter to emit)
    const input = wrapper.get('[data-testid="node-title-input"]')
    await input.setValue('My Custom Sampler')
    await input.trigger('keyup.enter')
    await input.trigger('blur')

    // NodeHeader should emit update:title with trimmed value
    const e = wrapper.emitted('update:title')
    expect(e).toBeTruthy()
    expect(e?.[0]).toEqual(['My Custom Sampler'])
  })

  it('cancels rename on escape and keeps previous title', async () => {
    const wrapper = mountHeader({ nodeData: makeNodeData({ title: 'KeepMe' }) })

    await wrapper.get('[data-testid="node-header-1"]').trigger('dblclick')
    const input = wrapper.get('[data-testid="node-title-input"]')
    await input.setValue('Should Not Save')
    await input.trigger('keyup.escape')

    // Should not emit update:title
    expect(wrapper.emitted('update:title')).toBeFalsy()

    // Title remains the original
    expect(wrapper.get('[data-testid="node-title"]').text()).toContain('KeepMe')
  })

  it('honors readonly: hides collapse button and prevents editing', async () => {
    const wrapper = mountHeader({ readonly: true })

    // Collapse button should be hidden
    const btn = wrapper.find('[data-testid="node-collapse-button"]')
    expect(btn.exists()).toBe(true)
    // v-show hides via display:none
    expect((btn.element as HTMLButtonElement).style.display).toBe('none')
    // In unit test, presence is fine; simulate double click should not create input
    await wrapper.get('[data-testid="node-header-1"]').trigger('dblclick')
    const input = wrapper.find('[data-testid="node-title-input"]')
    expect(input.exists()).toBe(false)
  })

  it('renders correct chevron icon based on collapsed prop', async () => {
    const wrapper = mountHeader({ collapsed: false })
    const expandedIcon = wrapper.get('i')
    expect(expandedIcon.classes()).toContain('pi-chevron-down')

    await wrapper.setProps({ collapsed: true })
    const collapsedIcon = wrapper.get('i')
    expect(collapsedIcon.classes()).toContain('pi-chevron-right')
  })
})
