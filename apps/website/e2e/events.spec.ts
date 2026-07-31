import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { localizeHref } from '../src/config/routes'
import {
  featuredEvents,
  pastEventPath,
  pastEvents,
  upcomingEvents
} from '../src/data/events'
import type { Locale } from '../src/i18n/translations'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH_EN = '/events'
const PATH_ZH = '/zh-CN/events'

const LOCALES: ReadonlyArray<readonly [string, Locale]> = [
  [PATH_EN, 'en'],
  [PATH_ZH, 'zh-CN']
]

function heroSection(page: Page, locale: Locale) {
  return page.locator('section').filter({
    has: page.getByRole('heading', {
      level: 1,
      name: t('events.hero.title', locale)
    })
  })
}

function upcomingSection(page: Page, locale: Locale) {
  return page.locator('section').filter({
    has: page.getByRole('heading', {
      level: 2,
      name: t('events.upcoming.title', locale)
    })
  })
}

function pastSection(page: Page, locale: Locale) {
  return page.locator('section').filter({
    has: page.getByRole('heading', {
      level: 2,
      name: t('events.past.title', locale)
    })
  })
}

test.describe('Events page — desktop @smoke', () => {
  test('renders the configured title and is indexable at both locales', async ({
    page
  }) => {
    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      await expect(page).toHaveTitle(t('events.page.title', locale))
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
    }
  })

  test('hero renders localized eyebrow, h1, and subtitle in both locales', async ({
    page
  }) => {
    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      const hero = heroSection(page, locale)
      await expect(
        hero.getByRole('heading', {
          level: 1,
          name: t('events.hero.title', locale)
        })
      ).toBeVisible()
      await expect(
        hero.getByText(t('events.hero.eyebrow', locale), { exact: true })
      ).toBeVisible()
      await expect(
        hero.getByText(t('events.hero.subtitle', locale), { exact: true })
      ).toBeVisible()
    }
  })

  test('hero carousel next/prev cycle through featured slides in both locales', async ({
    page
  }) => {
    test.skip(featuredEvents.length < 2, 'needs at least two featured events')

    // Reduced motion pauses autoplay so the slide only advances on click.
    await page.emulateMedia({ reducedMotion: 'reduce' })

    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      const hero = heroSection(page, locale)
      // Inactive slides are aria-hidden, so only the active slide's overlay
      // link is exposed; its accessible name is that slide's title.
      const activeSlide = hero.getByRole('link')
      const nextSlide = hero.getByRole('button', {
        name: t('events.hero.nextSlide', locale)
      })
      const prevSlide = hero.getByRole('button', {
        name: t('events.hero.prevSlide', locale)
      })
      const slideTitle = (index: number) => featuredEvents[index].title[locale]

      await expect(activeSlide).toHaveAccessibleName(slideTitle(0))

      // Retry the first advance until the island hydrates and the click lands.
      await expect(async () => {
        await nextSlide.click()
        await expect(activeSlide).toHaveAccessibleName(slideTitle(1))
      }).toPass()

      await prevSlide.click()
      await expect(activeSlide).toHaveAccessibleName(slideTitle(0))

      // Prev from the first slide wraps to the last.
      await prevSlide.click()
      await expect(activeSlide).toHaveAccessibleName(
        slideTitle(featuredEvents.length - 1)
      )
    }
  })

  test('upcoming section lists one row per event with localized content and links', async ({
    page
  }) => {
    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      const section = upcomingSection(page, locale)
      const rows = section.locator('li')
      await expect(rows).toHaveCount(upcomingEvents.length)

      for (const [i, event] of upcomingEvents.entries()) {
        const row = rows.nth(i)
        await expect(row).toContainText(event.name[locale])
        await expect(row).toContainText(event.location[locale])
        await expect(row).toContainText(event.dateLabel[locale])

        const link = row.getByRole('link')
        await expect(link).toHaveAttribute('href', event.link.href[locale])
      }
    }
  })

  test('past events gallery renders one card per event with WATCH NOW links', async ({
    page
  }) => {
    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      const section = pastSection(page, locale)
      await section.scrollIntoViewIfNeeded()

      const cards = section.locator('[data-slot="card"]')
      await expect(cards).toHaveCount(pastEvents.length)

      for (const [i, event] of pastEvents.entries()) {
        const card = cards.nth(i)
        await expect(card).toContainText(event.title[locale])
        const watch = card.getByRole('link', {
          name: new RegExp(t('events.past.watchNow', locale))
        })
        // Recorded events open their own detail page; the rest link out to the
        // external recording.
        const expectedHref = event.youtubeVideoId
          ? localizeHref(pastEventPath(event), locale)
          : event.watch.href[locale]
        await expect(watch).toHaveAttribute('href', expectedHref)
      }
    }
  })
})

test.describe('Events page — mobile @mobile', () => {
  test('past event cards stack in a single column at mobile width', async ({
    page
  }) => {
    await page.goto(PATH_EN)
    const section = pastSection(page, 'en')
    await section.scrollIntoViewIfNeeded()
    const cards = section.locator('[data-slot="card"]')
    await expect(cards).toHaveCount(pastEvents.length)

    const viewport = page.viewportSize()
    expect(viewport, 'viewport size').not.toBeNull()

    await expect
      .poll(async () => (await cards.nth(0).boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(viewport!.width * 0.7)

    await expect
      .poll(async () => {
        const firstBox = await cards.nth(0).boundingBox()
        const secondBox = await cards.nth(1).boundingBox()
        if (!firstBox || !secondBox) return false
        return secondBox.y >= firstBox.y + firstBox.height
      })
      .toBe(true)
  })

  test('upcoming event rows stay within viewport width', async ({ page }) => {
    await page.goto(PATH_EN)
    const section = upcomingSection(page, 'en')
    const firstRow = section.locator('li').first()
    await firstRow.scrollIntoViewIfNeeded()
    await expect(firstRow).toBeVisible()

    const box = await firstRow.boundingBox()
    expect(box, 'row bounding box').not.toBeNull()
    const viewport = page.viewportSize()
    expect(viewport, 'viewport size').not.toBeNull()
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
  })
})
