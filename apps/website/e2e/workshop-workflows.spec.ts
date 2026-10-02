import type { BrowserContext } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

async function mockWorkflowVisibility(
  context: BrowserContext,
  enabled: boolean
) {
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
          contentType: 'application/json',
          json: {
            featureFlags: {
              'workshop-enabled': true,
              'workshop-workflows-enabled': enabled
            },
            featureFlagPayloads: {}
          }
        })
      : route.abort('blockedbyclient')
  )
}

test('workflow launch groups lead to the existing shared form', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, true)
  await page.goto('/hub/models/')
  await expect(page.getByTestId('catalogue-tab-workflows')).toBeInViewport()
  await page.getByTestId('catalogue-tab-workflows').click()
  await expect(page).toHaveURL('/hub/workflows/')
  await expect(
    page.getByRole('heading', { level: 1, name: 'ComfyUI workflows' })
  ).toBeVisible()
  await expect(page.getByTestId('catalogue-tab-workflows')).toHaveAttribute(
    'aria-current',
    'page'
  )
  const catalogue = page.getByTestId('workflow-catalogue')
  await expect(catalogue.getByRole('heading', { level: 2 })).toHaveText([
    'Turn an image into a video',
    'Create & edit videos',
    'Animate characters',
    'Create product photos & ads',
    'Upscale & restore',
    'Edit & clean up photos'
  ])
  await expect(catalogue.getByTestId('workshop-model-card')).toHaveCount(30)
  await expect(catalogue.getByTestId('workshop-sort')).toHaveText('Recommended')
  await expect(catalogue.getByRole('button', { name: /See all/ })).toHaveCount(
    0
  )
  const highlights = catalogue.getByTestId('featured-pagination')
  await expect
    .poll(() =>
      highlights
        .getByRole('button')
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute('aria-label'))
        )
    )
    .toEqual([
      'Turn an image into a video',
      'Copy movement from a video',
      'Change a material',
      'Upscale and restore detail',
      'Edit a selected region'
    ])
  await highlights.getByRole('button', { name: 'Change a material' }).click()
  await expect(catalogue.getByTestId('featured-slide-link')).toHaveAttribute(
    'href',
    '/hub/workflows/change-material/'
  )
  await page.getByTestId('browse-all-end').click()
  await expect(
    page.getByRole('heading', { level: 2, name: 'All workflows 30' })
  ).toBeVisible()
  await expect(
    page
      .getByTestId('workflow-search-results')
      .getByTestId('workshop-model-card')
  ).toHaveCount(30)
  await expect(page.getByTestId('section-featured')).toHaveCount(0)
  await page.getByTestId('workshop-sort').click()
  await page.getByTestId('sort-name').click()
  await expect(
    page.getByTestId('workflow-search-results').getByRole('link').first()
  ).toHaveAttribute('href', '/hub/workflows/connect-images-with-motion/')
  await page.getByTestId('section-back').click()
  await expect(page.getByTestId('workshop-hero')).toBeVisible()
  await page.getByTestId('workshop-search').fill('Change a material')
  await page.getByRole('link', { name: /Change a material/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Change a material', exact: true })
  ).toBeVisible()
  // The eyebrow names the shelf this workflow sits on, and leads back to it.
  const shelf = page.getByTestId('workflow-use-case')
  await expect(shelf).toHaveText('Edit images')
  await expect(shelf).toHaveAttribute(
    'href',
    '/hub/workflows/?category=product'
  )
  await expect(
    page.getByRole('group', { name: 'Your original image' })
  ).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'Material reference' })
  ).toBeVisible()
  const prompt = page.getByRole('textbox', { name: 'What should change?' })
  await expect(prompt).toHaveValue(
    'Give the sofa the fur texture from the material reference instead of its leather.'
  )
  await prompt.fill('Use the material from the second image.')
  await page
    .getByRole('button', { name: /A softer finish for a leather sofa/ })
    .click()
  await page.getByTestId('example-replace-keep').click()
  await expect(prompt).toHaveValue('Use the material from the second image.')
  await page.getByRole('tab', { name: 'Details', exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'Try in Cloud' })
  ).toHaveAttribute(
    'href',
    'https://testcloud.comfy.org/?template=image_qwen_image_edit_2511'
  )
  const graphFiles = [
    {
      link: page.getByRole('link', { name: 'Open full-size workflow preview' }),
      path: '/workflow-graphs/change-material.svg',
      type: 'image/svg+xml'
    },
    {
      link: page.getByRole('link', { name: 'Download workflow JSON' }),
      path: '/workflow-graphs/change-material.json',
      type: 'application/json'
    }
  ]
  for (const { link, path, type } of graphFiles) {
    await expect(link).toHaveAttribute('href', path)
    const response = await page.request.get(path)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain(type)
  }
  await shelf.click()
  await expect(page).toHaveURL('/hub/workflows/?category=product')
  await expect(page.getByTestId('catalogue-tab-workflows')).toHaveAttribute(
    'aria-current',
    'page'
  )
  await expect(page.getByTestId('workshop-filter-count')).toHaveText('1')
  const filtered = page.getByTestId('workflow-search-results')
  await expect(
    filtered.getByRole('link', { name: /Change a material/ })
  ).toBeVisible()
  await expect(
    filtered.getByRole('link', { name: /Remove an image background/ })
  ).toHaveCount(0)
})

