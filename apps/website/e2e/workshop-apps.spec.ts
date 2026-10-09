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

  await page.goto('/hub/apps/reshoot/')
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
  await page.goto('/hub/apps/cinematic-studio/')
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
  await page.goto('/hub/apps/cinematic-studio/')
  await expect(page.getByText('Cinematic Studio is not open yet')).toBeVisible()
  await expect(page.getByTestId('cinematic')).toHaveCount(0)
})

test('lists both apps, then the apps still being built, on the hub apps page', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Apps' })
  ).toBeVisible()
  await expect(page.getByTestId('hub-back')).toHaveAttribute('href', '/hub/')
  await expect(
    page.getByText('Ready-made tools, one job each. No nodes, no setup.')
  ).toBeVisible()
  await expect(page.getByTestId('app-featured')).toHaveCount(0)
  const grid = page.getByTestId('app-grid')
  const cards = grid.getByRole('link')
  await expect(cards).toHaveCount(2)
  await expect(cards.nth(0)).toHaveAttribute(
    'href',
    '/hub/apps/cinematic-studio/'
  )
  await expect(cards.nth(1)).toHaveAttribute('href', '/hub/apps/reshoot/')
  for (const card of await cards.all()) {
    await expect(card).toHaveAttribute('target', '_blank')
    await expect(card).toContainText('Open')
  }
  const soon = grid.getByTestId('workshop-app-card').nth(2)
  await expect(soon).toContainText('Move anything')
  await expect(soon).toContainText('Soon')
  await expect(soon).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('button', { name: /Browse all/ })).toHaveCount(0)
})

const APP_MEDIA = 'https://media.comfy.org/website/workshop/apps'

for (const { reducedMotion, paused } of [
  { reducedMotion: 'no-preference', paused: false },
  { reducedMotion: 'reduce', paused: true }
] as const) {
  test(`loads each hub app card's poster and keeps its video thumbnail ${paused ? 'held still' : 'playing'} with ${reducedMotion} motion`, async ({
    page,
    context
  }) => {
    await mockFlags(context, { apps: true, workflows: false })
    await page.emulateMedia({ reducedMotion })
    const posters: string[] = []
    page.on('requestfinished', (request) => {
      if (request.url().endsWith('/poster.jpg')) posters.push(request.url())
    })
    await page.goto('/hub/apps/')

    const artwork = page
      .getByTestId('app-grid')
      .getByRole('link')
      .getByTestId('model-card-media')
    await expect(artwork).toHaveCount(2)
    await artwork.first().scrollIntoViewIfNeeded()
    await expect(artwork.nth(0)).toHaveAttribute(
      'src',
      `${APP_MEDIA}/cinematic-studio/thumbnail-480.mp4`
    )
    await expect(artwork.nth(1)).toHaveAttribute(
      'src',
      `${APP_MEDIA}/reshoot/thumbnail-480.mp4`
    )
    await expect
      .poll(() => posters.toSorted())
      .toEqual([
        `${APP_MEDIA}/cinematic-studio/poster.jpg`,
        `${APP_MEDIA}/reshoot/poster.jpg`
      ])
    await expect(artwork.nth(0)).toHaveJSProperty('paused', paused)
    await expect(artwork.nth(1)).toHaveJSProperty('paused', paused)
  })
}

test('decodes a frame of each hub app card video while it plays', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/')

  const artwork = page
    .getByTestId('app-grid')
    .getByRole('link')
    .getByTestId('model-card-media')
  await expect(artwork).toHaveCount(2)
  await artwork.first().scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      artwork.evaluateAll((videos: HTMLVideoElement[]) =>
        videos.map((video) => video.videoWidth > 0 && video.readyState >= 2)
      )
    )
    .toEqual([true, true])
})

test('hides Re-shoot from the hub apps page and closes its page while its flag is off', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false, reshoot: false })
  await page.goto('/hub/apps/')
  const cards = page.getByTestId('app-grid').getByRole('link')
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toHaveAttribute(
    'href',
    '/hub/apps/cinematic-studio/'
  )

  await page.goto('/hub/apps/reshoot/')
  await expect(page.getByText('Cinematic Studio is not open yet')).toBeVisible()
  await expect(page.getByTestId('reshoot')).toHaveCount(0)
})

test('opens Re-shoot once its flag is on', async ({ page, context }) => {
  await mockFlags(context, { apps: true, workflows: false, reshoot: true })
  await page.goto('/hub/apps/reshoot/')
  await expect(page.getByTestId('reshoot')).toBeVisible()
  await expect(page.getByText('Cinematic Studio is not open yet')).toHaveCount(
    0
  )
})

