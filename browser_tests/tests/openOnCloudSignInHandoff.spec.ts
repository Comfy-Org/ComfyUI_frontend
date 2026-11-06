import type { Page } from '@playwright/test'

import type { operations } from '@/types/comfyRegistryTypes'

import {
  cloudAppExpect as expect,
  cloudAppFixture as test
} from '@e2e/fixtures/cloudAppFixture'
import {
  CLOUD_SELF_EMAIL,
  CloudAuthHelper
} from '@e2e/fixtures/helpers/CloudAuthHelper'
import {
  mockCloudBoot,
  preselectCloudUser
} from '@e2e/fixtures/utils/cloudBootMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const OPENER_PATH = '/__e2e_local_opener'
const NONCE = '00000000-0000-4000-8000-000000000001'
const FILENAME = 'handed-over.json'

type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']

const HANDED_OVER_WORKFLOW = {
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

/**
 * Plays the local ComfyUI tab: answers the Cloud tab's ready message for
 * `NONCE` with the workflow, the same exchange `openWorkflowOnCloud` runs.
 */
async function openLocalOpener(page: Page): Promise<void> {
  await page.route(`**${OPENER_PATH}`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })
  )
  await page.goto(`${APP_URL}${OPENER_PATH}`)
  await page.evaluate(
    ({ nonce, filename, workflow }) => {
      window.addEventListener('message', (event) => {
        const data: unknown = event.data
        if (
          typeof data !== 'object' ||
          data === null ||
          !('nonce' in data) ||
          data.nonce !== nonce ||
          !event.source
        )
          return
        ;(event.source as Window).postMessage(
          { type: 'comfy-local-handoff:workflow', nonce, filename, workflow },
          '*'
        )
      })
    },
    { nonce: NONCE, filename: FILENAME, workflow: HANDED_OVER_WORKFLOW }
  )
}

async function openSignedOutCloudTab(opener: Page): Promise<Page> {
  const [cloudTab] = await Promise.all([
    opener.waitForEvent('popup'),
    opener.evaluate(() => {
      window.open('about:blank', 'comfy-cloud')
    })
  ])
  await mockCloudBoot(cloudTab, {
    features: { open_on_cloud_enabled: true }
  })
  await preselectCloudUser(cloudTab)
  await cloudTab.route('**/customers', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    return route.fulfill({
      status: 201,
      json: { id: 'test-customer-e2e' } satisfies CreateCustomerResponse
    })
  })
  await new CloudAuthHelper(cloudTab).mockLiveEmailSignIn()
  await opener.evaluate((nonce) => {
    window.open(`/?from_local=${nonce}`, 'comfy-cloud')
  }, NONCE)
  return cloudTab
}

test.describe(
  'Open on Cloud handoff through sign-in',
  { tag: '@cloud' },
  () => {
    test('opens the handed-over workflow after the signed-out Cloud tab signs in', async ({
      page
    }) => {
      await openLocalOpener(page)
      const cloudTab = await openSignedOutCloudTab(page)

      await expect(
        cloudTab.getByRole('heading', { name: 'Log in to your account' })
      ).toBeVisible()
      await cloudTab.getByRole('button', { name: 'Use email instead' }).click()
      await cloudTab.locator('#cloud-sign-in-email').fill(CLOUD_SELF_EMAIL)
      await cloudTab
        .locator('#cloud-sign-in-password')
        .fill('correct-horse-battery-staple')
      await cloudTab.locator('#cloud-sign-in-password').blur()
      await cloudTab.getByRole('button', { name: 'Sign in' }).click()

      await expect(
        cloudTab.getByTestId('toast').filter({
          visible: true,
          hasText: 'Opened from ComfyUI on your computer'
        })
      ).toBeVisible()
      expect(new URL(cloudTab.url()).searchParams.has('from_local')).toBe(false)
    })
  }
)
