import type { CardWorkflowItem } from '@/components/blocks/CardWorkflow01.vue'
import type { FeatureRow } from '@/components/blocks/FeatureRows01.vue'
import { localizeHref } from '@/config/routes'
import { filterByCategory, tutorialPath } from '@/data/learningTutorials'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { faqAnswerPlainText } from '@/utils/faqAnswer'
import { faqPageNode } from '@/utils/jsonLd'

export function vfxFaqPageNode(
  url: string,
  faqs: readonly { question: string; answer: string }[]
) {
  return faqPageNode(
    url,
    faqs.map((faq) => ({
      question: faq.question,
      answer: faqAnswerPlainText(faq.answer)
    }))
  )
}

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

  const workflows: CardWorkflowItem[] = tutorials.map((tutorial) => ({
    id: tutorial.id,
    title: tutorial.title[locale] || tutorial.title.en,
    href: localizeHref(tutorialPath(tutorial), locale),
    media: {
      type: 'image',
      src: tutorial.poster,
      alt: tutorial.title[locale] || tutorial.title.en
    },
    tags: [t('vfx.workflows.tag')]
  }))

  const reasons = ([1, 2, 3] as const).map((id) => ({
    id: String(id),
    title: t(`vfx.why.${id}.title`),
    description: t(`vfx.why.${id}.description`)
  }))
  const faqs = ([1, 2, 3, 4, 5] as const).map((id) => ({
    id: `vfx-${id}`,
    question: t(`vfx.faq.${id}.q`),
    answer: t(`vfx.faq.${id}.a`)
  }))
  return { hero, examples, workflows, reasons, faqs }
}