for (const { path, name } of [
  { path: '/hub/apps/cinematic-studio/', name: 'Cinematic Studio' },
  { path: '/hub/apps/reshoot/', name: 'Re-shoot a video' }
])
  test(`opens ${name} full screen under its own bar, with no site around it`, async ({
    page,
    context
  }) => {
    await mockFlags(context, { apps: true, workflows: false, reshoot: true })
    await page.goto(path)

    const bar = page.getByTestId('app-shell-bar')
    await expect(
      bar.getByRole('heading', { level: 1, name, exact: true })
    ).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(bar.getByText('Beta')).toBeVisible()
    await expect(
      bar.getByRole('link', { name: 'Back to apps' })
    ).toHaveAttribute('href', '/hub/apps/')
    await expect(page.getByTestId('desktop-nav-links')).toHaveCount(0)
    await expect(page.getByRole('contentinfo')).toHaveCount(0)
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' })
    ).toHaveCount(0)
    await expect(page.getByTestId('app-built-with')).toHaveCount(0)
  })

test('opens an app from the hub apps page in a new tab', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/')
  const opened = context.waitForEvent('page')
  await page
    .getByTestId('app-grid')
    .getByRole('link', { name: /Cinematic Studio/ })
    .click()
  const app = await opened
  await expect(app).toHaveURL('/hub/apps/cinematic-studio/')
  await expect(page).toHaveURL('/hub/apps/')
})

test('sends an old catalogue link for the Apps tab to the hub apps page', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/models/?type=apps&q=studio#top')
  await expect(page).toHaveURL('/hub/apps/?q=studio#top')
  await expect(page.getByTestId('app-grid')).toBeVisible()
})

test('keeps an old catalogue link for the Apps tab on the models catalogue while the apps flag is off', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: false, workflows: true })
  await page.goto('/hub/models/?type=apps')
  await expect(
    page.getByRole('searchbox', {
      name: 'Search models, providers, and categories'
    })
  ).toBeVisible()
  await expect(page).toHaveURL('/hub/models/?type=apps')
})

test('shows the showcase instead of the hub apps page while the apps flag is off', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: false, workflows: true })
  await page.goto('/hub/apps/')
  await expect(
    page.getByRole('heading', { level: 1, name: /Grok Imagine/ })
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Apps' })).toHaveCount(0)
  await expect(page.getByTestId('apps-catalogue')).toHaveCount(0)
})

test('sends the old studio address to the app page it named', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/cinematic-studio/?app=reshoot&ux=d&model=flux')
  await expect(page).toHaveURL('/hub/apps/reshoot/?ux=d&model=flux')
})

test.describe('GitHub links to published app repositories', () => {
  for (const { path, repo } of [
    {
      path: '/hub/apps/cinematic-studio/',
      repo: 'https://github.com/Comfy-Org/comfy-cinematic-studio'
    },
    {
      path: '/hub/apps/reshoot/',
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
  await page.goto('/hub/apps/reshoot/')
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
  await page.goto('/hub/apps/reshoot/')
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
  await page.goto('/hub/apps/cinematic-studio/')
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

test('makes a Cinematic Studio grade palette from an uploaded image', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/cinematic-studio/')

  await expect(
    page.getByRole('button', { name: /Add a palette reference/ })
  ).toHaveCount(0)
  await page.getByRole('button', { name: /^Grade/ }).click()
  await page
    .getByTestId('cinematic-grade-image-input')
    .setInputFiles('public/images/cinematic-studio/neon-street.jpg')

  await expect(page.getByRole('button', { name: /^Grade/ })).toContainText(
    'Your palette'
  )
  await page.getByRole('button', { name: 'Edit palette' }).click()
  await page.getByLabel(/^Color 1: #/).click()
  const hex = page.getByRole('textbox', { name: 'Hex color' })
  await hex.fill('#3b1b6e')
  await hex.press('Enter')
  await expect(page.getByLabel('Color 1: #3b1b6e')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Grade/ })).toContainText(
    'Your palette'
  )
})

test('offers the starting frame beside the Cinematic Studio scene in video mode', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/cinematic-studio/')

  await page.getByRole('button', { name: 'Video', exact: true }).click()

  await expect(
    page.getByRole('button', { name: 'Add a starting frame' })
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'References' })).toHaveCount(0)
})

test('@mobile keeps the Cinematic Studio camera badges to one line and the camera sheet steady across tabs', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/cinematic-studio/')

  const specs = page.getByTestId('camera-specs')
  await expect(specs.getByText('+2', { exact: true })).toBeVisible()
  await expect(specs.getByText('50mm', { exact: true })).toBeHidden()
  expect((await specs.boundingBox())?.height).toBeLessThan(32)

  await page.getByRole('button', { name: /^Camera/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Camera' })
  const heights = []
  for (const tab of ['Body', 'Lens', 'Focal length', 'Aperture']) {
    await sheet.getByRole('button', { name: tab, exact: true }).click()
    heights.push((await sheet.boundingBox())?.height)
  }
  expect(new Set(heights).size).toBe(1)
})
