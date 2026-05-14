import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import CloudRunButtonWrapper from './CloudRunButtonWrapper.vue'

const mockCanAccessSubscriptionFeatures = ref(true)
vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canAccessSubscriptionFeatures: mockCanAccessSubscriptionFeatures
  })
}))

vi.mock('@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue', () => ({
  default: { template: '<div data-testid="queue-button">Queue</div>' }
}))

vi.mock('@/platform/cloud/subscription/components/SubscribeToRun.vue', () => ({
  default: { template: '<div data-testid="subscribe-button">Subscribe</div>' }
}))

describe('CloudRunButtonWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessSubscriptionFeatures.value = true
  })

  it('shows ComfyQueueButton when canAccessSubscriptionFeatures is true', () => {
    mockCanAccessSubscriptionFeatures.value = true
    render(CloudRunButtonWrapper)

    expect(screen.getByTestId('queue-button')).toBeInTheDocument()
    expect(screen.queryByTestId('subscribe-button')).not.toBeInTheDocument()
  })

  it('shows SubscribeToRunButton when canAccessSubscriptionFeatures is false', () => {
    mockCanAccessSubscriptionFeatures.value = false
    render(CloudRunButtonWrapper)

    expect(screen.getByTestId('subscribe-button')).toBeInTheDocument()
    expect(screen.queryByTestId('queue-button')).not.toBeInTheDocument()
  })
})
