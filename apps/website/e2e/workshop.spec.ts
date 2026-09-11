import { expect } from '@playwright/test'

import { MODEL_PATH, test } from './fixtures/modelsAccount'

test.describe('Retired prototype routes', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('comfy-workshop-version', 'v2')
    )
  })

  test('ignores old stored and query layout overrides', async ({ page }) => {
    await page.goto('/models/?version=v2')
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
    await expect(page.getByTestId('workshop-hub')).toHaveCount(0)
    await expect(page.getByTestId('workshop-tabs')).toHaveCount(0)
    await page.reload()
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
  })

  test('does not serve retired workflow or Workshop pages', async ({
    page
  }) => {
    const workflow = await page.goto('/models/workflows/video_minimax_h3_i2v/')
    expect(workflow?.status()).toBe(404)
    await expect(page.getByTestId('model-detail')).toHaveCount(0)
    const workshop = await page.goto('/workshop/')
    expect(workshop?.status()).toBe(404)
    await expect(page.getByTestId('workshop-sections')).toHaveCount(0)
  })
})

test.describe('Models catalog', () => {
  test('searches the approved catalog and recovers from empty results', async ({
    page
  }) => {
    await page.goto('/models/')
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
    const cards = page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
    const search = page.getByTestId('workshop-search')
    await search.fill('kling')
    await page.getByRole('heading', { level: 1 }).click()
    await expect(cards.first()).toContainText('Kling')
    for (const card of await cards.all())
      await expect(card).toContainText(/kling/i)

    await search.fill('no such model')
    await page.getByRole('heading', { level: 1 }).click()
    await expect(page.getByTestId('workshop-empty')).toBeVisible()
    await expect(cards).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Clear filters', exact: true })
      .click()
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
  })

  test('category rows drill into the promised number of models', async ({
    page
  }) => {
    await page.goto('/models/')
    const sections = page.getByTestId('workshop-sections')
    await expect(sections).toBeVisible()
    const videos = page.getByTestId('section-generate-videos')
    const rowHeading = await videos
      .getByRole('heading', { level: 2 })
      .innerText()
    const promisedCount = Number(rowHeading.match(/(\d+)\s*$/)?.[1])
    expect(promisedCount).toBeGreaterThan(0)
    await videos.getByTestId('section-generate-videos-open').click()
    const cards = page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
    await expect(sections).toHaveCount(0)
    await expect(cards).toHaveCount(promisedCount)
    await expect(page.getByTestId('workshop-hero')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Generate videos'
    )
    await page
      .getByRole('button', { name: 'Back to all categories', exact: true })
      .click()
    await expect(sections).toBeVisible()
    await expect(page.getByTestId('workshop-hero')).toBeVisible()
  })

  test('cards open canonical model pages with related models', async ({
    page
  }) => {
    await page.goto('/models/')
    await page.getByTestId('workshop-search').fill('kling avatar')
    await page.getByRole('heading', { level: 1 }).click()
    await page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
      .first()
      .click()
    await expect(page).toHaveURL(/\/models\/kling--avatar--animate-images\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Kling Avatar'
    )
    await expect(
      page
        .getByTestId('related-models')
        .getByTestId('workshop-model-card')
        .first()
    ).toBeVisible()
  })

  test('a static compatibility alias reaches its canonical model page', async ({
    page
  }) => {
    const response = await page.goto('/models/bfl--flux-2-max/')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(
      /\/models\/bfl--flux-2-max--generate-images\/$/
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'FLUX 2 Max'
    )
  })

  test('the capability filter actually narrows the catalog', async ({
    page
  }) => {
    await page.goto('/models/')
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
    const all = await page.getByTestId('workshop-model-card').count()
    expect(all).toBeGreaterThan(0)
    await page.getByTestId('workshop-filter').click()
    await page.getByTestId('workshop-facet-capability').click()
    await page.getByTestId('filter-capability-upscale').click()
    const cards = page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeLessThan(all)
    for (const card of await cards.all())
      await expect(card).toContainText(/upscal/i)
    await expect(
      page.getByTestId('workshop-facet-capability-count')
    ).toHaveText('1')
    await expect(page.getByTestId('workshop-filter-count')).toHaveText('1')
    await page.getByTestId('workshop-filter-clear').click()
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
  })

  test('model tags deep-link into a filtered catalog', async ({ page }) => {
    await page.goto(MODEL_PATH)
    const tag = page
      .getByTestId('model-tags')
      .getByRole('link', { name: 'flux', exact: true })
    await expect(tag).toHaveAttribute('href', '/models?capability=flux')
    await tag.click()
    await expect(page).toHaveURL(/\/models\/?\?capability=flux$/)
    await expect(page.getByTestId('workshop-filter-count')).toHaveText('1')
    const cards = page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
    await expect(cards.first()).toBeVisible()
    for (const card of await cards.all())
      await expect(card).toContainText(/flux/i)
  })

  test('the hero medium deep-links into the catalog', async ({ page }) => {
    await page.goto('/models/kling--avatar--animate-images/')
    await page
      .getByTestId('model-hero')
      .getByRole('link', { name: 'Video', exact: true })
      .click()
    await expect(page).toHaveURL(/\/models\/?\?modality=video$/)
    await expect(page.getByTestId('workshop-filter-count')).toHaveText('1')
  })

  test('homepage model releases use the published canonical URL', async ({
    page
  }) => {
    await page.goto('/')
    await expect(
      page.getByRole('link', { name: /Explore Seedance/i })
    ).toHaveAttribute(
      'href',
      '/models/byteplus--seedance-2-5-text-to-video--generate-videos/'
    )
  })
})