test('the Details graph waits for its tab, names its subgraphs, and zooms from its controls', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, true)
  const graphRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('/workflow-graphs/image-to-video.json'))
      graphRequests.push(request.url())
  })
  await page.goto('/hub/workflows/image-to-video/')
  const details = page.getByRole('tab', { name: 'Details', exact: true })
  await expect(details).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(graphRequests).toHaveLength(0)

  await details.click()
  const graph = page.getByTestId('workflow-graph')
  const drawing = graph.getByRole('img', {
    name: 'The nodes of this workflow and the links between them'
  })
  await expect(drawing).toBeVisible()
  expect(graphRequests).toHaveLength(1)
  await expect(drawing).toContainText('Image to Video (LTX-2.3)')

  // Fitting the whole drawing into the panel renders its titles at a few
  // pixels, so it opens zoomed onto the node the workflow starts from.
  const zoom = () =>
    graph
      .getByText('%')
      .evaluate((el) => Number(el.textContent.replace('%', '')))
  const opening = await zoom()
  expect(opening).toBeGreaterThan(100)

  // The controls sit inside the draggable frame; a press on them has to reach
  // them rather than the frame.
  await graph.getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(zoom).toBeGreaterThan(opening)
  const frame = await graph.boundingBox()
  const drawn = await drawing.locator('g').first().boundingBox()
  // Zooming keeps the drawing under the frame rather than carrying it off.
  expect(drawn!.x).toBeLessThan(frame!.x + frame!.width)
  expect(drawn!.x + drawn!.width).toBeGreaterThan(frame!.x)
  expect(drawn!.y).toBeLessThan(frame!.y + frame!.height)
  expect(drawn!.y + drawn!.height).toBeGreaterThan(frame!.y)

  await graph.getByRole('button', { name: 'Reset' }).click()
  await expect.poll(zoom).toBe(opening)
})

test('withholds workflow discovery and direct pages when the workflow flag is off', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, false)
  await page.goto('/hub/models/')
  await expect(page.getByTestId('workshop-search')).toBeVisible()
  await expect(page.getByTestId('catalogue-tabs')).toHaveCount(0)
  await page.getByTestId('workshop-search').fill('Change a material')
  await expect(
    page.getByRole('link', { name: /Change a material/ })
  ).toHaveCount(0)
  await page.goto('/hub/workflows/')
  await expect(
    page.getByRole('heading', { level: 1, name: /Grok Imagine/ })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'ComfyUI workflows' })
  ).toHaveCount(0)
  await expect(page.getByTestId('workflow-catalogue')).toHaveCount(0)
  await page.goto('/hub/workflows/change-material/')
  await expect(
    page.getByRole('heading', { level: 1, name: /Grok Imagine/ })
  ).toBeVisible()
  await expect(page.getByTestId('workflow-hero')).toHaveCount(0)
})

