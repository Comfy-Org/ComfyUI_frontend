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
  test('opens the featured model from the full banner surface', async ({
    page
  }) => {
    await page.goto('/models/')
    const slide = page.getByTestId('featured-slide')
    const href = await page
      .getByTestId('featured-slide-link')
      .getAttribute('href')
    const bounds = await slide.boundingBox()
    if (!href || !bounds) throw new Error('Featured slide is not clickable')

    await slide.click({ position: { x: bounds.width - 24, y: 24 } })

    await expect(page).toHaveURL(new URL(href, page.url()).href)
  })

  test('switches between the curated recommendation and alphabetical order', async ({
    page
  }) => {
    await page.goto('/models/')
    const sections = page.getByTestId('workshop-sections')
    await expect(sections).toBeVisible()
    const sort = page.getByTestId('workshop-sort')
    await expect(sort).toContainText('Most popular')
    async function recommendedIn(section: string, count: number) {
      return page
        .getByTestId(`section-${section}`)
        .getByTestId('workshop-model-card')
        .evaluateAll(
          (cards, limit) =>
            cards
              .slice(0, limit)
              .map((card) => card.getAttribute('href') ?? ''),
          count
        )
    }
    const leading = page
      .getByTestId('section-generate-images')
      .getByTestId('workshop-model-card')
    await expect(leading.first()).toBeVisible()
    const rowCount = await leading.count()
    expect(rowCount).toBeGreaterThanOrEqual(3)
    const recommended = await leading.evaluateAll((cards) =>
      cards.slice(0, 3).map((card) => card.getAttribute('href') ?? '')
    )
    expect(recommended).toEqual([
      '/models/byteplus--seedream-5-pro--generate-images/',
      '/models/openai--gpt-image-2--edit-images/',
      '/models/byteplus--seedream-4--generate-images/'
    ])
    expect(await recommendedIn('generate-videos', 7)).toEqual([
      '/models/byteplus--seedance-2-5-reference--generate-videos/',
      '/models/byteplus--seedance-2-5-text-to-video--generate-videos/',
      '/models/kling--kling-3.0-turbo-text-to-video--generate-videos/',
      '/models/xai--grok-imagine-video-1.5--generate-videos/',
      '/models/xai--grok-imagine-video--generate-videos/',
      '/models/byteplus--seedance-2-fast-reference--generate-videos/',
      '/models/gemini--omni-1.1-flash--generate-videos/'
    ])
    expect(await recommendedIn('animate-images', 4)).toEqual([
      '/models/byteplus--seedance-2-5-first-last-frame--animate-images/',
      '/models/xai--grok-imagine-video--animate-images/',
      '/models/wan--image-to-video-3.0--animate-images/',
      '/models/wan--reference-to-video-3.0--animate-images/'
    ])
    expect(await recommendedIn('other-formats', 1)).toEqual([
      '/models/byteplus--seed-audio-1.0--audio/'
    ])
    expect(await recommendedIn('edit-videos', 2)).toEqual([
      '/models/gemini--omni-1.1-flash--edit-videos/',
      '/models/runway--aleph2-video-to-video--edit-videos/'
    ])

    await sort.click()
    await page.getByTestId('sort-name').click()
    await expect(sort).toContainText('Name A to Z')
    await expect
      .poll(async () => {
        const names = await leading
          .getByTestId('model-card-name')
          .allTextContents()
        return (
          names.length === rowCount &&
          names.every(
            (name, index) =>
              index === 0 || names[index - 1].localeCompare(name) <= 0
          )
        )
      })
      .toBe(true)

    await sort.click()
    await page.getByTestId('sort-popular').click()
    await expect(sort).toContainText('Most popular')
    await expect
      .poll(() =>
        leading.evaluateAll((cards) =>
          cards.slice(0, 3).map((card) => card.getAttribute('href') ?? '')
        )
      )
      .toEqual(recommended)
  })

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
    const rowLabel = rowHeading.replace(/\s*\d+\s*$/, '').trim()
    expect(promisedCount).toBeGreaterThan(0)
    await videos.getByTestId('section-generate-videos-open').click()
    const cards = page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
    await expect(sections).toHaveCount(0)
    await expect(cards).toHaveCount(promisedCount)
    await expect(page.getByTestId('workshop-hero')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      rowLabel
    )
    await page
      .getByRole('button', { name: 'Back to all categories', exact: true })
      .click()
    await expect(sections).toBeVisible()
    await expect(page.getByTestId('workshop-hero')).toBeVisible()
  })

  test('the rows listing opens the whole catalogue', async ({ page }) => {
    await page.goto('/models/')
    await page.getByTestId('browse-all').click()

    await expect(page.getByTestId('workshop-sections')).toHaveCount(0)
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toContainText('All models')
    const promisedCount = Number(
      (await heading.innerText()).match(/(\d+)\s*$/)?.[1]
    )
    expect(promisedCount).toBeGreaterThan(0)
    await expect(
      page
        .getByTestId('workshop-models-grid')
        .getByTestId('workshop-model-card')
    ).toHaveCount(promisedCount)

    await page.getByTestId('section-back').click()
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
  })

  test('a model page returns to the shelf it was opened from', async ({
    page
  }) => {
    await page.goto('/models/')
    await page.getByTestId('section-generate-videos-open').click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Generate videos'
    )
    await page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
      .first()
      .click()

    const back = page.getByTestId('model-back')
    await expect(back).toHaveText('Back to Generate videos')
    await back.click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Generate videos'
    )
    await expect(page.getByTestId('workshop-sections')).toHaveCount(0)
  })

  test('the search field stays put as the results swap under it', async ({
    page
  }) => {
    await page.goto('/models/')
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, 700))
    const search = page.getByTestId('workshop-search')

    // Nothing else is clicked between the two measurements: a click scrolls its
    // own target into view first, which would move the page under the field.
    await search.fill('kling')
    await expect(
      page
        .getByTestId('workshop-models-grid')
        .getByTestId('workshop-model-card')
        .first()
    ).toContainText('Kling')
    const searching = await search.boundingBox()

    await search.fill('')
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
    if (!searching)
      throw new Error('the search field was never on screen to measure')
    await expect
      .poll(async () => (await search.boundingBox())?.y)
      .toBeCloseTo(searching.y, 0)
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

  test('the use-case filter actually narrows the catalog', async ({ page }) => {
    await page.goto('/models/')
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
    const all = await page.getByTestId('workshop-model-card').count()
    expect(all).toBeGreaterThan(0)
    await page.getByTestId('workshop-filter').click()
    await page.getByTestId('filter-useCase-edit-images').click()
    const cards = page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeLessThan(all)
    await expect(
      page.locator(
        '[data-testid="workshop-model-card"][href="/models/vertexai--gemini-nano-banana-2--edit-images/"]'
      )
    ).toBeVisible()
    await expect(
      page.locator(
        '[data-testid="workshop-model-card"][href="/models/bfl--flux-2-max--generate-images/"]'
      )
    ).toHaveCount(0)
    await expect(page.getByTestId('workshop-facet-useCase-count')).toHaveText(
      '1'
    )
    await expect(page.getByTestId('workshop-filter-count')).toHaveText('1')
    await page.getByTestId('workshop-filter-clear').click()
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
  })

  test('model tags deep-link into a filtered catalog', async ({ page }) => {
    await page.goto(MODEL_PATH)
    const tag = page
      .getByTestId('model-tags')
      .getByRole('link', { name: 'flux', exact: true })
    await expect(tag).toHaveAttribute('href', '/models?q=flux')
    await tag.click()
    await expect(page).toHaveURL(/\/models\/?\?q=flux$/)
    await expect(page.getByTestId('workshop-search')).toHaveValue('flux')
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
      .getByRole('link', { name: 'Image to video', exact: true })
      .click()
    await expect(page).toHaveURL(/\/models\/?\?useCase=animate-images$/)
    await expect(
      page.getByRole('heading', { level: 1, name: /Image to video/ })
    ).toBeVisible()
  })

  test('homepage model releases use the published canonical URL', async ({
    page
  }) => {
    await page.goto('/')
    await page
      .getByRole('link', { name: /Explore Seedance/i })
      .scrollIntoViewIfNeeded()
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
    await expect(page.getByTestId('run-button')).toBeEnabled()
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
    await expect(page.getByTestId('run-button')).toBeEnabled()
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Choose images or drop them here', { exact: true }).click()
    ])
    await chooser.setFiles('e2e/assets/placeholder-1x1.webp')
    await expect(
      page.getByRole('button', { name: 'Replace placeholder-1x1.webp' })
    ).toBeVisible()
  })

  test('API tab highlights snippets and mirrors the form values', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    await page
      .getByRole('textbox', { name: 'Prompt', exact: true })
      .fill('neon street at night')
    const firstSnippetRender = page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const observer = new MutationObserver(() => {
            const code = document.querySelector(
              '[data-testid="highlighted-code"]'
            )
            if (!code) return
            observer.disconnect()
            resolve(code.querySelector('span') !== null)
          })
          observer.observe(document.body, { childList: true, subtree: true })
        })
    )
    await page.getByRole('tab', { name: 'API', exact: true }).click()
    const snippet = page.getByTestId('snippet')
    const highlighted = page.getByTestId('highlighted-code')
    expect(await firstSnippetRender).toBe(true)
    await expect(snippet).toContainText('neon street at night')
    await expect(snippet).toContainText('bfl/flux-2-max')
    await page.getByTestId('snippet-curl').click()
    await expect(snippet).toContainText(
      "--request POST 'https://testapi.comfy.org/v2/models/bfl/flux-2-max'"
    )
    await expect(highlighted.locator('span').first()).toBeVisible()
  })

  test('API snippets keep uploaded media local', async ({ page }) => {
    await page.goto('/models/byteplus--seedream-4-5--edit-images/')
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Choose images or drop them here', { exact: true }).click()
    ])
    await chooser.setFiles('e2e/assets/placeholder-1x1.webp')
    await page.getByRole('tab', { name: 'API', exact: true }).click()
    const snippet = page.getByTestId('snippet')
    await expect(snippet).toContainText(
      'client.assets.from_file("placeholder-1x1.webp")'
    )
    await expect(snippet).not.toContainText('base64.b64decode')
    await expect(snippet).not.toContainText('data:image')
    await expect(page.getByRole('note')).toContainText(
      'Set the paths to your local files.'
    )

    await page.getByTestId('snippet-curl').click()
    await expect(page.getByRole('note')).toContainText(
      'cURL cannot carry your uploaded files'
    )
    await expect(snippet).not.toContainText('data:image')
    await expect(snippet).not.toContainText('"image"')
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
    const example = page.getByTestId('example-card').first()
    await expect
      .poll(async () => (await example.boundingBox())?.width ?? Infinity)
      .toBeLessThan(320)
    await page.getByRole('textbox', { name: 'Prompt', exact: true }).fill('')
    await example.click()
    await expect(page.getByTestId('playground-tab')).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Prompt', exact: true })
    ).not.toHaveValue('')
  })

  test('three examples fill the available desktop row', async ({ page }) => {
    await page.goto('/models/krea--krea-2-medium-turbo--generate-images/')
    const list = page.getByTestId('examples-tab').locator('ul')
    const cards = page.getByTestId('example-card')
    await expect(cards).toHaveCount(3)

    await expect
      .poll(async () => {
        const [listBox, firstCardBox, lastCardBox] = await Promise.all([
          list.boundingBox(),
          cards.first().boundingBox(),
          cards.last().boundingBox()
        ])
        if (!listBox || !firstCardBox || !lastCardBox) return false
        return (
          Math.abs(firstCardBox.y - lastCardBox.y) < 2 &&
          Math.abs(
            listBox.x + listBox.width - (lastCardBox.x + lastCardBox.width)
          ) < 2
        )
      })
      .toBe(true)
  })
})

test.describe('Filter sheet @mobile', () => {
  test('the handle pulls the sheet up and lets it go', async ({ page }) => {
    await page.goto('/models/')
    await page.getByTestId('workshop-filter').click()

    const sheet = page.getByTestId('workshop-filter-menu')
    await expect(sheet).toBeVisible()
    const resting = await sheet.boundingBox()
    if (!resting) throw new Error('Filter sheet has no visible bounds')

    const handle = page.getByTestId('workshop-filter-grabber')
    const grip = await handle.boundingBox()
    if (!grip) throw new Error('Filter handle has no visible bounds')
    const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }

    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x, from.y - 260, { steps: 8 })
    await page.mouse.up()

    await expect
      .poll(async () => (await sheet.boundingBox())?.height ?? 0)
      .toBeGreaterThan(resting.height)

    const grown = await handle.boundingBox()
    if (!grown) throw new Error('Expanded filter handle has no visible bounds')
    await page.mouse.move(grown.x + grown.width / 2, grown.y + grown.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      grown.x + grown.width / 2,
      grown.y + grown.height / 2 + 500,
      { steps: 8 }
    )
    await page.mouse.up()

    await expect(sheet).toHaveCount(0)
  })
})
