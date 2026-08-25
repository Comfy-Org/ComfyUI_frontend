import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { withDesktopLoginApproval } from '@/platform/cloud/onboarding/desktopLoginRedemptionState'

import FirstRunTour from './FirstRunTour.vue'

const mocks = vi.hoisted(() => ({
  gettingStartedVisible: false
}))

vi.mock('./gettingStarted/firstRunEntry', async () => {
  const { computed } = await import('vue')
  return {
    useFirstRunEntry: () => ({
      gettingStartedVisible: computed(() => mocks.gettingStartedVisible)
    })
  }
})

vi.mock('./gettingStarted/GettingStartedScreen.vue', () => ({
  default: {
    template: '<div data-testid="getting-started-screen" />'
  }
}))

vi.mock('./nudge/FirstRunTourNudge.vue', () => ({
  default: { template: '<div />' }
}))

vi.mock('./tour/useFirstRunTourController', () => ({
  useFirstRunTourController: vi.fn()
}))

describe('FirstRunTour desktop sign-in arbitration', () => {
  beforeEach(() => {
    mocks.gettingStartedVisible = true
  })

  it.for([
    ['approved', true],
    ['declined', false],
    ['dismissed', null]
  ] as const)(
    'suspends onboarding until desktop sign-in is %s',
    async ([_label, result]) => {
      render(FirstRunTour)
      expect(screen.getByTestId('getting-started-screen')).toBeInTheDocument()

      let finishApproval!: (result: boolean | null) => void
      const approval = withDesktopLoginApproval(
        () =>
          new Promise<boolean | null>((resolve) => {
            finishApproval = resolve
          })
      )
      await nextTick()

      expect(screen.queryByTestId('getting-started-screen')).toBeNull()

      finishApproval(result)
      await approval
      await nextTick()

      expect(screen.getByTestId('getting-started-screen')).toBeInTheDocument()
    }
  )
})
