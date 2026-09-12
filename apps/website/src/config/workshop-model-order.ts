import orderJson from '../content/workshop-model-order.json'
import { workshopModelOrderSchema } from './workshop-model-order.schema'

const order = workshopModelOrderSchema.parse(orderJson)

/**
 * How often each model was actually run, as an order rather than a number.
 *
 * The figures behind it are partner usage and stay out of this repository; what
 * the catalogue needs is only the sequence, which is what a visitor sees anyway.
 * A model the window never saw is absent, and falls in behind the ones it did.
 */
export const modelOrderRank = new Map(
  order.slugs.map((slug, index) => [slug, index])
)