test.describe('Model playground', () => {
  test('puts data-declared parameters in the Advanced disclosure', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    const advanced = page.getByTestId('playground-advanced')
    await expect(advanced).toBeVisible()
    await expect(page.getByTestId('field-safety_tolerance')).not.toBeVisible()
    await advanced.locator('summary').click()
    await expect(page.getByTestId('field-safety_tolerance')).toBeVisible()
    await expect(page.getByTestId('field-seed')).toBeVisible()
  })

  test('restores sign-in and keeps Run and uploads enabled after Models menu navigation', async ({
    page,
    modelsAccount
  }) => {
    await page.goto(MODEL_PATH)
    const signIn = page.getByRole('link', {
      name: 'Sign in to run',
      exact: true
    })
    await expect(signIn).toHaveAttribute('href', /\/login\/\?returnTo=/)
    const prompt = 'a capybara in a trench coat'
    await page
      .getByRole('textbox', { name: 'Prompt', exact: true })
      .fill(prompt)
    await signIn.click()
    await expect(page).toHaveURL(/\/login\/\?returnTo=/)
    await page.getByRole('button', { name: 'Use email instead' }).click()
    await page.getByLabel('Email').fill(modelsAccount.email)
    await page
      .getByLabel('Password', { exact: true })
      .fill(modelsAccount.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${MODEL_PATH}$`))
    await expect(
      page.getByRole('button', { name: 'Run', exact: true })
    ).toBeEnabled()
    await expect(
      page.getByRole('textbox', { name: 'Prompt', exact: true })
    ).toHaveValue(prompt)

    await page
      .getByRole('navigation', { name: 'Main navigation', exact: true })
      .getByRole('link', { name: 'Models', exact: true })
      .click()
    await page
      .getByTestId('section-generate-images')
      .getByRole('link', { name: /Seedream 4\.5/ })
      .click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Seedream 4.5'
    )
    await expect(
      page.getByRole('button', { name: 'Run', exact: true })
    ).toBeEnabled()
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Choose images or drop them here', { exact: true }).click()
    ])
    await chooser.setFiles('e2e/assets/placeholder-1x1.webp')
    await expect(
      page.getByRole('button', { name: 'Replace placeholder-1x1.webp' })
    ).toBeVisible()
  })

  test('API tab mirrors the form values', async ({ page }) => {
    await page.goto(MODEL_PATH)
    await page
      .getByRole('textbox', { name: 'Prompt', exact: true })
      .fill('neon street at night')
    await page.getByRole('tab', { name: 'API', exact: true }).click()
    await expect(page.getByTestId('snippet')).toContainText(
      'neon street at night'
    )
    await expect(page.getByTestId('snippet')).toContainText('bfl/flux-2-max')
    await page.getByTestId('snippet-curl').click()
    await expect(page.getByTestId('snippet')).toContainText(
      "--request POST 'https://testapi.comfy.org/v2/models/bfl/flux-2-max'"
    )
  })

  test('examples are initially visible and refill the playground', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    await expect(page.getByTestId('playground-output')).toHaveAttribute(
      'data-state',
      'example'
    )
    await expect(
      page.getByRole('textbox', { name: 'Prompt', exact: true })
    ).not.toHaveValue('')
    await page.getByRole('textbox', { name: 'Prompt', exact: true }).fill('')
    await page.getByTestId('example-card').first().click()
    await expect(page.getByTestId('playground-tab')).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Prompt', exact: true })
    ).not.toHaveValue('')
  })
})
