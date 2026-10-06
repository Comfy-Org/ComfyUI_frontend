import type { Locale } from '@/i18n/translations'

import { externalLinks, localizeHref } from '@/config/routes'
import { projects } from '@/data/fdct'
import {
  categoryPath,
  getTutorialByCategoryAndSlug,
  tutorialPath
} from '@/data/learningTutorials'
import { translationsFor } from '@/i18n/translations'

export const vfxPage = {
  /** The existing sales contact form, shared with the Enterprise pages. */
  contactHref: '/contact/',
  heroTutorial: { category: 'vfx', slug: 'cleanplate-walkthrough' }
} as const

type TaskKey =
  | 'cleanplate'
  | 'sky'
  | 'deaging'
  | 'compositing'
  | 'upscaling'
  | 'custom'

interface VfxTaskSource {
  id: TaskKey
  /** Tutorial that already exists in /learning; absent for the contact card. */
  tutorial?: { category: string; slug: string }
}

const taskSources: readonly VfxTaskSource[] = [
  {
    id: 'cleanplate',
    tutorial: { category: 'vfx', slug: 'cleanplate-walkthrough' }
  },
  { id: 'sky', tutorial: { category: 'vfx', slug: 'sky-replacement' } },
  { id: 'deaging', tutorial: { category: 'vfx', slug: 'deaging-workflow' } },
  {
    id: 'compositing',
    tutorial: { category: 'vfx', slug: 'mattes-and-utilities' }
  },
  {
    id: 'upscaling',
    tutorial: {
      category: 'basics',
      slug: 'image-to-video-motion-control-upscaling'
    }
  },
  { id: 'custom' }
]

export interface VfxTask {
  id: string
  title: string
  description: string
  cta: { label: string; href: string }
}

function tutorialHref(
  { category, slug }: { category: string; slug: string },
  locale: Locale
): string {
  const tutorial = getTutorialByCategoryAndSlug(category, slug)
  if (!tutorial)
    throw new Error(`Unknown learning tutorial ${category}/${slug}`)
  return localizeHref(tutorialPath(tutorial), locale)
}

export function vfxTasks(locale: Locale = 'en'): readonly VfxTask[] {
  const { t } = translationsFor(locale)
  return taskSources.map(({ id, tutorial }) => ({
    id,
    title: t(`vfx.tasks.${id}.title`),
    description: t(`vfx.tasks.${id}.description`),
    cta: tutorial
      ? { label: t('vfx.tasks.watchCta'), href: tutorialHref(tutorial, locale) }
      : {
          label: t('vfx.tasks.custom.cta'),
          href: localizeHref(vfxPage.contactHref, locale)
        }
  }))
}

export interface VfxWorkflow {
  id: string
  title: string
  description: string
  href: string
  media: { type: 'image' | 'video'; src: string; alt: string }
  tags: readonly string[]
}

const fdctWorkflowIds = [
  'ltx-cleanplate-for-vfx',
  'face-swap-workflow',
  'vfx-utilities',
  'change-any-objects'
] as const

/**
 * VFX workflows that already ship elsewhere on the site: four Hub workflows
 * from the Forward Deployed Creatives page and the Sky Replacement and Frame
 * Adjustments workflows from the VFX tutorials. Titles, media, and links are reused unchanged.
 */
export function vfxWorkflows(locale: Locale = 'en'): readonly VfxWorkflow[] {
  const { t } = translationsFor(locale)
  const hub = projects(locale)
  const fromHub = (id: (typeof fdctWorkflowIds)[number]): VfxWorkflow => {
    const project = hub.find((candidate) => candidate.id === id)
    if (!project) throw new Error(`Unknown Hub workflow ${id}`)
    return {
      id,
      title: project.title,
      description: project.description ?? '',
      href: project.href,
      media: { ...project.media, alt: project.title },
      tags: project.tags
    }
  }

  const fromTutorial = (
    slug: string,
    descriptionKey:
      | 'vfx.workflows.skyReplacement.description'
      | 'vfx.workflows.frameAdjustments.description'
  ): VfxWorkflow => {
    const tutorial = getTutorialByCategoryAndSlug('vfx', slug)
    if (!tutorial?.href)
      throw new Error(`Tutorial ${slug} has no workflow link`)
    const title = tutorial.title[locale] ?? tutorial.title.en
    return {
      id: tutorial.id,
      title,
      description: t(descriptionKey),
      href: tutorial.href,
      media: { type: 'image', src: tutorial.poster, alt: title },
      tags: [t('fdct.tags.vfx')]
    }
  }

  return [
    fromHub('ltx-cleanplate-for-vfx'),
    fromTutorial('sky-replacement', 'vfx.workflows.skyReplacement.description'),
    fromHub('face-swap-workflow'),
    fromHub('vfx-utilities'),
    fromHub('change-any-objects'),
    fromTutorial(
      'frame-adjustments',
      'vfx.workflows.frameAdjustments.description'
    )
  ]
}

export function vfxTutorialsHref(locale: Locale = 'en'): string {
  return localizeHref(categoryPath('vfx'), locale)
}

export const vfxWorkflowsLibraryHref = externalLinks.workflows

const faqNumbers = [1, 2, 3, 4, 5] as const

export function vfxFaqs(locale: Locale = 'en') {
  const { t } = translationsFor(locale)
  return faqNumbers.map((n) => ({
    id: String(n),
    question: t(`vfx.faq.q${n}`),
    answer:
      n === 5
        ? t('vfx.faq.a5', { trustCenter: externalLinks.trustCenter })
        : t(`vfx.faq.a${n}`)
  }))
}
