import { CREDITS_PER_USD } from '@comfyorg/shared-frontend-utils/creditsUtil'
import {
  formatPricingResult,
  getCompiledRuleForNodeType,
  normalizeWidgetValue
} from '@comfyorg/shared-frontend-utils/nodePricing'
import { z } from 'zod'

import pricingJson from '../data/workshop-node-pricing.json'
import publishedPricingJson from '../data/workshop-published-pricing.json'
import type { UseCase, WorkshopModel } from './models-catalogue'
import {
  workshopNodePricingSchema,
  workshopPublishedPricingSchema
} from './workshop-node-pricing.schema'

const rules = workshopNodePricingSchema.parse(pricingJson)
const published = new Map(
  Object.entries(
    workshopPublishedPricingSchema.parse(publishedPricingJson).models
  )
)

/**
 * What one run asks for, where a node's pricing rule depends on it. Anything
 * left out falls back to the node's default widget values.
 */
export interface WorkshopRunSettings {
  readonly width?: number
  readonly height?: number
  /** Reference images sent with the run. */
  readonly images?: number
}

export interface CreditRange {
  readonly min: number
  readonly max: number
}

type RunPrice =
  | { readonly kind: 'published'; readonly credits: number }
  | { readonly kind: 'rule'; readonly result: unknown }

function sizeSetting(
  widget: string,
  settings: WorkshopRunSettings
): number | undefined {
  const name = widget.split('.').at(-1)
  if (name === 'width') return settings.width
  if (name === 'height') return settings.height
  return undefined
}

async function priceRun(
  model: Pick<WorkshopModel, 'routerId'>,
  useCase: UseCase | undefined,
  settings: WorkshopRunSettings
): Promise<RunPrice | undefined> {
  if (!useCase || !model.routerId) return
  const rule = rules.find(
    (row) =>
      row.routerId === model.routerId &&
      (!row.useCases || row.useCases.includes(useCase))
  )
  if (!rule) {
    const rate = published.get(model.routerId)
    if (rate?.useCases.some((operation) => operation === useCase))
      return { kind: 'published', credits: rate.creditsPerRun }
    return
  }
  const { priceBadge } = rule
  const images =
    settings.images ??
    (useCase === 'edit-images' || useCase === 'animate-images' ? 1 : 0)
  const widgets = Object.fromEntries(
    priceBadge.depends_on.widgets.map((dep) => [
      dep.name,
      normalizeWidgetValue(
        sizeSetting(dep.name, settings) ?? rule.widgets[dep.name],
        dep.type
      )
    ])
  )
  if (Object.values(widgets).some((value) => value === null)) return
  const compiled = getCompiledRuleForNodeType(
    `${rule.nodeType}:${rule.sourceCommit}`,
    priceBadge
  )?._compiled
  if (!compiled) return
  try {
    const result: unknown = await compiled.evaluate({
      widgets,
      inputs: Object.fromEntries(
        priceBadge.depends_on.inputs.map((name) => [
          name,
          { connected: images > 0 }
        ])
      ),
      inputGroups: Object.fromEntries(
        priceBadge.depends_on.input_groups.map((name) => [name, images])
      )
    })
    return { kind: 'rule', result }
  } catch {
    return
  }
}

export async function estimateWorkshopNodePrice(
  model: Pick<WorkshopModel, 'routerId'>,
  useCase: UseCase | undefined,
  settings: WorkshopRunSettings = {}
): Promise<string | undefined> {
  const price = await priceRun(model, useCase, settings)
  if (price?.kind === 'published') return `${price.credits} credits/Run`
  return (price && formatPricingResult(price.result)) || undefined
}

const usdResult = z.discriminatedUnion('type', [
  z.object({ type: z.literal('usd'), usd: z.number().nonnegative() }),
  z.object({
    type: z.literal('range_usd'),
    min_usd: z.number().nonnegative(),
    max_usd: z.number().nonnegative()
  })
])

function usdRange(result: unknown): CreditRange | undefined {
  const parsed = usdResult.safeParse(result)
  if (!parsed.success) return
  const usd = parsed.data
  return usd.type === 'usd'
    ? { min: usd.usd, max: usd.usd }
    : { min: usd.min_usd, max: usd.max_usd }
}

/**
 * Credits for one run that returns one image, from the same rule or
 * published rate as {@link estimateWorkshopNodePrice}.
 */
export async function estimateWorkshopRunCredits(
  model: Pick<WorkshopModel, 'routerId'>,
  useCase: UseCase | undefined,
  settings: WorkshopRunSettings = {}
): Promise<CreditRange | undefined> {
  const price = await priceRun(model, useCase, settings)
  if (!price) return
  if (price.kind === 'published')
    return { min: price.credits, max: price.credits }
  const usd = usdRange(price.result)
  return (
    usd && {
      min: usd.min * CREDITS_PER_USD,
      max: usd.max * CREDITS_PER_USD
    }
  )
}
