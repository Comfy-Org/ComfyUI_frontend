import { expect, mergeTests } from '@playwright/test'
import type { Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { TOUR_ROLE_PINS } from '@/renderer/extensions/firstRunTour/roles/tourRolePins'
import type { SupportedTemplateId } from '@/renderer/extensions/firstRunTour/roles/tourRolePins'

import type { PromptResponse } from '@comfyorg/ingest-types'

import type { CloudSubscriptionStatusResponse } from '@/platform/cloud/subscription/composables/useSubscription'
import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
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

function isPinned(id: string): id is SupportedTemplateId {
  return Object.hasOwn(TOUR_ROLE_PINS, id)
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
    // Without this the toolbar offers Subscribe to Run, and the tour's paywall
    // guard consumes that click instead of running anything.
    await page.route('**/customers/cloud-subscription-status', (route) =>
      route.fulfill(jsonRoute(ACTIVE_SUBSCRIPTION))
    )
    await page.addInitScript(() => {
      const style = document.createElement('style')
      style.textContent = '.p-toast { pointer-events: none !important; }'
      document.addEventListener('DOMContentLoaded', () =>
        document.head.append(style)
      )
    })
  })

  /**
   * The shared half of the walk: a fresh user reaches Getting Started, picks a
   * pinned template, and the tour guides them to Run — where the outcomes part.
   * The run is queued under a known id so WS events can address it afterwards.
   */
  async function tourToGeneratingStep(page: Page) {
    const screen = page.getByRole('dialog', { name: GETTING_STARTED_TITLE })
    const spotlight = page.getByTestId('coach-spotlight')
    const card = page.getByTestId('coach-card')

    await page.route('**/api/prompt', (route) =>
      route.fulfill(jsonRoute(QUEUED_PROMPT))
    )

    await expect(screen).toBeVisible()

    const templateId = await firstPinnedTemplateOnScreen(page)
    await page.getByTestId(`getting-started-card-${templateId}`).click()

    await expect(screen).toBeHidden()
    await expect(
      spotlight,
      'picking a template must spotlight the graph it loaded'
    ).toBeVisible()
    await expect(card).toContainText('Step 1 of')

    const next = card.getByRole('button', { name: 'Next' })
    const runTitle = card.getByText(RUN_STEP_TITLE)
    await expect(async () => {
      await next.click()
      await expect(runTitle).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 30_000 })

    await expect(
      next,
      'the Run step must offer no way forward except running'
    ).toBeHidden()

    await page.getByTestId('queue-button').click()

    await expect(
      card.getByText(GENERATING_TITLE),
      'the run outlives its step, so the click moves the tour on and Result reports it'
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('coach-busy')).toBeVisible()

    return { card, spotlight }
  }

  wstest(
    'guides a first-run user from a template to a finished result',
    async ({ comfyPage, getWebSocket }) => {
      // A template load, three camera flights and a queued run do not fit the default budget.
      test.slow()
      const { page } = comfyPage
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())

      const { card } = await tourToGeneratingStep(page)

      execution.executionStart(TOUR_JOB_ID)
      execution.executionSuccess(TOUR_JOB_ID)

      await expect(
        card.getByText(RESULT_IMAGE_TITLE),
        'the run finished, so the Result step has to stop saying it is still coming'
      ).toBeVisible({ timeout: 15_000 })
      await expect(
        page.getByTestId('coach-busy'),
        'nothing is in flight once the run succeeds'
      ).toBeHidden()
    }
  )

  wstest(
    'tells a first-run user when the run produced nothing',
    async ({ comfyPage, getWebSocket }) => {
      test.slow()
      const { page } = comfyPage
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())

      const { card } = await tourToGeneratingStep(page)

      execution.executionStart(TOUR_JOB_ID)
      execution.executionError(TOUR_JOB_ID, '1', 'the run blew up')

      await expect(
        card.getByText(RESULT_FAILED_TITLE),
        'announcing a result that does not exist is the bug D2 filed'
      ).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('coach-busy')).toBeHidden()
    }
  )

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
