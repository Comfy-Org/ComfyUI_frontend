import type { Locale } from '../config/locales'
import { localizeHref } from '../config/routes'
import { t } from '../i18n/translations'
import { absoluteUrl } from './jsonLd'
import type { Crumb } from './jsonLd'

/** The two crumbs every Comfy Cloud page starts from: home, then Cloud. */
export function cloudCrumbs(
  site: URL | undefined,
  locale: Locale,
  canonicalLocale: Locale
): Crumb[] {
  return [
    {
      name: t('breadcrumb.home', locale),
      url: absoluteUrl(site, localizeHref('/', canonicalLocale))
    },
    {
      name: 'Comfy Cloud',
      url: absoluteUrl(site, localizeHref('/cloud', canonicalLocale))
    }
  ]
}
