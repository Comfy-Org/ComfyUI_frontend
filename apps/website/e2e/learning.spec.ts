import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  categoryChapters,
  featuredFor,
  filterByCategory,
  learningCategories,
  learningTutorials,
  populatedCategories,
  recommendedFor,
  tutorialDescription,
  tutorialPath
} from '../src/data/learningTutorials'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const thumbnailLinkName = (title: string, locale: 'en' | 'zh-CN') =>
  `${t('player.play', locale)} ${title}`

const categoryNav = (page: Page, locale: 'en' | 'zh-CN' = 'en') =>
  page.getByRole('navigation', { name: t('learning.categoryNav', locale) })

// Rendered copy pinned as literals (en) rather than re-derived from the
// metadata helpers, so these assertions catch a regression in the helpers or
// the underlying strings — not just the wiring.
const EXPECTED_META = {
  vfx: {
    heading: 'VFX Tutorials',
    description:
      'Hands-on ComfyUI VFX tutorials — cleanplates, sky replacement, de-aging, mattes, and shot work you can open and run yourself.',
    title: 'VFX Tutorials - Comfy'
  },
  animations: {
    heading: 'Animation Tutorials',
    description:
      'Hands-on ComfyUI animation tutorials — character sheets, keyframes, in-betweening, backgrounds, and compositing you can run yourself.',
    title: 'Animation Tutorials - Comfy'
  },
  ads: {
    heading: 'Ad Creative Tutorials',
    description:
      'Hands-on ComfyUI ad creative tutorials — moodboards, storyboards, product photography, B-roll, and campaign assets you can run yourself.',
    title: 'Ad Creative Tutorials - Comfy'
  }
} as const

test.describe('Learning page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/learning')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Learning - Comfy')
  })

  test('sidebar shows the page heading and a link per category', async ({
    page
  }) => {
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText(t('learning.title', 'en'))

    const nav = categoryNav(page)
    await expect(nav.locator('a[href="/learning"]')).toHaveAttribute(
      'aria-current',
      'page'
    )
    for (const category of populatedCategories) {
      const link = nav.locator(`a[href="/learning/${category}"]`)
      await expect(link).toBeVisible()
      await expect(link).toContainText(
        String(filterByCategory(category).length)
      )
    }
  })

  test('omits categories that have no tutorials', async ({ page }) => {
    const nav = categoryNav(page)
    const emptyCategories = learningCategories.filter(
      (category) => !populatedCategories.includes(category)
    )
    for (const category of emptyCategories) {
      await expect(nav.locator(`a[href="/learning/${category}"]`)).toHaveCount(
        0
      )
    }
  })

  test('featured banner promotes the curated global pick', async ({ page }) => {
    const featured = featuredFor()
    if (!featured) throw new Error('expected a featured tutorial on /learning')
    await expect(
      page.getByText(t('learning.featuredBadge', 'en')).first()
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: featured.title.en, level: 2 })
    ).toBeVisible()
  })

  test('renders every tutorial as a link to its page', async ({ page }) => {
    for (const tutorial of learningTutorials) {
      await expect(
        page.getByRole('link', {
          name: thumbnailLinkName(tutorial.title.en, 'en')
        })
      ).toHaveAttribute('href', tutorialPath(tutorial))
    }
  })

  test('tutorials with a workflow link expose an external Try Workflow link', async ({
    page
  }) => {
    const linkedTutorials = learningTutorials.filter(
      (tutorial) => tutorial.href
    )
    const workflowLinks = page.getByRole('link', {
      name: t('cta.tryWorkflow', 'en')
    })
    const hrefs = await workflowLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href'))
    )
    for (const tutorial of linkedTutorials) {
      expect(hrefs).toContain(tutorial.href)
    }
  })

  test('newTab tutorials open their workflow link in a new tab', async ({
    page
  }) => {
    const links = page.getByRole('link', { name: t('cta.tryWorkflow', 'en') })
    const attrs = await links.evaluateAll((elements) =>
      elements.map((element) => ({
        href: element.getAttribute('href') ?? '',
        target: element.getAttribute('target')
      }))
    )
    // The page-level CTA shares the label; only judge tutorial links.
    const tutorialAttrs = attrs.filter(({ href }) =>
      learningTutorials.some((item) => item.href === href)
    )
    expect(tutorialAttrs.length).toBeGreaterThan(0)
    for (const { href, target } of tutorialAttrs) {
      const tutorial = learningTutorials.find((item) => item.href === href)
      expect(target, href).toBe(tutorial?.newTab ? '_blank' : null)
    }
  })

  test('call to action links to contact sales', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: t('learning.cta.heading', 'en'),
        level: 2
      })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: t('learning.cta.contactSales', 'en') })
    ).toHaveAttribute('href', '/contact')
  })
})

