import orderJson from '../content/workshop-model-order.json'
import { workshopModelOrderSchema } from './workshop-model-order.schema'

const order = workshopModelOrderSchema.parse(orderJson)

/** Curated recommendation order. Unlisted models use the catalogue fallback. */
export const modelOrderRank = new Map(
  order.slugs.map((slug, index) => [slug, index])
)
