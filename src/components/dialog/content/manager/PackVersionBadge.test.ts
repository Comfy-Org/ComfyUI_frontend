import { VueWrapper, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import Button from 'primevue/button'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { SelectedVersion } from '@/types/comfyManagerTypes'

import PackVersionBadge from './PackVersionBadge.vue'
import PackVersionSelectorPopover from './PackVersionSelectorPopover.vue'

const mockNodePack = {
  id: 'test-pack',
  name: 'Test Pack',
  latest_version: {
    version: '1.0.0'
  }
}

const mockInstalledPacks = {
  'test-pack': { ver: '1.5.0' },
  'installed-pack': { ver: '2.0.0' }
}

vi.mock('@/stores/comfyManagerStore', () => ({
  useComfyManagerStore: vi.fn(() => ({
    installedPacks: mockInstalledPacks,
    isPackInstalled: (id: string) =>
      !!mockInstalledPacks[id as keyof typeof mockInstalledPacks]
  }))
}))

const mockToggle = vi.fn()
const mockHide = vi.fn()
const PopoverStub = {
  name: 'Popover',
  template: '<div><slot></slot></div>',
  methods: {
    toggle: mockToggle,
    hide: mockHide
  }
}

describe('PackVersionBadge', () => {
  beforeEach(() => {
    mockToggle.mockReset()
    mockHide.mockReset()
  })

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
        isSelected: false,
        ...props
      },
      global: {
        plugins: [PrimeVue, createPinia(), i18n],
        stubs: {
          Popover: PopoverStub,
          PackVersionSelectorPopover: true
        }
      }
    })
  }

  it('renders with installed version from store', () => {
    const wrapper = mountComponent()

    const button = wrapper.findComponent(Button)
    expect(button.exists()).toBe(true)
    expect(button.props('label')).toBe('1.5.0') // From mockInstalledPacks
  })

  it('falls back to latest_version when not installed', () => {
    // Use a nodePack that's not in the installedPacks
    const uninstalledPack = {
      id: 'uninstalled-pack',
      name: 'Uninstalled Pack',
      latest_version: {
        version: '3.0.0'
      }
    }

    const wrapper = mountComponent({
      props: { nodePack: uninstalledPack }
    })

    const button = wrapper.findComponent(Button)
    expect(button.exists()).toBe(true)
    expect(button.props('label')).toBe('3.0.0') // From latest_version
  })

  it('falls back to NIGHTLY when no latest_version and not installed', () => {
    // Use a nodePack with no latest_version and not in installedPacks
    const noVersionPack = {
      id: 'no-version-pack',
      name: 'No Version Pack'
    }

    const wrapper = mountComponent({
      props: { nodePack: noVersionPack }
    })

    const button = wrapper.findComponent(Button)
    expect(button.exists()).toBe(true)
    expect(button.props('label')).toBe(SelectedVersion.NIGHTLY)
  })

  it('falls back to NIGHTLY when nodePack.id is missing', () => {
    const invalidPack = {
      name: 'Invalid Pack'
    }

    const wrapper = mountComponent({
      props: { nodePack: invalidPack }
    })

    const button = wrapper.findComponent(Button)
    expect(button.exists()).toBe(true)
    expect(button.props('label')).toBe(SelectedVersion.NIGHTLY)
  })

  it('toggles the popover when button is clicked', async () => {
    const wrapper = mountComponent()

    // Click the button
    await wrapper.findComponent(Button).trigger('click')

    // Verify that the toggle method was called
    expect(mockToggle).toHaveBeenCalled()
  })

  it('closes the popover when cancel is emitted', async () => {
    const wrapper = mountComponent()

    // Simulate the popover emitting a cancel event
    wrapper.findComponent(PackVersionSelectorPopover).vm.$emit('cancel')
    await nextTick()

    // Verify that the hide method was called
    expect(mockHide).toHaveBeenCalled()
  })

  it('closes the popover when submit is emitted', async () => {
    const wrapper = mountComponent()

    // Simulate the popover emitting a submit event
    wrapper.findComponent(PackVersionSelectorPopover).vm.$emit('submit')
    await nextTick()

    // Verify that the hide method was called
    expect(mockHide).toHaveBeenCalled()
  })

  describe('selection state changes', () => {
    it('closes the popover when card is deselected', async () => {
      const wrapper = mountComponent({
        props: { isSelected: true }
      })

      // Change isSelected from true to false
      await wrapper.setProps({ isSelected: false })
      await nextTick()

      // Verify that the hide method was called
      expect(mockHide).toHaveBeenCalled()
    })

    it('does not close the popover when card is selected', async () => {
      const wrapper = mountComponent({
        props: { isSelected: false }
      })

      // Change isSelected from false to true
      await wrapper.setProps({ isSelected: true })
      await nextTick()

      // Verify that the hide method was NOT called
      expect(mockHide).not.toHaveBeenCalled()
    })

    it('does not close the popover when isSelected remains false', async () => {
      const wrapper = mountComponent({
        props: { isSelected: false }
      })

      // Change isSelected from false to false (no change)
      await wrapper.setProps({ isSelected: false })
      await nextTick()

      // Verify that the hide method was NOT called
      expect(mockHide).not.toHaveBeenCalled()
    })

    it('does not close the popover when isSelected remains true', async () => {
      const wrapper = mountComponent({
        props: { isSelected: true }
      })

      // Change isSelected from true to true (no change)
      await wrapper.setProps({ isSelected: true })
      await nextTick()

      // Verify that the hide method was NOT called
      expect(mockHide).not.toHaveBeenCalled()
    })
  })
})
