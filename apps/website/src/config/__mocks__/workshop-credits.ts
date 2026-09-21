import { onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

import type * as realCredits from '../workshop-credits'

type Credits = ReturnType<typeof realCredits.useWorkshopCredits>

function defaults() {
  return {
    balance: computed<Credits['balance']['value']>(() => ({
      status: 'unknown'
    })),
    session: computed<Credits['session']['value']>(() => undefined)
  }
}

const state: Credits = defaults()

const credits: typeof realCredits = {
  balanceToCredits: centsToCredits,
  refreshWorkshopCredits: vi.fn(async () => {}),
  clearTopUpWatch: vi.fn(),
  watchForTopUp: vi.fn(),
  useTopUpWatch: vi.fn(() =>
    computed<ReturnType<typeof realCredits.useTopUpWatch>['value']>(() => ({
      status: 'idle'
    }))
  ),
  useWorkshopCredits: vi.fn(() => {
    onTestFinished(() => {
      Object.assign(state, defaults())
    })
    return state
  })
}

export const {
  balanceToCredits,
  refreshWorkshopCredits,
  clearTopUpWatch,
  watchForTopUp,
  useTopUpWatch,
  useWorkshopCredits
} = credits
export type { TopUpWatchContext } from '../workshop-credits'