test('cold workflow filters focus their controls and respect dismissal while loading @mobile', async ({
  page,
  context,
  isMobile
}) => {
  await mockWorkflowVisibility(context, true)
  const requested = Promise.withResolvers<void>()
  const released = Promise.withResolvers<void>()
  await page.route('**/_website/WorkshopFilterPanel.*.js', async (route) => {
    requested.resolve()
    await released.promise
    await route.continue()
  })
  await page.goto('/hub/workflows/')
  const trigger = page.getByTestId('workshop-filter')
  await trigger.click()
  await requested.promise
  await expect(page.getByRole('dialog', { name: 'Filter' })).toHaveCount(0)
  await trigger.press('Escape')
  released.resolve()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('dialog', { name: 'Filter' })).toHaveCount(0)

  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Filter' })
  const search = dialog.getByRole('searchbox')
  if (isMobile) {
    await expect(page.getByTestId('workshop-filter-grabber')).toBeFocused()
    await search.focus()
  } else {
    await expect(search).toBeFocused()
  }
  await page.keyboard.type('video')
  await expect(search).toHaveValue('video')
  await expect(
    dialog.getByRole('button', { name: 'Create & edit videos 6' })
  ).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Upscale & restore 6' })
  ).toHaveCount(0)
  await search.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('workflow search and category filters share the mobile controls @mobile', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, true)
  await page.goto('/hub/models/')
  await expect(page.getByTestId('catalogue-tab-workflows')).toBeInViewport()
  await page.getByTestId('catalogue-tab-workflows').click()
  await page.getByTestId('workshop-filter').click()
  await page.getByRole('button', { name: 'Upscale & restore 6' }).click()
  await page.getByRole('button', { name: 'Show 6 workflows' }).click()
  await expect(
    page
      .getByTestId('workflow-search-results')
      .getByTestId('workshop-model-card')
  ).toHaveCount(6)
  await page.getByTestId('workshop-search-button').click()
  await page.getByTestId('workshop-search-sheet-input').fill('SeedVR2')
  await expect(page.getByTestId('workshop-search-sheet-apply')).toHaveText(
    'Show 2 workflows'
  )
  await page.getByTestId('workshop-search-sheet-apply').click()
  await expect(
    page
      .getByTestId('workflow-search-results')
      .getByTestId('workshop-model-card')
  ).toHaveCount(2)
  await page.getByTestId('workshop-search-button').click()
  await page.getByTestId('workshop-search-sheet-input').fill('material')
  await expect(page.getByTestId('workshop-search-sheet-apply')).toHaveText(
    'Show 0 workflows'
  )
  await expect(
    page
      .getByTestId('workshop-search-sheet')
      .getByRole('button', { name: /Change a material/ })
  ).toHaveCount(0)
  await page.getByTestId('workshop-search-sheet-apply').click()
  await expect(
    page.getByText('No workflows match your search and filters.')
  ).toBeVisible()
  await page.getByTestId('catalogue-tab-models').click()
  await expect(page.getByTestId('workflow-catalogue')).toHaveCount(0)
  await expect(page.getByTestId('workshop-search-button')).toHaveText(
    'Search models…'
  )
})

