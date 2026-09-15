import type { Locale } from '../../i18n/translations'
import type { JsonLdNode } from '../../utils/jsonLd'

import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'
import {
  faqPageNode,
  jsonLdId,
  softwareApplicationNode
} from '../../utils/jsonLd'
import { cliFaqs } from './faqs'

// One source for both locales' <head> structured data, so the /cli and
// /zh-CN/cli pages cannot drift and the shaping is unit-testable.
export function cliPageJsonLd(
  siteUrl: string,
  url: string,
  locale: Locale
): { softwareId: string; nodes: JsonLdNode[] } {
  const softwareId = jsonLdId(url, 'software')
  return {
    softwareId,
    nodes: [
      softwareApplicationNode({
        siteUrl,
        id: softwareId,
        name: 'Comfy CLI',
        url,
        applicationCategory: 'DeveloperApplication',
        firstParty: true,
        description: t('cli.meta.description', locale),
        operatingSystem: 'macOS, Windows, Linux',
        codeRepository: externalLinks.comfyCliRepo,
        isFree: true
      }),
      faqPageNode(url, cliFaqs(locale))
    ]
  }
}
