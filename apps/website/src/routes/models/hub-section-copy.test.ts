import { describe, expect, it } from 'vitest'

import { translationsFor } from '@/i18n/translations'
import { hubSectionCopy } from './hub-section-copy'

describe('hubSectionCopy', () => {
  it.for(
    (['zh-CN', 'ja'] as const).flatMap((locale) =>
      (['workflows', 'apps'] as const).map((section) => ({ locale, section }))
    )
  )(
    'gives the $locale $section list a heading in its own language',
    ({ locale, section }) => {
      const { t } = translationsFor(locale)
      const english = hubSectionCopy(section, translationsFor('en').t)
      const localized = hubSectionCopy(section, t)
      expect(localized.heading).toBe(t(`workshop.hubSection.${section}.name`))
      expect(localized.heading).not.toBe(english.heading)
    }
  )
})
