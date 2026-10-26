import type { TranslationKey } from '@/i18n/translations'

interface HeroAction {
  readonly href: string
  readonly labelKey: TranslationKey
  readonly external: boolean
  readonly variant: 'solid' | 'outline'
  readonly testId?: string
}

type Candidate = Omit<HeroAction, 'variant'> | false | undefined | ''

interface HeroModel {
  readonly huggingFaceUrl: string
  readonly docsUrl?: string
  readonly hubSlug?: string
  readonly directory: string
  readonly localFile: boolean
}

function supportedModelActions({
  huggingFaceUrl,
  docsUrl,
  hubSlug,
  directory
}: HeroModel): Candidate[] {
  const download = directory !== 'partner_nodes' && huggingFaceUrl
  return [
    hubSlug && {
      href: `https://comfy.org/workflows/model/${hubSlug}/`,
      labelKey: 'models.hero.primaryCta',
      external: false
    },
    download && {
      href: download,
      labelKey: 'models.hero.secondaryCta',
      external: true
    },
    !hubSlug && {
      href: 'https://comfy.org/cloud/',
      labelKey: 'models.hero.cloudCta',
      external: true
    },
    docsUrl && {
      href: docsUrl,
      labelKey: 'models.hero.tutorialCta',
      external: true
    }
  ]
}

function localFileActions({ huggingFaceUrl }: HeroModel): Candidate[] {
  return [
    huggingFaceUrl && {
      href: huggingFaceUrl,
      labelKey: 'models.hero.downloadForComfy',
      external: true,
      testId: 'model-file-download'
    }
  ]
}

/** The hero's buttons in order; the first one leads, solid, and the rest outline it. */
export function modelHeroActions(model: HeroModel): HeroAction[] {
  const candidates = model.localFile
    ? localFileActions(model)
    : supportedModelActions(model)
  return candidates
    .filter((action) => !!action)
    .map((action, index) => ({
      ...action,
      variant: index === 0 ? 'solid' : 'outline'
    }))
}
