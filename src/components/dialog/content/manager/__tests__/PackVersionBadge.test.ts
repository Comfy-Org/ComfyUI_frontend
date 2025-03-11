import { VueWrapper, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import Button from 'primevue/button'
import PrimeVue from 'primevue/config'
import Popover from 'primevue/popover'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { SelectedVersion } from '@/types/comfyManagerTypes'

import PackVersionBadge from '../PackVersionBadge.vue'
import PackVersionSelectorPopover from '../PackVersionSelectorPopover.vue'

const mockNodePack = {
  id: 'test-pack',
  name: 'Test Pack',
  latest_version: {
    version: '1.0.0'
  }
}

describe('PackVersionBadge', () => {
  const mountComponent = ({
    props = {}
  }: Record<string, any> = {}): VueWrapper => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    return mount(PackVersionBadge, {
      props: {
        nodePack: mockNodePack,
        ...props
      },
      global: {
        plugins: [PrimeVue, createPinia(), i18n],
        components: {
          Popover,
          PackVersionSelectorPopover
        }
      }
    })
  }

  it('renders with default version (NIGHTLY)', () => {
    const wrapper = mountComponent()

    const button = wrapper.findComponent(Button)
    expect(button.exists()).toBe(true)
    expect(button.props('label')).toBe(SelectedVersion.NIGHTLY)
  })

  it('renders with provided version', () => {
    const version = '2.0.0'
    const wrapper = mountComponent({ props: { version } })

    const button = wrapper.findComponent(Button)
    expect(button.exists()).toBe(true)
    expect(button.props('label')).toBe(version)
  })

  it('shows actual latest (semantic) version prop when version is set to latest', () => {
    const wrapper = mountComponent({
      props: { version: SelectedVersion.LATEST }
    })

    const button = wrapper.findComponent(Button)
    expect(button.exists()).toBe(true)
    expect(button.props('label')).toBe(mockNodePack.latest_version.version)
  })

  it('toggles the popover when button is clicked', async () => {
    const wrapper = mountComponent()

    // Spy on the toggle method
    const popoverToggleSpy = vi.fn()
    const popover = wrapper.findComponent(Popover)
    popover.vm.toggle = popoverToggleSpy

    // Open the popover
    await wrapper.findComponent(Button).trigger('click')

    // Verify that the toggle method was called
    expect(popoverToggleSpy).toHaveBeenCalled()
  })

  it('emits update:version event when version is selected', async () => {
    const wrapper = mountComponent()

    // Open the popover
    await wrapper.findComponent(Button).trigger('click')

    // Simulate the popover emitting an apply event
    wrapper.findComponent(PackVersionSelectorPopover).vm.$emit('apply', '3.0.0')
    await nextTick()

    // Check if the update:version event was emitted with the correct value
    expect(wrapper.emitted('update:version')).toBeTruthy()
    expect(wrapper.emitted('update:version')![0]).toEqual(['3.0.0'])
  })

  it('closes the popover when cancel is clicked', async () => {
    const wrapper = mountComponent()

    // Open the popover
    await wrapper.findComponent(Button).trigger('click')

    // Simulate the popover emitting a cancel event
    wrapper.findComponent(PackVersionSelectorPopover).vm.$emit('cancel')
    await nextTick()

    // Check if the popover is hidden
    expect(wrapper.findComponent(Popover).isVisible()).toBe(false)
  })

  it('updates displayed version when version prop changes', async () => {
    const wrapper = mountComponent({ props: { version: '1.0.0' } })

    expect(wrapper.findComponent(Button).props('label')).toBe('1.0.0')

    // Update the version prop
    await wrapper.setProps({ version: '2.0.0' })

    // Check if the displayed version was updated
    expect(wrapper.findComponent(Button).props('label')).toBe('2.0.0')
  })

  it('handles null or undefined nodePack', async () => {
    const wrapper = mountComponent({ props: { nodePack: null } })

    const button = wrapper.findComponent(Button)
    expect(button.exists()).toBe(true)
    expect(button.props('label')).toBe(SelectedVersion.NIGHTLY)

    // Should not crash when clicking the button
    await button.trigger('click')
    expect(wrapper.findComponent(Popover).isVisible()).toBe(false)
  })

  it('handles missing latest_version (unclaimed pack) by falling back to NIGHTLY', async () => {
    const incompleteNodePack = { id: 'test-pack', name: 'Test Pack' }
    const wrapper = mountComponent({
      props: {
        nodePack: incompleteNodePack,
        version: SelectedVersion.LATEST
      }
    })

    const button = wrapper.findComponent(Button)
    expect(button.exists()).toBe(true)

    // Should fallback to nightly string when latest_version is missing
    expect(button.props('label')).toBe(SelectedVersion.NIGHTLY)
  })
})
