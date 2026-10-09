import type { BrowserContext, Locator, Page } from '@playwright/test'
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
    moveAnything?: boolean
    relight?: boolean
    handProductSwap?: boolean
    spriteSheet?: boolean
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
              'workshop-move-anything-app-enabled': flags.moveAnything ?? true,
              'workshop-relight-app-enabled': flags.relight ?? true,
              'workshop-hand-product-swap-app-enabled':
                flags.handProductSwap ?? true,
              'workshop-sprite-sheet-app-enabled': flags.spriteSheet ?? true,
              ...(flags.auth ? { 'workshop-auth': true } : {})
            },
            featureFlagPayloads: {}
          }
        })
      : route.abort('blockedbyclient')
  )
}

async function openDetectedExample(page: Page) {
  const app = page.getByTestId('move-anything')
  await app.getByRole('button', { name: 'Try the example' }).click()
  await expect(app.getByRole('status')).toContainText('Detecting')
  const kitten = app.getByRole('button', { name: /^Orange kitten\./ })
  await expect(kitten).toBeVisible()
  await expect(app.getByTestId('move-outline')).toHaveCount(3)
  await expect(app.getByText('Drag a thing to move it')).toBeVisible()
  return kitten
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

test('lists every app on the hub apps page, on /hub/apps/ pages', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/')
  await expect(
    page.getByRole('heading', { level: 1, name: 'ComfyUI apps' })
  ).toBeVisible()
  await expect(page.getByTestId('catalogue-tab-apps')).toHaveAttribute(
    'aria-current',
    'page'
  )
  const shelf = page.getByTestId('app-shelf')
  const cards = shelf.getByRole('link')
  await expect(cards).toHaveCount(5)
  await expect(cards.nth(0)).toHaveAttribute(
    'href',
    '/hub/apps/cinematic-studio/'
  )
  await expect(cards.nth(1)).toHaveAttribute('href', '/hub/apps/reshoot/')
  await expect(cards.nth(2)).toHaveAttribute('href', '/hub/apps/move-anything/')
  await expect(cards.nth(3)).toHaveAttribute('href', '/hub/apps/relight/')
  await expect(cards.nth(4)).toHaveAttribute(
    'href',
    '/hub/apps/hand-product-swap/'
  )
  await expect(cards.nth(5)).toHaveAttribute('href', '/hub/apps/sprite-sheet/')
  await expect(
    page.getByRole('button', { name: /Browse all apps/ })
  ).toHaveCount(0)
})

const APP_MEDIA = '/images/apps'

