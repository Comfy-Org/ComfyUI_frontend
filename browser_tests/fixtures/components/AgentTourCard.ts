import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

/**
 * One card of the Agent panel's onboarding tour
 * (src/workbench/extensions/agent/components/agent/OnboardingCoach.vue).
 *
 * The platform's App Mode tour already has `OnboardingCoachmarks` in ./Tour.ts
 * for the same job; this is the Agent panel's own coach, which is a separate
 * component with its own spotlight test id and its own button set.
 */
export class AgentTourCard {
  public readonly root: Locator
  public readonly spotlight: Locator
  public readonly backButton: Locator
  public readonly skipButton: Locator
  public readonly nextButton: Locator
  public readonly doneButton: Locator

  constructor(
    public readonly page: Page,
    public readonly title: string
  ) {
    this.root = page.getByRole('dialog', { name: title })
    this.spotlight = page.getByTestId('agent-coach-spotlight')
    this.backButton = this.root.getByRole('button', {
      name: enMessages.onboardingCoachmarks.back
    })
    this.skipButton = this.root.getByRole('button', {
      name: enMessages.agent.skip
    })
    this.nextButton = this.root.getByRole('button', { name: enMessages.g.next })
    this.doneButton = this.root.getByRole('button', {
      name: enMessages.onboardingCoachmarks.done
    })
  }

  /**
   * The card is on screen with the given description and progress label, is
   * spotlit, and is fully inside the viewport rather than clipped off an edge.
   */
  async expectShown(description: string, progress: string): Promise<void> {
    await expect(this.root).toBeVisible()
    await expect(this.root).toHaveAccessibleDescription(description)
    await expect(this.root).toContainText(progress)
    await expect(this.spotlight).toBeVisible()
    await expect(this.root).toBeInViewport({ ratio: 1 })
  }
}
