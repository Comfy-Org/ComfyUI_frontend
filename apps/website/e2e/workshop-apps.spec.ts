import type { BrowserContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import {
  MODELS_WORKSPACE_TOKEN,
  test as signedInTest
} from './fixtures/modelsAccount'
import { mockReshootProxy } from './fixtures/reshootProxy'

async function mockFlags(
  context: BrowserContext,
  flags: {
    apps: boolean
    workflows: boolean
    auth?: boolean
    reshoot?: boolean
  }
) {
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
          contentType: 'application/json',
          json: {
            featureFlags: {
              'workshop-enabled': true,
              'workshop-apps-enabled': flags.apps,
              'workshop-workflows-enabled': flags.workflows,
              'workshop-reshoot-app-enabled': flags.reshoot ?? true,
              ...(flags.auth ? { 'workshop-auth': true } : {})
            },
            featureFlagPayloads: {}
          }
        })
      : route.abort('blockedbyclient')
  )
}

/**
 * Signs in with a workspace, opens Re-shoot on the example clip and waits
 * for the app proxy (mocked) to read its scene, so the viewport is aimable.
 */
async function openReadReshootScene(
  page: Page,
  context: BrowserContext,
  account: { email: string; password: string }
) {
  await mockFlags(context, { apps: true, workflows: false, auth: true })
  // Firebase waits for gapi's onload, which the empty stub never calls.
  await context.route('https://apis.google.com/js/api.js*', (route) =>
    route.abort('blockedbyclient')
  )
  const proxy = await mockReshootProxy(page, MODELS_WORKSPACE_TOKEN)
  await page.goto('/login/')
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/models/apps/reshoot/')
  await page.getByText('Sci-fi pilot').first().click()
  await expect(page.getByTestId('reshoot-drag-hint')).toBeVisible()
  expect(proxy).toEqual(
    expect.arrayContaining([
      'POST /assets',
      'POST /jobs',
      'GET /jobs/e2e-reshoot-analyze/outputs/geo/content'
    ])
  )
}

test('opens Cinematic Studio on the apps flag alone', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/models/apps/cinematic-studio/')
  await expect(page.getByTestId('cinematic')).toBeVisible()
  await expect(page.getByText('Cinematic Studio is not open yet')).toHaveCount(
    0
  )
})

test('keeps Cinematic Studio closed on the workflows flag alone', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: false, workflows: true })
  await page.goto('/models/apps/cinematic-studio/')
  await expect(page.getByText('Cinematic Studio is not open yet')).toBeVisible()
  await expect(page.getByTestId('cinematic')).toHaveCount(0)
})

test('lists both apps in the catalogue Apps tab, on /models/apps/ pages', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/models/?type=apps')
  const shelf = page.getByTestId('app-shelf')
  const cards = shelf.getByRole('link')
  await expect(cards).toHaveCount(2)
  await expect(cards.nth(0)).toHaveAttribute(
    'href',
    '/models/apps/cinematic-studio/'
  )
  await expect(cards.nth(1)).toHaveAttribute('href', '/models/apps/reshoot/')
  await expect(
    page.getByRole('button', { name: /Browse all apps/ })
  ).toHaveCount(0)
})

test('hides Re-shoot from the Apps tab and closes its page while its flag is off', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false, reshoot: false })
  await page.goto('/models/?type=apps')
  const cards = page.getByTestId('app-shelf').getByRole('link')
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toHaveAttribute(
    'href',
    '/models/apps/cinematic-studio/'
  )

  await page.goto('/models/apps/reshoot/')
  await expect(page.getByText('Cinematic Studio is not open yet')).toBeVisible()
  await expect(page.getByTestId('reshoot')).toHaveCount(0)
})

test('opens Re-shoot once its flag is on', async ({ page, context }) => {
  await mockFlags(context, { apps: true, workflows: false, reshoot: true })
  await page.goto('/models/apps/reshoot/')
  await expect(page.getByTestId('reshoot')).toBeVisible()
  await expect(page.getByText('Cinematic Studio is not open yet')).toHaveCount(
    0
  )
})

test('sends the old studio address to the app page it named', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/cinematic-studio/?app=reshoot&ux=d&model=flux')
  await expect(page).toHaveURL(/\/models\/apps\/reshoot\/\?ux=d&model=flux$/)
})

