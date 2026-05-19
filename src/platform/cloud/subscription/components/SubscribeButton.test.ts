import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import SubscribeButton from './SubscribeButton.vue'

const mockCanAccessSubscriptionFeatures = ref(false)
const mockShowSubscriptionDialog = vi.fn()
vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canAccessSubscriptionFeatures: mockCanAccessSubscriptionFeatures,
    showSubscriptionDialog: mockShowSubscriptionDialog
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    subscriptionTier: ref('FREE')
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackSubscription: vi.fn()
  })
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click']
  }
}))

describe('SubscribeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessSubscriptionFeatures.value = false
  })

  function renderComponent(props: { label?: string } = {}) {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    return render(SubscribeButton, {
      global: {
        plugins: [i18n]
      },
      props
    })
  }

  describe('rendering', () => {
    it('renders subscribe button with default label', () => {
      renderComponent()

      expect(screen.getByText('Subscribe')).toBeInTheDocument()
    })

    it('renders subscribe button with custom label', () => {
      renderComponent({ label: 'Custom Subscribe' })

      expect(screen.getByText('Custom Subscribe')).toBeInTheDocument()
    })
  })

  describe('click behavior', () => {
    it('calls showSubscriptionDialog when clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      const button = screen.getByRole('button')
      await user.click(button)

      expect(mockShowSubscriptionDialog).toHaveBeenCalled()
    })
  })

  describe('subscribed event', () => {
    it('emits subscribed when canAccessSubscriptionFeatures becomes true after clicking', async () => {
      const user = userEvent.setup()
      const { emitted } = renderComponent()

      // Click to start awaiting
      const button = screen.getByRole('button')
      await user.click(button)

      // Simulate subscription becoming active
      mockCanAccessSubscriptionFeatures.value = true

      // Wait for watcher to trigger
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(emitted().subscribed).toBeTruthy()
    })
  })
})