for (const { reducedMotion, paused } of [
  { reducedMotion: 'no-preference', paused: false },
  { reducedMotion: 'reduce', paused: true }
] as const) {
  test(`loads each hub app card's poster and keeps its video thumbnail ${paused ? 'held still' : 'playing'} with ${reducedMotion} motion`, async ({
    page,
    context
  }) => {
    await mockFlags(context, {
      apps: true,
      workflows: false,
      moveAnything: false,
      relight: false,
      handProductSwap: false
    })
    await page.emulateMedia({ reducedMotion })
    const posters: string[] = []
    page.on('requestfinished', (request) => {
      if (request.url().endsWith('/poster.jpg'))
        posters.push(new URL(request.url()).pathname)
    })
    await page.goto('/hub/apps/')

    const artwork = page
      .getByTestId('app-shelf')
      .getByTestId('model-card-media')
    await expect(artwork).toHaveCount(2)
    await expect(artwork.nth(0)).toHaveAttribute(
      'src',
      `${APP_MEDIA}/cinematic-studio/cover.mp4`
    )
    await expect(artwork.nth(1)).toHaveAttribute(
      'src',
      `${APP_MEDIA}/reshoot/cover.mp4`
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
  await mockFlags(context, {
    apps: true,
    workflows: false,
    moveAnything: false,
    relight: false,
    handProductSwap: false
  })
  await page.goto('/hub/apps/')

  const artwork = page.getByTestId('app-shelf').getByTestId('model-card-media')
  await expect(artwork).toHaveCount(2)
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
  const cards = page.getByTestId('app-shelf').getByRole('link')
  await expect(cards).toHaveCount(4)
  await expect(cards.nth(0)).toHaveAttribute(
    'href',
    '/hub/apps/cinematic-studio/'
  )
  await expect(cards.nth(1)).toHaveAttribute('href', '/hub/apps/move-anything/')
  await expect(cards.nth(2)).toHaveAttribute('href', '/hub/apps/relight/')
  await expect(cards.nth(3)).toHaveAttribute(
    'href',
    '/hub/apps/hand-product-swap/'
  )
  await expect(cards.nth(4)).toHaveAttribute('href', '/hub/apps/sprite-sheet/')

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

test('closes Move anything while its flag is off', async ({
  page,
  context
}) => {
  await mockFlags(context, {
    apps: true,
    workflows: false,
    moveAnything: false
  })
  await page.goto('/hub/apps/move-anything/')
  await expect(page.getByText('Cinematic Studio is not open yet')).toBeVisible()
  await expect(page.getByTestId('move-anything')).toHaveCount(0)
})

async function expectDownloadBesideGitHub(app: Locator) {
  const download = await app
    .getByRole('link', { name: 'Download' })
    .boundingBox()
  const github = await app.getByText('GitHub · Coming soon').boundingBox()
  if (!download || !github) throw new Error('no header buttons')
  expect(download.y).toBe(github.y)
  expect(download.x - (github.x + github.width)).toBeLessThanOrEqual(8)
}

async function expectPanelWidth(panel: Locator) {
  expect((await panel.boundingBox())?.width).toBe(280)
}

test('moves a thing from the Move anything side panel and shows the result', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/move-anything/')
  const app = page.getByTestId('move-anything')
  await expect(app.getByTestId('move-empty')).toBeVisible()
  const generate = app.getByTestId('move-generate')
  await expect(generate).toHaveCount(0)

  const kitten = await openDetectedExample(page)
  const panel = app.getByRole('complementary', {
    name: 'Move anything settings'
  })
  await expect(panel).toContainText('kitten.jpg')
  await expectPanelWidth(panel)
  await expect(generate).toBeDisabled()
  await kitten.focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect(generate).toHaveText(/Move 1 object/)

  await generate.click()
  await expect(app.getByRole('status')).toContainText('Making the move')
  await expect(app.getByRole('link', { name: 'Download' })).toBeVisible()
  await expectDownloadBesideGitHub(app)
  await expect(
    app.getByRole('slider', {
      name: 'Drag to compare the original and the new image'
    })
  ).toBeVisible()

  await app.getByRole('button', { name: 'Edit arrangement' }).click()
  await expect(generate).toHaveText(/Move 1 object/)
})

test('moves a thing from the Move anything bottom composer', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/move-anything/?ux=e')
  const app = page.getByTestId('move-anything')
  const kitten = await openDetectedExample(page)
  await expect(app.getByRole('complementary')).toHaveCount(0)
  await expect(app.getByTestId('move-object-chip')).toHaveCount(3)

  await app.getByRole('button', { name: 'Quality: Fast' }).click()
  await page.getByRole('menuitemradio', { name: /^Best/ }).click()
  await expect(app.getByRole('button', { name: 'Quality: Best' })).toBeVisible()
  await kitten.focus()
  await page.keyboard.press('Shift+ArrowRight')
  const generate = app
    .getByRole('toolbar', { name: 'Move anything tools' })
    .getByTestId('move-generate')
  await expect(generate).toHaveText(/Move 1 object/)
  await generate.click()
  await expect(app.getByRole('link', { name: 'Download' })).toBeVisible()
})

test('renames and removes a thing from its chip on the Move anything photo', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/move-anything/')
  const app = page.getByTestId('move-anything')
  await openDetectedExample(page)
  const chips = app.getByTestId('move-object-chip')

  await chips.first().dblclick()
  const field = app.getByRole('textbox', { name: 'Rename Orange kitten' })
  await field.fill('Ginger')
  await field.press('Enter')
  const ginger = app.getByRole('button', { name: /^Ginger\./ })
  await expect(ginger).toBeFocused()

  await app.getByRole('button', { name: 'Remove Ginger' }).click()
  await expect(chips).toHaveCount(2)
  await app.getByRole('button', { name: 'Undo' }).click()
  await expect(chips).toHaveCount(3)
  await ginger.focus()
  await page.keyboard.press('Delete')
  await expect(ginger).toHaveCount(0)
})

test('moves a thing from the Move anything bottom sheet on phones @mobile', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/move-anything/')
  const app = page.getByTestId('move-anything')
  const kitten = await openDetectedExample(page)
  const sheet = app.getByRole('complementary', {
    name: 'Move anything settings'
  })
  await expect(
    sheet.getByRole('button', { name: '3 objects · 0 moved · Fast' })
  ).toBeVisible()
  await kitten.focus()
  await page.keyboard.press('Shift+ArrowRight')
  const generate = sheet.getByTestId('move-generate')
  await expect(generate).toHaveText(/Move 1 object/)

  await generate.click()
  await expect(app.getByRole('link', { name: 'Download' })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBe(0)
})

test('hides the site header in the editor apps only', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  const header = page.getByRole('navigation', { name: 'Main navigation' })
  for (const path of [
    '/hub/apps/relight/',
    '/hub/apps/move-anything/',
    '/hub/apps/hand-product-swap/',
    '/hub/apps/sprite-sheet/'
  ]) {
    await page.goto(path)
    await expect(page.getByTestId('apps-home')).toBeVisible()
    await expect(header).toBeHidden()
  }

  await page.goto('/hub/apps/cinematic-studio/')
  await expect(page.getByTestId('cinematic')).toBeVisible()
  await expect(header).toBeVisible()
  await page.goto('/hub/apps/')
  await expect(header).toBeVisible()
})

