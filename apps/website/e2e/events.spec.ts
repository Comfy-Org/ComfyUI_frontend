import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { externalLinks, localizeHref } from '../src/config/routes'
import type { ComfyEvent } from '../src/data/events'
import {
  directoryEvents,
  eventPath,
  eventVideoId,
  featuredEvents,
  pastEvents,
  upcomingEvents
} from '../src/data/events'
import type { Locale } from '../src/i18n/translations'
import { t } from '../src/i18n/translations'
import {
  EVENT_CATEGORIES,
  PAST_EVENTS_PAGE_SIZE,
  pastCtaLabel
} from '../src/utils/eventsDirectory'
import { test } from './fixtures/blockExternalMedia'

const PATH_EN = '/events'
const PATH_ZH = '/zh-CN/events'

const LOCALES: ReadonlyArray<readonly [string, Locale]> = [
  [PATH_EN, 'en'],
  [PATH_ZH, 'zh-CN']
]

// Every past event gets a card; the ones with no art get a gradient stand-in.
const pastCardEvents = pastEvents

function heroSection(page: Page, locale: Locale) {
  return page.locator('section').filter({
    has: page.getByRole('heading', {
      level: 1,
      name: t('events.hero.title', locale)
    })
  })
}

// Mirrors the singular/plural pick in EventsDirectorySection.vue.
function countLabel(count: number, locale: Locale) {
  const key =
    count === 1 ? 'events.directory.countOne' : 'events.directory.count'
  return t(key, locale).replace('{count}', String(count))
}

// Expected filter results restated from the raw event data, so the spec never
// asks the production filter what the page should show.
const inCategory = (category: string) =>
  directoryEvents.filter((event) => event.category === category)

const byOrganizer = (organizer: string) =>
  directoryEvents.filter((event) => event.organizer === organizer)

const matchesSearch = (event: ComfyEvent, query: string) =>
  [event.title.en, event.description.en, event.location?.en ?? ''].some(
    (field) => field.toLowerCase().includes(query.toLowerCase())
  )

// The agenda contract restated from the raw data. Month keys are the event's
// own written month — the ISO strings carry the event's offset, so their
// leading YYYY-MM already is that month. Upcoming months ascend then past
// months descend; rows inside an upcoming month ascend by start, inside a
// past month they descend. A month counts as upcoming while any of its
// events does.
function expectedAgendaMonths(): { key: string; eventIds: string[] }[] {
  const upcomingIds = new Set(upcomingEvents.map((event) => event.id))
  const byMonth = new Map<string, ComfyEvent[]>()
  for (const event of directoryEvents) {
    const key = event.startDateTime.slice(0, 7)
    byMonth.set(key, [...(byMonth.get(key) ?? []), event])
  }
  const byStart = (a: ComfyEvent, b: ComfyEvent) =>
    Date.parse(a.startDateTime) - Date.parse(b.startDateTime)
  const months = [...byMonth.entries()].map(([key, events]) => ({
    key,
    upcoming: events.some((event) => upcomingIds.has(event.id)),
    events: [...events]
  }))
  for (const month of months) {
    month.events.sort(month.upcoming ? byStart : (a, b) => byStart(b, a))
  }
  return [
    ...months
      .filter((month) => month.upcoming)
      .sort((a, b) => a.key.localeCompare(b.key)),
    ...months
      .filter((month) => !month.upcoming)
      .sort((a, b) => b.key.localeCompare(a.key))
  ].map(({ key, events }) => ({
    key,
    eventIds: events.map((event) => event.id)
  }))
}

