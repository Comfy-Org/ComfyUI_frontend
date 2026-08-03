import { expect, mergeTests } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { TOUR_ROLE_PINS } from '@/renderer/extensions/firstRunTour/roles/tourRolePins'
import type { SupportedTemplateId } from '@/renderer/extensions/firstRunTour/roles/tourRolePins'

import type { PromptResponse } from '@comfyorg/ingest-types'

import type { AssetResponse } from '@/platform/assets/schemas/assetSchema'
import type { CloudSubscriptionStatusResponse } from '@/platform/cloud/subscription/composables/useSubscription'
import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'

const wstest = mergeTests(test, webSocketFixture)

const { firstRun } = enMessages.onboardingCoachmarks
const GETTING_STARTED_TITLE = enMessages.gettingStarted.title
const RUN_STEP_TITLE = firstRun.run.title
const GENERATING_TITLE = firstRun.result.generating.title
const RESULT_IMAGE_TITLE = firstRun.result.image.title
const RESULT_FAILED_TITLE = firstRun.result.failed.title
const CARD_TESTID_PREFIX = 'getting-started-card-'

/** The prompt id the tour's run is queued under, so WS events can address it. */
const TOUR_JOB_ID = 'first-run-tour-prompt'

/** A prompt the queue accepts, so the walk does not depend on the backend's models. */
const QUEUED_PROMPT: PromptResponse = {
  prompt_id: TOUR_JOB_ID,
  number: 1,
  node_errors: {}
}

const TOUR_FEATURE_FLAGS: RemoteConfig = {
  onboarding_tour_enabled: true,
  subscription_required: true
}

const ACTIVE_SUBSCRIPTION: CloudSubscriptionStatusResponse = {
  is_active: true,
  subscription_id: 'sub_first_run_tour',
  renewal_date: '2099-01-01'
}

const NO_ASSETS: AssetResponse = {
  assets: [],
  total: 0,
  has_more: false
}

function isPinned(id: string): id is SupportedTemplateId {
  return Object.hasOwn(TOUR_ROLE_PINS, id)
}

/** How many steps the card says the tour has, once it says anything. */
async function tourLength(card: Locator): Promise<number> {
  await expect(card).toContainText(/Step \d+ of \d+/)
  const label = await card.textContent()
  return Number(/Step \d+ of (\d+)/.exec(label ?? '')?.[1])
}

/**
 * The grid backfills whichever curated templates a backend does not serve, so
 * the walk tours a card that is actually on screen rather than a fixed id.
 */
async function firstPinnedTemplateOnScreen(
  page: Page
): Promise<SupportedTemplateId> {
  const testIds = await page
    .locator(`[data-testid^="${CARD_TESTID_PREFIX}"]`)
    .evaluateAll((cards) =>
      cards.map((card) => card.getAttribute('data-testid') ?? '')
    )
  const templateId = testIds
    .map((testId) => testId.slice(CARD_TESTID_PREFIX.length))
    .find(isPinned)

  expect(
    templateId,
    `this backend serves none of the pinned templates: ${testIds.join(', ')}`
  ).toBeDefined()
  return templateId!
}

/**
 * The walk the review asked for: a fresh user reaches Getting Started, picks a
 * template, and the tour guides them through to a result.
 */
