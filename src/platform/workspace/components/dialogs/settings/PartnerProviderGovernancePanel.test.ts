import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { PartnerProviderPolicy } from '@/platform/workspace/api/partnerNodePolicyApi'
import type { PartnerNodePolicyStatus } from '@/platform/workspace/stores/partnerNodeGovernanceStore'

import PartnerProviderGovernancePanel from './PartnerProviderGovernancePanel.vue'

interface MockConfirmOptions {
  headerProps: { title: string }
  footerProps: { onConfirm: () => void }
}
const mocks = vi.hoisted(() => ({
  closeDialog: vi.fn(),
  loadPolicy: vi.fn(),
  savePolicy: vi.fn(),
  showConfirmDialog: vi.fn((_options: MockConfirmOptions) => ({
    key: 'confirm'
  })),
  toastAdd: vi.fn()
}))

const state = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')
  return {
    governedWorkspaceId: ref<string | null>('workspace-one'),
    policy: ref<PartnerProviderPolicy | null>({
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: true }]
    }),
    providers: ref([
      {
        id: 'openai',
        displayName: 'OpenAI (inc. Sora)',
        nodeCategories: ['OpenAI', 'Sora']
      },
      {
        id: 'kling',
        displayName: 'Kling',
        nodeCategories: ['Kling']
      },
      {
        id: 'route-only',
        displayName: 'Route only',
        nodeCategories: []
      }
    ]),
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

vi.mock('@/components/dialog/confirm/confirmDialog', () => ({
  showConfirmDialog: mocks.showConfirmDialog
}))

vi.mock('@/platform/workspace/stores/partnerNodeGovernanceStore', () => ({
  usePartnerNodeGovernanceStore: () => ({
    ...state,
    isProviderEnabled: (providerId: string) =>
      state.policy.value?.providers.find(
        (provider) => provider.providerId === providerId
      )?.enabled === true,
    createInitialPolicy: () => ({
      enforcementEnabled: false,
      providers: state.providers.value.map((provider) => ({
        providerId: provider.id,
        enabled: true
      }))
    }),
    loadPolicy: mocks.loadPolicy,
    savePolicy: mocks.savePolicy
  })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mocks.toastAdd })
}))

vi.mock('@/scripts/api', () => ({
  api: { getServerFeature: () => 300 }
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog: mocks.closeDialog })
}))

const ProviderPolicySwitchStub = defineComponent({
  name: 'ProviderPolicySwitch',
  props: {
    modelValue: Boolean,
    disabled: Boolean,
    label: String
  },
  emits: ['update:modelValue'],
  template: `
    <button
      role="switch"
      :aria-checked="modelValue"
      :aria-label="label"
      :disabled="disabled"
      @click="$emit('update:modelValue', !modelValue)"
    />
  `
})

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
  return render(PartnerProviderGovernancePanel, {
    global: {
      plugins: [i18n],
      stubs: {
        ProviderPolicySwitch: ProviderPolicySwitchStub,
        SearchInput: SearchInputStub
      }
    }
  })
}

describe('PartnerProviderGovernancePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.governedWorkspaceId.value = 'workspace-one'
    state.policy.value = {
      enforcementEnabled: true,
      providers: [{ providerId: 'openai', enabled: true }]
    }
    state.status.value = 'configured'
    mocks.savePolicy.mockResolvedValue(true)
  })

  it('renders provider-level policy and defaults a new provider to denied', () => {
    renderPanel()

    expect(screen.getByText('OpenAI (inc. Sora)')).toBeInTheDocument()
    expect(screen.getByText('OpenAI, Sora')).toBeInTheDocument()
    expect(
      screen.getByRole('switch', { name: 'Allow OpenAI (inc. Sora)' })
    ).toBeChecked()
    expect(
      screen.getByRole('switch', { name: 'Allow Kling' })
    ).not.toBeChecked()
    expect(screen.queryByText('Route only')).toBeNull()
  })

  it('confirms before leaving restricted mode', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(
      screen.getByRole('switch', {
        name: 'Restrict partner provider access'
      })
    )

    expect(mocks.showConfirmDialog).toHaveBeenCalledOnce()
    expect(mocks.showConfirmDialog.mock.calls[0][0].headerProps.title).toBe(
      'Allow unrestricted partner provider access?'
    )
    mocks.showConfirmDialog.mock.calls[0][0].footerProps.onConfirm()
    await waitFor(() =>
      expect(
        screen.getByRole('switch', {
          name: 'Restrict partner provider access'
        })
      ).not.toBeChecked()
    )
  })

  it('confirms before entering restricted mode', async () => {
    const user = userEvent.setup()
    state.policy.value = {
      enforcementEnabled: false,
      providers: [{ providerId: 'openai', enabled: true }]
    }
    renderPanel()

    await user.click(
      screen.getByRole('switch', {
        name: 'Restrict partner provider access'
      })
    )

    expect(mocks.showConfirmDialog.mock.calls[0][0].headerProps.title).toBe(
      'Restrict partner provider access?'
    )
  })

  it('creates an unrestricted allow-all document from the setup flow', async () => {
    const user = userEvent.setup()
    state.policy.value = null
    state.status.value = 'unconfigured'
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Set up governance' }))

    expect(mocks.savePolicy).toHaveBeenCalledWith({
      enforcementEnabled: false,
      providers: [
        { providerId: 'openai', enabled: true },
        { providerId: 'kling', enabled: true },
        { providerId: 'route-only', enabled: true }
      ]
    })
  })

  it('saves one complete provider policy document', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('switch', { name: 'Allow Kling' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mocks.savePolicy).toHaveBeenCalledWith({
      enforcementEnabled: true,
      providers: [
        { providerId: 'openai', enabled: true },
        { providerId: 'kling', enabled: true },
        { providerId: 'route-only', enabled: false }
      ]
    })
    expect(mocks.toastAdd).toHaveBeenCalledWith({
      severity: 'success',
      summary: 'Provider policy saved',
      life: 2000
    })
  })

  it('shows the server-derived propagation window', () => {
    renderPanel()

    expect(
      screen.getByText('Changes can take up to 5 minutes to apply.')
    ).toBeInTheDocument()
  })

  it('offers retry when policy evaluation is unavailable', async () => {
    const user = userEvent.setup()
    state.status.value = 'unavailable'
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(mocks.loadPolicy).toHaveBeenCalledOnce()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The provider policy could not be loaded.'
    )
  })
})
