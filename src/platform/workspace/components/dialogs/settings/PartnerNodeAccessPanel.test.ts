import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
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
  mockSetProvidersEnabled,
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
    mockSetProvidersEnabled: vi.fn(),
    mockShowConfirmDialog: vi.fn(),
    mockStatus: ref('configured'),
    mockWorkspaceRole: ref<'owner' | 'member'>('owner')
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
    setProviderEnabled: mockSetProviderEnabled,
    setProvidersEnabled: mockSetProvidersEnabled
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
    global: { plugins: [i18n], directives: { tooltip: {} } }
  })
}

function restrictPolicy(
  entries: PartnerNodePolicy['providers'] = [
    { providerId: 'openai', enabled: true }
  ]
) {
  mockPolicy.value = { enforcementEnabled: true, providers: entries }
}

const allowAllSwitchName = 'Allow all partner models'

async function openBulkMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Disable all' }))
}

describe('PartnerNodeAccessPanel', () => {
  beforeEach(() => {
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
    mockSetProvidersEnabled.mockResolvedValue(undefined)
    mockShowConfirmDialog.mockReturnValue({ key: 'disable-all-dialog' })
  })

  it('groups object-info nodes under visible catalog providers', async () => {
    const user = userEvent.setup()
    renderComponent()

    expect(screen.getByText('OpenAI (inc. Sora)')).toBeTruthy()
    expect(screen.getByText('2 models')).toBeTruthy()
    expect(screen.queryByText('Route only')).toBeNull()
    expect(screen.queryByText('Create image')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'OpenAI (inc. Sora)' }))

    expect(screen.getByText('Create image')).toBeTruthy()
    expect(screen.getByText('Create video')).toBeTruthy()
  })

  it('sorts providers from the Provider column header', async () => {
    const user = userEvent.setup()
    restrictPolicy([
      { providerId: 'openai', enabled: true },
      { providerId: 'acme', enabled: true }
    ])
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
      name: 'Partner model providers'
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

  it('sorts providers by model count', async () => {
    const user = userEvent.setup()
    restrictPolicy([
      { providerId: 'openai', enabled: true },
      { providerId: 'acme', enabled: true }
    ])
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
      name: 'Partner model providers'
    })
    const modelsHeader = within(table).getByRole('columnheader', {
      name: 'Models'
    })
    expect(modelsHeader).toHaveAttribute('aria-sort', 'none')

    await user.click(within(modelsHeader).getByRole('button'))

    expect(modelsHeader).toHaveAttribute('aria-sort', 'descending')
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent(
      'OpenAI (inc. Sora)'
    )
  })

  it('sorts providers from the State column header', async () => {
    const user = userEvent.setup()
    restrictPolicy([
      { providerId: 'openai', enabled: false },
      { providerId: 'acme', enabled: true }
    ])
    mockIsProviderEnabled.mockImplementation(
      (providerId: string) => providerId !== 'openai'
    )
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
      name: 'Partner model providers'
    })
    const stateHeader = within(table).getByRole('columnheader', {
      name: 'State'
    })

    await user.click(within(stateHeader).getByRole('button'))

    expect(stateHeader).toHaveAttribute('aria-sort', 'descending')
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Acme')
  })

  it('searches both provider and model names', async () => {
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
    mockNodeDefsByName.value.AcmeResize = nodeDef(
      'AcmeResize',
      'Resize video',
      'partner/video/Acme'
    )
    renderComponent()

    await user.type(
      screen.getByRole('combobox', {
        name: 'Search providers and partner models...'
      }),
      'Enhance'
    )

    expect(screen.getByText('Acme')).toBeTruthy()
    expect(screen.getByText('1 of 2 matches')).toBeTruthy()
    expect(screen.queryByText('Enhance image')).toBeNull()
    expect(screen.queryByText('OpenAI (inc. Sora)')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Acme' }))
    expect(screen.getByText('Enhance image')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Acme' }))
    expect(screen.queryByText('Enhance image')).toBeNull()
  })

  it('keeps provider-name matches collapsed while searching', async () => {
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
    const search = screen.getByRole('combobox', {
      name: 'Search providers and partner models...'
    })

    await user.type(search, 'Acme')
    expect(screen.queryByText('Enhance image')).toBeNull()
    expect(screen.getByText('1 model')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Acme' }))
    expect(screen.getByText('Enhance image')).toBeTruthy()
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
      name: 'Search providers and partner models...'
    })

    await user.type(search, 'Acme')

    expect(screen.getByText('Acme')).toBeTruthy()
    expect(screen.getByText('0 models')).toBeTruthy()

    await user.clear(search)
    await user.type(search, 'Missing')

    expect(
      screen.getByText('No providers or partner models found')
    ).toBeTruthy()
  })

  it('shows stored disabled state while restricted', () => {
    restrictPolicy([{ providerId: 'openai', enabled: false }])
    mockIsProviderEnabled.mockReturnValue(false)
    renderComponent()

    expect(
      screen
        .getByRole('switch', { name: allowAllSwitchName })
        .getAttribute('aria-checked')
    ).toBe('false')
    expect(screen.getByText('2 models')).toBeTruthy()
    expect(
      screen
        .getByRole('switch', { name: 'Set access for OpenAI (inc. Sora)' })
        .getAttribute('aria-checked')
    ).toBe('false')
  })

  it('hides provider controls while access is unrestricted', () => {
    mockPolicy.value = {
      enforcementEnabled: false,
      providers: [{ providerId: 'openai', enabled: false }]
    }
    mockIsProviderEnabled.mockReturnValue(false)
    renderComponent()

    expect(
      screen.getByText('Turn off to choose which partner models users can run.')
    ).toBeTruthy()
    expect(screen.getByText('2 models')).toBeTruthy()
    expect(
      screen.queryByRole('switch', {
        name: 'Set access for OpenAI (inc. Sora)'
      })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Disable all' })
    ).not.toBeInTheDocument()
  })

  it('summarizes allowed models under the table', async () => {
    const summary = (expected: string) =>
      screen.getByText(
        (_, element) =>
          element?.tagName === 'SPAN' && element.textContent === expected
      )
    renderComponent()

    expect(summary('All partner models allowed')).toBeInTheDocument()

    restrictPolicy([{ providerId: 'openai', enabled: true }])
    await nextTick()

    expect(summary('2 partner models allowed')).toBeInTheDocument()
  })

  it('warns about future partner models while restricted', () => {
    restrictPolicy()
    renderComponent()

    expect(
      screen.getByText(
        'Users can only run the models allowed below. New models are disabled by default.'
      )
    ).toBeTruthy()
  })

  it('applies bulk enable to every provider from the menu', async () => {
    const user = userEvent.setup()
    restrictPolicy([{ providerId: 'openai', enabled: false }])
    mockIsProviderEnabled.mockReturnValue(false)
    renderComponent()

    await openBulkMenu(user)
    await user.click(
      screen.getByRole('menuitem', { name: 'Enable all 1 provider' })
    )

    expect(mockSetProvidersEnabled).toHaveBeenCalledWith(['openai'], true)
  })

  it('disables no-op bulk actions in the menu', async () => {
    const user = userEvent.setup()
    restrictPolicy([{ providerId: 'openai', enabled: true }])
    renderComponent()

    await openBulkMenu(user)

    expect(
      screen.getByRole('menuitem', { name: 'Disable all 1 provider' })
    ).not.toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.getByRole('menuitem', { name: 'Enable all 1 provider' })
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('scopes bulk actions to matching providers while searching', async () => {
    const user = userEvent.setup()
    restrictPolicy([
      { providerId: 'openai', enabled: true },
      { providerId: 'acme', enabled: true }
    ])
    mockProviders.value = [
      ...mockProviders.value,
      {
        id: 'acme',
        displayName: 'Acme',
        nodeCategories: ['Acme']
      }
    ]
    renderComponent()

    await user.type(
      screen.getByRole('combobox', {
        name: 'Search providers and partner models...'
      }),
      'Acme'
    )
    await openBulkMenu(user)
    await user.click(
      screen.getByRole('menuitem', { name: 'Disable 1 matching provider' })
    )

    expect(mockShowConfirmDialog).not.toHaveBeenCalled()
    expect(mockSetProvidersEnabled).toHaveBeenCalledWith(['acme'], false)
  })

  it('surfaces save failures', async () => {
    const user = userEvent.setup()
    restrictPolicy()
    mockSetProviderEnabled.mockRejectedValueOnce(new Error('Save failed'))
    renderComponent()

    await user.click(
      screen.getByRole('switch', {
        name: 'Set access for OpenAI (inc. Sora)'
      })
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Partner model access couldn't be updated. Try again."
    )
  })

  it('locks provider controls while saving', () => {
    restrictPolicy()
    mockIsSaving.value = true
    renderComponent()

    expect(
      screen.getByRole('switch', { name: allowAllSwitchName })
    ).toBeDisabled()
    expect(
      screen.getByRole('switch', {
        name: 'Set access for OpenAI (inc. Sora)'
      })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Disable all' })).toBeDisabled()
  })

  it('locks policy controls when the owner loses workspace access', async () => {
    restrictPolicy()
    renderComponent()

    expect(
      screen.getByRole('switch', { name: allowAllSwitchName })
    ).toBeEnabled()

    mockWorkspaceRole.value = 'member'
    await nextTick()

    expect(
      screen.getByText('Only workspace owners can update partner model access.')
    ).toBeTruthy()
    expect(
      screen.getByRole('switch', { name: allowAllSwitchName })
    ).toBeDisabled()
    expect(
      screen.getByRole('switch', {
        name: 'Set access for OpenAI (inc. Sora)'
      })
    ).toBeDisabled()
  })

  it('confirms before disabling every provider', async () => {
    const user = userEvent.setup()
    restrictPolicy()
    renderComponent()

    await openBulkMenu(user)
    await user.click(
      screen.getByRole('menuitem', { name: 'Disable all 1 provider' })
    )

    expect(mockShowConfirmDialog).toHaveBeenCalledOnce()
    const options = mockShowConfirmDialog.mock.calls[0][0]
    expect(options.headerProps.title).toBe('Disable all providers?')
    await options.footerProps.onConfirm()
    expect(mockSetAllProvidersEnabled).toHaveBeenCalledWith(false)
    expect(mockCloseDialog).toHaveBeenCalled()
  })

  it('ignores a disable-all confirmation after the workspace changes', async () => {
    const user = userEvent.setup()
    restrictPolicy()
    renderComponent()

    await openBulkMenu(user)
    await user.click(
      screen.getByRole('menuitem', { name: 'Disable all 1 provider' })
    )
    const options = mockShowConfirmDialog.mock.calls[0][0]
    mockGovernedWorkspaceId.value = 'workspace-two'
    await options.footerProps.onConfirm()

    expect(mockSetAllProvidersEnabled).not.toHaveBeenCalled()
    expect(mockCloseDialog).toHaveBeenCalled()
  })

  it('ignores a disable-all confirmation after the owner loses access', async () => {
    const user = userEvent.setup()
    restrictPolicy()
    renderComponent()

    await openBulkMenu(user)
    await user.click(
      screen.getByRole('menuitem', { name: 'Disable all 1 provider' })
    )
    const options = mockShowConfirmDialog.mock.calls[0][0]
    mockWorkspaceRole.value = 'member'
    await options.footerProps.onConfirm()

    expect(mockSetAllProvidersEnabled).not.toHaveBeenCalled()
    expect(mockCloseDialog).toHaveBeenCalled()
  })

  it('confirms before turning on restrictions', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('switch', { name: allowAllSwitchName }))

    const options = mockShowConfirmDialog.mock.calls[0][0]
    expect(options.headerProps.title).toBe('Restrict access to partner models?')
    await options.footerProps.onConfirm()
    expect(mockSetEnforcementEnabled).toHaveBeenCalledWith(true)
  })

  it('ignores a restriction confirmation after the workspace changes', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('switch', { name: allowAllSwitchName }))
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

    await user.click(screen.getByRole('switch', { name: allowAllSwitchName }))
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

  it('keeps the access toggle in place until the change is confirmed', async () => {
    const user = userEvent.setup()
    renderComponent()
    const toggle = screen.getByRole('switch', { name: allowAllSwitchName })

    await user.click(toggle)

    expect(mockShowConfirmDialog).toHaveBeenCalledOnce()
    expect(toggle.getAttribute('aria-checked')).toBe('true')

    const options = mockShowConfirmDialog.mock.calls[0][0]
    options.footerProps.onCancel()
    await nextTick()

    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(mockSetEnforcementEnabled).not.toHaveBeenCalled()
  })

  it('toggles access mode from the keyboard', async () => {
    const user = userEvent.setup()
    renderComponent()

    screen.getByRole('switch', { name: allowAllSwitchName }).focus()
    await user.keyboard(' ')

    await vi.waitFor(() => expect(mockShowConfirmDialog).toHaveBeenCalledOnce())
  })

  it.for(['loading', 'error'] as const)(
    'locks the access toggle while policy status is %s',
    (status) => {
      mockStatus.value = status
      renderComponent()

      expect(
        screen.getByRole('switch', { name: allowAllSwitchName })
      ).toBeDisabled()
    }
  )

  it.for(['ineligible', 'inactive'] as const)(
    'shows an unavailable state while policy status is %s',
    (status) => {
      mockStatus.value = status
      mockProviders.value = []
      renderComponent()

      expect(
        screen.getByText(
          'Partner model access is unavailable for this workspace.'
        )
      ).toBeInTheDocument()
    }
  )

  it('offers the enterprise dialog when the gated toggle is clicked', async () => {
    const user = userEvent.setup()
    mockStatus.value = 'ineligible'
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderComponent()

    await user.click(screen.getByRole('switch', { name: allowAllSwitchName }))

    expect(mockShowConfirmDialog).toHaveBeenCalledOnce()
    const options = mockShowConfirmDialog.mock.calls[0][0]
    expect(options.headerProps.title).toBe(
      'Restricting partner models is an Enterprise feature'
    )
    expect(options.footerProps.cancelText).toBe('Not now')
    expect(options.footerProps.confirmText).toBe('Contact us')
    await options.footerProps.onConfirm()

    expect(openSpy).toHaveBeenCalledWith(
      'https://comfy.org/cloud/enterprise/',
      '_blank'
    )
    expect(mockCloseDialog).toHaveBeenCalled()
    openSpy.mockRestore()
  })

  it('shows the enterprise upsell when the catalog loads but policy access is forbidden', () => {
    mockStatus.value = 'ineligible'
    renderComponent()

    expect(screen.getByText('Enterprise')).toBeTruthy()
    expect(
      screen.getByText(
        'Restricting partner models is an Enterprise plan feature.'
      )
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Contact us' })).toBeEnabled()
    expect(screen.getByText('2 models')).toBeTruthy()

    const toggle = screen.getByRole('switch', { name: allowAllSwitchName })
    expect(toggle).not.toBeDisabled()
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(
      screen.queryByRole('button', { name: 'Disable all' })
    ).not.toBeInTheDocument()
  })

  it('confirms expanded access when a restricted provider is disabled', async () => {
    const user = userEvent.setup()
    restrictPolicy([{ providerId: 'openai', enabled: false }])
    mockIsProviderEnabled.mockImplementation(
      (providerId: string) => providerId !== 'openai'
    )
    renderComponent()

    await user.click(screen.getByRole('switch', { name: allowAllSwitchName }))

    const options = mockShowConfirmDialog.mock.calls[0][0]
    expect(options.headerProps.title).toBe(
      'Allow access to all partner models?'
    )
    await options.footerProps.onConfirm()
    expect(mockSetEnforcementEnabled).toHaveBeenCalledWith(false)
  })

  it('confirms before returning to unrestricted when every provider is enabled', async () => {
    const user = userEvent.setup()
    restrictPolicy()
    renderComponent()

    await user.click(screen.getByRole('switch', { name: allowAllSwitchName }))

    expect(mockShowConfirmDialog).toHaveBeenCalledOnce()
    expect(mockSetEnforcementEnabled).not.toHaveBeenCalled()
    const options = mockShowConfirmDialog.mock.calls[0][0]
    expect(options.headerProps.title).toBe(
      'Allow access to all partner models?'
    )
    expect(options.props.promptText).toBe(
      'Partner models from every provider will become available to every workspace member. This can take up to 10 minutes to apply across your workspace.'
    )
    await options.footerProps.onConfirm()
    expect(mockSetEnforcementEnabled).toHaveBeenCalledWith(false)
  })

  it('retries a failed load', async () => {
    const user = userEvent.setup()
    mockStatus.value = 'error'
    renderComponent()

    expect(
      screen.getByText("Partner model access couldn't be loaded.")
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(mockLoadPolicy).toHaveBeenCalledOnce()
  })
})
