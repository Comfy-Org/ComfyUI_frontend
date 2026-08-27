import { expect, mergeTests } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { TOUR_ROLE_PINS } from '@/renderer/extensions/firstRunTour/roles/tourRolePins'
import type { SupportedTemplateId } from '@/renderer/extensions/firstRunTour/roles/tourRolePins'

import type { BillingStatusResponse } from '@/platform/workspace/api/workspaceApi'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { FirstRunNudge } from '@e2e/fixtures/components/FirstRunNudge'
import { tourStepCount } from '@e2e/fixtures/components/Tour'
import { EMPTY_ASSET_RESPONSE } from '@e2e/fixtures/data/assetFixtures'
import {
  ACTIVE_PERSONAL_BILLING_STATUS,
  ONBOARDING_TOUR_REMOTE_CONFIG
} from '@e2e/fixtures/data/cloudWorkspace'
import {
  FIRST_RUN_START_TEMPLATE_ID,
  queuedPrompt
} from '@e2e/fixtures/data/firstRunTour'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { onboardingFixture } from '@e2e/fixtures/tourFixture'
import type { Position } from '@e2e/fixtures/types'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, onboardingFixture)
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

const INACTIVE_SUBSCRIPTION: BillingStatusResponse = {
  is_active: false,
  max_seats: 1,
  occupied_seats: 1,
  team_credit_stop: null,
  subscription_tier: 'FREE',
  subscription_duration: 'MONTHLY',
  has_funds: false
}

function isPinned(id: string): id is SupportedTemplateId {
  return Object.hasOwn(TOUR_ROLE_PINS, id)
}

async function clearWorkflowHistory(page: Page) {
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('Comfy.Workflow.')) localStorage.removeItem(key)
  })
}

/**
 * The grid backfills whichever curated templates a backend does not serve, so
 * the walk tours a card that is actually on screen rather than a fixed id.
 */
async function firstPinnedTemplateOnScreen(
  page: Page
): Promise<SupportedTemplateId> {
  const cardTestIds = () =>
    page
      .locator(`[data-testid^="${CARD_TESTID_PREFIX}"]`)
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute('data-testid') ?? '')
      )

  await expect
    .poll(
      async () =>
        (await cardTestIds()).some((testId) =>
          isPinned(testId.slice(CARD_TESTID_PREFIX.length))
        ),
      { message: 'the Getting Started grid never rendered a pinned template' }
    )
    .toBe(true)

  const templateId = (await cardTestIds())
    .map((testId) => testId.slice(CARD_TESTID_PREFIX.length))
    .find(isPinned)

  return templateId!
}

const DRAG_BY = { x: 120, y: 80 }

