import { render, screen } from '@testing-library/vue'
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
const mockToastAdd = vi.fn()

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

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mockToastAdd })
}))

const ToggleSwitchStub = defineComponent({
  name: 'ToggleSwitch',
  props: {
    modelValue: Boolean,
    disabled: Boolean,
    ariaLabel: String
  },
  emits: ['update:modelValue'],
  template: `
    <button
      role="switch"
      :aria-checked="modelValue"
      :aria-label="ariaLabel"
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
  return render(PartnerNodeAllowlistPanel, {
    global: {
      plugins: [i18n],
      stubs: {
        ToggleSwitch: ToggleSwitchStub,
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
  })

  it('groups catalog nodes and reflects the configured allowlist', () => {
    renderPanel()

    expect(screen.getByText('BFL')).toBeInTheDocument()
    expect(screen.getByText('Google')).toBeInTheDocument()
    expect(
      screen.getByRole('switch', {
        name: 'Enforce partner node allowlist'
      })
    ).toBeChecked()
    expect(
      screen.getByRole('switch', { name: 'Allow Flux Fill' })
    ).not.toBeChecked()
    expect(
      screen.getByRole('switch', { name: 'Allow Flux Expand' })
    ).toBeChecked()
    expect(screen.getByText('1 of 2 allowed')).toBeInTheDocument()
  })

  it('saves one whole policy while preserving enforcement and hidden entries', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('switch', { name: 'Allow Flux Fill' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mockSavePolicy).toHaveBeenCalledWith({
      enforcementEnabled: true,
      nodes: {
        FluxFill: true,
        FluxExpand: true,
        VeoVideo: true,
        RetiredNode: false
      }
    })
    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'success',
      summary: 'Partner node policy saved',
      life: 2000
    })
  })

  it('saves enforcement with the existing allowlist', async () => {
    const user = userEvent.setup()
    state.policy.value = {
      enforcementEnabled: false,
      nodes: {
        FluxFill: false,
        FluxExpand: true,
        VeoVideo: true,
        RetiredNode: false
      }
    }
    renderPanel()

    await user.click(
      screen.getByRole('switch', {
        name: 'Enforce partner node allowlist'
      })
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mockSavePolicy).toHaveBeenCalledWith({
      enforcementEnabled: true,
      nodes: {
        FluxFill: false,
        FluxExpand: true,
        VeoVideo: true,
        RetiredNode: false
      }
    })
  })

  it('treats an unconfigured workspace as allow-all draft', async () => {
    state.policy.value = null
    state.status.value = 'unconfigured'
    renderPanel()
    await nextTick()

    expect(
      screen.getByRole('switch', {
        name: 'Enforce partner node allowlist'
      })
    ).not.toBeChecked()
    const nodeToggles = screen.getAllByRole('switch', { name: /^Allow / })
    expect(nodeToggles).toHaveLength(3)
    for (const toggle of nodeToggles) {
      expect(toggle).toBeChecked()
    }
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('filters by provider and node identity', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.type(
      screen.getByPlaceholderText('Search partner nodes...'),
      'veo'
    )

    expect(screen.getByText('Veo Video')).toBeInTheDocument()
    expect(screen.queryByText('Flux Fill')).not.toBeInTheDocument()
    expect(screen.getByText('Google')).toBeInTheDocument()
  })

  it('preserves draft changes when the partner node catalog refreshes', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('switch', { name: 'Allow Flux Fill' }))
    state.partnerNodes.value = [...state.partnerNodes.value]
    await nextTick()

    expect(
      screen.getByRole('switch', { name: 'Allow Flux Fill' })
    ).toBeChecked()
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

  it('keeps draft changes and surfaces a save failure', async () => {
    const user = userEvent.setup()
    mockSavePolicy.mockRejectedValue(new Error('Conflict'))
    renderPanel()

    const toggle = screen.getByRole('switch', { name: 'Allow Flux Fill' })
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(toggle).toBeChecked()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Partner node policy could not be saved.'
    )
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

    await user.click(screen.getByRole('switch', { name: 'Allow Flux Fill' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      screen.getByRole('switch', { name: 'Allow Flux Fill' })
    ).toBeDisabled()

    state.governedWorkspaceId.value = 'workspace-two'
    await nextTick()

    expect(
      screen.getByRole('switch', { name: 'Allow Flux Fill' })
    ).not.toBeDisabled()

    rejectSave(new Error('Conflict'))
    await Promise.resolve()
    await Promise.resolve()

    expect(
      screen.queryByText('Allowlist could not be saved.')
    ).not.toBeInTheDocument()
  })
})