test.describe('Learning category pages @smoke', () => {
  test('sidebar links navigate to the category page', async ({ page }) => {
    await page.goto('/learning')
    await categoryNav(page).locator('a[href="/learning/vfx"]').click()

    await expect(page).toHaveURL('/learning/vfx')
    await expect(
      categoryNav(page).locator('a[href="/learning/vfx"]')
    ).toHaveAttribute('aria-current', 'page')
  })

  test('selecting a category swaps the heading, description, and title', async ({
    page
  }) => {
    await page.goto('/learning')
    await categoryNav(page).locator('a[href="/learning/vfx"]').click()

    await expect(page).toHaveURL('/learning/vfx')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      EXPECTED_META.vfx.heading
    )
    await expect(page.getByText(EXPECTED_META.vfx.description)).toBeVisible()
    await expect(page).toHaveTitle(EXPECTED_META.vfx.title)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      EXPECTED_META.vfx.description
    )
  })

  test('Back and Forward walk through category selections', async ({
    page
  }) => {
    await page.goto('/learning')
    await categoryNav(page).locator('a[href="/learning/vfx"]').click()
    await expect(page).toHaveURL('/learning/vfx')

    await page.goBack()
    await expect(page).toHaveURL('/learning')
    await expect(page).toHaveTitle('Learning - Comfy')
    await expect(
      categoryNav(page).locator('a[href="/learning"]')
    ).toHaveAttribute('aria-current', 'page')

    await page.goForward()
    await expect(page).toHaveURL('/learning/vfx')
    await expect(page).toHaveTitle(EXPECTED_META.vfx.title)
  })

  for (const category of populatedCategories) {
    test(`/learning/${category} lists only its own tutorials`, async ({
      page
    }) => {
      await page.goto(`/learning/${category}`)

      await expect(page).toHaveTitle(EXPECTED_META[category].title)

      for (const tutorial of learningTutorials) {
        const link = page.getByRole('link', {
          name: thumbnailLinkName(tutorial.title.en, 'en')
        })
        if (tutorial.category === category) {
          await expect(link).toBeVisible()
        } else {
          await expect(link).toHaveCount(0)
        }
      }
    })
  }
})

