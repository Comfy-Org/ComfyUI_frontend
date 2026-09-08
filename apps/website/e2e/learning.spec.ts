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
  tutorialMetaTitle,
  tutorialPath
} from '../src/data/learningTutorials'
import { externalLinks } from '../src/config/routes'
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
  basics: {
    heading: 'ComfyUI Basics',
    description:
      'Beginner ComfyUI tutorials: learn the node graph, LoRAs, style transfer, and ControlNets from the ground up.',
    metaDescription:
      'Free ComfyUI tutorials for beginners: the node graph, text-to-image and image-to-image, LoRAs and ControlNets, then inpainting, outpainting, and upscaling.',
    title: 'ComfyUI Basics for Beginners: Node Graph, LoRAs, ControlNet'
  },
  vfx: {
    heading: 'VFX Tutorials',
    description:
      'Hands-on ComfyUI VFX tutorials: cleanplates, sky replacement, de-aging, mattes, and shot work you can open and run yourself.',
    metaDescription:
      'Free ComfyUI VFX tutorials with the workflows behind them: cleanplates, sky replacement, deaging, mattes, and frame adjustments for your own shots.',
    title: 'ComfyUI VFX Tutorials: Cleanplates, Sky Replacement, Deaging'
  },
  animations: {
    heading: 'Animation Tutorials',
    description:
      'Hands-on ComfyUI animation tutorials: character sheets, keyframes, in-betweening, backgrounds, and compositing you can run yourself.',
    metaDescription:
      'Free ComfyUI animation tutorials with workflows: character sheets, keyframes, in-betweening, backgrounds, and compositing, from concept art to final shot.',
    title: 'ComfyUI Animation Tutorials: Character Sheets and Keyframes'
  },
  ads: {
    heading: 'Ad Creative Tutorials',
    description:
      'Hands-on ComfyUI ad creative tutorials: moodboards, storyboards, product photography, B-roll, and campaign assets you can run yourself.',
    metaDescription:
      'Free ComfyUI tutorials for ad creative, each with its workflow: moodboards, storyboards, product photography, talent casting, B-roll, and OOH mockups.',
    title: 'ComfyUI Ad Creative Tutorials: Moodboards to Product Shots'
  }
} as const

const ROOT_TITLE = 'ComfyUI Tutorials: Free Video Series from Basics to VFX'

test.describe('Learning page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/learning')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle(ROOT_TITLE)
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

  test('tutorials with a CTA link expose their labelled external link', async ({
    page
  }) => {
    const linkedTutorials = learningTutorials.filter(
      (tutorial) => tutorial.href
    )
    expect(linkedTutorials.length).toBeGreaterThan(0)
    for (const tutorial of linkedTutorials) {
      const link = page.locator(`a[href="${tutorial.href}"]`)
      await expect(link).toContainText(
        t(tutorial.ctaLabelKey ?? 'cta.tryWorkflow', 'en')
      )
    }
  })

  test('newTab tutorials open their CTA link in a new tab', async ({
    page
  }) => {
    const linkedTutorials = learningTutorials.filter(
      (tutorial) => tutorial.href
    )
    for (const tutorial of linkedTutorials) {
      const link = page.locator(`a[href="${tutorial.href}"]`)
      if (tutorial.newTab) {
        await expect(link).toHaveAttribute('target', '_blank')
      } else {
        await expect(link).not.toHaveAttribute('target', '_blank')
      }
    }
  })

  test('call to action links to the workflow library and cloud', async ({
    page
  }) => {
    const heading = page.getByRole('heading', {
      name: t('learning.cta.heading', 'en'),
      level: 2
    })
    await expect(heading).toBeVisible()

    // Scope to the CTA section so its "Try Workflow" button doesn't collide
    // with the per-tutorial workflow links elsewhere on the page.
    const cta = page.locator('section', { has: heading })
    await expect(
      cta.getByRole('link', { name: t('cta.tryWorkflow', 'en') })
    ).toHaveAttribute('href', externalLinks.workflows)
    await expect(
      cta.getByRole('link', { name: t('learning.cta.runComfy', 'en') })
    ).toHaveAttribute('href', externalLinks.cloud)
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
      EXPECTED_META.vfx.metaDescription
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
    await expect(page).toHaveTitle(ROOT_TITLE)
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
  const selfHostedTutorial = learningTutorials.find(
    (tutorial) => tutorial.videoSrc && !tutorial.youtubeId
  )
  const youtubeTutorial = learningTutorials.find(
    (tutorial) => tutorial.youtubeId
  )
  const workflowTutorial = learningTutorials.find((tutorial) => tutorial.href)
  if (!selfHostedTutorial || !youtubeTutorial || !workflowTutorial) {
    throw new Error('expected self-hosted, youtube, and workflow tutorials')
  }

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
    await expect(page).toHaveTitle(tutorialMetaTitle(firstTutorial, 'en'))
  })

  test('the page exposes an indexable heading and autoplay video', async ({
    page
  }) => {
    await page.goto(tutorialPath(selfHostedTutorial))

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      selfHostedTutorial.title.en
    )
    // Attribute-level autoplay check: blockExternalMedia aborts the video
    // request, so actual playback never starts in e2e.
    const video = page.locator('video')
    await expect(video).toBeVisible()
    await expect(video).toHaveAttribute('autoplay', '')
    await expect(video).toHaveAttribute('muted', '')
  })

  test('youtube tutorials embed a nocookie iframe instead of a video', async ({
    page
  }) => {
    await page.goto(tutorialPath(youtubeTutorial))

    await expect(page.locator('video')).toHaveCount(0)
    const iframe = page.locator('iframe[src*="youtube-nocookie.com/embed/"]')
    await expect(iframe).toBeVisible()
    await expect(iframe).toHaveAttribute(
      'src',
      new RegExp(`/embed/${youtubeTutorial.youtubeId}\\b`)
    )
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

  test('links to the CTA target from the title block', async ({ page }) => {
    await page.goto(tutorialPath(workflowTutorial))

    const ctaLink = page.locator(`a[href="${workflowTutorial.href}"]`)
    await expect(ctaLink).toHaveText(
      t(workflowTutorial.ctaLabelKey ?? 'cta.tryWorkflow', 'en')
    )
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
    await expect(page).toHaveTitle(tutorialMetaTitle(firstTutorial, 'zh-CN'))
    // Resolved the way the page resolves it. Chinese is optional on the type
    // now, so completeness is the coverage report's job, not this test's; this
    // asserts the heading matches whatever the resolver produced.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      firstTutorial.title['zh-CN'] ?? firstTutorial.title.en
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

    await expect(page).toHaveTitle('ComfyUI 教程：免费视频系列，从基础到 VFX')
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
        name: thumbnailLinkName(
          firstTutorial.title['zh-CN'] ?? firstTutorial.title.en,
          'zh-CN'
        )
      })
    ).toBeVisible()
  })
})
