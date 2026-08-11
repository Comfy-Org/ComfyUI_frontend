import { describe, expect, it } from 'vitest'

import type { Locale } from '../i18n/translations'
import { t, translationKeys } from '../i18n/translations'
import { seedancePage } from './seedance'

const LOCALES = ['en', 'zh-CN'] as const satisfies readonly Locale[]

// Seedance 2.5 tops out below 4K, so nothing this page renders may advertise
// it — the gallery prompts included, since they are reproduced verbatim and the
// clips render whatever they asked for.
const RESOLUTION_CLAIM = /4\s*k\b/i

function pageCopy(locale: Locale): { label: string; text: string }[] {
  return [
    ...(seedancePage.gallery?.cards ?? []).flatMap((card) => [
      { label: `card ${card.id} name`, text: card.name[locale] },
      { label: `card ${card.id} note`, text: card.note[locale] },
      { label: `card ${card.id} description`, text: card.description[locale] },
      { label: `card ${card.id} prompt`, text: card.prompt?.[locale] ?? '' }
    ]),
    ...(seedancePage.faq?.items ?? []).flatMap((faq) => [
      { label: `faq ${faq.id} question`, text: faq.question[locale] },
      { label: `faq ${faq.id} answer`, text: faq.answer[locale] }
    ]),
    ...(seedancePage.steps?.items ?? []).flatMap((step) => [
      { label: `step ${step.id} title`, text: step.title[locale] },
      { label: `step ${step.id} description`, text: step.description[locale] }
    ])
  ]
}

describe('seedance 2.5 landing copy', () => {
  // Offenders are collected rather than asserted one by one so a failure names
  // every surface that has to change.
  it('claims no 4K output anywhere in the page config', () => {
    const offenders = LOCALES.flatMap((locale) =>
      pageCopy(locale)
        .filter(({ text }) => RESOLUTION_CLAIM.test(text))
        .map(({ label }) => `${label} (${locale})`)
    )

    expect(offenders).toEqual([])
  })

  it('claims no 4K output in any seedance translation', () => {
    const offenders = translationKeys
      .filter((key) => key.startsWith('seedance.'))
      .flatMap((key) =>
        LOCALES.filter((locale) => RESOLUTION_CLAIM.test(t(key, locale))).map(
          (locale) => `${key} (${locale})`
        )
      )

    expect(offenders).toEqual([])
  })
})
