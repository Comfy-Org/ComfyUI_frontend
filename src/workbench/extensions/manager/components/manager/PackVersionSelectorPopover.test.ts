import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import Listbox from 'primevue/listbox'
import Select from 'primevue/select'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import VerifiedIcon from '@/components/icons/VerifiedIcon.vue'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

import PackVersionSelectorPopover from './PackVersionSelectorPopover.vue'

// Default mock versions for reference
const defaultMockVersions = [
  {
    version: '1.0.0',
    createdAt: '2023-01-01',
    supported_os: ['windows', 'linux'],
    supported_accelerators: ['CPU'],
    supported_comfyui_version: '>=0.1.0',
    supported_comfyui_frontend_version: '>=1.0.0',
    supported_python_version: '>=3.8',
    is_banned: false,
    has_registry_data: true
  },
  { version: '0.9.0', createdAt: '2022-12-01' },
  { version: '0.8.0', createdAt: '2022-11-01' }
]

const mockNodePack = {
  id: 'test-pack',
  name: 'Test Pack',
  latest_version: {
    version: '1.0.0',
    supported_os: ['windows', 'linux'],
    supported_accelerators: ['CPU'],
    supported_comfyui_version: '>=0.1.0',
    supported_comfyui_frontend_version: '>=1.0.0',
    supported_python_version: '>=3.8',
    is_banned: false,
    has_registry_data: true
  },
  repository: 'https://github.com/user/repo',
  has_registry_data: true
}

// Create mock functions
const mockGetPackVersions = vi.fn()
const mockInstallPack = vi.fn().mockResolvedValue(undefined)
const mockCheckNodeCompatibility = vi.fn()
const mockIsPackInstalled = vi.fn(() => false)
const mockGetInstalledPackVersion = vi.fn(() => undefined)

// Mock the registry service
vi.mock('@/services/comfyRegistryService', () => ({
  useComfyRegistryService: vi.fn(() => ({
    getPackVersions: mockGetPackVersions
  }))
}))

// Mock the manager store
vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: vi.fn(() => ({
    installPack: {
      call: mockInstallPack,
      clear: vi.fn()
    },
    isPackInstalled: mockIsPackInstalled,
    getInstalledPackVersion: mockGetInstalledPackVersion
  }))
}))

// Mock the conflict detection composable
vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: vi.fn(() => ({
      checkNodeCompatibility: mockCheckNodeCompatibility
    }))
  })
)

const waitForPromises = async () => {
  await new Promise((resolve) => setTimeout(resolve, 16))
  await nextTick()
}