// The outcome rows give way to a flat grid the moment a filter is on, so what
// the model facet narrows is what the reader ends up looking at.
test('the workflows half narrows to the model it runs on, from the menu and from a shared link', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, true)
  await page.goto('/hub/models/')
  await expect(page.getByTestId('catalogue-tab-workflows')).toBeInViewport()
  await page.getByTestId('catalogue-tab-workflows').click()
  const outcomes = page
    .getByTestId('workflow-catalogue')
    .getByTestId('workshop-model-card')
  await expect(outcomes).toHaveCount(30)

  await page.getByTestId('workshop-filter').click()
  await page.getByTestId('workshop-facet-model').click()
  await page.getByTestId('filter-model-LTX-2.3').click()
  await expect(outcomes).toHaveCount(7)

  // An outcome can stand on several models, so a second choice widens the list
  // instead of intersecting it.
  await page.getByTestId('filter-model-SeedVR2').click()
  await expect(outcomes).toHaveCount(9)
  await expect(page.getByTestId('workshop-facet-model-count')).toHaveText('2')

  // Clearing gives the whole catalogue back, not just the badge.
  await page.getByTestId('workshop-filter-clear').click()
  await expect(page.getByTestId('workshop-filter-count')).toHaveCount(0)
  await expect(outcomes).toHaveCount(30)

  await page.goto('/hub/models/?type=workflows&model=LTX-2.3')
  await expect(page).toHaveURL('/hub/workflows/?model=LTX-2.3')
  await expect(page.getByTestId('workshop-filter-count')).toHaveText('1')
  await expect(outcomes).toHaveCount(7)
})

test('keeps an old catalogue link for the Workflows tab on the models catalogue while workflows are off', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, false)
  await page.goto('/hub/models/?type=workflows')
  await expect(
    page.getByRole('searchbox', {
      name: 'Search models, providers, and categories'
    })
  ).toBeVisible()
  await expect(page).toHaveURL('/hub/models/?type=workflows')
})

test('the background example pairs its input and output and restores edited inputs', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, true)
  await page.goto('/hub/workflows/remove-background/')
  const input = page.getByRole('group', { name: 'Your image', exact: true })
  const original = input.getByRole('img', { name: 'the_lily_veil.png' })
  const example = page.getByRole('button', { name: /The lily veil/ })
  await expect(example).toHaveCount(1)
  await expect(original).toHaveAttribute(
    'src',
    'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@90c71fb78b3726392d010ff62a8e79e92d7296ad/input/the_lily_veil.png'
  )
  await expect(
    page.getByRole('img', { name: 'Output', exact: true })
  ).toHaveAttribute(
    'src',
    'https://media.comfy.org/website/workshop/workflows/remove-background/lily-veil-cutout.webp'
  )
  await input.getByRole('button', { name: 'Remove the_lily_veil.png' }).click()
  await example.click()
  await expect(page.getByTestId('example-replace-dialog')).toBeVisible()
  await page.getByTestId('example-replace-keep').click()
  await expect(original).toHaveCount(0)
  await example.click()
  await page.getByTestId('example-replace-confirm').click()
  await expect(original).toBeVisible()
  await page.reload()
  await expect(original).toBeVisible()
})

for (const { path, group, file } of [
  {
    path: '/hub/workflows/remove-object/',
    group: 'Edit mask',
    file: 'remove-object-apple-mask.png'
  },
  {
    path: '/hub/workflows/virtual-try-on/',
    group: 'Your character',
    file: 'subject-2048.jpg'
  }
])
  test(`${path} opens with every required input filled`, async ({
    page,
    context
  }) => {
    await mockWorkflowVisibility(context, true)
    await context.route('https://comfy.org/workflow-inputs/**', (route) =>
      route.fulfill({
        path: `public/workflow-inputs/${new URL(route.request().url()).pathname.split('/').pop()}`
      })
    )
    await page.goto(path)
    const input = page.getByRole('group', { name: group, exact: true })
    await expect(
      input.getByRole('button', { name: `Replace ${file}` })
    ).toBeVisible()
    await expect(
      input.getByRole('button', { name: `Remove ${file}` })
    ).toBeVisible()
  })

const tabletToolbars = [640, 700, 768].flatMap((width) => [
  { width, half: 'Models', path: '/hub/models/' },
  {
    width,
    half: 'Workflows with a category selected',
    path: '/hub/workflows/?category=upscale'
  }
])