// Month headings are localized by Intl, not by an i18n key.
const monthHeading = (key: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${key}-01T00:00:00Z`))

function directorySection(page: Page, locale: Locale) {
  return page.locator('section').filter({
    has: page.getByRole('heading', {
      level: 2,
      name: t('events.directory.title', locale)
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
      await expect(
        hero.getByRole('link', {
          name: t('events.hero.browseEvents', locale)
        })
      ).toHaveAttribute('href', '#events-directory')
      await expect(
        hero.getByRole('link', {
          name: t('events.hero.hostAnEvent', locale)
        })
      ).toHaveAttribute('href', '#host-an-event')
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
      // link is exposed; its accessible name is that slide's title. The hero
      // CTAs are links too, so scope to the carousel's active slide.
      const activeSlide = hero
        .locator('[aria-hidden="false"]')
        .getByRole('link')
      const nextSlide = hero.getByRole('button', {
        name: t('events.hero.nextSlide', locale)
      })
      const prevSlide = hero.getByRole('button', {
        name: t('events.hero.prevSlide', locale)
      })
      const slideTitle = (index: number) =>
        featuredEvents[index].title[locale] || featuredEvents[index].title.en

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

  test('directory and host sections render their headings', async ({
    page
  }) => {
    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      await expect(
        page.getByRole('heading', {
          level: 2,
          name: t('events.directory.title', locale)
        })
      ).toBeVisible()
      await expect(
        page.getByRole('heading', {
          level: 2,
          name: t('events.host.title', locale)
        })
      ).toBeVisible()
    }
  })

  test('the apply-to-host CTA points at the real form', async ({ page }) => {
    // The form URL was a '#' placeholder through most of the rebuild, which
    // left these visibly inert. Assert they stay wired. The hero's own CTA
    // anchors to the host section, and the directory header dropped its
    // apply link in the design-feedback pass — the host section's own CTA is
    // the one that renders on load (the step CTAs live in collapsed panels).
    const href = externalLinks.eventHostApplicationForm
    expect(href).not.toBe('#')

    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      const cta = page.getByRole('link', {
        name: t('events.host.applyToHost', locale)
      })
      await expect(cta).toHaveCount(1)
      await expect(cta).toHaveAttribute('href', href)
      await expect(cta).toHaveAttribute('target', '_blank')
      await expect(cta).toHaveAttribute('rel', /noopener/)
    }
  })

  test('directory lists every event with a live count in both locales', async ({
    page
  }) => {
    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      const section = directorySection(page, locale)
      await section.scrollIntoViewIfNeeded()

      const rows = section.getByTestId('events-directory-row')
      await expect(rows).toHaveCount(directoryEvents.length)
      await expect(
        section.getByText(countLabel(directoryEvents.length, locale))
      ).toBeVisible()

      // Upcoming events sort first and offer the calendar menu; past events
      // follow and link out to their recording.
      for (const [i, event] of directoryEvents.entries()) {
        await expect(rows.nth(i)).toContainText(
          event.title[locale] || event.title.en
        )
      }
    }
  })

  test('directory search narrows the list and the count follows it', async ({
    page
  }) => {
    const target = directoryEvents.find((event) => event.location)
    test.skip(!target, 'needs an event with a location')
    if (!target) return

    const query = target.location!.en
    const expected = directoryEvents.filter((event) =>
      matchesSearch(event, query)
    )

    await page.goto(PATH_EN)
    const section = directorySection(page, 'en')
    await section.scrollIntoViewIfNeeded()

    const rows = section.getByTestId('events-directory-row')
    const search = section.getByLabel(t('events.directory.searchLabel', 'en'))
    // Retry until the island hydrates and the typing lands.
    await expect(async () => {
      await search.fill(query)
      await expect(rows).toHaveCount(expected.length, { timeout: 1000 })
    }).toPass()
    for (const [i, event] of expected.entries()) {
      await expect(rows.nth(i)).toContainText(event.title.en)
    }
    await expect(
      section.getByText(countLabel(expected.length, 'en'))
    ).toBeVisible()

    // A query that matches nothing falls through to the empty state.
    await search.fill('zzzzzzzz')
    await expect(rows).toHaveCount(0)
    await expect(
      section.getByText(t('events.directory.empty', 'en'))
    ).toBeVisible()
  })

  test('map renders and its pins track the active filters', async ({
    page
  }) => {
    const mappable = directoryEvents.filter((event) => event.coords)
    test.skip(mappable.length === 0, 'needs at least one event with coords')

    // A category whose events all lack coords must empty the map; one with a
    // single mappable event must show exactly one pin (no clustering to fold).
    const emptyCategory = EVENT_CATEGORIES.find(
      (category) =>
        inCategory(category).length > 0 &&
        inCategory(category).every((event) => !event.coords)
    )
    const singlePinCategory = EVENT_CATEGORIES.find(
      (category) =>
        inCategory(category).filter((event) => event.coords).length === 1
    )

    await page.goto(PATH_EN)
    const section = directorySection(page, 'en')
    await section.scrollIntoViewIfNeeded()

    // Leaflet only loads in the browser, so the container appears on hydration.
    await expect(section.locator('.leaflet-container')).toBeVisible()

    // Pins cluster by pixel distance, so the unfiltered count is bounded by the
    // mappable events rather than equal to them.
    const pins = section.locator('.leaflet-marker-icon')
    await expect.poll(() => pins.count()).toBeGreaterThan(0)
    await expect.poll(() => pins.count()).toBeLessThanOrEqual(mappable.length)

    const typeFilter = section.getByLabel(t('events.directory.typeLabel', 'en'))

    if (singlePinCategory) {
      await typeFilter.selectOption(singlePinCategory)
      await expect(pins).toHaveCount(1)

      // A single-event pin is a divIcon whose title is the event's title;
      // clicking it selects the matching directory row, which highlights with
      // the yellow ring (the row has no aria selection state).
      const pinned = inCategory(singlePinCategory).find((event) => event.coords)
      expect(pinned).toBeDefined()
      const selectedRow = section.locator(
        `[data-testid="events-directory-row"][data-event-id="${pinned!.id}"]`
      )
      await expect(pins).toHaveAttribute('title', pinned!.title.en)
      await expect(selectedRow).not.toHaveClass(/ring-primary-comfy-yellow/)
      // The 8px pin sits under the sticky header at this map framing and the
      // site's smooth-scroll keeps it there, so a pointer click can never
      // land; fire the DOM click Leaflet listens for on the icon instead.
      await pins.dispatchEvent('click')
      await expect(selectedRow).toHaveClass(/ring-primary-comfy-yellow/)
    }

    if (emptyCategory) {
      await typeFilter.selectOption(emptyCategory)
      await expect(pins).toHaveCount(0)
      // The list still carries those events; only the map drops them.
      await expect(section.getByTestId('events-directory-row')).toHaveCount(
        inCategory(emptyCategory).length
      )
    }

    await typeFilter.selectOption('all')
    await expect.poll(() => pins.count()).toBeGreaterThan(0)
  })

  test('cards tab shows the same filtered set and keeps the filters', async ({
    page
  }) => {
    const category = EVENT_CATEGORIES.find((entry) =>
      directoryEvents.some((event) => event.category === entry)
    )
    test.skip(!category, 'needs at least one categorised event')
    if (!category) return

    const expected = inCategory(category)

    await page.goto(PATH_EN)
    const section = directorySection(page, 'en')
    await section.scrollIntoViewIfNeeded()

    const cards = section.getByTestId('events-directory-card')
    const rows = section.getByTestId('events-directory-row')

    // Map is the default view, so no cards until the tab is picked.
    await expect(cards).toHaveCount(0)

    // Filter first, then switch: the tab must inherit the active filters.
    const typeFilter = section.getByLabel(t('events.directory.typeLabel', 'en'))
    await expect(async () => {
      await typeFilter.selectOption(category)
      await expect(rows).toHaveCount(expected.length, { timeout: 1000 })
    }).toPass()

    await section
      .getByRole('button', { name: t('events.directory.view.cards', 'en') })
      .click()
    await expect(cards).toHaveCount(expected.length)
    // The map view's list and map are gone while cards are showing.
    await expect(rows).toHaveCount(0)
    await expect(section.locator('.leaflet-container')).toHaveCount(0)
    for (const [i, event] of expected.entries()) {
      await expect(cards.nth(i)).toContainText(event.title.en)
    }
    await expect(
      section.getByLabel(t('events.directory.typeLabel', 'en'))
    ).toHaveValue(category)

    // Searching while on the cards tab narrows the cards too.
    await section
      .getByLabel(t('events.directory.searchLabel', 'en'))
      .fill('zzzzzzzz')
    await expect(cards).toHaveCount(0)
    await expect(
      section.getByText(t('events.directory.empty', 'en'))
    ).toBeVisible()

    // Switching back restores the map view with the filters still applied.
    await section
      .getByRole('button', { name: t('events.directory.view.map', 'en') })
      .click()
    await expect(section.locator('.leaflet-container')).toBeVisible()
    await expect(
      section.getByLabel(t('events.directory.typeLabel', 'en'))
    ).toHaveValue(category)
  })

  test('cards carry the same upcoming and past CTAs as the list', async ({
    page
  }) => {
    const upcoming = directoryEvents.find(
      (event) => Date.parse(event.startDateTime) > Date.now()
    )
    test.skip(!upcoming, 'needs an upcoming event')
    if (!upcoming) return

    await page.goto(PATH_EN)
    const section = directorySection(page, 'en')
    await section.scrollIntoViewIfNeeded()

    const cards = section.getByTestId('events-directory-card')
    const cardsTab = section.getByRole('button', {
      name: t('events.directory.view.cards', 'en')
    })
    // Retry only the tab switch, until the island hydrates and the click lands.
    // Once cards are on screen the section is live, so the menu below needs no
    // retry — and must not get one: clicking the trigger again would toggle the
    // menu shut.
    await expect(async () => {
      await cardsTab.click()
      await expect(cards.first()).toBeVisible({ timeout: 1000 })
    }).toPass()

    const card = cards.filter({ hasText: upcoming.title.en }).first()
    // An upcoming card offers the calendar menu, not a watch link — and unlike
    // CardArticle01 there is no full-card link overlay to swallow the click.
    await expect(
      card.getByRole('link', { name: pastCtaLabel(upcoming, 'en') })
    ).toHaveCount(0)

    const saveTheDate = card.getByRole('button', {
      name: t('events.directory.saveTheDate', 'en')
    })
    await saveTheDate.scrollIntoViewIfNeeded()
    await saveTheDate.click()
    await expect(
      page.getByRole('menuitem', {
        name: t('events.calendar.google', 'en')
      })
    ).toBeVisible()

    // A past card links out instead of offering the menu.
    const past = directoryEvents.find(
      (event) => Date.parse(event.startDateTime) < Date.now() && event.link
    )
    if (past) {
      await page.keyboard.press('Escape')
      const pastCard = cards.filter({ hasText: past.title.en }).first()
      await expect(
        pastCard.getByRole('link', { name: pastCtaLabel(past, 'en') })
      ).toBeVisible()
      await expect(
        pastCard.getByRole('button', {
          name: t('events.directory.saveTheDate', 'en')
        })
      ).toHaveCount(0)
    }
  })

  test('calendar tab groups the filtered set into sticky months', async ({
    page
  }) => {
    await page.goto(PATH_EN)
    const section = directorySection(page, 'en')
    await section.scrollIntoViewIfNeeded()

    const agenda = section.getByTestId('events-directory-agenda')
    const rows = section.getByTestId('events-directory-row')
    const calendarTab = section.getByRole('button', {
      name: t('events.directory.view.calendar', 'en')
    })
    // Retry only the tab switch, until the island hydrates and the click lands.
    await expect(async () => {
      await calendarTab.click()
      await expect(agenda).toBeVisible({ timeout: 1000 })
    }).toPass()

    // Every event is present, grouped rather than dropped.
    await expect(rows).toHaveCount(directoryEvents.length)
    await expect(section.locator('.leaflet-container')).toHaveCount(0)

    // The grouping and its upcoming-ascending-then-past-descending month
    // order, checked against a restatement built from the raw event data.
    const expectedMonths = expectedAgendaMonths()
    const headings = agenda.locator('[data-month]')
    await expect(headings).toHaveCount(expectedMonths.length)
    expect(
      await headings.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-month'))
      )
    ).toEqual(expectedMonths.map((month) => month.key))

    // Headings are localized by Intl, not by an i18n key, and they stick.
    await expect(headings.first()).toHaveText(
      monthHeading(expectedMonths[0].key, 'en')
    )
    await expect(headings.first()).toHaveCSS('position', 'sticky')

    // Each month holds exactly its own events, in the order the grouping gives.
    for (const month of expectedMonths) {
      const monthRows = agenda
        .locator(`section:has(> [data-month="${month.key}"])`)
        .getByTestId('events-directory-row')
      await expect(monthRows).toHaveCount(month.eventIds.length)
      expect(
        await monthRows.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute('data-event-id'))
        )
      ).toEqual(month.eventIds)
    }

    // Filters reach the agenda like every other view.
    await section
      .getByLabel(t('events.directory.searchLabel', 'en'))
      .fill('zzzzzzzz')
    await expect(rows).toHaveCount(0)
    await expect(
      section.getByText(t('events.directory.empty', 'en'))
    ).toBeVisible()
  })

  test('agenda month headings localize per locale', async ({ page }) => {
    const firstMonth = expectedAgendaMonths()[0]
    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      const section = directorySection(page, locale)
      await section.scrollIntoViewIfNeeded()

      const agenda = section.getByTestId('events-directory-agenda')
      const calendarTab = section.getByRole('button', {
        name: t('events.directory.view.calendar', locale)
      })
      await expect(async () => {
        await calendarTab.click()
        await expect(agenda).toBeVisible({ timeout: 1000 })
      }).toPass()

      await expect(
        agenda.locator(`[data-month="${firstMonth.key}"]`)
      ).toHaveText(monthHeading(firstMonth.key, locale))
    }
  })

  test('calendar tab inherits a filter set beforehand and hands it back', async ({
    page
  }) => {
    const category = EVENT_CATEGORIES.find((entry) => {
      const count = inCategory(entry).length
      return count > 0 && count < directoryEvents.length
    })
    test.skip(!category, 'needs a category that narrows the list')
    if (!category) return

    const expected = inCategory(category)

    await page.goto(PATH_EN)
    const section = directorySection(page, 'en')
    await section.scrollIntoViewIfNeeded()

    const rows = section.getByTestId('events-directory-row')
    const typeFilter = section.getByLabel(t('events.directory.typeLabel', 'en'))
    // Filter first, then switch: the calendar must inherit the active filter.
    await expect(async () => {
      await typeFilter.selectOption(category)
      await expect(rows).toHaveCount(expected.length, { timeout: 1000 })
    }).toPass()

    const agenda = section.getByTestId('events-directory-agenda')
    await section
      .getByRole('button', { name: t('events.directory.view.calendar', 'en') })
      .click()
    await expect(agenda).toBeVisible()

    // Only the filtered events reach the agenda, and the control still shows
    // the selection. The agenda regroups by month, so compare as sets.
    await expect(rows).toHaveCount(expected.length)
    const agendaIds = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-event-id'))
    )
    expect([...agendaIds].sort()).toEqual(
      expected.map((event) => event.id).sort()
    )
    await expect(typeFilter).toHaveValue(category)

    // Switching back restores the map view with the same filtered set.
    await section
      .getByRole('button', { name: t('events.directory.view.map', 'en') })
      .click()
    await expect(section.locator('.leaflet-container')).toBeVisible()
    await expect(rows).toHaveCount(expected.length)
    await expect(typeFilter).toHaveValue(category)
  })

  test('directory type filter composes with the search box', async ({
    page
  }) => {
    const category = directoryEvents
      .map((event) => event.category)
      .find((entry) => entry !== directoryEvents[0]?.category)
    test.skip(!category, 'needs events in at least two categories')
    if (!category) return

    const expected = inCategory(category)

    await page.goto(PATH_EN)
    const section = directorySection(page, 'en')
    await section.scrollIntoViewIfNeeded()

    const rows = section.getByTestId('events-directory-row')
    const typeFilter = section.getByLabel(t('events.directory.typeLabel', 'en'))
    await expect(async () => {
      await typeFilter.selectOption(category)
      await expect(rows).toHaveCount(expected.length, { timeout: 1000 })
    }).toPass()
    for (const [i, event] of expected.entries()) {
      await expect(rows.nth(i)).toContainText(event.title.en)
    }

    // Composing a non-matching search with the same type empties the list.
    await section
      .getByLabel(t('events.directory.searchLabel', 'en'))
      .fill('zzzzzzzz')
    await expect(rows).toHaveCount(0)

    // Back to All types with the search cleared restores every event.
    await section.getByLabel(t('events.directory.searchLabel', 'en')).fill('')
    await typeFilter.selectOption('all')
    await expect(rows).toHaveCount(directoryEvents.length)
  })

  test('organizer filter narrows the list, composes with type, and resets', async ({
    page
  }) => {
    const expectedComfy = byOrganizer('comfy')
    test.skip(
      expectedComfy.length === 0 ||
        expectedComfy.length === directoryEvents.length,
      'needs Comfy-organized events alongside other organizers'
    )

    // A type that narrows the Comfy set further proves the two filters AND
    // together rather than replacing each other.
    const category = expectedComfy
      .map((event) => event.category)
      .find((entry) => entry !== expectedComfy[0].category)
    const expectedBoth = category
      ? expectedComfy.filter((event) => event.category === category)
      : []

    await page.goto(PATH_EN)
    const section = directorySection(page, 'en')
    await section.scrollIntoViewIfNeeded()

    const rows = section.getByTestId('events-directory-row')
    const organizerFilter = section.getByLabel(
      t('events.directory.organizerLabel', 'en')
    )
    await expect(async () => {
      await organizerFilter.selectOption('comfy')
      await expect(rows).toHaveCount(expectedComfy.length, { timeout: 1000 })
    }).toPass()
    for (const [i, event] of expectedComfy.entries()) {
      await expect(rows.nth(i)).toContainText(event.title.en)
    }
    await expect(
      section.getByText(countLabel(expectedComfy.length, 'en'))
    ).toBeVisible()

    const typeFilter = section.getByLabel(t('events.directory.typeLabel', 'en'))
    if (category) {
      await typeFilter.selectOption(category)
      await expect(rows).toHaveCount(expectedBoth.length)
      for (const [i, event] of expectedBoth.entries()) {
        await expect(rows.nth(i)).toContainText(event.title.en)
      }

      // Releasing only the organizer leaves the type filter in force.
      await organizerFilter.selectOption('all')
      await expect(rows).toHaveCount(inCategory(category).length)
      await typeFilter.selectOption('all')
    } else {
      await organizerFilter.selectOption('all')
    }

    // Both filters back at All restores the full directory.
    await expect(rows).toHaveCount(directoryEvents.length)
  })

  test('host section steps open one at a time, by pointer and keyboard', async ({
    page
  }) => {
    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      const section = page.locator('section').filter({
        has: page.getByRole('heading', {
          level: 2,
          name: t('events.host.title', locale)
        })
      })
      await section.scrollIntoViewIfNeeded()

      const step = (n: 1 | 2 | 3 | 4 | 5) =>
        section.getByRole('button', {
          name: `${n}. ${t(`events.host.step${n}.title`, locale)}`
        })

      // The first step is open on load; the rest are collapsed.
      await expect(step(1)).toHaveAttribute('aria-expanded', 'true')
      for (const n of [2, 3, 4, 5] as const) {
        await expect(step(n)).toHaveAttribute('aria-expanded', 'false')
      }
      await expect(
        section.getByText(t('events.host.step1.whoTitle', locale))
      ).toBeVisible()

      // Opening another step closes the first — single-select.
      await expect(async () => {
        await step(2).click()
        await expect(step(2)).toHaveAttribute('aria-expanded', 'true', {
          timeout: 1000
        })
      }).toPass()
      await expect(step(1)).toHaveAttribute('aria-expanded', 'false')
      await expect(
        section.getByText(t('events.host.step2.body', locale))
      ).toBeVisible()

      // The trigger is a real button, so the keyboard reaches it.
      await step(3).focus()
      await page.keyboard.press('Enter')
      await expect(step(3)).toHaveAttribute('aria-expanded', 'true')
      await expect(step(2)).toHaveAttribute('aria-expanded', 'false')
    }
  })

  test('an upcoming streamed event page opens with the video dialog', async ({
    page
  }) => {
    const event = upcomingEvents.find((entry) => eventVideoId(entry))
    const videoId = event && eventVideoId(event)
    test.skip(!videoId, 'needs an upcoming event with a video')
    if (!event || !videoId) return

    for (const [path, locale] of LOCALES) {
      await page.goto(localizeHref(eventPath(event), locale))

      const dialog = page.getByRole('dialog', {
        name: event.title[locale] || event.title.en
      })
      await expect(dialog).toBeVisible()
      await expect(
        dialog.getByRole('heading', {
          level: 1,
          name: event.title[locale] || event.title.en
        })
      ).toBeVisible()
      await expect(dialog.locator('iframe')).toHaveAttribute(
        'src',
        new RegExp(videoId)
      )

      // Future events offer adding the stream to the visitor's calendar; the
      // menu renders inside the top-layer dialog. Retry until the island
      // hydrates and the click lands.
      const addToCalendar = dialog.getByRole('button', {
        name: t('events.calendar.addToCalendar', locale)
      })
      const googleItem = dialog.getByRole('menuitem', {
        name: t('events.calendar.google', locale)
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

  test('past events gallery paginates and renders one card per renderable event with WATCH NOW links', async ({
    page
  }) => {
    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      const section = pastSection(page, locale)
      await section.scrollIntoViewIfNeeded()

      const cards = section.locator('[data-slot="card"]')
      await expect(cards).toHaveCount(
        Math.min(PAST_EVENTS_PAGE_SIZE, pastCardEvents.length)
      )

      // LOAD MORE reveals another page per click and disappears once every
      // card is shown.
      const loadMore = section.getByRole('button', {
        name: t('events.past.loadMore', locale)
      })
      while (pastCardEvents.length > (await cards.count())) {
        const shown = await cards.count()
        // Retry until the island hydrates and the click lands.
        await expect(async () => {
          // A click that landed but whose count assertion timed out must not
          // be repeated, or the retry skips past the expected page.
          if ((await cards.count()) === shown) {
            await loadMore.click()
          }
          await expect(cards).toHaveCount(
            Math.min(shown + PAST_EVENTS_PAGE_SIZE, pastCardEvents.length),
            { timeout: 1000 }
          )
        }).toPass()
      }
      await expect(loadMore).toBeHidden()

      for (const [i, event] of pastCardEvents.entries()) {
        const card = cards.nth(i)
        await expect(card).toContainText(event.title[locale] || event.title.en)
        const watch = card.getByRole('link', {
          name: new RegExp(pastCtaLabel(event, locale))
        })
        // Recorded events open their own detail page; the rest link out to the
        // event's external page.
        const expectedHref = eventVideoId(event)
          ? localizeHref(eventPath(event), locale)
          : event.link!.href[locale] || event.link!.href.en
        await expect(watch).toHaveAttribute('href', expectedHref)
      }
    }
  })

  test('past events category tabs filter the gallery', async ({ page }) => {
    const categoryWithEvents = pastCardEvents
      .map((event) => event.category)
      .find((category) => category !== pastCardEvents[0]?.category)
    test.skip(
      !categoryWithEvents,
      'needs past events in at least two categories'
    )
    if (!categoryWithEvents) return

    const expected = pastCardEvents.filter(
      (event) => event.category === categoryWithEvents
    )
    const label = t(`events.category.${categoryWithEvents}`, 'en')

    await page.goto(PATH_EN)
    const section = pastSection(page, 'en')
    await section.scrollIntoViewIfNeeded()

    // Retry until the island hydrates and the click lands. The count alone
    // cannot tell a filtered page from the unfiltered first page when both
    // fill PAST_EVENTS_PAGE_SIZE, so the first card's title is the real signal.
    const cards = section.locator('[data-slot="card"]')
    await expect(async () => {
      await section
        .getByRole('button', { name: label.toLocaleUpperCase('en') })
        .click()
      await expect(cards).toHaveCount(
        Math.min(PAST_EVENTS_PAGE_SIZE, expected.length),
        { timeout: 1000 }
      )
      await expect(cards.first()).toContainText(expected[0].title.en, {
        timeout: 1000
      })
    }).toPass()
    for (const [i, event] of expected
      .slice(0, PAST_EVENTS_PAGE_SIZE)
      .entries()) {
      await expect(cards.nth(i)).toContainText(event.title.en)
    }

    // ALL restores the unfiltered first page.
    await section
      .getByRole('button', { name: t('events.past.filterAll', 'en') })
      .click()
    await expect(cards).toHaveCount(
      Math.min(PAST_EVENTS_PAGE_SIZE, pastCardEvents.length)
    )
  })
})

test.describe('Events page — mobile @mobile', () => {
  test('directory stacks the map above the list without overflowing', async ({
    page
  }) => {
    await page.goto(PATH_EN)
    const section = directorySection(page, 'en')
    await section.scrollIntoViewIfNeeded()

    const map = section.locator('.leaflet-container')
    await expect(map).toBeVisible()

    const viewport = page.viewportSize()
    expect(viewport, 'viewport size').not.toBeNull()

    // The map sits above the list rather than beside it.
    const list = section.getByRole('list', {
      name: t('events.directory.allEvents', 'en')
    })
    await expect
      .poll(async () => {
        const mapBox = await map.boundingBox()
        const listBox = await list.boundingBox()
        if (!mapBox || !listBox) return false
        return listBox.y >= mapBox.y + mapBox.height
      })
      .toBe(true)

    // Nothing in the section pushes the page wider than the viewport.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth
        )
      )
      .toBe(true)
  })

  test('calendar agenda fits the viewport at mobile width', async ({
    page
  }) => {
    await page.goto(PATH_EN)
    const section = directorySection(page, 'en')
    await section.scrollIntoViewIfNeeded()

    const agenda = section.getByTestId('events-directory-agenda')
    const calendarTab = section.getByRole('button', {
      name: t('events.directory.view.calendar', 'en')
    })
    await expect(async () => {
      await calendarTab.click()
      await expect(agenda).toBeVisible({ timeout: 1000 })
    }).toPass()

    // Full-width rows plus a thumbnail are the overflow risk on a phone.
    await expect(section.getByTestId('events-directory-row')).toHaveCount(
      directoryEvents.length
    )
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth
        )
      )
      .toBe(true)
  })

  test('past event cards stack in a single column at mobile width', async ({
    page
  }) => {
    await page.goto(PATH_EN)
    const section = pastSection(page, 'en')
    await section.scrollIntoViewIfNeeded()
    const cards = section.locator('[data-slot="card"]')
    await expect(cards).toHaveCount(
      Math.min(PAST_EVENTS_PAGE_SIZE, pastCardEvents.length)
    )

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
})
