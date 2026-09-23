import { useBillingContext } from '@/composables/billing/useBillingContext'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

import SubscribeToRun from './SubscribeToRun.vue'

const mockCanManageSubscription = ref(true)
const mockIsMdOrLarger = ref(true)

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: true
}))

vi.mock(import('@/platform/telemetry'))

vi.mock<unknown>(import('@vueuse/core'), () => ({
  breakpointsTailwind: { md: 768 },
  createSharedComposable: (composable: () => unknown) => composable,
  useBreakpoints: () => ({
    greaterOrEqual: () => mockIsMdOrLarger
  }),
  useDocumentVisibility: () => ref('visible'),
  useStorage: (_key: string, defaultValue: unknown) => ref(defaultValue)
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      subscription: {
        subscribeToRun: 'Subscribe',
        subscribeToRunFull: 'Subscribe to Run',
        inactive: {
          runLabel: 'Run',
          memberRunTooltip: 'Contact your workspace owner to resubscribe'
        }
      }
    }
  }
})

function renderButton() {
  useWorkspaceUI().permissions = computed(() => ({
    ...useWorkspaceUI().permissions.value,
    canManageSubscription: mockCanManageSubscription.value
  }))
  vi.mocked(useTelemetry).mockReturnValue(null)
  mockBillingContext()
  const user = userEvent.setup()
  const result = render(SubscribeToRun, {
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })
  return { ...result, user }
}

describe('SubscribeToRun', () => {
  beforeEach(() => {
    mockCanManageSubscription.value = true
    mockIsMdOrLarger.value = true
  })

  it('shows the subscribe label for owners who can manage the subscription', () => {
    renderButton()

    expect(screen.getByTestId('subscribe-to-run-button')).toHaveTextContent(
      'Subscribe to Run'
    )
  })

  it('shows a neutral run label for members who cannot subscribe', () => {
    mockCanManageSubscription.value = false
    renderButton()

    const button = screen.getByTestId('subscribe-to-run-button')
    expect(button).toHaveTextContent('Run')
    expect(button).not.toHaveTextContent('Subscribe')
  })

  it('opens the subscription dialog for owners on click', async () => {
    const { user } = renderButton()

    await user.click(screen.getByTestId('subscribe-to-run-button'))

    expect(useBillingContext().showSubscriptionDialog).toHaveBeenCalledOnce()
  })

  it('routes members to the same role-aware dialog on click', async () => {
    mockCanManageSubscription.value = false
    const { user } = renderButton()

    await user.click(screen.getByTestId('subscribe-to-run-button'))

    expect(useBillingContext().showSubscriptionDialog).toHaveBeenCalledOnce()
  })
})