for (const { width, half, path } of tabletToolbars) {
  test(`keeps every ${half} toolbar control on screen at ${width}px`, async ({
    page,
    context
  }) => {
    await mockWorkflowVisibility(context, true)
    await page.setViewportSize({ width, height: 900 })
    await page.goto(path)
    const toolbar = page.getByTestId('workshop-toolbar')
    await expect(toolbar.getByTestId('catalogue-tabs')).toBeVisible()
    for (const control of [
      toolbar.getByTestId('catalogue-tabs'),
      toolbar.getByTestId('workshop-search'),
      toolbar.getByTestId('workshop-filter'),
      toolbar.getByTestId('workshop-sort')
    ])
      await expect(control).toBeInViewport({ ratio: 1 })
  })
}

test('keeps Run on screen beside a workflow form taller than the window', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, true)
  await page.setViewportSize({ width: 1280, height: 500 })
  await page.goto('/hub/workflows/extend-image-borders/')

  const run = page.getByTestId('workflow-run-footer')
  await expect(run.getByRole('link', { name: 'Sign in to run' })).toBeVisible()
  await page
    .getByRole('heading', { name: 'Input', exact: true })
    .evaluate((heading) => heading.scrollIntoView({ block: 'start' }))

  await expect(run).toBeInViewport({ ratio: 1 })
})

const stickyFooterViewports = [
  { width: 1280, height: 500 },
  { width: 768, height: 500 },
  { width: 390, height: 500 },
  { width: 390, height: 844 }
]

for (const viewport of stickyFooterViewports) {
  test(`keeps each keyboard-focused field clear of the Run footer at ${viewport.width}×${viewport.height}`, async ({
    page,
    context
  }) => {
    await mockWorkflowVisibility(context, true)
    await page.setViewportSize(viewport)
    await page.goto('/hub/workflows/extend-image-borders/')
    const footer = page.getByTestId('workflow-run-footer')
    await expect(footer).toBeVisible()
    await page
      .getByRole('textbox', { name: 'Describe the surrounding scene' })
      .focus()

    const focusedFieldsClearOfFooter = () =>
      page.evaluate(() => {
        const focused = document.activeElement
        const bar = document.querySelector(
          '[data-testid="workflow-run-footer"]'
        )
        if (!(focused instanceof HTMLElement) || !bar || bar.contains(focused))
          return true
        return (
          focused.getBoundingClientRect().bottom <=
          bar.getBoundingClientRect().top + 1
        )
      })

    for (const key of ['Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']) {
      await page.keyboard.press(key)
      await expect.poll(focusedFieldsClearOfFooter).toBe(true)
    }
  })
}

test('keeps the workflow form inside a phone screen @mobile', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, true)
  await page.goto('/hub/workflows/extend-image-borders/')
  const footer = page.getByTestId('workflow-run-footer')
  await expect(footer).toBeVisible()

  const viewportWidth = page.viewportSize()?.width ?? 0
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(viewportWidth)
  const box = await footer.boundingBox()
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewportWidth)
})

test('@mobile keeps the catalogue tabs in place from one hub page to the next', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, true)
  await page.goto('/hub/models/')
  const models = page.getByTestId('catalogue-tab-models')
  const workflows = page.getByTestId('catalogue-tab-workflows')
  await expect(workflows).toBeVisible()
  // Stuck under the header is where a reader meets the tabs on a phone, and
  // the position a tab has to hold is the one it is clicked in.
  await page.evaluate(() => window.scrollBy(0, 1200))
  await expect
    .poll(async () => (await workflows.boundingBox())?.y)
    .toBeLessThan(200)
  const before = await workflows.boundingBox()

  // A reader taps the tab where they can see it. Playwright scrolls a target
  // into view first, and on a toolbar still settling it sometimes scrolls a
  // pinned one — which is the state under test. Only that scrolling is turned
  // off: every other check it makes before tapping, the hit test included,
  // still runs, and a tab out of the viewport now fails rather than being
  // fetched into it.
  //
  // The tabs sit in the same place on both pages and mark themselves current
  // as soon as they render, so neither tells the page apart from the one it
  // replaced. The address does, and the place they come to rest is reached
  // after it — a measurement taken before either is of the page being left.
  await workflows.click({ scroll: 'none' })
  await expect(page).toHaveURL('/hub/workflows/')
  await expect(workflows).toHaveAttribute('aria-current', 'page')
  await expect
    .poll(async () => (await workflows.boundingBox())?.y)
    .toBeCloseTo(before?.y ?? 0, 0)

  await models.click({ scroll: 'none' })
  await expect(page).toHaveURL('/hub/models/')
  await expect(models).toHaveAttribute('aria-current', 'page')
  await expect
    .poll(async () => (await models.boundingBox())?.y)
    .toBeCloseTo(before?.y ?? 0, 0)
})

