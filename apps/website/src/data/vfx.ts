import type { FeatureRow } from '@/components/blocks/FeatureRows01.vue'
import { filterByCategory } from '@/data/learningTutorials'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

export function vfxContent(locale: Locale) {
  const { t } = translationsFor(locale)
  const tutorials = filterByCategory('vfx')
  const hero = tutorials.find((item) => item.slug === 'sky-replacement')
  if (!hero?.videoSrc)
    throw new Error('The VFX page requires the sky replacement tutorial')

  const examples: FeatureRow[] = [
    {
      slug: 'sky-replacement',
      title: t('vfx.examples.sky'),
      description: t('vfx.examples.skyDescription')
    },
    {
      slug: 'cleanplate-walkthrough',
      title: t('vfx.examples.clean'),
      description: t('vfx.examples.cleanDescription')
    }
  ].map(({ slug, title, description }) => {
    const tutorial = tutorials.find((item) => item.slug === slug)
    if (!tutorial?.videoSrc) throw new Error(`Missing VFX example: ${slug}`)
    return {
      id: slug,
      title,
      description,
      media: {
        type: 'video',
        src: tutorial.videoSrc,
        poster: tutorial.poster,
        alt: tutorial.title[locale] || tutorial.title.en,
        tracks: tutorial.caption
      }
    }
  })

  return { examples }
}
