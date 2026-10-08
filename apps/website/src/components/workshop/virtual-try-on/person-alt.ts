import type { TryOnImage } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import { TRY_ON_PERSON } from '../../../lib/workshop/virtual-try-on/mock-run'

export function personAlt(person: TryOnImage, locale: Locale): string {
  return person.url === TRY_ON_PERSON.url
    ? vc('tryOn.alt.person', locale)
    : person.name
}
