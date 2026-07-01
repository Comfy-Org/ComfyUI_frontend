import type { Locator, Page } from '@playwright/test'

export type CoachTour = 'appMode'

const SEEN_SETTING = 'Comfy.OnboardingCoachmarks.Seen'

/**
 * Coach-mark overlay (src/platform/onboarding/TourOverlay.vue).
 * The landing dialog opens the tour; spotlight steps and the card are exercised
 * via their `data-coach-id` anchors and the dialog role.
 */
export class OnboardingCoachmarks {
  public readonly landing: Locator
  public readonly landingStartButton: Locator
  public readonly landingSkipButton: Locator
  /** App-mode help button that replays the tour in-place (past the seen-flag). */
  public readonly startTourButton: Locator
  /** The current spotlight step card (the dialog carrying a "Step N of M" label). */
  public readonly card: Locator
  public readonly cardNextButton: Locator

  constructor(public readonly page: Page) {
    this.landing = page.getByTestId('coach-landing')
    this.landingStartButton = this.landing.getByRole('button', {
      name: 'Start tutorial'
    })
    this.landingSkipButton = this.landing.getByRole('button', {
      name: 'Skip for now'
    })
    this.startTourButton = page.getByRole('button', {
      name: 'Take a tour of App Mode'
    })
    this.card = page.getByRole('dialog').filter({ hasText: /Step \d+ of \d+/ })
    this.cardNextButton = this.card.getByRole('button', { name: 'Next' })
  }

  /** The spotlight card while it is showing the given step number. */
  cardForStep(step: number): Locator {
    return this.card.filter({ hasText: new RegExp(`Step ${step} of `) })
  }

  /**
   * Replay the tour from a running app: clears the pre-seeded seen-flag (so
   * dismissal assertions observe it being set again) and clicks the in-app help
   * button, which starts the tour past the seen-flag. The caller must already be
   * in app mode with a populated graph so the button is mounted.
   */
  async startTour() {
    await this.clearSeen()
    await this.startTourButton.click()
  }

  private async clearSeen() {
    await this.page.evaluate(
      async (key) => window.app!.extensionManager.setting.set(key, []),
      SEEN_SETTING
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
      SEEN_SETTING
    )
    return !!seen?.includes(tour)
  }
}
