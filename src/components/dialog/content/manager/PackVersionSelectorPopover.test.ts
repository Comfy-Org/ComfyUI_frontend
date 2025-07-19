import { VueWrapper, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import Button from 'primevue/button'
import PrimeVue from 'primevue/config'
import Listbox from 'primevue/listbox'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import VerifiedIcon from '@/components/icons/VerifiedIcon.vue'
import enMessages from '@/locales/en/main.json'

// SelectedVersion is now using direct strings instead of enum

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
const mockCheckVersionCompatibility = vi.fn()

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

// Mock the conflict detection composable
vi.mock('@/composables/useConflictDetection', () => ({
  useConflictDetection: vi.fn(() => ({
    checkVersionCompatibility: mockCheckVersionCompatibility
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
    mockCheckVersionCompatibility
      .mockReset()
      .mockReturnValue({ hasConflict: false, conflicts: [] })
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
          Listbox,
          VerifiedIcon
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
    expect(options.some((o) => o.value === 'nightly')).toBe(true)
    expect(options.some((o) => o.value === 'latest')).toBe(true)

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

  describe('nodePack.id changes', () => {
    it('re-fetches versions when nodePack.id changes', async () => {
      // Set up the mock for the initial fetch
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      const wrapper = mountComponent()
      await waitForPromises()

      // Verify initial fetch
      expect(mockGetPackVersions).toHaveBeenCalledTimes(1)
      expect(mockGetPackVersions).toHaveBeenCalledWith(mockNodePack.id)

      // Set up the mock for the second fetch
      const newVersions = [
        { version: '2.0.0', createdAt: '2023-06-01' },
        { version: '1.9.0', createdAt: '2023-05-01' }
      ]
      mockGetPackVersions.mockResolvedValueOnce(newVersions)

      // Update the nodePack with a new ID
      const newNodePack = {
        ...mockNodePack,
        id: 'different-pack',
        name: 'Different Pack'
      }
      await wrapper.setProps({ nodePack: newNodePack })
      await waitForPromises()

      // Should fetch versions for the new nodePack
      expect(mockGetPackVersions).toHaveBeenCalledTimes(2)
      expect(mockGetPackVersions).toHaveBeenLastCalledWith(newNodePack.id)

      // Check that new versions are displayed
      const listbox = wrapper.findComponent(Listbox)
      const options = listbox.props('options')!
      expect(options.some((o) => o.value === '2.0.0')).toBe(true)
      expect(options.some((o) => o.value === '1.9.0')).toBe(true)
    })

    it('does not re-fetch when nodePack changes but id remains the same', async () => {
      // Set up the mock for the initial fetch
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      const wrapper = mountComponent()
      await waitForPromises()

      // Verify initial fetch
      expect(mockGetPackVersions).toHaveBeenCalledTimes(1)

      // Update the nodePack with same ID but different properties
      const updatedNodePack = {
        ...mockNodePack,
        name: 'Updated Test Pack',
        description: 'New description'
      }
      await wrapper.setProps({ nodePack: updatedNodePack })
      await waitForPromises()

      // Should NOT fetch versions again
      expect(mockGetPackVersions).toHaveBeenCalledTimes(1)
    })

    it('maintains selected version when switching to a new pack', async () => {
      // Set up the mock for the initial fetch
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      const wrapper = mountComponent()
      await waitForPromises()

      // Select a specific version
      const listbox = wrapper.findComponent(Listbox)
      await listbox.setValue('0.9.0')
      expect(listbox.props('modelValue')).toBe('0.9.0')

      // Set up the mock for the second fetch
      mockGetPackVersions.mockResolvedValueOnce([
        { version: '3.0.0', createdAt: '2023-07-01' },
        { version: '0.9.0', createdAt: '2023-04-01' }
      ])

      // Update to a new pack that also has version 0.9.0
      const newNodePack = {
        id: 'another-pack',
        name: 'Another Pack',
        latest_version: { version: '3.0.0' }
      }
      await wrapper.setProps({ nodePack: newNodePack })
      await waitForPromises()

      // Selected version should remain the same if available
      expect(listbox.props('modelValue')).toBe('0.9.0')
    })
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
      expect(listbox.props('modelValue')).toBe('nightly')
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
      expect(listbox.props('modelValue')).toBe('nightly')
    })
  })

  describe('version compatibility checking', () => {
    it('shows warning icon for incompatible versions', async () => {
      // Set up the mock for versions
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      // Mock compatibility check to return conflict for specific version
      mockCheckVersionCompatibility.mockImplementation((versionData) => {
        if (versionData.supported_os?.includes('linux')) {
          return {
            hasConflict: true,
            conflicts: [
              {
                type: 'os',
                current_value: 'windows',
                required_value: 'linux'
              }
            ]
          }
        }
        return { hasConflict: false, conflicts: [] }
      })

      const nodePackWithCompatibility = {
        ...mockNodePack,
        supported_os: ['linux'],
        supported_accelerators: ['CUDA']
      }

      const wrapper = mountComponent({
        props: { nodePack: nodePackWithCompatibility }
      })
      await waitForPromises()

      // Check that compatibility checking function was called
      expect(mockCheckVersionCompatibility).toHaveBeenCalled()

      // The warning icon should be shown for incompatible versions
      const warningIcons = wrapper.findAll('.pi-exclamation-triangle')
      expect(warningIcons.length).toBeGreaterThan(0)
    })

    it('shows verified icon for compatible versions', async () => {
      // Set up the mock for versions
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      // Mock compatibility check to return no conflicts
      mockCheckVersionCompatibility.mockReturnValue({
        hasConflict: false,
        conflicts: []
      })

      const wrapper = mountComponent()
      await waitForPromises()

      // Check that compatibility checking function was called
      expect(mockCheckVersionCompatibility).toHaveBeenCalled()

      // The verified icon should be shown for compatible versions
      // Look for the VerifiedIcon component or SVG elements
      const verifiedIcons = wrapper.findAll('svg')
      expect(verifiedIcons.length).toBeGreaterThan(0)
    })

    it('calls checkVersionCompatibility with correct version data', async () => {
      // Set up the mock for versions with specific supported data
      const versionsWithCompatibility = [
        {
          version: '1.0.0',
          supported_os: ['windows', 'linux'],
          supported_accelerators: ['CUDA', 'CPU'],
          supported_comfyui_version: '>=0.1.0',
          supported_comfyui_frontend_version: '>=1.0.0'
        }
      ]
      mockGetPackVersions.mockResolvedValueOnce(versionsWithCompatibility)

      const nodePackWithCompatibility = {
        ...mockNodePack,
        supported_os: ['windows'],
        supported_accelerators: ['CPU'],
        supported_comfyui_version: '>=0.1.0',
        supported_comfyui_frontend_version: '>=1.0.0'
      }

      const wrapper = mountComponent({
        props: { nodePack: nodePackWithCompatibility }
      })
      await waitForPromises()

      // Trigger compatibility check by accessing getVersionCompatibility
      const vm = wrapper.vm as any
      vm.getVersionCompatibility('1.0.0')

      // Verify that checkVersionCompatibility was called with correct data
      expect(mockCheckVersionCompatibility).toHaveBeenCalledWith({
        supported_os: ['windows', 'linux'],
        supported_accelerators: ['CUDA', 'CPU'],
        supported_comfyui_version: '>=0.1.0',
        supported_comfyui_frontend_version: '>=1.0.0',
        supported_python_version: undefined,
        is_banned: undefined,
        has_registry_data: undefined
      })
    })

    it('shows version conflict warnings for ComfyUI and frontend versions', async () => {
      // Set up the mock for versions
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      // Mock compatibility check to return version conflicts
      mockCheckVersionCompatibility.mockImplementation((versionData) => {
        const conflicts = []
        if (versionData.supported_comfyui_version) {
          conflicts.push({
            type: 'comfyui_version',
            current_value: '0.5.0',
            required_value: versionData.supported_comfyui_version
          })
        }
        if (versionData.supported_comfyui_frontend_version) {
          conflicts.push({
            type: 'frontend_version',
            current_value: '1.0.0',
            required_value: versionData.supported_comfyui_frontend_version
          })
        }
        return {
          hasConflict: conflicts.length > 0,
          conflicts
        }
      })

      const nodePackWithVersionRequirements = {
        ...mockNodePack,
        supported_comfyui_version: '>=1.0.0',
        supported_comfyui_frontend_version: '>=2.0.0'
      }

      const wrapper = mountComponent({
        props: { nodePack: nodePackWithVersionRequirements }
      })
      await waitForPromises()

      // Check that compatibility checking function was called
      expect(mockCheckVersionCompatibility).toHaveBeenCalled()

      // The warning icon should be shown for version incompatible packages
      const warningIcons = wrapper.findAll('.pi-exclamation-triangle')
      expect(warningIcons.length).toBeGreaterThan(0)
    })

    it('handles latest and nightly versions using nodePack data', async () => {
      // Set up the mock for versions
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      const nodePackWithCompatibility = {
        ...mockNodePack,
        supported_os: ['windows'],
        supported_accelerators: ['CPU'],
        supported_comfyui_version: '>=0.1.0',
        supported_comfyui_frontend_version: '>=1.0.0'
      }

      const wrapper = mountComponent({
        props: { nodePack: nodePackWithCompatibility }
      })
      await waitForPromises()

      const vm = wrapper.vm as any

      // Test latest version
      vm.getVersionCompatibility('latest')
      expect(mockCheckVersionCompatibility).toHaveBeenCalledWith({
        supported_os: ['windows'],
        supported_accelerators: ['CPU'],
        supported_comfyui_version: '>=0.1.0',
        supported_comfyui_frontend_version: '>=1.0.0',
        supported_python_version: undefined,
        is_banned: undefined,
        has_registry_data: undefined
      })

      // Test nightly version
      vm.getVersionCompatibility('nightly')
      expect(mockCheckVersionCompatibility).toHaveBeenCalledWith({
        supported_os: ['windows'],
        supported_accelerators: ['CPU'],
        supported_comfyui_version: '>=0.1.0',
        supported_comfyui_frontend_version: '>=1.0.0',
        supported_python_version: undefined,
        is_banned: undefined,
        has_registry_data: undefined
      })
    })

    it('shows python version conflict warnings', async () => {
      // Set up the mock for versions
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      // Mock compatibility check to return python version conflicts
      mockCheckVersionCompatibility.mockImplementation((versionData) => {
        if (versionData.supported_python_version) {
          return {
            hasConflict: true,
            conflicts: [
              {
                type: 'python_version',
                current_value: '3.8.0',
                required_value: versionData.supported_python_version
              }
            ]
          }
        }
        return { hasConflict: false, conflicts: [] }
      })

      const nodePackWithPythonRequirement = {
        ...mockNodePack,
        supported_python_version: '>=3.9.0'
      }

      const wrapper = mountComponent({
        props: { nodePack: nodePackWithPythonRequirement }
      })
      await waitForPromises()

      // Check that compatibility checking function was called
      expect(mockCheckVersionCompatibility).toHaveBeenCalled()

      // The warning icon should be shown for python version incompatible packages
      const warningIcons = wrapper.findAll('.pi-exclamation-triangle')
      expect(warningIcons.length).toBeGreaterThan(0)
    })

    it('shows banned package warnings', async () => {
      // Set up the mock for versions
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      // Mock compatibility check to return banned conflicts
      mockCheckVersionCompatibility.mockImplementation((versionData) => {
        if (versionData.is_banned === true) {
          return {
            hasConflict: true,
            conflicts: [
              {
                type: 'banned',
                current_value: 'installed',
                required_value: 'not_banned'
              }
            ]
          }
        }
        return { hasConflict: false, conflicts: [] }
      })

      const bannedNodePack = {
        ...mockNodePack,
        is_banned: true
      }

      const wrapper = mountComponent({
        props: { nodePack: bannedNodePack }
      })
      await waitForPromises()

      // Check that compatibility checking function was called
      expect(mockCheckVersionCompatibility).toHaveBeenCalled()

      // The warning icon should be shown for banned packages
      const warningIcons = wrapper.findAll('.pi-exclamation-triangle')
      expect(warningIcons.length).toBeGreaterThan(0)
    })

    it('shows security pending warnings', async () => {
      // Set up the mock for versions
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      // Mock compatibility check to return security pending conflicts
      mockCheckVersionCompatibility.mockImplementation((versionData) => {
        if (versionData.has_registry_data === false) {
          return {
            hasConflict: true,
            conflicts: [
              {
                type: 'security_pending',
                current_value: 'no_registry_data',
                required_value: 'registry_data_available'
              }
            ]
          }
        }
        return { hasConflict: false, conflicts: [] }
      })

      const securityPendingNodePack = {
        ...mockNodePack,
        has_registry_data: false
      }

      const wrapper = mountComponent({
        props: { nodePack: securityPendingNodePack }
      })
      await waitForPromises()

      // Check that compatibility checking function was called
      expect(mockCheckVersionCompatibility).toHaveBeenCalled()

      // The warning icon should be shown for security pending packages
      const warningIcons = wrapper.findAll('.pi-exclamation-triangle')
      expect(warningIcons.length).toBeGreaterThan(0)
    })
  })
})
