import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { PartnerNodePolicy } from '@/platform/workspace/api/partnerNodePolicyApi'
import type { PartnerNodePolicyStatus } from '@/platform/workspace/stores/partnerNodeGovernanceStore'

import PartnerNodeAllowlistPanel from './PartnerNodeAllowlistPanel.vue'

const mockSavePolicy = vi.fn()
const mockLoadPolicy = vi.fn()
const mockConfirm = vi.fn()

const state = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')
  return {
    governedWorkspaceId: ref<string | null>('workspace-one'),
    partnerNodes: ref([
      { id: 'FluxFill', name: 'Flux Fill', provider: 'BFL' },
      { id: 'FluxExpand', name: 'Flux Expand', provider: 'BFL' },
      { id: 'VeoVideo', name: 'Veo Video', provider: 'Google' }
    ]),
    policy: ref<PartnerNodePolicy | null>({
      enforcementEnabled: true,
      nodes: {
        FluxFill: false,
        FluxExpand: true,
        VeoVideo: true,
        RetiredNode: false
      }
    }),
    status: ref<PartnerNodePolicyStatus>('configured')
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
    ...state,
    savePolicy: mockSavePolicy,
    loadPolicy: mockLoadPolicy
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ confirm: mockConfirm })
}))

const SearchInputStub = defineComponent({
  name: 'SearchInput',
  props: {
    modelValue: { type: String, required: true },
    placeholder: String,
    disabled: Boolean
  },
  emits: ['update:modelValue'],
  template: `
    <input
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  `
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderPanel() {
  return render(PartnerNodeAllowlistPanel, {
    global: {
      plugins: [i18n],
      stubs: {
        SearchInput: SearchInputStub
      }
    }
  })
}

describe('PartnerNodeAllowlistPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.governedWorkspaceId.value = 'workspace-one'
    state.partnerNodes.value = [
      { id: 'FluxFill', name: 'Flux Fill', provider: 'BFL' },
      { id: 'FluxExpand', name: 'Flux Expand', provider: 'BFL' },
      { id: 'VeoVideo', name: 'Veo Video', provider: 'Google' }
    ]
    state.policy.value = {
      enforcementEnabled: true,
      nodes: {
        FluxFill: false,
        FluxExpand: true,
        VeoVideo: true,
        RetiredNode: false
      }
    }
    state.status.value = 'configured'
    mockSavePolicy.mockResolvedValue(true)
    mockConfirm.mockResolvedValue(true)
  })

  it('shows restricted provider access and expandable node details', async () => {
    const user = userEvent.setup()
    renderPanel()

    expect(screen.getByRole('button', { name: 'Restricted' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByText('1 of 2 allowed')).toBeInTheDocument()
    expect(
      screen.getByRole('switch', { name: 'Allow all nodes from BFL' })
    ).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'BFL' }))

    expect(screen.getByText('Flux Fill')).toBeInTheDocument()
    expect(screen.getByText('FluxFill')).toBeInTheDocument()
    expect(screen.getByText('Disabled')).toBeInTheDocument()
  })

  it('auto-saves a whole provider while preserving hidden policy entries', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(
      screen.getByRole('switch', { name: 'Allow all nodes from BFL' })
    )

    await waitFor(() =>
      expect(mockSavePolicy).toHaveBeenCalledWith({
        enforcementEnabled: true,
        nodes: {
          FluxFill: true,
          FluxExpand: true,
          VeoVideo: true,
          RetiredNode: false
        }
      })
    )
  })

  it('confirms before entering restricted mode', async () => {
    const user = userEvent.setup()
    state.policy.value = {
      enforcementEnabled: false,
      nodes: { FluxFill: true, FluxExpand: true, VeoVideo: true }
    }
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Restricted' }))

    expect(mockConfirm).toHaveBeenCalledWith({
      title: 'Switch to restricted access?',
      message:
        'Only enabled partner node providers will remain available to workspace members.'
    })
    expect(mockSavePolicy).toHaveBeenCalledWith({
      enforcementEnabled: true,
      nodes: { FluxFill: true, FluxExpand: true, VeoVideo: true }
    })
  })

  it('keeps the current mode when restricted mode is cancelled', async () => {
    const user = userEvent.setup()
    mockConfirm.mockResolvedValue(false)
    state.policy.value = {
      enforcementEnabled: false,
      nodes: { FluxFill: true, FluxExpand: true, VeoVideo: true }
    }
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Restricted' }))

    expect(mockSavePolicy).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Unrestricted' })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('ignores a mode confirmation after the workspace changes', async () => {
    const user = userEvent.setup()
    let confirmMode: (confirmed: boolean) => void = () => undefined
    mockConfirm.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          confirmMode = resolve
        })
    )
    state.policy.value = {
      enforcementEnabled: false,
      nodes: { FluxFill: true, FluxExpand: true, VeoVideo: true }
    }
    renderPanel()

    const clickMode = user.click(
      screen.getByRole('button', { name: 'Restricted' })
    )
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledOnce())

    state.governedWorkspaceId.value = 'workspace-two'
    await nextTick()
    confirmMode(true)
    await clickMode

    expect(mockSavePolicy).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Unrestricted' })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('confirms unrestricted mode when a provider remains disabled', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Unrestricted' }))

    expect(mockConfirm).toHaveBeenCalledWith({
      title: 'Switch to unrestricted access?',
      message:
        'All partner node providers will become available to workspace members.'
    })
    expect(mockSavePolicy).toHaveBeenCalledWith({
      enforcementEnabled: false,
      nodes: {
        FluxFill: false,
        FluxExpand: true,
        VeoVideo: true,
        RetiredNode: false
      }
    })
  })

  it('switches directly to unrestricted mode when every provider is enabled', async () => {
    const user = userEvent.setup()
    state.policy.value = {
      enforcementEnabled: true,
      nodes: { FluxFill: true, FluxExpand: true, VeoVideo: true }
    }
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Unrestricted' }))

    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockSavePolicy).toHaveBeenCalledWith({
      enforcementEnabled: false,
      nodes: { FluxFill: true, FluxExpand: true, VeoVideo: true }
    })
  })

  it('disables all providers in one update', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Disable all' }))

    expect(mockSavePolicy).toHaveBeenCalledWith({
      enforcementEnabled: true,
      nodes: {
        FluxFill: false,
        FluxExpand: false,
        VeoVideo: false,
        RetiredNode: false
      }
    })
  })

  it('makes the provider table read-only in unrestricted mode', () => {
    state.policy.value = {
      enforcementEnabled: false,
      nodes: { FluxFill: false, FluxExpand: true, VeoVideo: true }
    }
    renderPanel()

    expect(
      screen.getByRole('switch', { name: 'Allow all nodes from BFL' })
    ).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Disable all' })
    ).not.toBeInTheDocument()
  })

  it('filters by provider and node identity', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.type(
      screen.getByPlaceholderText('Search partner nodes...'),
      'veo'
    )

    const table = screen.getByRole('table', {
      name: 'Partner node provider access'
    })
    expect(within(table).getByRole('button', { name: 'Google' })).toBeVisible()
    expect(
      within(table).queryByRole('button', { name: 'BFL' })
    ).not.toBeInTheDocument()
  })

  it('reverses provider sort order from the column header', async () => {
    const user = userEvent.setup()
    renderPanel()

    const providerButtons = () =>
      screen
        .getAllByRole('button')
        .filter((button) =>
          ['BFL', 'Google'].includes(button.textContent ?? '')
        )
    expect(providerButtons().map((button) => button.textContent)).toEqual([
      'BFL',
      'Google'
    ])

    await user.click(screen.getByRole('columnheader', { name: 'Provider' }))

    expect(providerButtons().map((button) => button.textContent)).toEqual([
      'Google',
      'BFL'
    ])
  })

  it('offers retry when the policy is unavailable', async () => {
    const user = userEvent.setup()
    state.status.value = 'unavailable'
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(mockLoadPolicy).toHaveBeenCalledOnce()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Partner node policy could not be loaded.'
    )
  })

  it('keeps draft changes and retries a save failure', async () => {
    const user = userEvent.setup()
    mockSavePolicy.mockRejectedValueOnce(new Error('Conflict'))
    renderPanel()

    const toggle = screen.getByRole('switch', {
      name: 'Allow all nodes from BFL'
    })
    await user.click(toggle)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Partner node policy could not be saved.'
    )
    expect(toggle).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(mockSavePolicy).toHaveBeenCalledTimes(2)
  })

  it('clears a save error after reverting to the saved policy', async () => {
    const user = userEvent.setup()
    mockSavePolicy.mockRejectedValueOnce(new Error('Conflict'))
    renderPanel()

    const toggle = screen.getByRole('switch', {
      name: 'Allow all nodes from Google'
    })
    await user.click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Partner node policy could not be saved.'
    )

    await user.click(toggle)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mockSavePolicy).toHaveBeenCalledOnce()
  })

  it('releases the new workspace when a previous save fails', async () => {
    const user = userEvent.setup()
    let rejectSave: (reason?: unknown) => void = () => undefined
    mockSavePolicy.mockImplementation(
      () =>
        new Promise<boolean>((_resolve, reject) => {
          rejectSave = reject
        })
    )
    renderPanel()

    const toggle = screen.getByRole('switch', {
      name: 'Allow all nodes from BFL'
    })
    await user.click(toggle)
    expect(toggle).toBeDisabled()

    state.governedWorkspaceId.value = 'workspace-two'
    await nextTick()

    expect(toggle).not.toBeDisabled()

    rejectSave(new Error('Conflict'))
    await Promise.resolve()
    await Promise.resolve()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
