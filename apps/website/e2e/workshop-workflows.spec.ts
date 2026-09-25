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
  await page.goto('/models/')
  await expect(page.getByTestId('catalogue-tab-workflows')).toBeInViewport()
  await page.getByTestId('catalogue-tab-workflows').click()
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
    '/models/workflows/change-material/'
  )
  await page.getByTestId('browse-all').click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'All workflows 30'
  )
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
  ).toHaveAttribute('href', '/models/workflows/animate-reference-sheet/')
  await page.getByTestId('section-back').click()
  await expect(page.getByTestId('workshop-hero')).toBeVisible()
  await page.getByTestId('workshop-search').fill('Change a material')
  await page.getByRole('link', { name: /Change a material/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Change a material', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'Your original image' })
  ).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'Material reference' })
  ).toBeVisible()
  const prompt = page.getByRole('textbox', { name: 'What should change?' })
  await expect(prompt).toHaveValue(
    'Change the furniture leather difference in image 1 to the fur material in image 2.'
  )
  await prompt.fill('Use the material from the second image.')
  await page
    .getByRole('button', { name: /A softer finish for a leather sofa/ })
    .click()
  await page.getByTestId('example-replace-keep').click()
  await expect(prompt).toHaveValue('Use the material from the second image.')
  await expect(
    page.getByRole('link', { name: 'Try in Cloud' })
  ).toHaveAttribute(
    'href',
    'https://testcloud.comfy.org/?template=image_qwen_image_edit_2511'
  )
  await page.getByRole('tab', { name: 'Workflow', exact: true }).click()
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
  await page.getByRole('link', { name: 'Back to workflows' }).click()
  await expect(page.getByTestId('catalogue-tab-workflows')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})

test('withholds workflow discovery and direct pages when the workflow flag is off', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, false)
  await page.goto('/models/?type=workflows')
  await expect(page.getByTestId('workshop-search')).toBeVisible()
  await expect(page.getByTestId('catalogue-tabs')).toHaveCount(0)
  await page.getByTestId('workshop-search').fill('Change a material')
  await expect(
    page.getByRole('link', { name: /Change a material/ })
  ).toHaveCount(0)
  await page.goto('/models/workflows/change-material/')
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
  await page.goto('/models/?type=workflows')
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
  await page.goto('/models/')
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
  await page.goto('/models/')
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

  await page.goto('/models/?type=workflows&model=LTX-2.3')
  await expect(page.getByTestId('workshop-filter-count')).toHaveText('1')
  await expect(outcomes).toHaveCount(7)
})

test('the background example pairs its input and output and restores edited inputs', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, true)
  await page.goto('/models/workflows/remove-background/')
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
    'https://cloud.comfy.org/templates/utility_birefnet_remove_background-1.webp'
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

const tabletToolbars = [640, 700, 768].flatMap((width) => [
  { width, half: 'Models', path: '/models/' },
  {
    width,
    half: 'Workflows with a category selected',
    path: '/models/?type=workflows&category=upscale'
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
  await page.goto('/models/workflows/extend-image-borders/')

  const run = page.getByTestId('workflow-run-footer')
  await expect(run.getByRole('link', { name: 'Sign in to run' })).toBeVisible()
  await page
    .getByRole('heading', { name: 'Make it yours' })
    .evaluate((heading) => heading.scrollIntoView({ block: 'start' }))

  await expect(run).toBeInViewport({ ratio: 1 })
})