test('closes Relight while its flag is off', async ({ page, context }) => {
  await mockFlags(context, { apps: true, workflows: false, relight: false })
  await page.goto('/hub/apps/relight/')
  await expect(page.getByText('Cinematic Studio is not open yet')).toBeVisible()
  await expect(page.getByTestId('relight')).toHaveCount(0)
})

async function relightFromPanel(page: Page) {
  const app = page.getByTestId('relight')
  await expect(app.getByTestId('relight-empty')).toBeVisible()
  await app.getByRole('button', { name: 'Try the example' }).click()
  const panel = app.getByRole('complementary', { name: 'Relight settings' })
  const lights = panel.getByRole('region', { name: 'Lights' })

  await app.getByRole('button', { name: /^Cool fill\./ }).click()
  await expect(
    lights.getByRole('button', { name: /^Cool fill\s*Point/ })
  ).toHaveAttribute('aria-expanded', 'true')
  await expect(
    lights.getByRole('button', { name: /^Warm key\s*Directional/ })
  ).toHaveAttribute('aria-expanded', 'false')
  await lights.getByRole('button', { name: 'Hide Cool fill' }).click()
  await expect(
    lights.getByRole('button', { name: 'Show Cool fill' })
  ).toBeVisible()
  await lights.getByRole('button', { name: 'Show Cool fill' }).click()
  const tools = app.getByRole('toolbar', { name: 'Relight tools' })
  await expect(tools.getByRole('button').nth(-2)).toHaveAccessibleName('Undo')
  await expect(tools.getByRole('button').last()).toHaveAccessibleName('Redo')
  const compare = tools.getByRole('button', { name: 'Compare' })
  const stage = app.getByTestId('relight-stage')
  await compare.click()
  await expect(compare).toHaveAttribute('aria-pressed', 'true')
  const divider = stage.getByRole('slider', {
    name: 'Drag to compare the original and the live preview'
  })
  await expect(divider).toBeVisible()
  await expect(stage.getByText('Original', { exact: true })).toBeVisible()
  await expect(stage.getByText('Relit', { exact: true })).toBeVisible()
  await expect(app.getByRole('button', { name: /^Cool fill\./ })).toHaveCount(0)
  await divider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(divider).toHaveValue('51')
  await compare.click()
  await expect(divider).toHaveCount(0)
  await expect(app.getByRole('button', { name: /^Cool fill\./ })).toBeVisible()
  const intensity = lights.getByRole('slider', { name: 'Intensity' })
  await intensity.fill('70')
  await expect(intensity).toHaveValue('70')
  await expect(app.getByRole('button', { name: 'Undo' })).toBeEnabled()
  const locked = app.getByRole('button', { name: 'Download' })
  await expect(locked).toHaveAttribute('aria-disabled', 'true')
  await locked.hover()
  await expect(page.getByText('Run to download')).toBeVisible()

  await panel.getByTestId('relight-run').click()
  await expect(app.getByRole('status')).toContainText('Relighting')
  await expect(app.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'href',
    /^(blob:|\/images\/apps\/relight\/example-relit\.jpg)/
  )
  await expectDownloadBesideGitHub(app)
  await expect(
    app.getByRole('slider', {
      name: 'Drag to compare the original and the relit photo'
    })
  ).toBeVisible()
  return app
}

