import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import LocalRunButtonWrapper from './LocalRunButtonWrapper.vue'

type PartnerNode = { nodeName: string; displayName: string }

const gateState = vi.hoisted(() => ({
  gate: { value: 'none' as 'sign-in' | 'none' },
  partnerNodes: { value: [] as PartnerNode[] }
}))

const showApiNodesSignInDialog = vi.hoisted(() =>
  vi.fn(() => Promise.resolve(false))
)

vi.mock('@/composables/billing/usePartnerNodesRunGate', async () => {
  const { ref } = await import('vue')
  gateState.gate = ref<'sign-in' | 'none'>('none')
  gateState.partnerNodes = ref<PartnerNode[]>([])
  return {
    usePartnerNodesRunGate: () => ({
      gate: gateState.gate,
      partnerNodes: gateState.partnerNodes
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
    gateState.gate.value = 'none'
    gateState.partnerNodes.value = []
  })

  it('renders the normal queue button when not gated', () => {
    renderWrapper()
    expect(screen.getByTestId('queue-button')).toBeInTheDocument()
    expect(
      screen.queryByTestId('partner-sign-in-to-run-button')
    ).not.toBeInTheDocument()
  })

  it('replaces the queue button with a sign-in button when gated', () => {
    gateState.gate.value = 'sign-in'
    renderWrapper()
    expect(screen.queryByTestId('queue-button')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Sign in to run' })
    ).toBeInTheDocument()
  })

  it('points the gated button at the caption explaining why it is gated', () => {
    gateState.gate.value = 'sign-in'
    renderWrapper()

    expect(
      screen.getByRole('button', { name: 'Sign in to run' })
    ).toHaveAttribute('aria-describedby', 'partner-run-gate-caption')
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

    expect(showApiNodesSignInDialog).toHaveBeenCalledWith([
      'Partner A',
      'Partner B'
    ])
  })
})
