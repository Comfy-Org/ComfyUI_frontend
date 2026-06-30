import type { Locator, Page } from '@playwright/test'

import { nextFrame } from '@e2e/fixtures/utils/timing'

export type CoachTour = 'appMode'

const SEEN_SETTING = 'Comfy.OnboardingCoachmarks.Seen'

/**
 * Coach-mark overlay (src/platform/onboarding/TourOverlay.vue).
 * The card is a `role="dialog"` distinguished from app dialogs by its
 * "Step x of y" label; the spotlight is decorative and located by test id.
 */
export class OnboardingCoachmarks {
  public readonly card: Locator
  public readonly stepLabel: Locator
  public readonly title: Locator
  public readonly skipButton: Locator
  public readonly nextButton: Locator
  public readonly doneButton: Locator
  public readonly spotlight: Locator
  public readonly spotlightRing: Locator
  public readonly landing: Locator
  public readonly landingStartButton: Locator
  public readonly landingSkipButton: Locator

  constructor(public readonly page: Page) {
    this.card = page.getByRole('dialog').filter({ hasText: /Step \d+ of \d+/ })
    this.stepLabel = this.card.getByText(/Step \d+ of \d+/)
    this.title = this.card.getByRole('heading')
    this.skipButton = this.card.getByRole('button', { name: 'Skip' })
    this.nextButton = this.card.getByRole('button', {
      name: 'Next',
      exact: true
    })
    this.doneButton = this.card.getByRole('button', {
      name: 'Done',
      exact: true
    })
    this.spotlight = page.getByTestId('coach-spotlight')
    this.spotlightRing = page.getByTestId('coach-spotlight-ring')
    this.landing = page.getByTestId('coach-landing')
    this.landingStartButton = this.landing.getByRole('button', {
      name: 'Start tutorial'
    })
    this.landingSkipButton = this.landing.getByRole('button', {
      name: 'Skip for now'
    })
  }

  /**
   * Re-navigate with a forced tour (`?coach=` bypasses detection, gates and
   * the seen-flag). Clears the pre-seeded seen-flag afterward so completion
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

  /**
   * Largest px difference between the spotlight box and `target` grown by `pad`
   * on every side. ~0 means the spotlight precisely wraps the target. Poll this
   * to wait out the open-animation settle.
   */
  async spotlightGap(target: Locator, pad = 8): Promise<number> {
    const spot = await this.spotlight.boundingBox()
    const box = await target.boundingBox()
    if (!spot || !box) return Number.POSITIVE_INFINITY
    return Math.max(
      Math.abs(spot.x - (box.x - pad)),
      Math.abs(spot.y - (box.y - pad)),
      Math.abs(spot.width - (box.width + pad * 2)),
      Math.abs(spot.height - (box.height + pad * 2))
    )
  }

  /**
   * Whether the spotlight box encloses `target` (the target is fully spotlit).
   * Unlike {@link spotlightGap} this tolerates the viewport-edge clamp that
   * trims the spotlight's padding when the target hugs a screen edge, so it
   * stays meaningful for edge-anchored targets like the app-mode run button.
   */
  async spotlightCovers(target: Locator, tolerance = 3): Promise<boolean> {
    const spot = await this.spotlight.boundingBox()
    const box = await target.boundingBox()
    if (!spot || !box) return false
    return (
      box.x >= spot.x - tolerance &&
      box.y >= spot.y - tolerance &&
      box.x + box.width <= spot.x + spot.width + tolerance &&
      box.y + box.height <= spot.y + spot.height + tolerance
    )
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