test('@mobile stretches the catalogue tabs across the toolbar on a phone', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, true)
  await page.goto('/hub/models/')
  const toolbar = page.getByTestId('workshop-toolbar')
  const tabs = toolbar.getByTestId('catalogue-tabs')
  await expect(tabs).toBeVisible()

  const [bar, group] = await Promise.all([
    toolbar.boundingBox(),
    tabs.boundingBox()
  ])
  expect(Math.abs((bar?.width ?? 0) - (group?.width ?? 0))).toBeLessThan(12)
})

test('the examples below the form read and mark themselves like a model page', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, true)
  await page.goto('/hub/workflows/change-material/')

  await expect(
    page.getByRole('heading', { name: 'Try an example' })
  ).toBeVisible()

  const example = page.getByRole('button', {
    name: /A softer finish for a leather sofa/
  })
  await expect(example).toHaveAttribute('aria-current', 'true')
  await expect(page.getByTestId('workflow-example-chosen')).toHaveCount(1)
})

test('the examples belong to the playground, not to Details or API', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, true)
  await page.goto('/hub/workflows/change-material/')

  const examples = page.getByRole('heading', { name: 'Try an example' })
  await expect(examples).toBeVisible()

  for (const tab of ['Details', 'API']) {
    await page.getByRole('tab', { name: tab, exact: true }).click()
    await expect(examples).toBeHidden()
  }

  await page.getByRole('tab', { name: 'Playground', exact: true }).click()
  await expect(examples).toBeVisible()
})

test('a hovered workflow card spends its tag line only on a name that is cut off', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, true)
  await page.goto('/hub/workflows/')

  const cards = page.locator(
    '[data-testid="workshop-model-card"][data-kind="workflow"]'
  )
  await expect(cards.first()).toBeVisible()
  // Only a name the single line already cuts off can show the hover doing
  // anything, so the test picks one the catalogue is clipping — and one it is
  // not, which must keep its tag.
  const [clipped, whole] = await cards.evaluateAll((all) => {
    const clips = (card: Element) => {
      const name = card.querySelector('[data-testid="model-card-name"]')
      return !!name && name.scrollHeight > name.clientHeight
    }
    return [all.findIndex(clips), all.findIndex((card) => !clips(card))]
  })
  expect(clipped, 'no workflow name is long enough to clip').toBeGreaterThan(-1)
  expect(whole, 'every workflow name clips').toBeGreaterThan(-1)

  const fits = cards.nth(whole)
  await fits.hover()
  await expect(fits.getByTestId('model-card-task')).toBeVisible()

  const card = cards.nth(clipped)
  const name = card.getByTestId('model-card-name')
  const linesOfName = () =>
    name.evaluate((element) =>
      Math.round(
        element.clientHeight /
          Number.parseFloat(getComputedStyle(element).lineHeight)
      )
    )

  await expect(card.getByTestId('model-card-task')).toBeVisible()
  expect(await linesOfName()).toBe(1)
  const resting = await card.boundingBox()

  await card.hover()

  await expect(card.getByTestId('model-card-task')).toBeHidden()
  await expect(async () => expect(await linesOfName()).toBe(2)).toPass()
  expect((await card.boundingBox())?.height).toBeCloseTo(
    resting?.height ?? 0,
    0
  )
})
