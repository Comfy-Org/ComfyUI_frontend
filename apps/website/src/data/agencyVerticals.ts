import type { FeatureRow } from '@/components/blocks/FeatureRows01.vue'
import { getIndustryVertical } from '@/data/industryVerticals'
import type {
  IndustryVertical,
  IndustryVerticalId
} from '@/data/industryVerticals'
import { vfxContent } from '@/data/vfx'
import { vfxWorkflows } from '@/data/vfxWorkflows'
import { translationsFor } from '@/i18n/translations'
import type { Locale, TranslationKey } from '@/i18n/translations'

export type AgencyVerticalId = 'vfx' | IndustryVerticalId

interface AgencyVertical {
  id: AgencyVerticalId
  badgeKey: TranslationKey
  hero: IndustryVertical['hero']
  workflows: IndustryVertical['workflows']
  examples: FeatureRow[]
}

export function getAgencyVertical(
  id: AgencyVerticalId,
  locale: Locale
): AgencyVertical {
  if (id === 'vfx') {
    const { hero, examples } = vfxContent(locale)
    if (!hero.videoSrc) throw new Error('Missing VFX agency hero video')
    return {
      id,
      badgeKey: 'fdct.tags.vfx',
      hero: {
        type: 'video',
        src: hero.videoSrc,
        poster: hero.poster,
        tracks: hero.caption
      },
      workflows: vfxWorkflows,
      examples
    }
  }

  const { t } = translationsFor(locale)
  const vertical = getIndustryVertical(id)
  return {
    id,
    badgeKey: vertical.badgeKey,
    hero: vertical.hero,
    workflows: vertical.workflows,
    examples: vertical.examples.map(({ titleKey, descriptionKey, ...row }) => ({
      ...row,
      title: t(titleKey),
      description: t(descriptionKey),
      media: { ...row.media, alt: t(titleKey) }
    }))
  }
}