for (const { width, panel } of [
  { width: 768, panel: 280 },
  { width: 1280, panel: 280 },
  { width: 1920, panel: 307.2 },
  { width: 2400, panel: 340 }
])
  test(`sizes the Relight panel to ${panel}px on a ${width}px screen`, async ({
    page,
    context
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockFlags(context, { apps: true, workflows: false })
    await page.goto('/hub/apps/relight/')
    const app = page.getByTestId('relight')
    await app.getByRole('button', { name: 'Try the example' }).click()
    const settings = app.getByRole('complementary', {
      name: 'Relight settings'
    })
    await expect(settings).toBeVisible()
    expect((await settings.boundingBox())?.width).toBeCloseTo(panel, 0)
  })

test('relights the Relight example from the floating panel', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/relight/')
  const app = await relightFromPanel(page)

  await app.getByRole('button', { name: 'Edit lights' }).click()
  const panel = app.getByRole('complementary', { name: 'Relight settings' })
  const lights = panel.getByRole('region', { name: 'Lights' })
  await expect(lights.getByRole('slider', { name: 'Intensity' })).toHaveValue(
    '70'
  )
  await expectPanelWidth(panel)

  await lights.getByRole('button', { name: /^Warm key\s*Directional/ }).click()
  const readout = lights.getByTestId('relight-dial-readout')
  await expect(readout).toHaveText(/^-?\d+° · 15°$/)
  await lights.getByRole('slider', { name: 'Direction' }).focus()
  await page.keyboard.press('ArrowUp')
  await expect(readout).toHaveText(/^-?\d+° · 20°$/)
  await expect(lights.getByRole('slider', { name: 'Elevation' })).toHaveValue(
    '20'
  )
})

test('zooms the Relight photo from the control, ctrl+wheel and the keys, and still drags a light', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/relight/')
  const app = page.getByTestId('relight')
  await app.getByRole('button', { name: 'Try the example' }).click()
  const stage = app.getByTestId('relight-stage')
  const percent = app.getByTestId('editor-zoom-fit')
  await expect(percent).toHaveText('100%')
  const fitted = await stage.boundingBox()
  if (!fitted) throw new Error('no stage')

  await app.getByRole('button', { name: 'Zoom in' }).click()
  await expect(percent).toHaveText('125%')
  await expect
    .poll(async () => (await stage.boundingBox())?.width)
    .toBeCloseTo(fitted.width * 1.25, 0)

  const zoomed = await stage.boundingBox()
  if (!zoomed) throw new Error('no stage')
  const key = app.getByRole('button', { name: /^Warm key\./ })
  const handle = await key.boundingBox()
  if (!handle) throw new Error('no light')
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2
  )
  await page.mouse.down()
  await page.mouse.move(
    zoomed.x + zoomed.width / 2,
    zoomed.y + zoomed.height / 2,
    { steps: 6 }
  )
  await page.mouse.up()
  await expect(key).toHaveAttribute('style', /left: (4[89]|5[0-2])/)

  await page.mouse.move(
    fitted.x + fitted.width / 2,
    fitted.y + fitted.height / 2
  )
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -100)
  await page.keyboard.up('Control')
  await expect(percent).not.toHaveText('125%')

  await page.keyboard.press('0')
  await expect(percent).toHaveText('100%')
  await expect
    .poll(async () => (await stage.boundingBox())?.width)
    .toBeCloseTo(fitted.width, 0)
})