test.describe('GitHub links to published app repositories', () => {
  for (const { path, repo } of [
    {
      path: '/models/apps/cinematic-studio/',
      repo: 'https://github.com/Comfy-Org/comfy-cinematic-studio'
    },
    {
      path: '/models/apps/reshoot/',
      repo: 'https://github.com/Comfy-Org/comfy-reshoot'
    }
  ])
    test(`links to the app repository on ${path}`, async ({
      page,
      context
    }) => {
      await mockFlags(context, { apps: true, workflows: false })
      await page.goto(path)
      await expect(page.getByText('GitHub · Coming soon')).toHaveCount(0)
      const link = page.getByRole('link', { name: 'View on GitHub' })
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute('href', repo)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
})

test('asks Safari for a first frame on the Re-shoot example video tile', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/models/apps/reshoot/')
  await expect(page.getByTestId('example-video')).toHaveAttribute(
    'src',
    /#t=0\.1$/
  )
})

signedInTest(
  '@mobile keeps the Re-shoot aim badges to one line on a phone',
  async ({ page, context, modelsAccount }) => {
    await openReadReshootScene(page, context, modelsAccount)

    const viewport = page.getByTestId('reshoot-viewport').first()
    await expect(
      viewport.getByText('Drag to orbit', { exact: true })
    ).toBeVisible()
    await expect(viewport.getByText(/Scroll to move closer/)).toBeHidden()

    for (const badge of [
      viewport.getByTestId('reshoot-drag-hint'),
      viewport.getByTestId('reshoot-angle-readout')
    ]) {
      const box = await badge.boundingBox()
      expect(box?.height).toBeLessThan(40)
    }
  }
)

signedInTest(
  '@mobile pins the Re-shoot preview while the camera controls scroll under it',
  async ({ page, context, modelsAccount }) => {
    await openReadReshootScene(page, context, modelsAccount)

    const frame = page.getByTestId('reshoot-frame')
    const distance = page.getByRole('slider', { name: /Distance/ })
    await page.getByTestId('reshoot-action').scrollIntoViewIfNeeded()
    const pinned = await frame.boundingBox()
    expect(pinned?.y).toBeGreaterThanOrEqual(0)
    expect(pinned?.y).toBeLessThan(120)

    const before = Number(await distance.inputValue())
    await page.getByRole('button', { name: 'Move the camera closer' }).tap()
    await expect
      .poll(async () => Number(await distance.inputValue()))
      .toBeLessThan(before)
  }
)

test('keeps the Re-shoot camera help behind info buttons', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/models/apps/reshoot/')
  await page.getByText('Sci-fi pilot').first().click()

  const help = 'Distance is approximate; angles give the most control.'
  await expect(page.getByText(help)).toBeHidden()
  await page.getByRole('button', { name: help }).hover()
  await expect(page.getByText(help).first()).toBeVisible()
})

test('shows a preview frame for every Cinematic Studio shot option', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/models/apps/cinematic-studio/')
  await page
    .getByRole('button', { name: /^Framing\b/ })
    .first()
    .click()

  const shots = page.getByRole('radiogroup', { name: 'Framing' })
  await expect(shots.getByRole('radio')).toHaveCount(8)
  await expect(
    shots.locator('img[src^="/images/cinematic-studio/options/shot-"]')
  ).toHaveCount(7)
  for (const id of [
    'xwide',
    'wide',
    'medium',
    'close',
    'xclose',
    'ots',
    'low'
  ]) {
    await expect(
      shots.locator(
        `img[src="/images/cinematic-studio/options/shot-${id}.jpg"]`
      )
    ).toHaveCount(1)
  }
})

test('matches the Cinematic Studio grade to an uploaded image', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/models/apps/cinematic-studio/')

  await expect(
    page.getByRole('button', { name: /Add a palette reference/ })
  ).toHaveCount(0)
  await page.getByRole('button', { name: /^Grade/ }).click()
  await page
    .getByTestId('cinematic-grade-image-input')
    .setInputFiles('public/images/cinematic-studio/neon-street.jpg')

  await expect(page.getByRole('button', { name: /^Grade/ })).toContainText(
    'Your image'
  )
})
