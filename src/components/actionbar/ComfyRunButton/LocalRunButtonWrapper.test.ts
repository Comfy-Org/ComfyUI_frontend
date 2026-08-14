import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import LocalRunButtonWrapper from './LocalRunButtonWrapper.vue'

type PartnerNode = { nodeName: string; displayName: string }

type PartnerRunGate = 'sign-in' | 'add-credits' | 'none'

const gateState = vi.hoisted(() => ({
  gate: undefined as unknown as { value: PartnerRunGate },
  partnerNodes: undefined as unknown as { value: PartnerNode[] }
}))

const showApiNodesSignInDialog = vi.hoisted(() =>
  vi.fn(() => Promise.resolve(false))
)
const showTopUpCreditsDialog = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('@/composables/billing/usePartnerNodesRunGate', async () => {
  const { ref } = await import('vue')
  gateState.gate = ref<PartnerRunGate>('none')
  gateState.partnerNodes = ref<PartnerNode[]>([])
  return {
    usePartnerNodesRunGate: () => ({
      gate: gateState.gate,
      partnerNodes: gateState.partnerNodes
    })
  }
})

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showApiNodesSignInDialog, showTopUpCreditsDialog })
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

vi.mock('@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue', () => ({
  default: {
    name: 'ComfyQueueButton',
    template: '<button data-testid="queue-button" />'
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      actionbar: {
        partnerRunGate: enMessages.actionbar.partnerRunGate
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
    gateState.gate.value = 'none'
    gateState.partnerNodes.value = []
    __setQueueMode('instant')
    showApiNodesSignInDialog.mockClear()
    showTopUpCreditsDialog.mockClear()
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
    gateState.gate.value = 'sign-in'
    renderWrapper()
    expect(screen.queryByTestId('queue-button')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Sign in to run' })
    ).toBeInTheDocument()
    expect(__getQueueMode()).toBe('disabled')
  })

  it('shows Add Credits, opens the top-up dialog, and disables auto-queue when gated', async () => {
    gateState.gate.value = 'add-credits'
    renderWrapper()

    expect(screen.queryByTestId('queue-button')).not.toBeInTheDocument()
    expect(__getQueueMode()).toBe('disabled')
    await userEvent.click(screen.getByRole('button', { name: 'Add Credits' }))

    expect(showTopUpCreditsDialog).toHaveBeenCalledExactlyOnceWith({
      isInsufficientCredits: true
    })
  })

  it('points the gated buttons at the caption explaining why they are gated', () => {
    gateState.gate.value = 'sign-in'
    const { unmount } = renderWrapper()
    expect(
      screen.getByRole('button', { name: 'Sign in to run' })
    ).toHaveAttribute('aria-describedby', 'partner-run-gate-caption')
    unmount()

    gateState.gate.value = 'add-credits'
    renderWrapper()
    expect(screen.getByRole('button', { name: 'Add Credits' })).toHaveAttribute(
      'aria-describedby',
      'partner-run-gate-caption'
    )
  })

  it('moves focus to the queue button when signing in unmounts the gated button', async () => {
    gateState.gate.value = 'sign-in'
    renderWrapper()

    const gatedButton = screen.getByRole('button', { name: 'Sign in to run' })
    gatedButton.focus()
    expect(gatedButton).toHaveFocus()

    gateState.gate.value = 'none'

    await waitFor(() => {
      expect(screen.getByTestId('queue-button')).toHaveFocus()
    })
  })

  it('opens the partner sign-in dialog with every partner node display name', async () => {
    gateState.gate.value = 'sign-in'
    gateState.partnerNodes.value = [
      { nodeName: 'PartnerA', displayName: 'Partner A' },
      { nodeName: 'PartnerB', displayName: 'Partner B' }
    ]
    renderWrapper()

    await userEvent.click(
      screen.getByRole('button', { name: 'Sign in to run' })
    )

    expect(showApiNodesSignInDialog).toHaveBeenCalledExactlyOnceWith([
      'Partner A',
      'Partner B'
    ])
  })
})
