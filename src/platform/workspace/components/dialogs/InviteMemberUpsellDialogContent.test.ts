import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import InviteMemberUpsellDialogContent from './InviteMemberUpsellDialogContent.vue'

const mockCanAccessSubscriptionFeatures = ref(true)
const mockShowSubscriptionDialog = vi.fn()
vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canAccessSubscriptionFeatures: mockCanAccessSubscriptionFeatures,
    showSubscriptionDialog: mockShowSubscriptionDialog
  })
}))

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    template:
      '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click']
  }
}))

describe('InviteMemberUpsellDialogContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessSubscriptionFeatures.value = true
  })

  function renderComponent() {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    const pinia = createTestingPinia({
      createSpy: vi.fn,
      stubActions: false
    })

    return render(InviteMemberUpsellDialogContent, {
      global: {
        plugins: [i18n, pinia]
      }
    })
  }

  describe('canAccessSubscriptionFeatures', () => {
    it('shows single seat message when canAccessSubscriptionFeatures is true', () => {
      mockCanAccessSubscriptionFeatures.value = true
      renderComponent()

      // Should show single seat title (user has subscription but single seat plan)
      expect(
        screen.getByText('Your current plan supports a single seat')
      ).toBeInTheDocument()
    })

    it('shows not subscribed message when canAccessSubscriptionFeatures is false', () => {
      mockCanAccessSubscriptionFeatures.value = false
      renderComponent()

      // Should show not subscribed title (user doesn't have subscription)
      expect(
        screen.getByText('A subscription is required to invite members')
      ).toBeInTheDocument()
    })

    it('shows upgradeToCreator button when canAccessSubscriptionFeatures is true', () => {
      mockCanAccessSubscriptionFeatures.value = true
      renderComponent()

      expect(screen.getByText('Upgrade to Creator')).toBeInTheDocument()
    })

    it('shows viewPlans button when canAccessSubscriptionFeatures is false', () => {
      mockCanAccessSubscriptionFeatures.value = false
      renderComponent()

      expect(screen.getByText('View Plans')).toBeInTheDocument()
    })
  })
})
