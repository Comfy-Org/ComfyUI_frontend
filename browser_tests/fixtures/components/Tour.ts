import { expect } from '@playwright/test'
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
  public readonly spotlight: Locator
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
    this.spotlight = page.getByTestId('coach-spotlight')
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

  /** How many steps the card says the tour has, once it says anything. */
  async stepCount(): Promise<number> {
    await expect(this.card).toContainText(/Step \d+ of \d+/)
    const label = await this.card.textContent()
    return Number(/Step \d+ of (\d+)/.exec(label ?? '')?.[1])
  }

  /**
   * Steps forward until the card parks on the step carrying `title`, whatever
   * the sequence is, and reports how many steps the tour said it had.
   */
  async walkToStep(title: string): Promise<number> {
    const target = this.card.getByText(title)
    const totalSteps = await this.stepCount()

    for (let step = 1; step < totalSteps; step++) {
      await expect(this.card).toContainText(`Step ${step} of ${totalSteps}`)
      if (await target.isVisible()) break
      await this.cardNextButton.click()
    }

    await expect(
      target,
      `the tour ran out of steps before reaching "${title}"`
    ).toBeVisible()
    return totalSteps
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