async function settled(locator: Locator) {
  await locator.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished))
  )
}

async function steadyShot(locator: Locator) {
  let previous = await locator.screenshot()
  for (;;) {
    const next = await locator.screenshot()
    if (next.equals(previous)) return next
    previous = next
  }
}

async function dragTo(page: Page, from: Locator, x: number, y: number) {
  const dot = await from.boundingBox()
  if (!dot) throw new Error('no dot')
  await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, y, { steps: 6 })
  await page.mouse.up()
}

test('turns and raises a Relight light from the light map, and hides the map', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/relight/')
  const app = page.getByTestId('relight')
  await app.getByRole('button', { name: 'Try the example' }).click()
  const map = app.getByRole('group', { name: 'Light map' })
  await expect(map).toHaveAttribute('data-corner', 'top-right')
  await settled(map)
  const top = map.getByRole('slider', { name: 'Warm key, top view' })
  const side = map.getByRole('slider', { name: 'Warm key, side view' })

  const topView = await app.getByTestId('relight-map-top').boundingBox()
  if (!topView) throw new Error('no top view')
  await dragTo(
    page,
    top,
    topView.x + topView.width * 0.95,
    topView.y + topView.height / 2
  )
  await expect(top).toHaveAttribute('aria-valuenow', /^(8[5-9]|9[0-5])$/)

  const sideView = await app.getByTestId('relight-map-side').boundingBox()
  if (!sideView) throw new Error('no side view')
  await dragTo(
    page,
    side,
    sideView.x + sideView.width * 0.2,
    sideView.y + sideView.height * 0.2
  )
  await expect(side).toHaveAttribute('aria-valuenow', /^(4[0-9]|5[0-9])$/)
  await expect(app.getByTestId('editor-zoom-fit')).toHaveText('100%')
  const lights = app
    .getByRole('complementary', { name: 'Relight settings' })
    .getByRole('region', { name: 'Lights' })
  await expect(
    lights.getByRole('button', { name: /^Warm key\s*Directional/ })
  ).toHaveAttribute('aria-expanded', 'true')

  const tool = app
    .getByRole('toolbar', { name: 'Relight tools' })
    .getByRole('button', { name: 'Light map' })
  await tool.click()
  await expect(map).toHaveCount(0)
  await expect(tool).toHaveAttribute('aria-pressed', 'false')
  await tool.click()
  await expect(map).toBeVisible()
})

async function overlap(a: Locator, b: Locator) {
  const [first, second] = await Promise.all([a.boundingBox(), b.boundingBox()])
  if (!first || !second) throw new Error('no box')
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  )
}

test('moves the Relight light map off the Sunset warm key, and back once the key leaves', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/relight/')
  const app = page.getByTestId('relight')
  await app.getByRole('button', { name: 'Try the example' }).click()
  const map = app.getByRole('group', { name: 'Light map' })
  const key = app.getByRole('button', { name: /^Warm key\./ })
  const stage = app.getByTestId('relight-stage')
  await expect(map).toHaveAttribute('data-corner', 'top-right')
  await expect.poll(() => overlap(map, key)).toBe(false)

  const box = await stage.boundingBox()
  if (!box) throw new Error('no stage')
  await dragTo(page, key, box.x + box.width / 2, box.y + box.height / 2)
  await expect(map).toHaveAttribute('data-corner', 'top-left')
  await expect
    .poll(async () => (await map.boundingBox())?.x)
    .toBeCloseTo(box.x + 10, 0)
  await expect.poll(() => overlap(map, key)).toBe(false)
})

