import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { OnboardingCoachmarks } from '@e2e/fixtures/components/Tour'
import {
  FIRST_RUN_JOB_ID,
  FIRST_RUN_OUTPUT,
  FIRST_RUN_START_TEMPLATE_ID,
  QUEUED_FIRST_RUN_PROMPT
} from '@e2e/fixtures/data/postFirstRun'
import type { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const { firstRun } = enMessages.onboardingCoachmarks

/** Drives the complete first-success path that precedes a continuation. */
export class PostFirstRunHelper {
  constructor(
    private readonly comfyPage: ComfyPage,
    private readonly onboarding: OnboardingCoachmarks,
    private readonly execution: ExecutionHelper
  ) {}

  async completeTourWithImage(): Promise<void> {
    const { page } = this.comfyPage
    const gettingStarted = page.getByRole('dialog', {
      name: enMessages.gettingStarted.title
    })

    await page.route(
      '**/api/prompt',
      (route) => route.fulfill(jsonRoute(QUEUED_FIRST_RUN_PROMPT)),
      { times: 1 }
    )

    await expect(gettingStarted).toBeVisible()
    await page
      .getByTestId(`getting-started-card-${FIRST_RUN_START_TEMPLATE_ID}`)
      .click()

    await expect(gettingStarted).toBeHidden()
    await expect(this.onboarding.spotlight).toBeVisible()
    await expect(this.onboarding.card).toContainText('Step 1 of 3')

    await this.onboarding.cardNextButton.click()
    await expect(
      this.onboarding.card.getByText(firstRun.run.title)
    ).toBeVisible()

    await this.comfyPage.runButton.click()
    await expect(
      this.onboarding.card.getByText(firstRun.result.generating.title)
    ).toBeVisible({ timeout: 15_000 })

    this.execution.executionStart(FIRST_RUN_JOB_ID)
    this.execution.executed(FIRST_RUN_JOB_ID, '9', {
      images: [FIRST_RUN_OUTPUT]
    })
    this.execution.executionSuccess(FIRST_RUN_JOB_ID)

    await expect(
      this.onboarding.card.getByText(firstRun.result.image.title)
    ).toBeVisible({ timeout: 15_000 })
    await this.onboarding.cardDoneButton.click()
    await expect(this.onboarding.card).toBeHidden()
  }

  async loadedContinuationInput(): Promise<unknown> {
    const loadImages =
      await this.comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    if (loadImages.length !== 1) return null
    return (await loadImages[0].getWidget(0)).getValue()
  }
}
