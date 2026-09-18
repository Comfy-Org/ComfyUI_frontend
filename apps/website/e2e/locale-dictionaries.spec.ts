import { readdirSync } from 'node:fs'

import type { Response } from '@playwright/test'
import { expect } from '@playwright/test'

import { DEFAULT_LOCALE, LOCALE_CODES } from '../src/config/locales'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

function readDictionaries() {
  const assets = readdirSync(new URL('../dist/_website/', import.meta.url))
  return LOCALE_CODES.map((locale) => ({
    locale,
    chunks: assets.filter(
      (file) => file.startsWith(`${locale}.`) && file.endsWith('.js')
    ),
    marker: t('pricing.meta.description', locale)
  }))
}

test('build emits one distinct dictionary per locale', () => {
  const dictionaries = readDictionaries()
  expect(dictionaries.map(({ chunks }) => chunks.length)).toEqual(
    LOCALE_CODES.map(() => 1)
  )
  expect(new Set(dictionaries.map(({ marker }) => marker)).size).toBe(
    LOCALE_CODES.length
  )
})

for (const locale of LOCALE_CODES) {
  test(`${locale} downloads only its own dictionary and hydrates legal content`, async ({
    page
  }) => {
    const dictionaries = readDictionaries()
    const scripts: Response[] = []
    page.on('response', (response) => {
      if (
        response.request().resourceType() === 'script' &&
        new URL(response.url()).pathname.startsWith('/_website/')
      ) {
        scripts.push(response)
      }
    })

    await page.goto(
      `${locale === DEFAULT_LOCALE ? '' : `/${locale}`}/privacy-policy/`
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      t('privacy.hero.title', locale)
    )
    const contentIsland = page.locator(
      'astro-island[component-url*="/ContentSection."]'
    )
    await expect(contentIsland).toHaveCount(1)
    await expect(contentIsland).not.toHaveAttribute('ssr')
    await expect(
      page.getByRole('heading', {
        name: t('privacy.personal-information.title', locale),
        exact: true
      })
    ).toBeVisible()

    const scriptPaths = scripts.map(
      (response) => new URL(response.url()).pathname
    )
    const downloaded = dictionaries.filter(({ chunks }) =>
      chunks.some((file) => scriptPaths.includes(`/_website/${file}`))
    )
    expect(downloaded.map((dictionary) => dictionary.locale)).toEqual([locale])

    const javascript = (
      await Promise.all(scripts.map((response) => response.text()))
    ).join('\n')
    expect(
      dictionaries
        .filter(({ marker }) => javascript.includes(marker))
        .map((dictionary) => dictionary.locale)
    ).toEqual([locale])
  })
}
