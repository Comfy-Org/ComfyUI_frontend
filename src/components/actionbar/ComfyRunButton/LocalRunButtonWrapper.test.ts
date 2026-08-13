import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import LocalRunButtonWrapper from './LocalRunButtonWrapper.vue'

const gateState = vi.hoisted(() => ({
  gate: 'none' as 'sign-in' | 'none',
  partnerNodes: [] as { nodeName: string; displayName: string }[]
}))

const showApiNodesSignInDialog = vi.hoisted(() =>
  vi.fn(() => Promise.resolve(false))
)

vi.mock('@/composables/billing/usePartnerNodesRunGate', async () => {
  const { computed } = await import('vue')
  return {
    usePartnerNodesRunGate: () => ({
      gate: computed(() => gateState.gate),
      partnerNodes: computed(() => gateState.partnerNodes)
    })
  }
})

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showApiNodesSignInDialog })
}))

vi.mock('@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue', () => ({
  default: {
    name: 'ComfyQueueButton',
    template: '<button data-testid="queue-button" />'
  }
}))

vi.mock('@/stores/queueSettingsStore', async () => {
  const { reactive, ref } = await import('vue')
  const mode = ref('instant')
  const store = reactive({ mode })
  return {
    useQueueSettingsStore: () => store,
    __setQueueMode: (value: string) => {
      mode.value = value
    },
    __getQueueMode: () => mode.value
  }
})

const queueSettingsModule = await import('@/stores/queueSettingsStore')
const { __setQueueMode, __getQueueMode } =
  queueSettingsModule as typeof queueSettingsModule & {
    __setQueueMode: (value: string) => void
    __getQueueMode: () => string
  }

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      actionbar: {
        partnerRunGate: {
          signInToRun: 'Sign in to run',
          signInCaption: 'Partner nodes require an account'
        }
      }
    }
  }
})

function renderWrapper() {
  return render(LocalRunButtonWrapper, {
    global: { plugins: [i18n], directives: { tooltip: {} } }
  })
}

describe('LocalRunButtonWrapper', () => {
  beforeEach(() => {
    gateState.gate = 'none'
    gateState.partnerNodes = []
    __setQueueMode('instant')
  })

  it('renders the normal queue button when not gated, leaving queue mode alone', () => {
    renderWrapper()
    expect(screen.getByTestId('queue-button')).toBeInTheDocument()
    expect(
      screen.queryByTestId('partner-sign-in-to-run-button')
    ).not.toBeInTheDocument()
    expect(__getQueueMode()).toBe('instant')
  })

  it('replaces the queue button and disables auto-queue when gated', () => {
    gateState.gate = 'sign-in'
    renderWrapper()
    expect(screen.queryByTestId('queue-button')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Sign in to run' })
    ).toBeInTheDocument()
    expect(__getQueueMode()).toBe('disabled')
  })

  it('opens the partner sign-in dialog with all partner node names', async () => {
    gateState.gate = 'sign-in'
    gateState.partnerNodes = [
      { nodeName: 'PartnerA', displayName: 'Partner A' },
      { nodeName: 'PartnerB', displayName: 'Partner B' }
    ]
    renderWrapper()

    await userEvent.click(
      screen.getByRole('button', { name: 'Sign in to run' })
    )

    expect(showApiNodesSignInDialog).toHaveBeenCalledWith([
      'PartnerA',
      'PartnerB'
    ])
  })
})