test('shows only the Relight light, apart from the light map, and not in Compare', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/relight/')
  const app = page.getByTestId('relight')
  await app.getByRole('button', { name: 'Try the example' }).click()
  const tools = app.getByRole('toolbar', { name: 'Relight tools' })
  const lightOnly = tools.getByRole('button', { name: 'Light only' })
  const preview = app
    .getByTestId('relight-stage')
    .getByTestId('relight-preview')
  await expect(lightOnly).toHaveAttribute('aria-pressed', 'false')
  await expect(app.getByRole('group', { name: 'Light map' })).toHaveAttribute(
    'data-corner',
    'top-right'
  )
  await settled(app.getByRole('group', { name: 'Light map' }))
  const photo = await steadyShot(preview)

  await lightOnly.click()
  await expect(lightOnly).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(async () => (await preview.screenshot()).equals(photo))
    .toBe(false)
  await expect(app.getByRole('group', { name: 'Light map' })).toBeVisible()

  await tools.getByRole('button', { name: 'Compare' }).click()
  await expect(lightOnly).toBeDisabled()
  await tools.getByRole('button', { name: 'Compare' }).click()
  await lightOnly.click()
  await expect(lightOnly).toHaveAttribute('aria-pressed', 'false')
  await expect
    .poll(async () => (await preview.screenshot()).equals(photo))
    .toBe(true)
})

test('folds the Relight light map to a chip on phones @mobile', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/relight/')
  const app = page.getByTestId('relight')
  await app.getByRole('button', { name: 'Try the example' }).click()
  const map = app.getByRole('group', { name: 'Light map' })
  const chip = map.getByRole('button', { name: 'Light map' })
  await expect(chip).toHaveAttribute('aria-expanded', 'false')
  await expect(map.getByRole('slider')).toHaveCount(0)
  await expect(map).toHaveAttribute('data-corner', 'top-right')
  await expect
    .poll(() => overlap(chip, app.getByRole('button', { name: /^Warm key\./ })))
    .toBe(false)

  await chip.click()
  await expect(map.getByRole('slider')).toHaveCount(4)
  await map.getByRole('button', { name: 'Collapse light map' }).click()
  await expect(chip).toBeVisible()
})

test('relights the Relight example from the bottom composer', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/relight/?ux=e')
  const app = page.getByTestId('relight')
  await app.getByRole('button', { name: 'Try the example' }).click()
  await expect(app.getByRole('complementary')).toHaveCount(0)
  const key = app.getByRole('button', { name: /^Warm key\./ })
  await key.focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect(key).toHaveAttribute('style', /left: 17%/)

  await app.getByRole('button', { name: /Lights/ }).click()
  const intensity = app
    .getByRole('dialog', { name: 'Lights' })
    .getByRole('slider', { name: 'Intensity' })
  await intensity.fill('40')
  await expect(intensity).toHaveValue('40')

  await app.getByTestId('relight-run').click()
  await expect(app.getByRole('link', { name: 'Download' })).toBeVisible()
  await app.getByRole('button', { name: 'Edit lights' }).click()
  await expect(key).toHaveAttribute('style', /left: 17%/)
})

