import type { Locator, Page } from '@playwright/test'

import { nextFrame } from '@e2e/fixtures/utils/timing'

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
   * Re-navigate with a forced tour (`?coach=` bypasses detection and the
   * seen-flag). Clears the pre-seeded seen-flag afterward so completion
   * assertions observe it being set.
   */
  async startTour(tour: CoachTour) {
    await this.page.goto(new URL(`/?coach=${tour}`, this.page.url()).toString())
    await this.page.waitForFunction(() => window.app?.extensionManager)
    await this.page.locator('.p-blockui-mask').waitFor({ state: 'hidden' })
    await this.page.evaluate(
      async (key) => window.app!.extensionManager.setting.set(key, []),
      SEEN_SETTING
    )
    await nextFrame(this.page)
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
