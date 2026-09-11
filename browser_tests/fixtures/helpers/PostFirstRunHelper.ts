import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { FirstRunNudge } from '@e2e/fixtures/components/FirstRunNudge'
import type { OnboardingCoachmarks } from '@e2e/fixtures/components/Tour'
import {
  CONTINUATION_INPUT,
  FIRST_RUN_CONTINUATION,
  FIRST_RUN_OUTPUT_WIDGET_VALUE,
  FIRST_RUN_START_TEMPLATE_ID
} from '@e2e/fixtures/data/firstRunTour'

export class PostFirstRunHelper {
  constructor(
    private readonly comfyPage: ComfyPage,
    private readonly onboarding: OnboardingCoachmarks,
    private readonly nudge: FirstRunNudge
  ) {}

  async openTour(): Promise<void> {
    const gettingStarted = this.comfyPage.page.getByRole('dialog', {
      name: enMessages.gettingStarted.title
    })
    await expect(gettingStarted).toBeVisible()
    await this.comfyPage.page
      .getByTestId(`getting-started-card-${FIRST_RUN_START_TEMPLATE_ID}`)
      .click()
    await expect(gettingStarted).toBeHidden()
    await expect(this.onboarding.spotlight).toBeVisible()
    await this.onboarding.walkToStep(
      enMessages.onboardingCoachmarks.firstRun.run.title
    )
  }

  async submitFromTour(): Promise<void> {
    await this.comfyPage.runButton.click()
    await expect(
      this.onboarding.card.getByText(
        enMessages.onboardingCoachmarks.firstRun.result.generating.title
      )
    ).toBeVisible()
  }

  async finishTour(): Promise<void> {
    await expect(this.onboarding.card).toHaveAttribute('aria-busy', 'false')
    await this.onboarding.cardDoneButton.click()
    await expect(this.onboarding.card).toBeHidden()
  }

  async expectOutputImage(nodeId: string, filename: string): Promise<void> {
    await expect(
      this.comfyPage.vueNodes.getNodeLocator(nodeId).locator('img')
    ).toHaveAttribute('src', new RegExp(encodeURIComponent(filename)))
  }

  async expectContinuationWithFinalImage(): Promise<void> {
    await expect(this.nudge.root).toBeVisible()
    await expect(this.nudge.actions).toHaveCount(1)

    const requestedTemplate = this.comfyPage.page.waitForRequest(
      `**/templates/${FIRST_RUN_CONTINUATION.templateId}.json`
    )
    await this.nudge.action(FIRST_RUN_CONTINUATION.action).click()
    await requestedTemplate

    await expect(this.nudge.root).toBeHidden()
    await expect.poll(() => this.comfyPage.nodeOps.getNodeCount()).toBe(1)
    await expect
      .poll(() => this.loadedContinuationInput())
      .toBe(FIRST_RUN_OUTPUT_WIDGET_VALUE)

    const image = this.comfyPage.vueNodes
      .getNodeLocator(String(CONTINUATION_INPUT.nodeId))
      .locator('img')
    await expect(image).toBeVisible()
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.naturalWidth)
      )
      .toBeGreaterThan(0)
  }

  async loadedContinuationInput(): Promise<string | null> {
    const inputs = await this.comfyPage.nodeOps.getNodeRefsByType(
      CONTINUATION_INPUT.nodeType
    )
    if (inputs.length !== 1) return null
    const value = await (await inputs[0].getWidgetByName('image')).getValue()
    return typeof value === 'string' ? value : null
  }
}