test('relights from the Relight bottom sheet on phones @mobile', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/relight/')
  const app = page.getByTestId('relight')
  await app.getByRole('button', { name: 'Try the example' }).click()
  const sheet = app.getByRole('complementary', { name: 'Relight settings' })
  await expect(sheet.getByRole('region', { name: 'Lights' })).toHaveCount(0)

  await app
    .getByRole('toolbar', { name: 'Relight tools' })
    .getByRole('button', { name: 'Compare' })
    .click()
  const divider = app.getByRole('slider', {
    name: 'Drag to compare the original and the live preview'
  })
  const area = await divider.boundingBox()
  if (!area) throw new Error('no divider')
  const scrolled = await page.evaluate(() => window.scrollY)
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2)
  await page.mouse.down()
  await page.mouse.move(area.x + area.width * 0.8, area.y + area.height * 0.2, {
    steps: 6
  })
  await page.mouse.up()
  await expect(divider).not.toHaveValue('50')
  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled)
  await app
    .getByRole('toolbar', { name: 'Relight tools' })
    .getByRole('button', { name: 'Compare' })
    .click()

  await sheet.getByRole('button', { name: 'Sunset · 2 lights · Long' }).click()
  await expect(sheet.getByRole('region', { name: 'Lights' })).toBeVisible()
  await sheet.getByRole('radio', { name: 'Neon' }).click()
  await expect(sheet.getByRole('radio', { name: 'Neon' })).toBeChecked()
  await sheet.getByRole('button', { name: 'Hide settings' }).click()
  await expect(
    sheet.getByRole('button', { name: 'Neon · 2 lights · Hard' })
  ).toBeVisible()

  await sheet.getByTestId('relight-run').click()
  await expect(app.getByRole('link', { name: 'Download' })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBe(0)
})

test('closes Hand product swap while its flag is off', async ({
  page,
  context
}) => {
  await mockFlags(context, {
    apps: true,
    workflows: false,
    handProductSwap: false
  })
  await page.goto('/hub/apps/hand-product-swap/')
  await expect(page.getByText('Cinematic Studio is not open yet')).toBeVisible()
  await expect(page.getByTestId('hand-product-swap')).toHaveCount(0)
})

async function openHandSwapExample(page: Page, context: BrowserContext) {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/hand-product-swap/')
  const app = page.getByTestId('hand-product-swap')
  await expect(app.getByTestId('swap-empty')).toBeVisible()
  await app.getByRole('button', { name: 'Try the example' }).click()
  const panel = app.getByRole('complementary', {
    name: 'Hand product swap settings'
  })
  return { app, panel }
}

test('swaps the product in the Hand product swap example and compares the result', async ({
  page,
  context
}) => {
  const { app, panel } = await openHandSwapExample(page, context)
  await expectPanelWidth(panel)
  await expect(app.getByText('Same hand & grip, new product')).toBeVisible()
  await expect(
    app.getByRole('button', { name: /Where the product goes/ })
  ).toHaveCount(0)
  await panel.getByRole('radio', { name: 'Serum' }).click()
  await panel.getByRole('button', { name: 'Resolution: 2K' }).click()
  await page.getByRole('menuitemradio', { name: /^1K/ }).click()
  const tools = app.getByRole('toolbar', { name: 'Hand product swap tools' })
  await expect(tools.getByRole('button').last()).toHaveAccessibleName('Redo')

  await panel.getByTestId('swap-run').click()
  await expect(app.getByRole('status')).toContainText('Swapping the product')
  const download = app.getByRole('link', { name: 'Download' })
  await expect(download).toHaveAttribute(
    'href',
    '/images/apps/hand-product-swap/result-serum.jpg'
  )
  await expect(download).toHaveAttribute(
    'download',
    'hand-holding-can-swapped-42.jpg'
  )
  await expectDownloadBesideGitHub(app)
  const compare = tools.getByRole('button', { name: 'Compare' })
  await expect(compare).toHaveAttribute('aria-pressed', 'false')
  await compare.click()
  const split = app.getByRole('slider', {
    name: 'Drag to compare the original and the result'
  })
  await split.focus()
  await page.keyboard.press('ArrowRight')
  await expect(split).toHaveValue('51')

  await tools.getByRole('button', { name: 'Edit' }).click()
  await expect(panel.getByRole('radio', { name: 'Serum' })).toHaveAttribute(
    'aria-checked',
    'true'
  )
})

