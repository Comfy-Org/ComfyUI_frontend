import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { withDesktopLoginApproval } from '@/platform/cloud/onboarding/desktopLoginRedemptionState'

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

async function renderFirstRunTour() {
  const { default: FirstRunTour } = await import('./FirstRunTour.vue')
  return render(FirstRunTour)
}

describe('FirstRunTour desktop sign-in arbitration', () => {
  beforeEach(() => {
    mocks.gettingStartedVisible = true
  })

  it('suspends onboarding while desktop sign-in approval is pending', async () => {
    await renderFirstRunTour()
    expect(screen.getByTestId('getting-started-screen')).toBeInTheDocument()

    let finishApproval!: () => void
    const approval = withDesktopLoginApproval(
      () =>
        new Promise<void>((resolve) => {
          finishApproval = resolve
        })
    )
    await nextTick()

    expect(screen.queryByTestId('getting-started-screen')).toBeNull()

    finishApproval()
    await approval
    await nextTick()

    expect(screen.getByTestId('getting-started-screen')).toBeInTheDocument()
  })
})
