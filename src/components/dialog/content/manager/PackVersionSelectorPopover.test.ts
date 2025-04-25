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

import PackVersionSelectorPopover from './PackVersionSelectorPopover.vue'

// Default mock versions for reference
const defaultMockVersions = [
  { version: '1.0.0', createdAt: '2023-01-01' },
  { version: '0.9.0', createdAt: '2022-12-01' },
  { version: '0.8.0', createdAt: '2022-11-01' }
]

const mockNodePack = {
  id: 'test-pack',
  name: 'Test Pack',
  latest_version: { version: '1.0.0' },
  repository: 'https://github.com/user/repo'
}

// Create mock functions
const mockGetPackVersions = vi.fn()
const mockInstallPack = vi.fn().mockResolvedValue(undefined)

// Mock the registry service
vi.mock('@/services/comfyRegistryService', () => ({
  useComfyRegistryService: vi.fn(() => ({
    getPackVersions: mockGetPackVersions
  }))
}))

// Mock the manager store
vi.mock('@/stores/comfyManagerStore', () => ({
  useComfyManagerStore: vi.fn(() => ({
    installPack: {
      call: mockInstallPack,
      clear: vi.fn()
    },
    isPackInstalled: vi.fn(() => false),
    getInstalledPackVersion: vi.fn(() => undefined)
  }))
}))

const waitForPromises = async () => {
  await new Promise((resolve) => setTimeout(resolve, 16))
  await nextTick()
}

describe('PackVersionSelectorPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPackVersions.mockReset()
    mockInstallPack.mockReset().mockResolvedValue(undefined)
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
    // Set up the mock for this specific test
    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

    mountComponent()
    await waitForPromises()

    expect(mockGetPackVersions).toHaveBeenCalledWith(mockNodePack.id)
  })

  it('shows loading state while fetching versions', async () => {
    // Delay the promise resolution
    mockGetPackVersions.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(defaultMockVersions), 1000)
        )
    )

    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('Loading versions...')
  })

  it('displays special options and version options in the listbox', async () => {
    // Set up the mock for this specific test
    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

    const wrapper = mountComponent()
    await waitForPromises()

    const listbox = wrapper.findComponent(Listbox)
    expect(listbox.exists()).toBe(true)

    const options = listbox.props('options')!
    // Check that we have both special options and version options
    expect(options.length).toBe(defaultMockVersions.length + 2) // 2 special options + version options

    // Check that special options exist
    expect(options.some((o) => o.value === SelectedVersion.NIGHTLY)).toBe(true)
    expect(options.some((o) => o.value === SelectedVersion.LATEST)).toBe(true)

    // Check that version options exist
    expect(options.some((o) => o.value === '1.0.0')).toBe(true)
    expect(options.some((o) => o.value === '0.9.0')).toBe(true)
    expect(options.some((o) => o.value === '0.8.0')).toBe(true)
  })

  it('emits cancel event when cancel button is clicked', async () => {
    // Set up the mock for this specific test
    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

    const wrapper = mountComponent()
    await waitForPromises()

    const cancelButton = wrapper.findAllComponents(Button)[0]
    await cancelButton.trigger('click')

    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('calls installPack and emits submit when install button is clicked', async () => {
    // Set up the mock for this specific test
    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

    const wrapper = mountComponent()
    await waitForPromises()

    // Set the selected version
    await wrapper.findComponent(Listbox).setValue('0.9.0')

    const installButton = wrapper.findAllComponents(Button)[1]
    await installButton.trigger('click')

    // Check that installPack was called with the correct parameters
    expect(mockInstallPack).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockNodePack.id,
        repository: mockNodePack.repository,
        version: '0.9.0',
        selected_version: '0.9.0'
      })
    )

    // Check that submit was emitted
    expect(wrapper.emitted('submit')).toBeTruthy()
  })

  it('is reactive to nodePack prop changes', async () => {
    // Set up the mock for the initial fetch
    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

    const wrapper = mountComponent()
    await waitForPromises()

    // Set up the mock for the second fetch after prop change
    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

    // Update the nodePack prop
    const newNodePack = { ...mockNodePack, id: 'new-test-pack' }
    await wrapper.setProps({ nodePack: newNodePack })
    await waitForPromises()

    // Should fetch versions for the new nodePack
    expect(mockGetPackVersions).toHaveBeenCalledWith(newNodePack.id)
  })

  describe('Unclaimed GitHub packs handling', () => {
    it('falls back to nightly when no versions exist', async () => {
      // Set up the mock to return versions
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      const packWithRepo = {
        ...mockNodePack,
        latest_version: undefined
      }

      const wrapper = mountComponent({
        props: {
          nodePack: packWithRepo
        }
      })

      await waitForPromises()
      const listbox = wrapper.findComponent(Listbox)
      expect(listbox.exists()).toBe(true)
      expect(listbox.props('modelValue')).toBe(SelectedVersion.NIGHTLY)
    })

    it('defaults to nightly when publisher name is "Unclaimed"', async () => {
      // Set up the mock to return versions
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      const unclaimedNodePack = {
        ...mockNodePack,
        publisher: { name: 'Unclaimed' }
      }

      const wrapper = mountComponent({
        props: {
          nodePack: unclaimedNodePack
        }
      })

      await waitForPromises()
      const listbox = wrapper.findComponent(Listbox)
      expect(listbox.exists()).toBe(true)
      expect(listbox.props('modelValue')).toBe(SelectedVersion.NIGHTLY)
    })
  })
})
