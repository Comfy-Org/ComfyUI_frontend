import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import { useCaseFor } from '../../../config/models-catalogue'
import { resolveModelRouterRender } from '../../../config/router-render'
import type { WorkshopRunSettings } from '../../../config/workshop-node-pricing'
import { estimateWorkshopRunCredits } from '../../../config/workshop-node-pricing'
import { ASPECT_RATIOS, RESOLUTIONS } from './catalog'
import type { AspectRatio } from './catalog'
import type { CinematicPrices } from './estimate'
import { priceKey } from './estimate'
import type { CinematicModel } from './models'

type DetailLookup = (slug: string) => WorkshopModelDetail | undefined

/** A shot sends no reference, the cast, the palette, or both. */
const REFERENCE_COUNTS = [0, 1, 2] as const

/** The frame size the Router mapping sends for this aspect and resolution. */
function requestedSize(
  model: WorkshopModelDetail,
  aspect: AspectRatio,
  pixels: number
): WorkshopRunSettings | undefined {
  try {
    const { values } = resolveModelRouterRender(model, {
      aspect_ratio: aspect,
      resolution: pixels
    })
    const { width, height, size } = values
    if (typeof width === 'number' && typeof height === 'number')
      return { width, height }
    const match =
      typeof size === 'string' ? /^(\d+)\s*[x*]\s*(\d+)$/.exec(size) : null
    return match ? { width: Number(match[1]), height: Number(match[2]) } : {}
  } catch {
    return undefined
  }
}

async function pricesFor(
  model: CinematicModel,
  lookup: DetailLookup
): Promise<CinematicPrices | undefined> {
  const priced = await Promise.all(
    REFERENCE_COUNTS.flatMap((references) => {
      const slug = references ? model.referenceSlug : model.slug
      const detail = slug ? lookup(slug) : undefined
      if (!detail) return []
      return ASPECT_RATIOS.flatMap(({ id: aspect }) =>
        RESOLUTIONS.map(async ({ id: resolution, pixels }) => {
          const size = requestedSize(detail, aspect, pixels)
          const credits =
            size &&
            (await estimateWorkshopRunCredits(detail, useCaseFor(detail), {
              ...size,
              images: references
            }))
          return credits
            ? [[priceKey(aspect, resolution, references), credits] as const]
            : []
        })
      )
    })
  )
  const prices = Object.fromEntries(priced.flat())
  return Object.keys(prices).length ? prices : undefined
}

/**
 * Adds each model's per-take credit estimate for every format a shot can
 * ask for, at build time, so the studio never ships the pricing rules.
 */
export function priceCinematicModels(
  models: readonly CinematicModel[],
  lookup: DetailLookup
): Promise<readonly CinematicModel[]> {
  return Promise.all(
    models.map(async (model) => {
      const prices = await pricesFor(model, lookup)
      return prices ? { ...model, prices } : model
    })
  )
}
