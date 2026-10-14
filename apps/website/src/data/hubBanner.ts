import { uniqBy } from 'es-toolkit'

import type { WorkshopModel } from '@/config/models-catalogue'
import { workshopModels } from '@/config/workshop-browse-content'
import { workflowModels } from '@/config/workshop-workflow-content'

export interface HubBannerTile {
  readonly kind: 'workflow' | 'model'
  readonly name: string
  readonly maker: string
  readonly href: string
  readonly imageUrl: string
}

export interface HubBannerContent {
  readonly workflows: readonly HubBannerTile[]
  readonly models: readonly HubBannerTile[]
}

const ROW_LENGTH = 12

const byRank = (
  a: Pick<WorkshopModel, 'recommendedRank'>,
  b: Pick<WorkshopModel, 'recommendedRank'>
) => (a.recommendedRank ?? Infinity) - (b.recommendedRank ?? Infinity)

function stillImage({
  thumbnail
}: Pick<WorkshopModel, 'thumbnail'>): string | undefined {
  return thumbnail?.kind === 'image' ? thumbnail.url : thumbnail?.poster
}

const workflows: readonly HubBannerTile[] = workflowModels
  .toSorted(byRank)
  .flatMap((workflow) => {
    const imageUrl = stillImage(workflow)
    return imageUrl && workflow.author && !workflow.flag
      ? [
          {
            kind: 'workflow' as const,
            name: workflow.name,
            maker: workflow.author,
            href: workflow.href,
            imageUrl
          }
        ]
      : []
  })
  .slice(0, ROW_LENGTH)

const models: readonly HubBannerTile[] = uniqBy(
  workshopModels.toSorted(byRank).flatMap((model) => {
    const imageUrl = stillImage(model)
    return imageUrl && model.href && model.provider && !model.flag
      ? [
          {
            kind: 'model' as const,
            name: model.name,
            maker: model.provider,
            href: model.href,
            imageUrl
          }
        ]
      : []
  }),
  (tile) => tile.maker
).slice(0, ROW_LENGTH)

/** Ranked catalogue workflows and one model per partner, each with a still image. */
export const hubBannerContent: HubBannerContent = { workflows, models }
