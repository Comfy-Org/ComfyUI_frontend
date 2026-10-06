import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'

import { MODEL_PATH, test } from './fixtures/modelsAccount'
import { waitForIsland } from './fixtures/islands'

test.describe('Retired prototype routes', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('comfy-workshop-version', 'v2')
    )
  })

  test('ignores old stored and query layout overrides', async ({ page }) => {
    await page.goto('/hub/models/?version=v2')
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
    await expect(page.getByTestId('workshop-hub')).toHaveCount(0)
    await expect(page.getByTestId('workshop-tabs')).toHaveCount(0)
    await page.reload()
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
  })

  test('does not serve retired workflow or Workshop pages', async ({
    page
  }) => {
    const workflow = await page.goto('/hub/workflows/video_minimax_h3_i2v/')
    expect(workflow?.status()).toBe(404)
    await expect(page.getByTestId('model-detail')).toHaveCount(0)
    const workshop = await page.goto('/workshop/')
    expect(workshop?.status()).toBe(404)
    await expect(page.getByTestId('workshop-sections')).toHaveCount(0)
  })
})

test.describe('Hub pages', () => {
  for (const { path, title, heading, noindex } of [
    {
      path: 'hub/models',
      title: 'ComfyUI Models: Run AI Image, Video &amp; Audio Models - Comfy',
      heading: 'ComfyUI models',
      noindex: false
    },
    {
      path: 'hub/workflows',
      title:
        'ComfyUI Workflows: Multi-Step AI Image &amp; Video Workflows - Comfy',
      heading: 'ComfyUI workflows',
      noindex: true
    },
    {
      path: 'hub/apps',
      title: 'ComfyUI Apps: Creative Tools Built from Workflows - Comfy',
      heading: 'ComfyUI apps',
      noindex: true
    }
  ])
    test(`builds /${path}/ with its own title, heading and canonical`, () => {
      const html = readFileSync(`dist/${path}/index.html`, 'utf8')

      expect(html).toContain(`<title>${title}</title>`)
      expect(html).toMatch(new RegExp(`<h1[^>]*>\\s*${heading}\\s*</h1>`))
      expect(html).toContain(
        `rel="canonical" href="https://comfy.org/${path}/"`
      )
      expect(html.includes('<meta name="robots" content="noindex')).toBe(
        noindex
      )
    })
})