/** The node the spotlight is framing, by the id on its Vue element. */
async function spotlitNodeId(page: Page, spotlight: Locator): Promise<string> {
  let nodeId: string | null = null

  await expect
    .poll(
      async () => {
        const box = await spotlight.boundingBox()
        if (!box) return null

        nodeId = await page.evaluate(
          ({ x, y }) =>
            document
              .elementsFromPoint(x, y)
              .map((element) => element.closest('[data-node-id]'))
              .find(Boolean)
              ?.getAttribute('data-node-id') ?? null,
          { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        )
        return nodeId
      },
      { message: 'the spotlight never framed a Vue node' }
    )
    .not.toBeNull()

  return nodeId!
}

/** Waits until an element's position stops changing between frames. */
async function settled(element: Locator) {
  let previous: number | null = null

  await expect
    .poll(
      async () => {
        const box = await element.boundingBox()
        const stable = box !== null && box.x === previous
        previous = box?.x ?? null
        return stable
      },
      { message: 'the node never stopped moving' }
    )
    .toBe(true)
}

/** Where the spotlight sits relative to the node it frames. */
async function framing(node: Locator, spotlight: Locator) {
  let seen: { node: Position; offset: Position } | null = null

  await expect
    .poll(
      async () => {
        const [nodeBox, spotlightBox] = await Promise.all([
          node.boundingBox(),
          spotlight.boundingBox()
        ])
        if (!nodeBox || !spotlightBox) return null

        seen = {
          node: { x: nodeBox.x, y: nodeBox.y },
          offset: {
            x: spotlightBox.x - nodeBox.x,
            y: spotlightBox.y - nodeBox.y
          }
        }
        return seen
      },
      { message: 'the node and its spotlight never both had layout' }
    )
    .not.toBeNull()

  return seen!
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
      route.fulfill(jsonRoute(ONBOARDING_TOUR_REMOTE_CONFIG))
    )
    await page.route('**/api/billing/status', (route) =>
      route.fulfill(jsonRoute(ACTIVE_PERSONAL_BILLING_STATUS))
    )
    await page.route('**/api/assets**', (route) =>
      route.fulfill(jsonRoute(EMPTY_ASSET_RESPONSE))
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
      route.fulfill(jsonRoute(queuedPrompt(TOUR_JOB_ID)))
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
    const totalSteps = await tourStepCount(card)

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
      await page.route('**/api/billing/status', (route) =>
        route.fulfill(jsonRoute(INACTIVE_SUBSCRIPTION))
      )
    })

    test('leaves the nudge until the upgrade dialog closes', async ({
      comfyPage
    }) => {
      test.slow()
      const { page } = comfyPage
      const { spotlight } = await tourToRunStep(page)
      const nudge = new FirstRunNudge(page).root
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

  test.describe('arriving on a template link', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await clearWorkflowHistory(comfyPage.page)
      await comfyPage.setup({
        clearStorage: false,
        url: `/?template=${FIRST_RUN_START_TEMPLATE_ID}`
      })
    })

    test('tours the template the link loaded', async ({ comfyPage }) => {
      const { page } = comfyPage

      await expect(
        page.getByRole('dialog', { name: GETTING_STARTED_TITLE }),
        'the link already chose a workflow, so there is nothing to choose'
      ).toBeHidden()
      await expect(page.getByTestId('coach-spotlight')).toBeVisible()
      await expect(page.getByTestId('coach-card')).toContainText('Step 1 of')
    })

    /**
     * The tour holds a node's layout ref for the whole tour, while the node's
     * own component holds the same ref only while it is mounted. Whatever
     * unmounts the node -- here a renderer toggle -- must not leave the
     * spotlight watching a ref the store has stopped notifying, or the
     * highlight sits on empty canvas while the user drags the node it is
     * meant to be pointing at.
     */
    test('keeps the spotlight on its node after the node remounts', async ({
      comfyPage,
      comfyMouse,
      onboarding
    }) => {
      const { page } = comfyPage
      await expect(onboarding.spotlight).toBeVisible()

      const nodeId = await spotlitNodeId(page, onboarding.spotlight)
      const node = new VueNodeFixture(comfyPage.vueNodes.getNodeLocator(nodeId))

      // A pan moves every node, so a second node tells a drag from a pan.
      const otherId = (
        await comfyPage.vueNodes.nodes.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute('data-node-id') ?? '')
        )
      ).find((id) => id && id !== nodeId)
      expect(
        otherId,
        'a tour pins a source and a sink, so its graph has more than one node'
      ).toBeDefined()
      const other = comfyPage.vueNodes.getNodeLocator(otherId!)

      // The node component unmounts and comes back; the tour never let go.
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.vueNodes.waitForNodes()
      await expect(onboarding.spotlight).toBeVisible()
      await settled(node.root)

      const before = await framing(node.root, onboarding.spotlight)
      const otherBefore = await framing(other, onboarding.spotlight)

      await comfyMouse.dragElementBy(node.header, DRAG_BY)

      await expect
        .poll(async () => (await node.root.boundingBox())?.x, {
          message: 'the drag never moved the node, so it proves nothing'
        })
        .not.toBe(before.node.x)

      const after = await framing(node.root, onboarding.spotlight)
      const otherAfter = await framing(other, onboarding.spotlight)

      expect(
        otherAfter.node,
        'the untouched node moved too, so this panned the canvas'
      ).toEqual(otherBefore.node)
      expect(
        after.offset.x,
        'the spotlight stopped following its node horizontally'
      ).toBeCloseTo(before.offset.x, 0)
      expect(
        after.offset.y,
        'the spotlight stopped following its node vertically'
      ).toBeCloseTo(before.offset.y, 0)
    })
  })

  test.describe('arriving on a link that loads nothing', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await clearWorkflowHistory(comfyPage.page)
      await comfyPage.setup({
        clearStorage: false,
        url: '/?template=no_such_template_exists'
      })
    })

    test('offers no tour', async ({ comfyPage }) => {
      await expect(
        comfyPage.page.getByTestId('coach-spotlight'),
        'touring a graph the user never asked for is worse than no tour'
      ).toBeHidden()
    })
  })
})