test.describe('First-run tour', { tag: ['@cloud', '@ui'] }, () => {
  test.use({
    initialSettings: {
      'Comfy.TutorialCompleted': false,
      'Comfy.OnboardingCoachmarks.Seen': ['appMode'],
      'Comfy.VueNodes.Enabled': true
    },
    initialFeatureFlags: { onboarding_tour_enabled: true }
  })

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/features', (route) =>
      route.fulfill(jsonRoute(TOUR_FEATURE_FLAGS))
    )
    await page.route('**/customers/cloud-subscription-status', (route) =>
      route.fulfill(jsonRoute(ACTIVE_SUBSCRIPTION))
    )
    await page.route('**/api/assets**', (route) =>
      route.fulfill(jsonRoute(NO_ASSETS))
    )
  })

  /**
   * The shared half of the walk: a fresh user reaches Getting Started, picks a
   * pinned template, and the tour guides them to Run — where the funded and
   * paywalled branches part. The run is queued under a known id, so whoever
   * goes on to click Run can address it over the websocket.
   */
  async function tourToRunStep(page: Page) {
    const screen = page.getByRole('dialog', { name: GETTING_STARTED_TITLE })
    const spotlight = page.getByTestId('coach-spotlight')
    const card = page.getByTestId('coach-card')

    await page.route('**/api/prompt', (route) =>
      route.fulfill(jsonRoute(QUEUED_PROMPT))
    )

    await expect(screen).toBeVisible()

    const templateId = await firstPinnedTemplateOnScreen(page)
    await page.getByTestId(`${CARD_TESTID_PREFIX}${templateId}`).click()

    await expect(screen).toBeHidden()
    await expect(
      spotlight,
      'picking a template must spotlight the graph it loaded'
    ).toBeVisible()

    const next = card.getByRole('button', { name: 'Next' })
    const runTitle = card.getByText(RUN_STEP_TITLE)
    const totalSteps = await tourLength(card)

    for (let step = 1; step < totalSteps; step++) {
      await expect(card).toContainText(`Step ${step} of ${totalSteps}`)
      if (await runTitle.isVisible()) break
      await next.click()
    }

    await expect(runTitle).toBeVisible()
    await expect(
      next,
      'the Run step must offer no way forward except running'
    ).toBeHidden()

    return { spotlight, card, totalSteps }
  }

  /** Clicks Run and waits for the Result step to admit the run is in flight. */
  async function runFromTourStep(
    page: Page,
    card: Locator,
    totalSteps: number
  ) {
    await page.getByTestId('queue-button').click()

    await expect(
      card.getByText(GENERATING_TITLE),
      'the run outlives its step, so the click moves the tour on and Result reports it'
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      card,
      'Run hands over to the last step, the one spotlighting where output lands'
    ).toContainText(`Step ${totalSteps} of ${totalSteps}`)
  }

  wstest(
    'guides a first-run user from a template to a finished result',
    async ({ comfyPage, getWebSocket }) => {
      // A template load, three camera flights and a queued run do not fit the default budget.
      test.slow()
      const { page } = comfyPage
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())

      const { card, totalSteps } = await tourToRunStep(page)
      await runFromTourStep(page, card, totalSteps)

      execution.executionStart(TOUR_JOB_ID)
      execution.executionSuccess(TOUR_JOB_ID)

      await expect(
        card.getByText(RESULT_IMAGE_TITLE),
        'the run finished, so the Result step has to stop saying it is still coming'
      ).toBeVisible({ timeout: 15_000 })
    }
  )

  wstest(
    'tells a first-run user when the run produced nothing',
    async ({ comfyPage, getWebSocket }) => {
      test.slow()
      const { page } = comfyPage
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())

      const { card, totalSteps } = await tourToRunStep(page)
      await runFromTourStep(page, card, totalSteps)

      execution.executionStart(TOUR_JOB_ID)
      execution.executionError(TOUR_JOB_ID, '1', 'the run blew up')

      await expect(
        card.getByText(RESULT_FAILED_TITLE),
        'announcing a result that does not exist is the bug D2 filed'
      ).toBeVisible({ timeout: 15_000 })
    }
  )

  test.describe('without a subscription', () => {
    test.beforeEach(async ({ page }) => {
      await mockBilling(page)
    })

    test('leaves the nudge until the upgrade dialog closes', async ({
      comfyPage
    }) => {
      test.slow()
      const { page } = comfyPage
      const { spotlight } = await tourToRunStep(page)
      const nudge = page.getByTestId('first-run-nudge')
      const upgradeDialog = page.getByTestId('dialog-overlay')

      await page.getByTestId('subscribe-to-run-button').click()

      await expect(upgradeDialog).toBeVisible()
      await expect(
        spotlight,
        'a tour parked on a button that will never run has nowhere to go'
      ).toBeHidden()
      await expect(nudge, 'the nudge sits below the modal stack').toBeHidden()

      await page.keyboard.press('Escape')

      await expect(upgradeDialog).toBeHidden()
      await expect(
        nudge,
        'the tour ended, so the user still needs somewhere to go next'
      ).toBeVisible({ timeout: 10_000 })
    })
  })

  test('starts no tour for a user who takes the blank canvas', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await page.getByTestId('getting-started-blank').click()

    await expect(
      page.getByRole('dialog', { name: GETTING_STARTED_TITLE })
    ).toBeHidden()
    await expect(page.getByTestId('coach-spotlight')).toBeHidden()
  })
})
