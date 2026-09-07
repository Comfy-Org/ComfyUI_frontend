import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Crossing locales must be a real page load.
 *
 * ClientRouter swaps the document without re-evaluating any module, and in
 * production the browser loads only its own page's dictionary — an English
 * reader never downloads Chinese. A client-side swap into another locale
 * therefore left the incoming islands asking for a dictionary that was never
 * fetched, and `t()` threw rather than render text the server did not. The page
 * rendered broken and came right on refresh, which is a full load.
 *
 * Not only the language switcher: `localizeHref` returns an unprefixed path for
 * a route a locale does not publish, so an ordinary footer link out of the
 * Chinese tree crosses locales too. Both paths are covered here.
 *
 * Only a browser can catch this. The build is identical either way — the
 * failure is in what the client does after the swap.
 */
async function errorsWhile(
  page: Page,
  act: () => Promise<void>
): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    // A preview server is http://localhost and the CDN is https://media.comfy.org,
    // so external media and Vercel Analytics always complain. Neither says
    // anything about whether the page hydrated, which is what this is for —
    // that failure arrives as an uncaught exception on `pageerror`.
    const text = message.text()
    const environmental =
      text.includes('Failed to load resource') ||
      text.includes('Unsafe attempt to load URL') ||
      text.includes('media.comfy.org') ||
      text.includes('/_vercel/')
    if (message.type() === 'error' && !environmental) errors.push(text)
  })
  await act()
  await page.waitForLoadState('domcontentloaded')
  return errors
}

test('switching language from the footer renders the new locale', async ({
  page
}) => {
  await page.goto('/zh-CN/cli/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')

  const errors = await errorsWhile(page, async () => {
    await page
      .locator('a[href="/cli/"][data-astro-reload]')
      .locator('visible=true')
      .first()
      .click()
  })

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  expect(
    errors,
    `console errors after switching language: ${errors.join(' | ')}`
  ).toEqual([])

  // The islands really hydrated: the footer is rendered by one of them.
  await expect(
    page.getByRole('link', { name: '简体中文', exact: true })
  ).toBeVisible()
})

test('a footer link that leaves the Chinese tree renders correctly', async ({
  page
}) => {
  await page.goto('/zh-CN/cli/', { waitUntil: 'domcontentloaded' })

  // /terms-of-service is English-only, so `localizeHref` leaves it unprefixed
  // and this link crosses locales without going anywhere near the switcher.
  const errors = await errorsWhile(page, async () => {
    await page
      .locator('a[href="/terms-of-service"]')
      .locator('visible=true')
      .first()
      .click()
  })

  await expect(page).toHaveURL(/\/terms-of-service\/?$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  expect(
    errors,
    `console errors after leaving the Chinese tree: ${errors.join(' | ')}`
  ).toEqual([])
})

test('navigating within one locale still uses the client router', async ({
  page
}) => {
  await page.goto('/zh-CN/cli/', { waitUntil: 'domcontentloaded' })

  const errors = await errorsWhile(page, async () => {
    await page
      .locator(
        'a[href^="/zh-CN/"]:not([data-astro-reload]):not([href="/zh-CN/cli/"])'
      )
      .locator('visible=true')
      .first()
      .click()
  })

  await expect(page).toHaveURL(/\/zh-CN\//)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  expect(
    errors,
    `console errors within one locale: ${errors.join(' | ')}`
  ).toEqual([])
})
