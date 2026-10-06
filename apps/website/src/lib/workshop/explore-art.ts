import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale, TranslationKey } from '@/i18n/translations'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import { nameWithoutTask, taskLabelFor } from '@/lib/workshop/task-label'

export type HubDoor = 'models' | 'workflows' | 'apps'

export interface ModelDoorArt {
  readonly src: string
  readonly name: string
  readonly provider?: string
  readonly usd?: number
  readonly credits?: number
  readonly prompt: TranslationKey
}

export interface WorkflowDoorArt {
  readonly src: string
}

export interface AppDoorArt {
  readonly src: string
  readonly control: TranslationKey
  readonly value: string
}

export interface DoorArt {
  readonly models?: ModelDoorArt
  readonly workflows?: WorkflowDoorArt
  readonly apps?: AppDoorArt
}

/** Each door's candidates, best first, with the copy that matches its image. */
const MODEL_CANDIDATES = [
  {
    slug: 'vertexai--gemini-3-pro-image--generate-images',
    prompt: 'workshop.explore.doorModelPromptLake'
  },
  {
    slug: 'runway--gen4-image--generate-images',
    prompt: 'workshop.explore.doorModelPromptRowboat'
  }
] as const satisfies readonly { slug: string; prompt: TranslationKey }[]

const WORKFLOW_CANDIDATES = ['workflows/product-in-scene'] as const

const APP_CANDIDATES = [
  {
    key: 'apps/cinematic-studio',
    image: '/images/cinematic-studio/neon-street.jpg',
    control: 'workshop.explore.doorAppControlFocal',
    value: '35mm'
  },
  {
    key: 'apps/reshoot',
    image: '/images/cinematic-studio/train.jpg',
    control: 'workshop.explore.doorAppControlRotation',
    value: '35°'
  }
] as const satisfies readonly {
  key: string
  image: string
  control: TranslationKey
  value: string
}[]

type Thumbnail = WorkshopModel['thumbnail']

const stillOf = (thumbnail: Thumbnail) =>
  thumbnail?.kind === 'image' ? thumbnail.url : thumbnail?.poster

function firstWithStill<C, T extends { thumbnail?: Thumbnail }>(
  candidates: readonly C[],
  find: (candidate: C) => T | undefined
) {
  for (const candidate of candidates) {
    const item = find(candidate)
    const src = stillOf(item?.thumbnail)
    if (item && src) return { candidate, item, src }
  }
  return undefined
}

/** Picks one real catalogue item per door to show what that format looks like. */
export function doorArt(
  catalogue: {
    readonly models: readonly WorkshopModel[]
    readonly workflows: readonly WorkshopModel[]
    readonly apps: readonly CatalogueApp[]
  },
  locale: Locale = 'en'
): DoorArt {
  const model = firstWithStill(MODEL_CANDIDATES, ({ slug }) =>
    catalogue.models.find((item) => item.slug === slug)
  )
  const workflow = firstWithStill(WORKFLOW_CANDIDATES, (slug) =>
    catalogue.workflows.find((item) => item.slug === slug)
  )
  const app = APP_CANDIDATES.find(({ key }) =>
    catalogue.apps.some((item) => item.key === key)
  )
  return {
    ...(model && {
      models: {
        src: model.src,
        name: nameWithoutTask(
          model.item.name,
          taskLabelFor(model.item, locale)
        ),
        provider: model.item.provider,
        usd: model.item.priceUsdFrom,
        credits: model.item.creditsPerRun,
        prompt: model.candidate.prompt
      }
    }),
    ...(workflow && { workflows: { src: workflow.src } }),
    ...(app && {
      apps: { src: app.image, control: app.control, value: app.value }
    })
  }
}
