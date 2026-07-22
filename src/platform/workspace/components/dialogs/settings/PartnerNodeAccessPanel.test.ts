import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type {
  PartnerNodePolicy,
  PartnerProvider
} from '@/platform/workspace/api/partnerNodePolicyApi'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import PartnerNodeAccessPanel from './PartnerNodeAccessPanel.vue'

const {
  mockCloseDialog,
  mockGovernedWorkspaceId,
  mockIsProviderEnabled,
  mockIsSaving,
  mockLoadPolicy,
  mockNodeDefsByName,
  mockPolicy,
  mockProviders,
  mockSetAllProvidersEnabled,
  mockSetEnforcementEnabled,
  mockSetProviderEnabled,
  mockShowConfirmDialog,
  mockStatus,
  mockWorkspaceRole
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')
  return {
    mockCloseDialog: vi.fn(),
    mockGovernedWorkspaceId: ref('workspace-one'),
    mockIsProviderEnabled: vi.fn(),
    mockIsSaving: ref(false),
    mockLoadPolicy: vi.fn(),
    mockNodeDefsByName: ref<Record<string, ComfyNodeDefImpl>>({}),
    mockPolicy: ref<PartnerNodePolicy | null>(null),
    mockProviders: ref<PartnerProvider[]>([]),
    mockSetAllProvidersEnabled: vi.fn(),
    mockSetEnforcementEnabled: vi.fn(),
    mockSetProviderEnabled: vi.fn(),
    mockShowConfirmDialog: vi.fn(),
    mockStatus: ref('configured'),
    mockWorkspaceRole: ref<'owner' | 'admin'>('owner')
  }
})

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    storeToRefs: (store: Record<string, unknown>) => store
  }
})

vi.mock('@/platform/workspace/stores/partnerNodeGovernanceStore', () => ({
  usePartnerNodeGovernanceStore: () => ({
    governedWorkspaceId: mockGovernedWorkspaceId,
    policy: mockPolicy,
    providers: mockProviders,
    status: mockStatus,
    isSaving: mockIsSaving,
    isProviderEnabled: mockIsProviderEnabled,
    loadPolicy: mockLoadPolicy,
    setAllProvidersEnabled: mockSetAllProvidersEnabled,
    setEnforcementEnabled: mockSetEnforcementEnabled,
    setProviderEnabled: mockSetProviderEnabled
  })
}))

