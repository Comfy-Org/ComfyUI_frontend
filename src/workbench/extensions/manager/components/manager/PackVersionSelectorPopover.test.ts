import { render, screen, within } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Listbox from 'primevue/listbox'
import Select from 'primevue/select'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import VerifiedIcon from '@/components/icons/VerifiedIcon.vue'
import { api } from '@/scripts/api'
import type { components } from '@/types/comfyRegistryTypes'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { ImportFailedKey } from '@/workbench/extensions/manager/types/importFailedTypes'

import PackVersionSelectorPopover from './PackVersionSelectorPopover.vue'

// Default mock versions for reference
const defaultMockVersions: components['schemas']['NodeVersion'][] = [
  {
    version: '1.0.0',
    status: 'NodeVersionStatusActive',
    createdAt: '2023-01-01',
    supported_os: ['windows', 'linux'],
    supported_accelerators: ['CPU'],
    supported_comfyui_version: '>=0.1.0',
    supported_comfyui_frontend_version: '>=1.0.0'
  },
  {
    version: '0.9.0',
    status: 'NodeVersionStatusActive',
    createdAt: '2022-12-01'
  },
  {
    version: '0.8.0',
    status: 'NodeVersionStatusActive',
    createdAt: '2022-11-01'
  }
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
const mockRegistryError = ref<string | null>(null)
let mockInstallPack: MockInstance<
  ReturnType<typeof useComfyManagerStore>['installPack']['call']
>
const mockCheckNodeCompatibility = vi.fn()

// Mock the registry service
vi.mock<unknown>(import('@/services/comfyRegistryService'), () => ({
  useComfyRegistryService: vi.fn(() => ({
    getPackVersions: mockGetPackVersions,
    error: mockRegistryError
  }))
}))

// Mock the conflict detection composable
vi.mock<unknown>(
  import('@/workbench/extensions/manager/composables/useConflictDetection'),

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
    mockRegistryError.value = null
    vi.spyOn(api, 'getSystemStats').mockResolvedValue(
      fromPartial({ system: { os: 'linux', argv: [] }, devices: [] })
    )
    const store = useComfyManagerStore()
    vi.mocked(store.getInstalledPackVersion).mockReturnValue('')
    mockInstallPack = vi.spyOn(store.installPack, 'call')
    mockInstallPack.mockReset().mockResolvedValue(undefined)
    mockCheckNodeCompatibility
      .mockReset()
      .mockReturnValue({ hasConflict: false, conflicts: [] })
    vi.mocked(useComfyManagerStore().isPackInstalled)
      .mockReset()
      .mockReturnValue(false)
  })

  function renderComponent({
    props = {},
    importFailed = false,
    onCancel,
    onSubmit
  }: {
    props?: Record<string, unknown>
    importFailed?: boolean
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
        provide: {
          [ImportFailedKey]: {
            importFailed: computed(() => importFailed),
            showImportFailedDialog: vi.fn()
          }
        },
        plugins: [PrimeVue, i18n],
        components: { Listbox, VerifiedIcon, Select },
        directives: { tooltip: Tooltip }
      }
    })
    return { ...result, user }
  }

  it.for([
    {
      name: 'only Flagged releases',
      versions: [{ version: '1.0.0', status: 'NodeVersionStatusFlagged' }],
      error: null,
      label: 'Latest stable',
      message:
        'This pack has no Active releases. Select a Flagged release to request installation, subject to Manager security settings.'
    },
    {
      name: 'an empty version list',
      versions: [],
      error: null,
      label: 'Latest',
      message: 'This pack has no Active releases.'
    },
    {
      name: 'a failed version lookup',
      versions: null,
      error: 'Failed to get pack versions',
      label: 'Latest',
      message: 'Versions could not be loaded. Close this picker and try again.'
    }
  ] satisfies {
    name: string
    versions: components['schemas']['NodeVersion'][] | null
    error: string | null
    label: string
    message: string
  }[])(
    'disables the Active default with $name while allowing Nightly',
    async ({ versions, error, label, message }) => {
      mockRegistryError.value = error
      mockGetPackVersions.mockResolvedValueOnce(versions)
      const { user } = renderComponent()
      const latest = await screen.findByRole('option', {
        name: label
      })
      expect(latest).toHaveAttribute('aria-disabled', 'true')
      expect(screen.getByText(message)).toBeVisible()
      expect(screen.getByRole('button', { name: 'Install' })).toBeDisabled()
      await user.click(screen.getByRole('option', { name: 'Nightly' }))
      await user.click(screen.getByRole('button', { name: 'Install' }))
      expect(mockInstallPack).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 'nightly',
          selected_version: 'nightly'
        })
      )
    }
  )

  it('allows an explicit Flagged release when neither Latest nor Nightly is available', async () => {
    mockGetPackVersions.mockResolvedValueOnce([
      { version: '1.2.0', status: 'NodeVersionStatusFlagged' }
    ])
    const { user } = renderComponent({
      props: {
        nodePack: { ...mockNodePack, latest_version: undefined, repository: '' }
      }
    })

    expect(
      await screen.findByRole('option', { name: 'Latest stable' })
    ).toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.queryByRole('option', { name: 'Nightly' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Install' })).toBeDisabled()

    await user.click(screen.getByRole('option', { name: /1\.2\.0/ }))
    expect(screen.getByRole('button', { name: 'Install' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Install' }))
    expect(mockInstallPack).toHaveBeenCalledWith(
      expect.objectContaining({ version: '1.2.0', selected_version: '1.2.0' })
    )
  })

  it('fetches versions on mount', async () => {
    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

    renderComponent()
    await waitForPromises()

    expect(mockGetPackVersions).toHaveBeenCalledWith(mockNodePack.id)
  })

  it('shows loading state while fetching versions', async () => {
    mockGetPackVersions.mockImplementationOnce(() => new Promise(() => {}))

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

  it.for([
    {
      version: '0.9.0',
      label: '0.9.0',
      activeLabel: 'Latest (1.0.0)',
      latestLabels: ['Latest (1.0.0)']
    },
    {
      version: '1.0.0',
      label: 'Latest (1.0.0)',
      activeLabel: 'Latest stable (0.9.0)',
      latestLabels: ['Latest (1.0.0)', 'Latest stable (0.9.0)']
    }
  ])(
    'marks Flagged version $version and keeps it installable',
    async ({ version, label, activeLabel, latestLabels }) => {
      const versions: components['schemas']['NodeVersion'][] =
        defaultMockVersions.map((item) => ({
          ...item,
          status:
            item.version === version
              ? 'NodeVersionStatusFlagged'
              : 'NodeVersionStatusActive'
        }))
      mockGetPackVersions.mockResolvedValueOnce(versions)
      const { user } = renderComponent({
        importFailed: true,
        props: { nodePack: { ...mockNodePack, latest_version: versions[0] } }
      })

      const option = await screen.findByRole('option', { name: label })
      expect(within(option).getByText('Flagged')).toBeVisible()
      expect(
        screen
          .getAllByRole('option', { name: /^Latest/ })
          .map((item) => item.getAttribute('aria-label'))
      ).toEqual(latestLabels)
      expect(
        within(screen.getByRole('option', { name: activeLabel })).queryByText(
          'Flagged'
        )
      ).not.toBeInTheDocument()
      expect(
        within(screen.getByRole('option', { name: 'Nightly' })).queryByText(
          'Flagged'
        )
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText(enMessages.manager.status.importFailed)
      ).not.toBeInTheDocument()

      await user.click(option)
      await user.click(screen.getByRole('button', { name: 'Install' }))
      expect(mockInstallPack).toHaveBeenCalledWith(
        expect.objectContaining({ version, selected_version: version })
      )
    }
  )

  it('prevents another version install while the pack has a pending task', async () => {
    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)
    vi.mocked(useComfyManagerStore().isPackInstalling).mockReturnValue(true)
    const { user } = renderComponent()
    await user.click(await screen.findByRole('option', { name: '0.9.0' }))
    const install = screen.getByRole('button', { name: 'Install' })
    expect(install).toBeDisabled()
    await user.click(install)
    expect(mockInstallPack).not.toHaveBeenCalled()
  })

  it.for([
    { summary: undefined, fetched: 'NodeVersionStatusFlagged', flagged: true },
    {
      summary: 'NodeVersionStatusActive',
      fetched: 'NodeVersionStatusFlagged',
      flagged: true
    },
    {
      summary: 'NodeVersionStatusFlagged',
      fetched: 'NodeVersionStatusActive',
      flagged: false
    }
  ] as const)(
    'uses fetched status $fetched over summary $summary for explicit versions',
    async ({ summary, fetched, flagged }) => {
      const versions: components['schemas']['NodeVersion'][] = [
        { ...defaultMockVersions[0], status: fetched },
        { version: '0.9.0', status: 'NodeVersionStatusActive' }
      ]
      mockGetPackVersions.mockResolvedValueOnce(versions)
      renderComponent({
        props: {
          nodePack: {
            ...mockNodePack,
            latest_version: { ...mockNodePack.latest_version, status: summary }
          }
        }
      })
      const latest = await screen.findByRole('option', {
        name: flagged ? 'Latest stable (0.9.0)' : 'Latest (1.0.0)'
      })
      expect(within(latest).queryByText('Flagged')).not.toBeInTheDocument()
      expect(latest).toHaveTextContent(flagged ? '0.9.0' : '1.0.0')
      expect(screen.queryAllByText('Flagged')).toHaveLength(Number(flagged))
    }
  )

  it('pins Latest before Latest stable while keeping Active selected by default', async () => {
    const versions: components['schemas']['NodeVersion'][] = [
      { version: '0.8.0', status: 'NodeVersionStatusActive' },
      { version: '1.1.0', status: 'NodeVersionStatusFlagged' },
      { version: '3.0.0', status: 'NodeVersionStatusBanned' },
      { version: '1.2.0', status: 'NodeVersionStatusFlagged' },
      { version: '0.9.0', status: 'NodeVersionStatusActive' }
    ]
    mockGetPackVersions.mockResolvedValueOnce(versions)
    const { user } = renderComponent()
    const stable = await screen.findByRole('option', {
      name: 'Latest stable (0.9.0)'
    })
    const latest = screen.getByRole('option', { name: 'Latest (1.2.0)' })
    expect(screen.getAllByRole('option').slice(0, 2)).toEqual([latest, stable])
    expect(stable).toHaveAttribute('aria-selected', 'true')
    expect(latest).toHaveAttribute('aria-selected', 'false')
    expect(within(stable).queryByText('Flagged')).not.toBeInTheDocument()
    expect(within(latest).getByText('Flagged')).toBeVisible()
    expect(
      screen.queryByRole('option', { name: '1.2.0' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: '0.9.0' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Install' }))
    expect(mockInstallPack).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '0.9.0',
        selected_version: '0.9.0'
      })
    )
  })

  it.for([
    { installedVersion: '0.9.0', latestInstalled: true },
    { installedVersion: '1.0.0', latestInstalled: false }
  ])(
    'checks Latest against installed Active version, with $installedVersion installed',
    async ({ installedVersion, latestInstalled }) => {
      mockGetPackVersions.mockResolvedValueOnce([
        { version: '1.0.0', status: 'NodeVersionStatusFlagged' },
        { version: '0.9.0', status: 'NodeVersionStatusActive' }
      ])
      const store = useComfyManagerStore()
      vi.mocked(store.isPackInstalled).mockReturnValue(true)
      vi.mocked(store.getInstalledPackVersion).mockReturnValue(installedVersion)
      renderComponent()

      const latest = await screen.findByRole('option', {
        name: 'Latest stable (0.9.0)'
      })
      expect(latest).toHaveAttribute('aria-disabled', String(latestInstalled))
    }
  )

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

  it('does not queue installation without a pack ID', async () => {
    mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)
    const { user } = renderComponent({
      props: { nodePack: { ...mockNodePack, id: '' } }
    })
    await waitForPromises()

    const installButton = screen.getByRole('button', { name: 'Install' })
    await user.click(installButton)

    expect(mockInstallPack).not.toHaveBeenCalled()
    expect(installButton).toBeDisabled()
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
      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue Listbox: checking aria-selected on option element
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
      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue Listbox: checking selected indicator icon
      const checkIcons = container.querySelectorAll('.pi.pi-check')
      const selectedTexts = Array.from(checkIcons).map(
        // oxlint-disable-next-line testing-library/no-node-access -- traversing to parent option element
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
      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue Listbox: checking selected indicator icon
      const checkIcons = container.querySelectorAll('.pi.pi-check')
      const selectedTexts = Array.from(checkIcons).map(
        // oxlint-disable-next-line testing-library/no-node-access -- traversing to parent option element
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
      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue Listbox: checking selected indicator icon
      const checkIcons = container.querySelectorAll('.pi.pi-check')
      const selectedTexts = Array.from(checkIcons).map(
        // oxlint-disable-next-line testing-library/no-node-access -- traversing to parent option element
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

      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- icon class query not expressible via ARIA roles
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

      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- VerifiedIcon renders SVG without accessible role
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

      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- icon class query not expressible via ARIA roles
      const warningIcons = container.querySelectorAll(
        '.icon-\\[lucide--triangle-alert\\]'
      )
      expect(warningIcons.length).toBeGreaterThan(0)
    })

    it.for([
      { status: 'NodeVersionStatusBanned', type: 'banned', label: '1.0.0' },
      {
        status: 'NodeVersionStatusPending',
        type: 'pending',
        label: 'Latest (1.0.0)'
      }
    ] as const)(
      'shows $type warnings from version status',
      async ({ status, type, label }) => {
        const versions: components['schemas']['NodeVersion'][] = [
          { ...defaultMockVersions[0], status }
        ]
        mockGetPackVersions.mockResolvedValueOnce(versions)
        mockCheckNodeCompatibility.mockImplementation(
          (version: components['schemas']['NodeVersion']) => ({
            hasConflict: version.status === status,
            conflicts: [
              { type, current_value: status, required_value: 'active' }
            ]
          })
        )
        renderComponent()
        const latest = await screen.findByRole('option', { name: label })
        expect(
          within(latest).getByRole('img', { name: /banned|pending/i })
        ).toBeVisible()
      }
    )
  })
})
