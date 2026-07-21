import { createTestingPinia } from '@pinia/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import { useWorkspaceOverview } from '@/platform/workspace/composables/useWorkspaceOverview'

const state = vi.hoisted<{
  duration: 'MONTHLY' | 'ANNUAL'
  allowanceTotalCredits: number
  renewalDate: string
}>(() => ({
  duration: 'MONTHLY',
  allowanceTotalCredits: 24_000,
  renewalDate: '2027-04-25T12:00:00Z'
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscription: computed(() => ({
      tier: 'TEAM',
      duration: state.duration
    })),
    renewalDate: computed(() => state.renewalDate)
  })
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionCredits',
  () => ({
    useSubscriptionCredits: () => ({
      allowanceTotalCredits: computed(() => state.allowanceTotalCredits)
    })
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      workspacePanel: {
        overview: {
          perMonth: 'mo',
          perYear: 'year'
        }
      }
    }
  },
  datetimeFormats: {
    en: {
      short: {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }
    }
  }
})

function useOverviewPlan() {
  let result: ReturnType<typeof useWorkspaceOverview> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        result = useWorkspaceOverview()
        return () => h('div')
      }
    })
  )
  app.use(createTestingPinia({ stubActions: false }))
  app.use(i18n)
  app.mount(document.createElement('div'))

  if (!result) throw new Error('Workspace overview was not initialized')
  return { ...result, unmount: () => app.unmount() }
}

describe('useWorkspaceOverview', () => {
  beforeEach(() => {
    state.duration = 'MONTHLY'
    state.allowanceTotalCredits = 24_000
  })

  it('labels the plan credits with the active billing period', () => {
    state.duration = 'ANNUAL'
    state.allowanceTotalCredits = 288_000

    const { plan, unmount } = useOverviewPlan()

    expect(plan.value).toMatchObject({
      cycleCredits: 288_000,
      billingPeriod: 'year'
    })
    unmount()
  })
})