describe('PackVersionSelectorPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPackVersions.mockReset()
    mockInstallPack.mockReset().mockResolvedValue(undefined)
    mockCheckNodeCompatibility
      .mockReset()
      .mockReturnValue({ hasConflict: false, conflicts: [] })
    mockIsPackInstalled.mockReset().mockReturnValue(false)
    mockGetInstalledPackVersion.mockReset().mockReturnValue(undefined)
  })

  function renderComponent({
    props = {},
    onCancel,
    onSubmit
  }: {
    props?: Record<string, unknown>
    onCancel?: () => void
    onSubmit?: () => void
  } = {}) {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })
    const user = userEvent.setup()
    const result = render(PackVersionSelectorPopover, {
      props: {
        nodePack: mockNodePack,
        ...props,
        ...(onCancel ? { onCancel } : {}),
        ...(onSubmit ? { onSubmit } : {})
      },
      global: {
        plugins: [PrimeVue, createTestingPinia({ stubActions: false }), i18n],
        components: { Listbox, VerifiedIcon, Select },
        directives: { tooltip: Tooltip }
      }
    })
    return { ...result, user }
  }

  it('fetches versions on mount', async () => {
    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

    renderComponent()
    await waitForPromises()

    expect(mockGetPackVersions).toHaveBeenCalledWith(mockNodePack.id)
  })

  it('shows loading state while fetching versions', async () => {
    mockGetPackVersions.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(defaultMockVersions), 1000)
        )
    )

    renderComponent()

    expect(screen.getByText('Loading versions...')).toBeInTheDocument()
  })

  it('displays special options and version options in the listbox', async () => {
    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

    renderComponent()
    await waitForPromises()

    // Latest version (1.0.0) should be excluded from version list to avoid duplication
    expect(screen.getByText(/Latest/)).toBeInTheDocument()
    expect(screen.getByText('Nightly')).toBeInTheDocument()
    expect(screen.getByText('0.9.0')).toBeInTheDocument()
    expect(screen.getByText('0.8.0')).toBeInTheDocument()
    // 1.0.0 appears only inside the "Latest (1.0.0)" label, not as a standalone option
    expect(
      screen.queryByRole('option', { name: '1.0.0' })
    ).not.toBeInTheDocument()
  })

  it('emits cancel event when cancel button is clicked', async () => {
    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)
    const onCancel = vi.fn()

    const { user } = renderComponent({ onCancel })
    await waitForPromises()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls installPack and emits submit when install button is clicked', async () => {
    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)
    const onSubmit = vi.fn()

    const { user } = renderComponent({ onSubmit })
    await waitForPromises()

    // Select version 0.9.0 by clicking its option
    await user.click(screen.getByText('0.9.0'))

    await user.click(screen.getByRole('button', { name: 'Install' }))

    expect(mockInstallPack).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockNodePack.id,
        repository: mockNodePack.repository,
        version: '0.9.0',
        selected_version: '0.9.0'
      })
    )

    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('is reactive to nodePack prop changes', async () => {
    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

    const { rerender } = renderComponent()
    await waitForPromises()

    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

    const newNodePack = { ...mockNodePack, id: 'new-test-pack' }
    await rerender({ nodePack: newNodePack })
    await waitForPromises()

    expect(mockGetPackVersions).toHaveBeenCalledWith(newNodePack.id)
  })

  describe('nodePack.id changes', () => {
    it('re-fetches versions when nodePack.id changes', async () => {
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      const { rerender } = renderComponent()
      await waitForPromises()

      expect(mockGetPackVersions).toHaveBeenCalledTimes(1)
      expect(mockGetPackVersions).toHaveBeenCalledWith(mockNodePack.id)

      const newVersions = [
        { version: '2.0.0', createdAt: '2023-06-01' },
        { version: '1.9.0', createdAt: '2023-05-01' }
      ]
      mockGetPackVersions.mockResolvedValueOnce(newVersions)

      const newNodePack = {
        ...mockNodePack,
        id: 'different-pack',
        name: 'Different Pack'
      }
      await rerender({ nodePack: newNodePack })
      await waitForPromises()

      expect(mockGetPackVersions).toHaveBeenCalledTimes(2)
      expect(mockGetPackVersions).toHaveBeenLastCalledWith(newNodePack.id)

      expect(screen.getByText('2.0.0')).toBeInTheDocument()
      expect(screen.getByText('1.9.0')).toBeInTheDocument()
    })

    it('does not re-fetch when nodePack changes but id remains the same', async () => {
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      const { rerender } = renderComponent()
      await waitForPromises()

      expect(mockGetPackVersions).toHaveBeenCalledTimes(1)

      const updatedNodePack = {
        ...mockNodePack,
        name: 'Updated Test Pack',
        description: 'New description'
      }
      await rerender({ nodePack: updatedNodePack })
      await waitForPromises()

      expect(mockGetPackVersions).toHaveBeenCalledTimes(1)
    })

    it('maintains selected version when switching to a new pack', async () => {
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      const { user, container, rerender } = renderComponent()
      await waitForPromises()

      // Select version 0.9.0
      await user.click(screen.getByText('0.9.0'))

      // Verify 0.9.0 is selected via aria-selected
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue Listbox: checking aria-selected on option element
      const selectedOption = container.querySelector(
        '[role="option"][aria-selected="true"]'
      )
      expect(selectedOption).not.toBeNull()
      expect(selectedOption?.textContent).toContain('0.9.0')

      mockGetPackVersions.mockResolvedValueOnce([
        { version: '3.0.0', createdAt: '2023-07-01' },
        { version: '0.9.0', createdAt: '2023-04-01' }
      ])

      const newNodePack = {
        id: 'another-pack',
        name: 'Another Pack',
        latest_version: { version: '3.0.0' }
      }
      await rerender({ nodePack: newNodePack })
      await waitForPromises()

      // Selected version should remain 0.9.0 — verify via pi-check icon
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue Listbox: checking selected indicator icon
      const checkIcons = container.querySelectorAll('.pi.pi-check')
      const selectedTexts = Array.from(checkIcons).map(
        // eslint-disable-next-line testing-library/no-node-access -- traversing to parent option element
        (icon) => icon.closest('[role="option"]')?.textContent
      )
      expect(selectedTexts.some((text) => text?.includes('0.9.0'))).toBe(true)
    })
  })

  describe('Unclaimed GitHub packs handling', () => {
    it('falls back to nightly when no versions exist', async () => {
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      const packWithRepo = {
        ...mockNodePack,
        latest_version: undefined
      }

      const { container } = renderComponent({
        props: { nodePack: packWithRepo }
      })
      await waitForPromises()

      // Nightly should be selected — verify via pi-check icon next to Nightly
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue Listbox: checking selected indicator icon
      const checkIcons = container.querySelectorAll('.pi.pi-check')
      const selectedTexts = Array.from(checkIcons).map(
        // eslint-disable-next-line testing-library/no-node-access -- traversing to parent option element
        (icon) => icon.closest('[role="option"]')?.textContent
      )
      expect(selectedTexts.some((text) => text?.includes('Nightly'))).toBe(true)
    })

    it('defaults to nightly when publisher name is "Unclaimed"', async () => {
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      const unclaimedNodePack = {
        ...mockNodePack,
        publisher: { name: 'Unclaimed' }
      }

      const { container } = renderComponent({
        props: { nodePack: unclaimedNodePack }
      })
      await waitForPromises()

      // Nightly should be selected
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue Listbox: checking selected indicator icon
      const checkIcons = container.querySelectorAll('.pi.pi-check')
      const selectedTexts = Array.from(checkIcons).map(
        // eslint-disable-next-line testing-library/no-node-access -- traversing to parent option element
        (icon) => icon.closest('[role="option"]')?.textContent
      )
      expect(selectedTexts.some((text) => text?.includes('Nightly'))).toBe(true)
    })
  })

  describe('version compatibility checking', () => {
    it('shows warning icon for incompatible versions', async () => {
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      mockCheckNodeCompatibility.mockImplementation((versionData) => {
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

      const { container } = renderComponent({
        props: { nodePack: nodePackWithCompatibility }
      })
      await waitForPromises()

      expect(mockCheckNodeCompatibility).toHaveBeenCalled()

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- icon class query not expressible via ARIA roles
      const warningIcons = container.querySelectorAll(
        '.icon-\\[lucide--triangle-alert\\]'
      )
      expect(warningIcons.length).toBeGreaterThan(0)
    })

    it('shows verified icon for compatible versions', async () => {
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      mockCheckNodeCompatibility.mockReturnValue({
        hasConflict: false,
        conflicts: []
      })

      const { container } = renderComponent()
      await waitForPromises()

      expect(mockCheckNodeCompatibility).toHaveBeenCalled()

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- VerifiedIcon renders SVG without accessible role
      const verifiedIcons = container.querySelectorAll('svg')
      expect(verifiedIcons.length).toBeGreaterThan(0)
    })

    it('shows version conflict warnings for ComfyUI and frontend versions', async () => {
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      mockCheckNodeCompatibility.mockImplementation((versionData) => {
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

      const { container } = renderComponent({
        props: { nodePack: nodePackWithVersionRequirements }
      })
      await waitForPromises()

      expect(mockCheckNodeCompatibility).toHaveBeenCalled()

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- icon class query not expressible via ARIA roles
      const warningIcons = container.querySelectorAll(
        '.icon-\\[lucide--triangle-alert\\]'
      )
      expect(warningIcons.length).toBeGreaterThan(0)
    })

    it('shows banned package warnings', async () => {
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      mockCheckNodeCompatibility.mockImplementation((versionData) => {
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
        is_banned: true,
        latest_version: {
          ...mockNodePack.latest_version,
          is_banned: true
        }
      }

      const { container } = renderComponent({
        props: { nodePack: bannedNodePack }
      })
      await waitForPromises()

      expect(mockCheckNodeCompatibility).toHaveBeenCalled()

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- icon class query not expressible via ARIA roles
      const warningIcons = container.querySelectorAll(
        '.icon-\\[lucide--triangle-alert\\]'
      )
      expect(warningIcons.length).toBeGreaterThan(0)
    })

    it('shows security pending warnings', async () => {
      mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

      mockCheckNodeCompatibility.mockImplementation((versionData) => {
        if (versionData.has_registry_data === false) {
          return {
            hasConflict: true,
            conflicts: [
              {
                type: 'pending',
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
        has_registry_data: false,
        latest_version: {
          ...mockNodePack.latest_version,
          has_registry_data: false
        }
      }

      const { container } = renderComponent({
        props: { nodePack: securityPendingNodePack }
      })
      await waitForPromises()

      expect(mockCheckNodeCompatibility).toHaveBeenCalled()

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- icon class query not expressible via ARIA roles
      const warningIcons = container.querySelectorAll(
        '.icon-\\[lucide--triangle-alert\\]'
      )
      expect(warningIcons.length).toBeGreaterThan(0)
    })
  })
})
