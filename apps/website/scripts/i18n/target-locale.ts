import { isLocale } from '../../src/config/locales'
import type { Locale } from '../../src/config/locales'
import { OUTPUT_LOCALES } from './config'

/**
 * The locale a writer generates content for.
 *
 * The three writers each held `const TARGET = 'ja'`, so the generated `.mdx`
 * and the `ja` fields in `src/data` were the only ones the pipeline could ever
 * produce — a second locale got dictionaries and nothing else. They read the
 * layer the translator fills, so they take the locale the same way it does:
 * one knob, `WEBSITE_I18N_LOCALE`, rather than a constant in each script.
 */
export function targetLocale(): Locale {
  const locale = process.env.WEBSITE_I18N_LOCALE
  if (!isLocale(locale) || !OUTPUT_LOCALES[locale]) {
    console.error(
      `[i18n] set WEBSITE_I18N_LOCALE to one of: ${Object.keys(OUTPUT_LOCALES).join(', ')}`
    )
    process.exit(1)
  }
  return locale
}
