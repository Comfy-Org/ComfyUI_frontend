import type * as VueUseCore from '@vueuse/core'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SubscribeToRun from './SubscribeToRun.vue'

const mockShowSubscriptionDialog = vi.fn()
const mockCanManageSubscription = ref(true)
const mockIsMdOrLarger = ref(true)

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    showSubscriptionDialog: mockShowSubscriptionDialog
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: computed(() => ({
      canManageSubscription: mockCanManageSubscription.value
    }))
  })
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => null
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof VueUseCore>()
  return {
    ...actual,
    useBreakpoints: () => ({
      greaterOrEqual: () => mockIsMdOrLarger
    })
  }
})

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
    vi.clearAllMocks()
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

    expect(mockShowSubscriptionDialog).toHaveBeenCalledOnce()
  })

  it('routes members to the same role-aware dialog on click', async () => {
    mockCanManageSubscription.value = false
    const { user } = renderButton()

    await user.click(screen.getByTestId('subscribe-to-run-button'))

    expect(mockShowSubscriptionDialog).toHaveBeenCalledOnce()
  })
})
