import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { TOUR_ROLE_PINS } from '@/renderer/extensions/firstRunTour/roles/tourRolePins'
import type { SupportedTemplateId } from '@/renderer/extensions/firstRunTour/roles/tourRolePins'

import type { AssetResponse } from '@/platform/assets/schemas/assetSchema'
import type { CloudSubscriptionStatusResponse } from '@/platform/cloud/subscription/composables/useSubscription'
import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const GETTING_STARTED_TITLE = enMessages.gettingStarted.title
const CARD_TESTID_PREFIX = 'getting-started-card-'

const TOUR_FEATURE_FLAGS: RemoteConfig = {
  onboarding_tour_enabled: true,
  subscription_required: true
}

const ACTIVE_SUBSCRIPTION: CloudSubscriptionStatusResponse = {
  is_active: true,
  subscription_id: 'sub_first_run_tour',
  renewal_date: '2099-01-01'
}

const NO_ASSETS: AssetResponse = { assets: [], total: 0, has_more: false }

const DRAG_BY = { x: 220, y: 140 }

const BASE_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

function isPinned(id: string): id is SupportedTemplateId {
  return Object.hasOwn(TOUR_ROLE_PINS, id)
}

/** Whether this backend still serves the nodes the tour pins its roles to. */
async function rolesResolve(
  page: Page,
  templateId: SupportedTemplateId
): Promise<boolean> {
  const response = await page.request.get(
    new URL(`/templates/${templateId}.json`, BASE_URL).toString()
  )
  if (!response.ok()) return false

  const workflow = (await response.json()) as {
    nodes?: { id: number | string; type?: string }[]
  }
  const pins = Object.values(TOUR_ROLE_PINS[templateId]).filter(
    (pin): pin is { id: number; type: string } =>
      typeof pin === 'object' && pin !== null && 'id' in pin
  )

  return pins.every((pin) =>
    workflow.nodes?.some(
      (node) => String(node.id) === String(pin.id) && node.type === pin.type
    )
  )
}

/**
 * The grid backfills whichever curated templates a backend does not serve, so
 * the walk tours a template that is on screen *and* whose pinned roles this
 * backend still serves -- an unresolvable pin starts no tour at all.
 */
async function tourableTemplateOnScreen(
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

  const pinned = (await cardTestIds())
    .map((testId) => testId.slice(CARD_TESTID_PREFIX.length))
    .filter(isPinned)

  for (const templateId of pinned) {
    if (await rolesResolve(page, templateId)) return templateId
  }

  throw new Error(
    `no template on screen has resolvable role pins: ${pinned.join(', ')}`
  )
}

/** The node the spotlight is currently framing, by the id on its Vue element. */
async function spotlitNodeId(page: Page, spotlight: Locator): Promise<string> {
  const box = (await spotlight.boundingBox())!
  const nodeId = await page.evaluate(
    ({ x, y }) =>
      document
        .elementsFromPoint(x, y)
        .map((element) => element.closest('[data-node-id]'))
        .find(Boolean)
        ?.getAttribute('data-node-id') ?? null,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  )

  expect(nodeId, 'the spotlight must be framing a Vue node').not.toBeNull()
  return nodeId!
}

async function setVueNodes(page: Page, enabled: boolean) {
  await page.evaluate(
    async (value) =>
      window.app!.extensionManager.setting.set('Comfy.VueNodes.Enabled', value),
    enabled
  )
}

async function dragNodeBy(page: Page, node: Locator, by: typeof DRAG_BY) {
  const box = (await node.boundingBox())!
  const from = { x: box.x + box.width / 2, y: box.y + 12 }

  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + by.x / 2, from.y + by.y / 2, { steps: 8 })
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 })
  await page.mouse.up()
}

/**
 * The tour holds a node's layout ref for the whole tour, while the node's own
 * component holds the same ref only while it is mounted. Whatever unmounts the
 * node -- here a renderer toggle -- must not leave the spotlight watching a
 * ref the store has stopped notifying, or the highlight sits on empty canvas
 * while the user drags the node it is supposed to be pointing at.
 */
test.describe('first-run tour spotlight tracking', { tag: ['@cloud'] }, () => {
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

  test('follows its node after the node remounts', async ({ comfyPage }) => {
    const { page } = comfyPage
    const screen = page.getByRole('dialog', { name: GETTING_STARTED_TITLE })
    const spotlight = page.getByTestId('coach-spotlight')

    await expect(screen).toBeVisible()
    const templateId = await tourableTemplateOnScreen(page)
    await page.getByTestId(`${CARD_TESTID_PREFIX}${templateId}`).click()
    await expect(screen).toBeHidden()
    await expect(spotlight).toBeVisible()

    const nodeId = await spotlitNodeId(page, spotlight)

    // The node component unmounts and comes back; the tour never let go.
    await setVueNodes(page, false)
    await expect(page.locator('[data-node-id]')).toHaveCount(0)
    await setVueNodes(page, true)
    await comfyPage.vueNodes.waitForNodes()
    await expect(spotlight).toBeVisible()

    const before = (await spotlight.boundingBox())!
    await dragNodeBy(page, comfyPage.vueNodes.getNodeLocator(nodeId), DRAG_BY)

    await expect
      .poll(async () => (await spotlight.boundingBox())!.x, {
        message:
          'the spotlight stopped tracking its node, so it frames empty canvas'
      })
      .not.toBe(before.x)
  })
})
