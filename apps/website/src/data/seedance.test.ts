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
      {
        label: `step ${step.id} description`,
        text: step.description?.[locale] ?? ''
      }
    ])
  ]
}

describe('seedance 2.5 workflow links', () => {
  it('sends "try workflows" to the Seedance family page, not the hub root', () => {
    // The hub root makes the reader search for the model they just read about.
    // The family page lists the shipped 2.5 workflows, which is what the launch
    // playbook asks the page to link, and matches what /ltx-2.5 already does.
    expect(seedancePage.hero.secondaryCta?.href).toBe(
      'https://comfy.org/workflows/model/seedance'
    )
  })

  it('keeps the run CTAs on Cloud, which is a separate deliberate choice', () => {
    // Reference-to-video on Cloud is the "run it" path chosen for this launch;
    // linking the hub instead would undo that, so it is pinned here.
    expect(seedancePage.hero.primaryCta?.href).toContain(
      'cloud.comfy.org/?template=api_seedance2_5_r2v'
    )
  })

  it('keeps the draft CTA on a template that costs nothing to run', () => {
    // The step above this CTA promises "zero credits" in both locales, so it
    // has to open a Cloud template that is not an `api_` one; those bill per
    // render.
    expect(seedancePage.steps?.primaryCta?.href).toMatch(
      /cloud\.comfy\.org\/\?template=(?!api_)/
    )
  })
})

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