test.describe('Models catalog', () => {
  test('opens the featured model from the full banner surface', async ({
    page
  }) => {
    await page.goto('/hub/models/')
    const slide = page.getByTestId('featured-slide')
    const href = await page
      .getByTestId('featured-slide-link')
      .getAttribute('href')
    const bounds = await slide.boundingBox()
    if (!href || !bounds) throw new Error('Featured slide is not clickable')

    await slide.click({ position: { x: bounds.width - 24, y: 24 } })

    await expect(page).toHaveURL(new URL(href, page.url()).href)
  })

  test('opens the model from the banner beside the pagination bars', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/hub/models/')
    const strip = page.getByTestId('featured-pagination')
    const card = page.getByTestId('featured-slide')
    const href = await page
      .getByTestId('featured-slide-link')
      .getAttribute('href')
    await card.scrollIntoViewIfNeeded()
    const [bars, area] = [await strip.boundingBox(), await card.boundingBox()]
    if (!href || !bars || !area)
      throw new Error('Featured banner is not laid out')

    // The strip spans the card so the bars can share the room, which puts a
    // wide empty stretch of it over the link.
    await page.mouse.click(area.x + area.width - 80, bars.y + bars.height / 2)

    await expect(page).toHaveURL(new URL(href, page.url()).href)
  })

  test('keeps every pagination bar inside the banner on a phone', async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/hub/models/')
    const strip = page.getByTestId('featured-pagination')
    const card = page.getByTestId('featured-slide')
    const [bars, card_] = [await strip.boundingBox(), await card.boundingBox()]
    if (!bars || !card_) throw new Error('Featured banner is not laid out')
    expect(bars.x + bars.width).toBeLessThanOrEqual(card_.x + card_.width)
    expect(bars.x).toBeGreaterThanOrEqual(card_.x)
  })

  test('switches between the curated recommendation and alphabetical order', async ({
    page
  }) => {
    await page.goto('/hub/models/')
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
    expect(rowCount).toBeGreaterThanOrEqual(6)
    const recommended = await leading.evaluateAll((cards) =>
      cards.slice(0, 6).map((card) => card.getAttribute('href') ?? '')
    )
    expect(recommended).toEqual([
      '/hub/models/seedream-5-0-pro-text-to-image/',
      '/hub/models/gpt-image-2-text-to-image/',
      '/hub/models/seedream-4-0-text-to-image/',
      '/hub/models/grok-imagine-image-2-0-text-to-image/',
      '/hub/models/nano-banana-2-text-to-image/',
      '/hub/models/flux-2-pro-text-to-image/'
    ])
    expect(await recommendedIn('generate-videos', 5)).toEqual([
      '/hub/models/seedance-2-5-text-to-video/',
      '/hub/models/kling-3-0-turbo-text-to-video/',
      '/hub/models/grok-imagine-video-1-5-text-to-video/',
      '/hub/models/wan-3-0-text-to-video/',
      '/hub/models/gemini-omni-1-1-flash-text-to-video/'
    ])
    expect(await recommendedIn('animate-images', 6)).toEqual([
      '/hub/models/seedance-2-5-reference-to-video/',
      '/hub/models/seedance-2-5-first-last-frame/',
      '/hub/models/seedance-2-0-image-to-video/',
      '/hub/models/grok-imagine-video-image-to-video/',
      '/hub/models/wan-3-0-image-to-video/',
      '/hub/models/wan-3-0-reference-to-video/'
    ])
    expect(await recommendedIn('other-formats', 1)).toEqual([
      '/hub/models/seed-audio-1-0-text-to-speech/'
    ])
    expect(await recommendedIn('edit-videos', 6)).toEqual([
      '/hub/models/seedance-2-5-video-edit/',
      '/hub/models/kling-o3-video-edit/',
      '/hub/models/gemini-omni-1-1-flash-video-edit/',
      '/hub/models/runway-aleph-2-video-to-video/',
      '/hub/models/gemini-omni-flash-preview-video-edit/',
      '/hub/models/wan-2-7-video-edit/'
    ])
    expect(await recommendedIn('edit-images', 5)).toEqual([
      '/hub/models/nano-banana-2-image-edit/',
      '/hub/models/nano-banana-pro-image-edit/',
      '/hub/models/seedream-5-0-pro-image-edit/',
      '/hub/models/seedream-5-0-pro-layer-separation/',
      '/hub/models/seedream-4-5-image-edit/'
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
        leading.evaluateAll(
          (cards, limit) =>
            cards
              .slice(0, limit)
              .map((card) => card.getAttribute('href') ?? ''),
          recommended.length
        )
      )
      .toEqual(recommended)
  })

  test('searches the approved catalog and recovers from empty results', async ({
    page
  }) => {
    await page.goto('/hub/models/')
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
    await page.goto('/hub/models/')
    const sections = page.getByTestId('workshop-sections')
    await expect(sections).toBeVisible()
    const videos = page.getByTestId('section-generate-videos')
    const rowLabel = (
      await videos.getByRole('heading', { level: 2 }).innerText()
    ).trim()
    const seeAll = await videos
      .getByTestId('section-generate-videos-see-all')
      .innerText()
    const promisedCount = Number(seeAll.match(/(\d+)/)?.[1])
    expect(promisedCount).toBeGreaterThan(0)
    await videos.getByTestId('section-generate-videos-open').click()
    const cards = page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
    await expect(sections).toHaveCount(0)
    await expect(cards).toHaveCount(promisedCount)
    await expect(page.getByTestId('workshop-hero')).toHaveCount(0)
    await expect(
      page.getByRole('heading', { level: 2, name: rowLabel })
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Back to all categories', exact: true })
      .click()
    await expect(sections).toBeVisible()
    await expect(page.getByTestId('workshop-hero')).toBeVisible()
  })

  // A row loads eight whatever its total says, so a row holding fewer than
  // eight cards is showing its whole shelf and has nothing left to open.
  test('a shelf showing everything stops promising more', async ({ page }) => {
    await page.goto('/hub/models/')
    const sections = page.getByTestId('workshop-sections')
    await expect(sections).toBeVisible()
    await expect(
      sections.getByTestId('workshop-model-card').first()
    ).toBeVisible()
    const shelves = sections
      .locator('[data-testid^="section-"]')
      .filter({ has: page.getByTestId('workshop-model-card') })
    const count = await shelves.count()
    expect(count).toBeGreaterThan(1)

    let complete = 0
    for (let index = 0; index < count; index++) {
      const shelf = shelves.nth(index)
      if ((await shelf.getByTestId('workshop-model-card').count()) >= 8)
        continue
      complete++
      await expect(shelf.locator('[data-testid$="-see-all"]')).toHaveCount(0)
    }
    expect(complete).toBeGreaterThan(0)
  })

  test('the rows listing opens the whole catalogue', async ({ page }) => {
    await page.goto('/hub/models/')
    await page.getByTestId('browse-all-end').click()

    await expect(page.getByTestId('workshop-sections')).toHaveCount(0)
    const heading = page.getByRole('heading', {
      level: 2,
      name: /^All models \d+$/
    })
    await expect(heading).toBeVisible()
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

  test('an opened shelf reads as a chosen filter', async ({ page }) => {
    await page.goto('/hub/models/')
    await page.getByTestId('section-generate-videos-open').click()
    await expect(
      page.getByRole('heading', { level: 2, name: /Generate videos/ })
    ).toBeVisible()
    await expect(page.getByTestId('workshop-filter-count')).toHaveText('1')
    await page.getByTestId('workshop-filter').click()
    await expect(page.getByTestId('workshop-filter-applied')).toHaveText(
      '1 selected'
    )
    await page.getByTestId('workshop-filter-clear').click()
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
  })

  test('a model page returns to the shelf it was opened from', async ({
    page
  }) => {
    await page.goto('/hub/models/')
    await page.getByTestId('section-generate-videos-open').click()
    await expect(
      page.getByRole('heading', { level: 2, name: 'Generate videos' })
    ).toBeVisible()
    await page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
      .first()
      .click()

    const back = page.getByTestId('model-back')
    await expect(back).toHaveText('Back to Generate videos')
    await expect(back).toHaveAttribute(
      'href',
      '/hub/models/?useCase=generate-videos'
    )
    await back.click()
    await expect(
      page.getByRole('heading', { level: 2, name: 'Generate videos' })
    ).toBeVisible()
    await expect(page.getByTestId('workshop-sections')).toHaveCount(0)
  })

  test('the search field stays put as the results swap under it', async ({
    page
  }) => {
    await page.goto('/hub/models/')
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

  test('the category heading stays clear of the nav while searching', async ({
    page
  }) => {
    await page.goto('/hub/models/')
    await page.getByTestId('section-generate-videos-open').click()
    const heading = page.getByRole('heading', {
      level: 2,
      name: 'Generate videos'
    })
    await expect(heading).toBeVisible()

    // Typing scrolls the heading's row into view, which is what used to bury
    // the heading and the result count it carries under the sticky nav.
    await page.getByTestId('workshop-search').fill('kling')
    await expect(
      page
        .getByTestId('workshop-models-grid')
        .getByTestId('workshop-model-card')
        .first()
    ).toContainText('Kling')

    // Both measured after the scroll settles: the nav only reaches its docked
    // height once the banner above it has scrolled away.
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const clearanceBelowNav = async () => {
      const [headingBox, navBox] = await Promise.all([
        heading.boundingBox(),
        nav.boundingBox()
      ])
      if (!headingBox || !navBox) return null
      return headingBox.y - (navBox.y + navBox.height)
    }

    await expect.poll(clearanceBelowNav).toBeGreaterThanOrEqual(0)
    // Without an upper bound, dropping the scroll altogether would also pass.
    await expect.poll(clearanceBelowNav).toBeLessThan(40)
  })

  test('cards open canonical model pages with related models', async ({
    page
  }) => {
    await page.goto('/hub/models/')
    await page.getByTestId('workshop-search').fill('kling avatar')
    await page.getByRole('heading', { level: 1 }).click()
    await page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
      .first()
      .click()
    await expect(page).toHaveURL(/\/hub\/models\/kling-avatar\/$/)
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

  test('the hub page an old alias points at renders', async ({ page }) => {
    const response = await page.goto('/hub/models/flux-2-max-text-to-image/')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'FLUX 2 Max Text-to-Image'
    )
  })

  test('the use-case filter actually narrows the catalog', async ({ page }) => {
    await page.goto('/hub/models/')
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
        '[data-testid="workshop-model-card"][href="/hub/models/nano-banana-2-image-edit/"]'
      )
    ).toBeVisible()
    await expect(
      page.locator(
        '[data-testid="workshop-model-card"][href="/hub/models/flux-2-max-text-to-image/"]'
      )
    ).toHaveCount(0)
    await expect(page.getByTestId('workshop-filter-applied')).toHaveText(
      '1 selected'
    )
    await expect(page.getByTestId('workshop-filter-count')).toHaveText('1')
    await page.getByTestId('workshop-filter-clear').click()
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
  })

  test('hosted model cards say they run here and by API', async ({ page }) => {
    await page.goto('/hub/models/')
    const badges = page
      .getByTestId('workshop-model-card')
      .first()
      .getByTestId('model-access-badges')
    await expect(badges).toHaveText(/Run\s*API/)
  })

  test('the how-you-use-it filter lists open-weight downloads', async ({
    page
  }) => {
    await page.goto('/hub/models/')
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
    await page.getByTestId('workshop-filter').click()
    await page.getByTestId('workshop-facet-access').click()
    await page.getByTestId('filter-access-download').click()

    const grid = page.getByTestId('workshop-models-grid')
    await expect(grid.getByTestId('workshop-model-card')).toHaveCount(0)
    const openWeight = grid.getByTestId('open-weight-model-card')
    await expect(openWeight.first()).toHaveAttribute(
      'href',
      /^\/p\/supported-models\/[a-z0-9-]+\/$/
    )
    await expect(
      openWeight.first().getByTestId('model-access-badges')
    ).toHaveText('Download')

    await page.getByTestId('filter-access-api').click()
    await expect(grid.getByTestId('workshop-model-card').first()).toBeVisible()
    await expect(page.getByTestId('workshop-filter-count')).toHaveText('2')
  })

  test('model tags deep-link into a filtered catalog', async ({ page }) => {
    await page.goto(MODEL_PATH)
    const tag = page
      .getByTestId('model-tags')
      .getByRole('link', { name: 'premium', exact: true })
    await expect(tag).toHaveAttribute('href', '/hub/models/?q=premium')
    await tag.click()
    await expect(page).toHaveURL(/\/hub\/models\/?\?q=premium$/)
    await expect(page.getByTestId('workshop-search')).toHaveValue('premium')
    const cards = page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
    await expect(cards.first()).toBeVisible()
    for (const card of await cards.all())
      await expect(card.getByTestId('tag-row')).toContainText(/premium/i)
  })

  test('the hero medium deep-links into the catalog', async ({ page }) => {
    await page.goto('/hub/models/kling-avatar/')
    await page
      .getByTestId('model-hero')
      .getByRole('link', { name: 'Image to video', exact: true })
      .click()
    await expect(page).toHaveURL(/\/hub\/models\/?\?useCase=animate-images$/)
    await expect(
      page.getByRole('heading', { level: 2, name: /Image to video/ })
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
    ).toHaveAttribute('href', '/hub/models/seedance-2-5-text-to-video/')
  })

  test('the row arrow sits level with the middle of a card', async ({
    page
  }) => {
    for (const width of [1440, 820, 420]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/hub/models/')
      const row = page.getByTestId('section-generate-images')
      const card = row.getByTestId('workshop-model-card').first()
      await expect(card).toBeVisible()
      await card.hover()
      const cardBox = await card.boundingBox()
      const arrowBox = await row.getByTestId('card-row-next').boundingBox()
      if (!cardBox || !arrowBox) throw new Error('the row did not lay out')
      const middleOf = (box: { y: number; height: number }) =>
        box.y + box.height / 2
      expect(Math.abs(middleOf(arrowBox) - middleOf(cardBox))).toBeLessThan(1)
    }
  })

  test('the fade reaches both ends of the scrolling row', async ({ page }) => {
    await page.goto('/hub/models/')
    const row = page.getByTestId('section-generate-images')
    await expect(row.getByTestId('workshop-model-card').first()).toBeVisible()
    await row.hover()
    const edges = await row.evaluate((section) => {
      const span = (selector: string) => {
        const element = section.querySelector(selector)
        if (!element) return undefined
        const { x, width } = element.getBoundingClientRect()
        return { left: x, right: x + width }
      }
      return {
        scroller: span('ul'),
        fades: span('[data-testid="card-row-arrows"]')
      }
    })
    expect(edges.fades).toEqual(edges.scroller)
  })
})

test.describe('Model playground', () => {
  test('keeps a long prompt whole instead of scrolling it out of sight', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    const prompt = page.getByTestId('field-prompt')
    const hidden = () =>
      prompt.evaluate((box) => box.scrollHeight - box.clientHeight)
    const height = () => prompt.evaluate((box) => box.clientHeight)

    await prompt.fill(
      Array.from({ length: 12 }, (_, line) => `Line ${line + 1}.`).join('\n')
    )
    await expect.poll(hidden).toBeLessThanOrEqual(1)
    const tall = await height()

    await prompt.fill('One line.')
    await expect.poll(height).toBeLessThan(tall)
    await expect.poll(hidden).toBeLessThanOrEqual(1)
  })

  test('keeps a long prompt whole when the layout narrows under it', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    const prompt = page.getByTestId('field-prompt')
    const hidden = () =>
      prompt.evaluate((box) => box.scrollHeight - box.clientHeight)

    await prompt.fill(
      'A slow push-in on a glass teapot lit from behind by a low winter sun, steam rising and catching the light while the room around it stays in shadow, the reflections on the table kept sharp and the background soft, with no people, no text and no logos anywhere in the frame.'
    )
    await expect.poll(hidden).toBeLessThanOrEqual(1)

    await page.setViewportSize({ width: 380, height: 900 })

    await expect.poll(hidden).toBeLessThanOrEqual(1)
  })

  test('stops the prompt box short of swallowing the window', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(MODEL_PATH)
    const prompt = page.getByTestId('field-prompt')

    await prompt.fill(
      Array.from({ length: 60 }, (_, line) => `Line ${line + 1}.`).join('\n')
    )

    // A prompt this long would bury the rest of the form, so the box keeps a
    // share of the window and scrolls what is left.
    await expect
      .poll(() => prompt.evaluate((box) => box.clientHeight))
      .toBeLessThan(800)
    await expect
      .poll(() => prompt.evaluate((box) => box.scrollHeight - box.clientHeight))
      .toBeGreaterThan(1)
  })

  test('puts data-declared parameters in the Advanced disclosure', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    const advanced = page.getByTestId('playground-advanced')
    await waitForIsland(page, advanced)
    await expect(page.getByTestId('field-prompt_upsampling')).not.toBeVisible()
    await advanced.locator('summary').click()
    await expect(page.getByTestId('field-prompt_upsampling')).toBeVisible()
    await expect(page.getByTestId('field-seed')).toBeVisible()
  })

  test('asks nothing about the provider moderation checks and sends nothing', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    const advanced = page.getByTestId('playground-advanced')
    await waitForIsland(page, advanced)
    await advanced.locator('summary').click()

    await expect(page.getByTestId('field-safety_tolerance')).toHaveCount(0)
    await expect(
      page.getByRole('combobox', { name: 'Safety tolerance', exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole('slider', { name: 'Safety tolerance', exact: true })
    ).toHaveCount(0)

    await page.getByTestId('model-path-api').click()
    await expect(page.getByTestId('snippet')).not.toContainText(
      'safety_tolerance'
    )
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

    const nav = page.getByRole('navigation', {
      name: 'Main navigation',
      exact: true
    })
    await nav.getByRole('button', { name: /^Hub/ }).hover()
    await nav.getByRole('link', { name: /^Explore the Hub/ }).click()
    await expect(page).toHaveURL('/hub/')
    await page.getByTestId('explore-door-models').click()
    await page.getByTestId('workshop-search').fill('Seedream 4.5 Image Edit')
    await page
      .getByTestId('workshop-models-grid')
      .getByRole('link', { name: /Seedream 4\.5 Image Edit/ })
      .click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Seedream 4.5 Image Edit'
    )
    await expect(page.getByTestId('run-button')).toBeEnabled()
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page
        .getByRole('button', { name: /^Replace / })
        .first()
        .click()
    ])
    await chooser.setFiles('e2e/assets/placeholder-1x1.webp')
    await expect(
      page.getByRole('button', { name: 'Replace placeholder-1x1.webp' })
    ).toBeVisible()
  })

  test('API tab highlights snippets and mirrors the form values', async ({
    page
  }) => {
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        const code = document.querySelector('[data-testid="highlighted-code"]')
        if (!code) return
        observer.disconnect()
        document.documentElement.dataset.firstSnippetHighlighted = String(
          code.querySelector('span') !== null
        )
      })
      observer.observe(document, { childList: true, subtree: true })
    })
    await page.goto(MODEL_PATH)
    await page
      .getByRole('textbox', { name: 'Prompt', exact: true })
      .fill('neon street at night')
    await page.getByTestId('model-path-api').click()
    const snippet = page.getByTestId('snippet')
    const highlighted = page.getByTestId('highlighted-code')
    await expect(page.locator('html')).toHaveAttribute(
      'data-first-snippet-highlighted',
      'true'
    )
    await expect(snippet).toContainText('neon street at night')
    await expect(snippet).toContainText('bfl/flux-2-max')
    await page.getByTestId('snippet-curl').click()
    await expect(snippet).toContainText(
      "--request POST 'https://testapi.comfy.org/v2/models/bfl/flux-2-max'"
    )
    await expect(highlighted.locator('span').first()).toBeVisible()
  })

  test('API snippets keep uploaded media local', async ({ page }) => {
    await page.goto('/hub/models/seedream-4-5-image-edit/')
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: /^Replace seedream-4-5-input-/ }).click()
    ])
    await chooser.setFiles('e2e/assets/placeholder-1x1.webp')
    await page.getByTestId('model-path-api').click()
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

    // Clearing the field is a deliberate edit, so the example asks before it
    // writes over it.
    await page.getByTestId('example-replace-confirm').click()

    await expect(page.getByTestId('playground-section')).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Prompt', exact: true })
    ).not.toHaveValue('')
  })

  test('an example leaves a cleared prompt alone when asked to', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    const prompt = page.getByRole('textbox', { name: 'Prompt', exact: true })
    await expect(prompt).not.toHaveValue('')
    await prompt.fill('')

    await page.getByTestId('example-card').first().click()
    const dialog = page.getByTestId('example-replace-dialog')
    await expect(dialog.getByRole('heading')).toHaveText('Load this example?')
    await expect(dialog.getByRole('button')).toHaveCount(2)
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: 'Load example' })
    ).toBeVisible()
    await page.getByTestId('example-replace-keep').click()

    await expect(page.getByTestId('example-replace-dialog')).toHaveCount(0)
    await expect(prompt).toHaveValue('')
  })

  test('three examples fill the available desktop row', async ({ page }) => {
    await page.goto('/hub/models/krea-2-medium-turbo-text-to-image/')
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

  test('a phone sample is big enough to judge @mobile', async ({ page }) => {
    await page.goto('/hub/models/krea-2-medium-turbo-text-to-image/')
    const cards = page.getByTestId('example-card')
    await expect(cards).toHaveCount(3)

    // A sample exists to be judged. Below this it is a thumbnail of a
    // thumbnail, which is what it was.
    await expect
      .poll(async () => (await cards.first().boundingBox())?.width ?? 0)
      .toBeGreaterThan(260)

    const list = page.getByTestId('examples-tab').locator('ul')
    await expect
      .poll(() => list.evaluate((el) => el.scrollWidth > el.clientWidth))
      .toBe(true)
  })

  // 320px is the narrowest phone the site supports, and it is where a fixed
  // card width ran the next sample off the screen: a strip that scrolls with
  // nothing showing past its edge reads as a single card.
  test('the next sample shows past the edge at 320px @mobile', async ({
    page
  }) => {
    const width = 320
    await page.setViewportSize({ width, height: 720 })
    await page.goto('/hub/models/krea-2-medium-turbo-text-to-image/')
    const cards = page.getByTestId('example-card')
    await expect(cards).toHaveCount(3)

    await expect
      .poll(async () => {
        const box = await cards.nth(1).boundingBox()
        if (!box) return false
        // Far enough in to be seen, and still running off the edge: a card
        // that fitted whole would say the strip ends there.
        return box.x < width - 24 && box.x + box.width > width
      })
      .toBe(true)
  })

  test('a lone sample takes the phone row @mobile', async ({ page }) => {
    await page.goto('/hub/models/flux-2-pro-text-to-image/')
    const cards = page.getByTestId('example-card')
    await expect(cards).toHaveCount(1)

    // The strip runs edge to edge behind a gutter of 24px on each side.
    const list = page.getByTestId('examples-tab').locator('ul')
    await expect
      .poll(async () => {
        const [listBox, cardBox] = await Promise.all([
          list.boundingBox(),
          cards.first().boundingBox()
        ])
        if (!listBox || !cardBox) return false
        return Math.abs(cardBox.width - (listBox.width - 48)) < 2
      })
      .toBe(true)
  })
})

test.describe('Filter sheet @mobile', () => {
  test('the handle pulls the sheet up and lets it go', async ({ page }) => {
    await page.goto('/hub/models/')
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