for (const { product, result } of [
  { product: 'Can', result: 'result-can.jpg' },
  { product: 'Serum', result: 'result-serum.jpg' },
  { product: 'Cream', result: 'result-tube.jpg' }
])
  test(`answers the Hand product swap example holding the ${product} with its example photo`, async ({
    page,
    context
  }) => {
    const { app, panel } = await openHandSwapExample(page, context)
    await panel.getByRole('radio', { name: product }).click()
    await panel.getByTestId('swap-run').click()
    await expect(app.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      `/images/apps/hand-product-swap/${result}`
    )
  })

test('draws an uploaded product into the Hand product swap example', async ({
  page,
  context
}) => {
  const { app, panel } = await openHandSwapExample(page, context)
  await panel
    .getByTestId('swap-product-input')
    .setInputFiles('public/images/apps/hand-product-swap/product-can.jpg')
  await expect(panel.getByRole('radio', { name: 'Yours' })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await panel.getByTestId('swap-run').click()
  await expect(app.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'href',
    /^blob:/
  )
})

test('closes the Sprite Sheet Generator while its flag is off', async ({
  page,
  context
}) => {
  await mockFlags(context, {
    apps: true,
    workflows: false,
    spriteSheet: false
  })
  await page.goto('/hub/apps/sprite-sheet/')
  await expect(page.getByText('Cinematic Studio is not open yet')).toBeVisible()
  await expect(page.getByTestId('sprite-sheet')).toHaveCount(0)
})

test('makes a sprite sheet of the example from the floating panel', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/apps/sprite-sheet/')
  const app = page.getByTestId('sprite-sheet')
  await expect(app.getByTestId('sprite-empty')).toBeVisible()
  await app.getByRole('button', { name: 'Try the example' }).click()
  const panel = app.getByRole('complementary', {
    name: 'Sprite sheet settings'
  })
  await expect(panel).toContainText('explorer.webp')

  await panel.getByRole('textbox', { name: 'Animation' }).fill('dancing')
  await panel.getByTestId('sprite-picker-style').click()
  await app
    .getByRole('dialog', { name: 'Style' })
    .getByRole('radio', { name: 'Toon' })
    .click()
  await panel.getByTestId('sprite-picker-motion').click()
  await app
    .getByRole('dialog', { name: 'Motion' })
    .getByRole('radio', { name: 'Jump' })
    .click()
  await expect(panel.getByTestId('sprite-picker-motion')).toContainText('Jump')
  await expect(app.getByRole('button', { name: 'Undo' })).toBeEnabled()
  await expectPanelWidth(panel)
  const tools = app.getByRole('toolbar', { name: 'Sprite sheet tools' })
  await expect(tools.getByRole('button').last()).toHaveAccessibleName('Redo')

  await tools.getByRole('radio', { name: 'Preview' }).click()
  await expect(app.getByTestId('sprite-preview')).toBeVisible()
  await expect(tools.getByRole('button', { name: 'Pause' })).toBeVisible()
  await tools.getByRole('radio', { name: 'Sheet' }).click()

  await panel.getByTestId('sprite-run').click()
  await expect(app.getByRole('status')).toContainText('Drawing the frames')
  await expect(app.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'download',
    'explorer-toon-jump-sheet.png'
  )
  await expectDownloadBesideGitHub(app)
  await expect(app.getByTestId('sprite-sheet-result')).toBeVisible()
  await expect(tools.getByRole('button', { name: 'Compare' })).toHaveCount(0)

  await tools.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(panel.getByTestId('sprite-picker-motion')).toContainText('Jump')
})

test('sends an old catalogue link for the Apps tab to the hub apps page', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/hub/models/?type=apps&q=studio#top')
  await expect(page).toHaveURL('/hub/apps/?q=studio#top')
  await expect(page.getByTestId('app-shelf')).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'ComfyUI apps' })).toHaveCount(
    0
  )
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
