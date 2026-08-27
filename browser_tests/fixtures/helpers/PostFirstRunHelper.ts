import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { TOUR_ROLE_PINS } from '@/renderer/extensions/firstRunTour/roles/tourRolePins'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { OnboardingCoachmarks } from '@e2e/fixtures/components/Tour'
import {
  CONTINUATION_INPUT,
  FIRST_RUN_JOB_ID,
  FIRST_RUN_OUTPUT,
  FIRST_RUN_START_TEMPLATE_ID,
  queuedPrompt
} from '@e2e/fixtures/data/firstRunTour'
import type { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const { firstRun } = enMessages.onboardingCoachmarks

/**
 * The roles the tour reads off the synthetic graph. The graph asset carries
 * these ids by hand, so the run addresses the sink through the pin rather than
 * a literal — a renumbered pin then moves both together.
 */
const START_PINS = TOUR_ROLE_PINS[FIRST_RUN_START_TEMPLATE_ID]

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
      (route) => route.fulfill(jsonRoute(queuedPrompt(FIRST_RUN_JOB_ID))),
      { times: 1 }
    )

    await expect(gettingStarted).toBeVisible()
    await page
      .getByTestId(`getting-started-card-${FIRST_RUN_START_TEMPLATE_ID}`)
      .click()

    await expect(gettingStarted).toBeHidden()
    await expect(
      this.onboarding.spotlight,
      `the tour has to start, which needs the synthetic graph to carry ${FIRST_RUN_START_TEMPLATE_ID}'s pinned roles: ${JSON.stringify(START_PINS)}`
    ).toBeVisible()

    await this.onboarding.walkToStep(firstRun.run.title)

    await this.comfyPage.runButton.click()
    await expect(
      this.onboarding.card.getByText(firstRun.result.generating.title),
      'the run outlives its step, so the click moves the tour on and Result reports it'
    ).toBeVisible({ timeout: 15_000 })

    this.execution.executionStart(FIRST_RUN_JOB_ID)
    this.execution.executed(FIRST_RUN_JOB_ID, String(START_PINS.sink.id), {
      images: [FIRST_RUN_OUTPUT]
    })
    this.execution.executionSuccess(FIRST_RUN_JOB_ID)

    await expect(
      this.onboarding.card.getByText(firstRun.result.image.title),
      'the run produced an image, so Result has to stop saying it is still coming'
    ).toBeVisible({ timeout: 15_000 })
    await this.onboarding.cardDoneButton.click()
    await expect(this.onboarding.card).toBeHidden()
  }

  /**
   * The value the continuation's declared image input is carrying, or null
   * while the graph swap has yet to settle on exactly one such node.
   */
  async loadedContinuationInput(): Promise<string | null> {
    const inputs = await this.comfyPage.nodeOps.getNodeRefsByType(
      CONTINUATION_INPUT.nodeType
    )
    if (inputs.length !== 1) return null
    const value = await (await inputs[0].getWidgetByName('image')).getValue()
    return typeof value === 'string' ? value : null
  }
}