test.describe('Learning tutorial page @smoke', () => {
  const [firstTutorial] = learningTutorials

  test('a thumbnail navigates to the dedicated tutorial page', async ({
    page
  }) => {
    await page.goto('/learning')
    await page
      .getByRole('link', {
        name: thumbnailLinkName(firstTutorial.title.en, 'en')
      })
      .click()

    await expect(page).toHaveURL(tutorialPath(firstTutorial))
    await expect(page).toHaveTitle(`${firstTutorial.title.en} - Comfy`)
  })

  test('the page exposes an indexable heading and autoplay video', async ({
    page
  }) => {
    await page.goto(tutorialPath(firstTutorial))

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      firstTutorial.title.en
    )
    // Attribute-level autoplay check: blockExternalMedia aborts the video
    // request, so actual playback never starts in e2e.
    const video = page.locator('video')
    await expect(video).toBeVisible()
    await expect(video).toHaveAttribute('autoplay', '')
    await expect(video).toHaveAttribute('muted', '')
  })

  test('the breadcrumb links back to the directory and category', async ({
    page
  }) => {
    await page.goto(tutorialPath(firstTutorial))

    const breadcrumb = page.getByRole('navigation', {
      name: t('ui.breadcrumb', 'en')
    })
    await expect(
      breadcrumb.getByRole('link', { name: t('learning.title', 'en') })
    ).toHaveAttribute('href', '/learning')
    await expect(
      breadcrumb.getByRole('link', {
        name: t(`learning.categories.${firstTutorial.category}`, 'en')
      })
    ).toHaveAttribute('href', `/learning/${firstTutorial.category}`)
    await expect(breadcrumb.getByText(firstTutorial.title.en)).toBeVisible()
  })

  test('shows the now-watching eyebrow and tag badges', async ({ page }) => {
    await page.goto(tutorialPath(firstTutorial))

    const eyebrow = page.locator('p', {
      hasText: t('learning.watch.nowWatching', 'en')
    })
    await expect(eyebrow).toBeVisible()
    for (const tag of firstTutorial.tags) {
      await expect(page.getByText(t(tag, 'en')).first()).toBeVisible()
    }
  })

  test('links to the workflow from the title block', async ({ page }) => {
    if (!firstTutorial.href) throw new Error('expected a workflow link')
    await page.goto(tutorialPath(firstTutorial))

    const workflowLink = page.locator(`a[href="${firstTutorial.href}"]`)
    await expect(workflowLink).toHaveText(t('cta.tryWorkflow', 'en'))
  })

  test('the chapter strip links to same-category siblings', async ({
    page
  }) => {
    await page.goto(tutorialPath(firstTutorial))

    for (const sibling of categoryChapters(firstTutorial)) {
      await expect(
        page.getByRole('link', { name: sibling.title.en })
      ).toHaveAttribute('href', tutorialPath(sibling))
    }
  })

  test('recommended cards link to tutorials from other categories', async ({
    page
  }) => {
    await page.goto(tutorialPath(firstTutorial))

    const recommended = recommendedFor(firstTutorial)
    expect(recommended.length).toBeGreaterThan(0)
    for (const item of recommended) {
      expect(item.category).not.toBe(firstTutorial.category)
      const card = page.locator(`a[href="${tutorialPath(item)}"]`)
      await expect(card).toContainText(item.title.en)
    }
  })

  test('the page emits VideoObject structured data', async ({ page }) => {
    await page.goto(tutorialPath(firstTutorial))
    const blocks = page.locator('script[type="application/ld+json"]')
    const contents = await blocks.allTextContents()
    expect(contents.some((c) => c.includes('"VideoObject"'))).toBe(true)
  })

  test('renders under the zh-CN locale', async ({ page }) => {
    const zhPath = `/zh-CN${tutorialPath(firstTutorial)}`
    await page.goto(zhPath)
    await expect(page).toHaveTitle(`${firstTutorial.title['zh-CN']} - Comfy`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      firstTutorial.title['zh-CN']
    )
  })
})

test.describe('Learning tutorial page description toggle @smoke', () => {
  // The read more/less toggle only surfaces once the description clamps past
  // four lines. That needs the longest authored description at a narrow
  // (mobile) viewport — it stays unclamped at desktop width.
  test.use({ viewport: { width: 375, height: 800 } })

  const [longestDescription] = [...learningTutorials].sort(
    (a, b) =>
      tutorialDescription(b, 'en').length - tutorialDescription(a, 'en').length
  )

  test('read more expands the clamped description and collapses it again', async ({
    page
  }) => {
    await page.goto(tutorialPath(longestDescription))

    const readMore = page.getByRole('button', { name: t('ui.readMore', 'en') })
    await expect(readMore).toBeVisible()
    await expect(readMore).toHaveAttribute('aria-expanded', 'false')

    // aria-controls points at the clamped paragraph.
    const controls = await readMore.getAttribute('aria-controls')
    const description = page.locator(`p[id="${controls}"]`)
    await expect(description).toHaveClass(/line-clamp-4/)

    await readMore.click()

    const readLess = page.getByRole('button', { name: t('ui.readLess', 'en') })
    await expect(readLess).toBeVisible()
    await expect(readLess).toHaveAttribute('aria-expanded', 'true')
    await expect(description).not.toHaveClass(/line-clamp-4/)

    await readLess.click()
    await expect(readMore).toBeVisible()
    await expect(readMore).toHaveAttribute('aria-expanded', 'false')
    await expect(description).toHaveClass(/line-clamp-4/)
  })
})

test.describe('Learning page (zh-CN) @smoke', () => {
  test('renders localized title, sidebar, and tutorials', async ({ page }) => {
    await page.goto('/zh-CN/learning')

    await expect(page).toHaveTitle('学习 - Comfy')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /[一-鿿]/
    )

    const nav = categoryNav(page, 'zh-CN')
    for (const category of populatedCategories) {
      await expect(
        nav.locator(`a[href="/zh-CN/learning/${category}"]`)
      ).toBeVisible()
    }

    const [firstTutorial] = learningTutorials
    await expect(
      page.getByRole('link', {
        name: thumbnailLinkName(firstTutorial.title['zh-CN'], 'zh-CN')
      })
    ).toBeVisible()
  })
})
