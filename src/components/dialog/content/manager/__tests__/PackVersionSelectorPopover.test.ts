import { VueWrapper, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import Button from 'primevue/button'
import PrimeVue from 'primevue/config'
import Listbox from 'primevue/listbox'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { SelectedVersion } from '@/types/comfyManagerTypes'

import PackVersionSelectorPopover from '../PackVersionSelectorPopover.vue'

const mockVersions = [
  { version: '1.0.0', createdAt: '2023-01-01' },
  { version: '0.9.0', createdAt: '2022-12-01' },
  { version: '0.8.0', createdAt: '2022-11-01' }
]

const mockNodePack = {
  id: 'test-pack',
  name: 'Test Pack',
  latest_version: { version: '1.0.0' }
}

const mockGetPackVersions = vi.fn().mockResolvedValue(mockVersions)

vi.mock('@/services/comfyRegistryService', () => ({
  useComfyRegistryService: vi.fn(() => ({
    getPackVersions: mockGetPackVersions
  }))
}))

const waitForPromises = async () => {
  await new Promise((resolve) => setTimeout(resolve, 16))
  await nextTick()
}

describe('PackVersionSelectorPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPackVersions.mockClear()
    mockGetPackVersions.mockResolvedValue(mockVersions)
  })

  const mountComponent = ({
    props = {}
  }: Record<string, any> = {}): VueWrapper => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    return mount(PackVersionSelectorPopover, {
      props: {
        nodePack: mockNodePack,
        selectedVersion: SelectedVersion.NIGHTLY,
        ...props
      },
      global: {
        plugins: [PrimeVue, createPinia(), i18n],
        components: {
          Listbox
        }
      }
    })
  }

  it('fetches versions on mount', async () => {
    mountComponent()
    await waitForPromises()

    expect(mockGetPackVersions).toHaveBeenCalledWith(mockNodePack.id)
  })

  it('shows loading state while fetching versions', async () => {
    // Delay the promise resolution
    mockGetPackVersions.mockImplementationOnce(
      () =>
        new Promise((resolve) => setTimeout(() => resolve(mockVersions), 1000))
    )

    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('Loading versions...')
  })

  it('displays special options and version options in the listbox', async () => {
    const wrapper = mountComponent()
    await waitForPromises()

    const listbox = wrapper.findComponent(Listbox)
    expect(listbox.exists()).toBe(true)

    const options = listbox.props('options')!
    expect(options.length).toBe(5) // 2 special options + 3 version options

    // Check special options
    expect(options[0].value).toBe(SelectedVersion.NIGHTLY)
    expect(options[1].value).toBe(SelectedVersion.LATEST)

    // Check version options
    expect(options[2].value).toBe('1.0.0')
    expect(options[3].value).toBe('0.9.0')
    expect(options[4].value).toBe('0.8.0')
  })

  it('initializes with the provided selectedVersion prop', async () => {
    const selectedVersion = '0.9.0'
    const wrapper = mountComponent({ props: { selectedVersion } })
    await waitForPromises()

    // Check that the listbox has the correct model value
    const listbox = wrapper.findComponent(Listbox)
    expect(listbox.props('modelValue')).toBe(selectedVersion)
  })

  it('emits cancel event when cancel button is clicked', async () => {
    const wrapper = mountComponent()
    await waitForPromises()

    const cancelButton = wrapper.findAllComponents(Button)[0]
    await cancelButton.trigger('click')

    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('emits apply event with current selection when apply button is clicked', async () => {
    const selectedVersion = '0.9.0'
    const wrapper = mountComponent({ props: { selectedVersion } })
    await waitForPromises()

    const applyButton = wrapper.findAllComponents(Button)[1]
    await applyButton.trigger('click')

    expect(wrapper.emitted('apply')).toBeTruthy()
    expect(wrapper.emitted('apply')![0]).toEqual([selectedVersion])
  })

  it('emits apply event with LATEST when no selection and apply button is clicked', async () => {
    const wrapper = mountComponent({ props: { selectedVersion: null } })
    await waitForPromises()

    const applyButton = wrapper.findAllComponents(Button)[1]
    await applyButton.trigger('click')

    expect(wrapper.emitted('apply')).toBeTruthy()
    expect(wrapper.emitted('apply')![0]).toEqual([SelectedVersion.LATEST])
  })

  it('is reactive to nodePack prop changes', async () => {
    const wrapper = mountComponent()
    await waitForPromises()

    // Clear mock calls to check if getPackVersions is called again
    mockGetPackVersions.mockClear()

    // Update the nodePack prop
    const newNodePack = { ...mockNodePack, id: 'new-test-pack' }
    await wrapper.setProps({ nodePack: newNodePack })
    await waitForPromises()

    // Should fetch versions for the new nodePack
    expect(mockGetPackVersions).toHaveBeenCalledWith(newNodePack.id)
  })

  describe('Unclaimed GitHub packs handling', () => {
    it('falls back to nightly when comfy-api returns null when fetching versions', async () => {
      mockGetPackVersions.mockResolvedValueOnce(null)

      const wrapper = mountComponent()
      await waitForPromises()

      const listbox = wrapper.findComponent(Listbox)
      expect(listbox.props('modelValue')).toBe(SelectedVersion.NIGHTLY)
    })

    it('falls back to nightly when component mounts with no versions (unclaimed pack)', async () => {
      mockGetPackVersions.mockResolvedValueOnce([])

      const wrapper = mountComponent()
      await waitForPromises()

      const listbox = wrapper.findComponent(Listbox)
      expect(listbox.props('modelValue')).toBe(SelectedVersion.NIGHTLY)
    })
  })
})
