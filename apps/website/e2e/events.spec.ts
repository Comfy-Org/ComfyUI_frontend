import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { localizeHref } from '../src/config/routes'
import {
  eventPath,
  eventVideoId,
  featuredEvents,
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

  test('a video slide that ends while hovered advances once the pointer leaves', async ({
    page
  }) => {
    const videoSlideTitles = featuredEvents
      .filter((event) => event.media.type === 'video')
      .map((event) => event.title.en)
    test.skip(videoSlideTitles.length === 0, 'needs a featured video slide')

    await page.goto(PATH_EN)
    const hero = heroSection(page, 'en')
    const nextSlide = hero.getByRole('button', {
      name: t('events.hero.nextSlide', 'en')
    })
    await nextSlide.scrollIntoViewIfNeeded()
    // Hovering pauses auto-advance, so the carousel only moves on our clicks and
    // then holds the video slide once the pointer stays inside.
    await nextSlide.hover()

    const activeSlide = hero.locator('[aria-hidden="false"]')

    // Advance to whichever video slide comes next. A click before the island
    // hydrates is a no-op, so each advance retries until the slide changes.
    await expect(activeSlide.locator('a')).toHaveCount(1)
    const activeLabel = async () => {
      const label = await activeSlide.locator('a').getAttribute('aria-label')
      if (label === null) throw new Error('active slide link has no aria-label')
      return label
    }

    for (let step = 0; step < featuredEvents.length; step++) {
      const label = await activeLabel()
      if (videoSlideTitles.includes(label)) break
      await expect(async () => {
        await nextSlide.click()
        await expect(activeSlide.locator('a')).not.toHaveAttribute(
          'aria-label',
          label
        )
      }).toPass()
    }
    expect(videoSlideTitles).toContain(await activeLabel())
    // Clicking left the button focused; drop that focus so only the hover holds
    // the slide, letting the pointer leaving be what releases the advance.
    await nextSlide.blur()

    // With the pointer inside the carousel, the active video finishes (the
    // fixture serves a 0.12s placeholder) and the carousel holds its slide.
    await expect
      .poll(() =>
        activeSlide
          .locator('video')
          .evaluate((video: HTMLVideoElement) => video.ended)
          .catch(() => false)
      )
      .toBe(true)
    const heldLabel = await activeLabel()

    // Leaving the carousel releases the held advance.
    await page.mouse.move(0, 0)
    await expect(activeSlide.locator('a')).not.toHaveAttribute(
      'aria-label',
      heldLabel
    )
  })

  test('upcoming section lists one row per event with localized content and links', async ({
    page
  }) => {
    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      const section = upcomingSection(page, locale)
      // Every configured event ages out eventually, so the row assertions
      // scale to zero — the list itself has to render either way.
      await expect(section.getByRole('list')).toBeAttached()
      const rows = section.locator('li')
      await expect(rows).toHaveCount(upcomingEvents.length)

      for (const [i, event] of upcomingEvents.entries()) {
        const row = rows.nth(i)
        await expect(row).toContainText(event.title[locale])
        await expect(row).toContainText(event.location![locale])
        await expect(row).toContainText(event.dateLabel![locale])

        // In-person events override the CTA label (e.g. "Register"); the rest
        // fall back to the default "Livestream" label.
        const ctaLabel =
          event.ctaLabel?.[locale] ?? t('events.upcoming.livestream', locale)
        const ctaLink = row.getByRole('link', {
          name: `${event.title[locale]} — ${ctaLabel}`,
          exact: true
        })
        // Events with a stream open their own detail page (dialog over the
        // directory); the rest link to the event's page.
        const eventLink = event.link
        const expectedHref = eventVideoId(event)
          ? localizeHref(eventPath(event), locale)
          : eventLink?.href[locale]
        if (expectedHref) {
          await expect(ctaLink).toHaveAttribute('href', expectedHref)
        }
        // External registration links open in a new tab.
        if (!eventVideoId(event) && eventLink?.newTab) {
          await expect(ctaLink).toHaveAttribute('target', '_blank')
        }
      }
    }
  })

  test('upcoming Livestream link opens the event page with the video dialog', async ({
    page
  }) => {
    const event = upcomingEvents.find((entry) => eventVideoId(entry))
    const videoId = event && eventVideoId(event)
    test.skip(!videoId, 'needs an upcoming event with a video')
    if (!event || !videoId) return

    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      const section = upcomingSection(page, locale)
      await section.scrollIntoViewIfNeeded()

      await section
        .getByRole('link', {
          name: `${event.title[locale]} — ${t('events.upcoming.livestream', locale)}`
        })
        .click()

      await expect(page).toHaveURL(
        new RegExp(`${localizeHref(eventPath(event), locale)}/?$`)
      )
      const dialog = page.getByRole('dialog', { name: event.title[locale] })
      await expect(dialog).toBeVisible()
      await expect(
        dialog.getByRole('heading', { level: 1, name: event.title[locale] })
      ).toBeVisible()
      await expect(dialog.locator('iframe')).toHaveAttribute(
        'src',
        new RegExp(videoId)
      )

      // Future events offer adding the stream to the visitor's calendar; the
      // menu renders inside the top-layer dialog. Retry until the island
      // hydrates and the click lands.
      const addToCalendar = dialog.getByRole('button', {
        name: t('events.upcoming.addToCalendar', locale)
      })
      const googleItem = dialog.getByRole('menuitem', {
        name: t('events.upcoming.calendarGoogle', locale)
      })
      await expect(async () => {
        await addToCalendar.click()
        await expect(googleItem).toBeVisible({ timeout: 1000 })
      }).toPass()
      // Dismiss the menu: while it is open the outside pointerdown only
      // closes the menu, never the dialog behind it. The menu's outside-press
      // listener attaches on a later tick, so retry until it is really gone.
      await expect(async () => {
        await page.mouse.click(10, 10)
        await expect(googleItem).toBeHidden({ timeout: 500 })
      }).toPass()

      // Closing returns to the events directory. Retry until the dialog
      // island hydrates and the click lands; once the navigation has happened
      // the button is gone, so only click while it is still there.
      const closeButton = dialog.getByRole('button', {
        name: t('events.videoDialog.close', locale)
      })
      await expect(async () => {
        if (await closeButton.isVisible()) await closeButton.click()
        await expect(page).toHaveURL(new RegExp(`${path}/?$`), {
          timeout: 1000
        })
      }).toPass()
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
        // event's external page.
        const expectedHref = eventVideoId(event)
          ? localizeHref(eventPath(event), locale)
          : event.link!.href[locale]
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
    test.skip(upcomingEvents.length === 0, 'needs an upcoming event')
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