vi.mock('@/components/dialog/confirm/confirmDialog', () => ({
  showConfirmDialog: mockShowConfirmDialog
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog: mockCloseDialog })
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({ nodeDefsByName: mockNodeDefsByName })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({ workspaceRole: mockWorkspaceRole })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function nodeDef(
  name: string,
  displayName: string,
  category: string
): ComfyNodeDefImpl {
  return {
    name,
    display_name: displayName,
    category,
    api_node: true
  } as ComfyNodeDefImpl
}

function renderComponent() {
  return render(PartnerNodeAccessPanel, {
    global: { plugins: [i18n] }
  })
}

describe('PartnerNodeAccessPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGovernedWorkspaceId.value = 'workspace-one'
    mockStatus.value = 'configured'
    mockWorkspaceRole.value = 'owner'
    mockIsSaving.value = false
    mockPolicy.value = null
    mockProviders.value = [
      {
        id: 'openai',
        displayName: 'OpenAI (inc. Sora)',
        nodeCategories: ['OpenAI', 'Sora']
      },
      {
        id: 'route-only',
        displayName: 'Route only',
        nodeCategories: []
      }
    ]
    mockNodeDefsByName.value = {
      ImageNode: nodeDef('ImageNode', 'Create image', 'partner/image/OpenAI'),
      VideoNode: nodeDef('VideoNode', 'Create video', 'partner/video/Sora')
    }
    mockIsProviderEnabled.mockReturnValue(true)
    mockSetAllProvidersEnabled.mockResolvedValue(undefined)
    mockSetEnforcementEnabled.mockResolvedValue(undefined)
    mockSetProviderEnabled.mockResolvedValue(undefined)
    mockShowConfirmDialog.mockReturnValue({ key: 'disable-all-dialog' })
  })

  it('groups object-info nodes under visible catalog providers', async () => {
    const user = userEvent.setup()
    renderComponent()

    expect(screen.getByText('OpenAI (inc. Sora)')).toBeTruthy()
    expect(screen.getByText('2 enabled')).toBeTruthy()
    expect(screen.queryByText('Route only')).toBeNull()
    expect(screen.queryByText('Create image')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'OpenAI (inc. Sora)' }))

    expect(screen.getByText('Create image')).toBeTruthy()
    expect(screen.getByText('Create video')).toBeTruthy()
  })

  it('sorts providers from the Provider column header', async () => {
    const user = userEvent.setup()
    mockPolicy.value = {
      enforcementEnabled: true,
      providers: [
        { providerId: 'openai', enabled: true },
        { providerId: 'acme', enabled: true }
      ]
    }
    mockProviders.value = [
      ...mockProviders.value,
      {
        id: 'acme',
        displayName: 'Acme',
        nodeCategories: ['Acme']
      }
    ]
    renderComponent()

    const table = screen.getByRole('table', {
      name: 'Partner node providers'
    })
    const providerHeader = within(table).getByRole('columnheader', {
      name: 'Provider'
    })
    expect(providerHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Acme')

    await user.click(within(providerHeader).getByRole('button'))

    expect(providerHeader).toHaveAttribute('aria-sort', 'descending')
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent(
      'OpenAI (inc. Sora)'
    )
  })

  it('sorts providers by enabled node count', async () => {
    const user = userEvent.setup()
    mockPolicy.value = {
      enforcementEnabled: true,
      providers: [
        { providerId: 'openai', enabled: true },
        { providerId: 'acme', enabled: true }
      ]
    }
    mockProviders.value = [
      ...mockProviders.value,
      {
        id: 'acme',
        displayName: 'Acme',
        nodeCategories: ['Acme']
      }
    ]
    mockNodeDefsByName.value.AcmeNode = nodeDef(
      'AcmeNode',
      'Enhance image',
      'partner/image/Acme'
    )
    renderComponent()

    const table = screen.getByRole('table', {
      name: 'Partner node providers'
    })
    const nodesHeader = within(table).getByRole('columnheader', {
      name: 'Nodes'
    })
    expect(nodesHeader).toHaveAttribute('aria-sort', 'none')

    await user.click(within(nodesHeader).getByRole('button'))

    expect(nodesHeader).toHaveAttribute('aria-sort', 'descending')
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent(
      'OpenAI (inc. Sora)'
    )
  })

  it('searches both provider and node names', async () => {
    const user = userEvent.setup()
    mockProviders.value = [
      ...mockProviders.value,
      {
        id: 'acme',
        displayName: 'Acme',
        nodeCategories: ['Acme']
      }
    ]
    mockNodeDefsByName.value.AcmeNode = nodeDef(
      'AcmeNode',
      'Enhance image',
      'partner/image/Acme'
    )
    renderComponent()

    await user.type(
      screen.getByRole('combobox', {
        name: 'Search providers and partner nodes...'
      }),
      'Enhance'
    )

    expect(screen.getByText('Acme')).toBeTruthy()
    expect(screen.getByText('Enhance image')).toBeTruthy()
    expect(screen.queryByText('OpenAI (inc. Sora)')).toBeNull()
  })

  it('keeps name-matched providers without loaded nodes', async () => {
    const user = userEvent.setup()
    mockProviders.value = [
      ...mockProviders.value,
      {
        id: 'acme',
        displayName: 'Acme',
        nodeCategories: ['Acme']
      }
    ]
    renderComponent()
    const search = screen.getByRole('combobox', {
      name: 'Search providers and partner nodes...'
    })

    await user.type(search, 'Acme')

    expect(screen.getByText('Acme')).toBeTruthy()
    expect(screen.getByText('0 enabled')).toBeTruthy()

    await user.clear(search)
    await user.type(search, 'Missing')

    expect(screen.getByText('No providers or partner nodes found')).toBeTruthy()
  })

  it('shows stored disabled state while restricted', () => {
    mockPolicy.value = {
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: false }]
    }
    mockIsProviderEnabled.mockReturnValue(false)
    renderComponent()

    expect(screen.getByText('Restricted')).toBeTruthy()
    expect(
      screen
        .getByRole('switch', { name: 'Set access for OpenAI (inc. Sora)' })
        .getAttribute('aria-checked')
    ).toBe('false')
  })

  it('uses checkbox-backed switches for provider access', () => {
    renderComponent()

    expect(
      screen.getByRole('switch', {
        name: 'Set access for OpenAI (inc. Sora)'
      })
    ).toHaveAttribute('type', 'checkbox')
  })

  it('explains stored provider settings while access is unrestricted', () => {
    mockPolicy.value = {
      enforcementEnabled: false,
      providers: [{ providerId: 'openai', enabled: false }]
    }
    mockIsProviderEnabled.mockReturnValue(false)
    renderComponent()

    expect(
      screen.getByText(
        'Partner nodes from every provider are available to everyone. Disabling providers will set this to Restricted.'
      )
    ).toBeTruthy()
    expect(
      screen
        .getByRole('switch', { name: 'Set access for OpenAI (inc. Sora)' })
        .getAttribute('aria-checked')
    ).toBe('false')
  })

  it('disables provider controls while access is unrestricted', () => {
    renderComponent()

    expect(screen.getByRole('button', { name: 'Disable all' })).toBeDisabled()
    expect(
      screen.getByRole('switch', {
        name: 'Set access for OpenAI (inc. Sora)'
      })
    ).toBeDisabled()
  })

  it('saves enable-all changes immediately', async () => {
    const user = userEvent.setup()
    mockIsProviderEnabled.mockReturnValue(false)
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Enable all' }))

    expect(mockSetAllProvidersEnabled).toHaveBeenCalledWith(true)
  })

  it('surfaces save failures', async () => {
    const user = userEvent.setup()
    mockPolicy.value = {
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: true }]
    }
    mockSetProviderEnabled.mockRejectedValueOnce(new Error('Save failed'))
    renderComponent()

    await user.click(
      screen.getByRole('switch', {
        name: 'Set access for OpenAI (inc. Sora)'
      })
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Partner node access couldn't be updated. Try again."
    )
  })

  it('locks provider controls while saving', () => {
    mockIsSaving.value = true
    renderComponent()

    expect(
      screen.getByRole('switch', {
        name: 'Set access for OpenAI (inc. Sora)'
      })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Disable all' })).toBeDisabled()
  })

  it('keeps the Allowlist visible but read-only for workspace admins', () => {
    mockWorkspaceRole.value = 'admin'
    renderComponent()

    expect(
      screen.getByText('Only workspace owners can update partner node access.')
    ).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Unrestricted' })).toBeDisabled()
    expect(
      screen.getByRole('switch', {
        name: 'Set access for OpenAI (inc. Sora)'
      })
    ).toBeDisabled()
  })

  it('confirms before disabling every provider', async () => {
    const user = userEvent.setup()
    mockPolicy.value = {
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: true }]
    }
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Disable all' }))

    expect(mockShowConfirmDialog).toHaveBeenCalledOnce()
    const options = mockShowConfirmDialog.mock.calls[0][0]
    expect(options.headerProps.title).toBe('Disable all providers?')
    await options.footerProps.onConfirm()
    expect(mockSetAllProvidersEnabled).toHaveBeenCalledWith(false)
    expect(mockCloseDialog).toHaveBeenCalled()
  })

  it('confirms before turning on restrictions', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('radio', { name: 'Restricted' }))

    const options = mockShowConfirmDialog.mock.calls[0][0]
    expect(options.headerProps.title).toBe('Restrict access to partner nodes?')
    await options.footerProps.onConfirm()
    expect(mockSetEnforcementEnabled).toHaveBeenCalledWith(true)
  })

  it('ignores a restriction confirmation after the workspace changes', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('radio', { name: 'Restricted' }))
    const options = mockShowConfirmDialog.mock.calls[0][0]
    mockGovernedWorkspaceId.value = 'workspace-two'
    await options.footerProps.onConfirm()

    expect(mockSetEnforcementEnabled).not.toHaveBeenCalled()
    expect(mockCloseDialog).toHaveBeenCalled()
  })

  it('ignores a restriction confirmation after a workspace round trip', async () => {
    const user = userEvent.setup()
    mockPolicy.value = {
      enforcementEnabled: false,
      providers: [{ providerId: 'openai', enabled: true }]
    }
    renderComponent()

    await user.click(screen.getByRole('radio', { name: 'Restricted' }))
    const options = mockShowConfirmDialog.mock.calls[0][0]
    mockGovernedWorkspaceId.value = 'workspace-two'
    mockPolicy.value = {
      enforcementEnabled: false,
      providers: [{ providerId: 'openai', enabled: false }]
    }
    mockGovernedWorkspaceId.value = 'workspace-one'
    await options.footerProps.onConfirm()

    expect(mockSetEnforcementEnabled).not.toHaveBeenCalled()
    expect(mockCloseDialog).toHaveBeenCalled()
  })

  it('supports roving focus and keyboard selection', async () => {
    const user = userEvent.setup()
    renderComponent()
    const unrestricted = screen.getByRole('radio', { name: 'Unrestricted' })
    const restricted = screen.getByRole('radio', { name: 'Restricted' })

    unrestricted.focus()
    await user.keyboard('{ArrowRight}')

    expect(restricted).toHaveFocus()
    await user.keyboard(' ')
    await vi.waitFor(() => expect(mockShowConfirmDialog).toHaveBeenCalledOnce())
  })

  it.for(['loading', 'error'] as const)(
    'does not expose access mode while policy status is %s',
    (status) => {
      mockStatus.value = status
      renderComponent()

      expect(
        screen.queryByRole('radio', { name: 'Restricted' })
      ).not.toBeInTheDocument()
    }
  )

  it('confirms expanded access when a restricted provider is disabled', async () => {
    const user = userEvent.setup()
    mockPolicy.value = {
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: false }]
    }
    mockIsProviderEnabled.mockImplementation(
      (providerId: string) => providerId !== 'openai'
    )
    renderComponent()

    await user.click(screen.getByRole('radio', { name: 'Unrestricted' }))

    const options = mockShowConfirmDialog.mock.calls[0][0]
    expect(options.headerProps.title).toBe('Allow access to all partner nodes?')
    await options.footerProps.onConfirm()
    expect(mockSetEnforcementEnabled).toHaveBeenCalledWith(false)
  })

  it('confirms before returning to unrestricted when every provider is enabled', async () => {
    const user = userEvent.setup()
    mockPolicy.value = {
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: true }]
    }
    renderComponent()

    await user.click(screen.getByRole('radio', { name: 'Unrestricted' }))

    expect(mockShowConfirmDialog).toHaveBeenCalledOnce()
    expect(mockSetEnforcementEnabled).not.toHaveBeenCalled()
    const options = mockShowConfirmDialog.mock.calls[0][0]
    expect(options.headerProps.title).toBe('Allow access to all partner nodes?')
    expect(options.props.promptText).toBe(
      'Partner nodes from every provider will become available to every workspace member. This can take up to 10 minutes to apply across your workspace.'
    )
    await options.footerProps.onConfirm()
    expect(mockSetEnforcementEnabled).toHaveBeenCalledWith(false)
  })

  it('retries a failed load', async () => {
    const user = userEvent.setup()
    mockStatus.value = 'error'
    renderComponent()

    expect(screen.queryByText('Unrestricted')).toBeNull()
    expect(
      screen.queryByText('Partner nodes from every provider are available.')
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(mockLoadPolicy).toHaveBeenCalledOnce()
  })
})
