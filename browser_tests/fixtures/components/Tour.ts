import type { Locator, Page } from '@playwright/test'

import { TOUR_SEEN_SETTING } from '@/platform/onboarding/onboardingTours'

export type CoachTour = 'appMode'

/** Accessible name of each tour's in-app replay (help) button. */
const TOUR_REPLAY_BUTTONS: Record<CoachTour, string> = {
  appMode: 'Take a tour of App Mode'
}

/** Coach-mark overlay (src/platform/onboarding/TourOverlay.vue). */
export class OnboardingCoachmarks {
  public readonly landing: Locator
  public readonly landingStartButton: Locator
  public readonly landingSkipButton: Locator
  /** The current spotlight step card (the dialog carrying a "Step N of M" label). */
  public readonly card: Locator
  public readonly cardNextButton: Locator
  public readonly cardDoneButton: Locator

  constructor(public readonly page: Page) {
    this.landing = page.getByTestId('coach-landing')
    this.landingStartButton = this.landing.getByRole('button', {
      name: 'Start tutorial'
    })
    this.landingSkipButton = this.landing.getByRole('button', {
      name: 'Skip',
      exact: true
    })
    this.card = page.getByRole('dialog').filter({ hasText: /Step \d+ of \d+/ })
    this.cardNextButton = this.card.getByRole('button', { name: 'Next' })
    this.cardDoneButton = this.card.getByRole('button', { name: 'Done' })
  }

  /** The tour's in-app help button, which replays it past the seen-flag. */
  replayButton(tour: CoachTour): Locator {
    return this.page.getByRole('button', { name: TOUR_REPLAY_BUTTONS[tour] })
  }

  /** The spotlight card while it is showing the given step number. */
  cardForStep(step: number): Locator {
    return this.card.filter({ hasText: new RegExp(`Step ${step} of `) })
  }

  /**
   * Clears the pre-seeded seen-flag (so dismissal assertions observe it being
   * set again) and clicks the tour's replay button, which must be mounted.
   */
  async startTour(tour: CoachTour) {
    await this.clearSeen()
    await this.replayButton(tour).click()
  }

  private async clearSeen() {
    await this.page.evaluate(
      async (key) => window.app!.extensionManager.setting.set(key, []),
      TOUR_SEEN_SETTING
    )
  }

  /** An element a tour points at, by its `data-coach-id` anchor. */
  coachAnchor(id: string): Locator {
    return this.page.locator(`[data-coach-id="${id}"]`)
  }

  async seen(tour: CoachTour): Promise<boolean> {
    const seen = await this.page.evaluate(
      async (key) =>
        (await window.app!.extensionManager.setting.get(key)) as
          | string[]
          | undefined,
      TOUR_SEEN_SETTING
    )
    return !!seen?.includes(tour)
  }
}
