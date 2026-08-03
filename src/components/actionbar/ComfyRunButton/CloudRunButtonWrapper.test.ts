import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import CloudRunButtonWrapper from './CloudRunButtonWrapper.vue'

const mockCanRunWorkflows = ref(true)

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canRunWorkflows: mockCanRunWorkflows
  })
}))

vi.mock('@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue', () => ({
  default: {
    name: 'ComfyQueueButton',
    template: '<div data-testid="queue-button" />'
  }
}))

vi.mock('@/platform/cloud/subscription/components/SubscribeToRun.vue', () => ({
  default: {
    name: 'SubscribeToRun',
    template: '<div data-testid="subscribe-to-run-button" />'
  }
}))

function renderWrapper() {
  return render(CloudRunButtonWrapper)
}

describe('CloudRunButtonWrapper', () => {
  beforeEach(() => {
    mockCanRunWorkflows.value = true
  })

  it('renders the runnable queue button when the subscription is active', () => {
    renderWrapper()

    expect(screen.getByTestId('queue-button')).toBeInTheDocument()
    expect(
      screen.queryByTestId('subscribe-to-run-button')
    ).not.toBeInTheDocument()
  })

  it('locks the run button when the subscription is inactive', () => {
    mockCanRunWorkflows.value = false
    renderWrapper()

    expect(screen.getByTestId('subscribe-to-run-button')).toBeInTheDocument()
    expect(screen.queryByTestId('queue-button')).not.toBeInTheDocument()
  })

  it('unlocks the run button once the subscription becomes active again', async () => {
    mockCanRunWorkflows.value = false
    renderWrapper()

    expect(screen.getByTestId('subscribe-to-run-button')).toBeInTheDocument()

    mockCanRunWorkflows.value = true
    await nextTick()

    expect(screen.getByTestId('queue-button')).toBeInTheDocument()
    expect(
      screen.queryByTestId('subscribe-to-run-button')
    ).not.toBeInTheDocument()
  })
})
