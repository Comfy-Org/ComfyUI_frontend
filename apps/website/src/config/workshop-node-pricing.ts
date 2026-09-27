import { CREDITS_PER_USD } from '@comfyorg/shared-frontend-utils/creditsUtil'
import type { JsonataEvalContext } from '@comfyorg/shared-frontend-utils/nodePricing'
import {
  formatPricingResult,
  getCompiledRuleForNodeType
} from '@comfyorg/shared-frontend-utils/nodePricing'
import { z } from 'zod'

import pricingJson from '../data/workshop-node-pricing.json'
import publishedPricingJson from '../data/workshop-published-pricing.json'
import type { UseCase, WorkshopModel } from './models-catalogue'
import type { WorkshopRunSettings } from './workshop-node-pricing-context'
import {
  pricingContext,
  referenceImages
} from './workshop-node-pricing-context'
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

export interface CreditRange {
  readonly min: number
  readonly max: number
}

type PricingRule = (typeof rules)[number]
type RunPrice =
  | { readonly kind: 'published'; readonly credits: number }
  | { readonly kind: 'rule'; readonly result: unknown }

function ruleFor(routerId: string, useCase: UseCase): PricingRule | undefined {
  return rules.find(
    (row) =>
      row.routerId === routerId &&
      (!row.useCases || row.useCases.includes(useCase))
  )
}

function publishedPrice(
  routerId: string,
  useCase: UseCase
): RunPrice | undefined {
  const rate = published.get(routerId)
  return rate?.useCases.some((operation) => operation === useCase)
    ? { kind: 'published', credits: rate.creditsPerRun }
    : undefined
}

async function evaluateRule(
  rule: PricingRule,
  context: JsonataEvalContext
): Promise<RunPrice | undefined> {
  const compiled = getCompiledRuleForNodeType(
    `${rule.nodeType}:${rule.sourceCommit}`,
    rule.priceBadge
  )?._compiled
  if (!compiled) return undefined
  try {
    return { kind: 'rule', result: await compiled.evaluate(context) }
  } catch {
    return undefined
  }
}

async function priceRun(
  model: Pick<WorkshopModel, 'routerId'>,
  useCase: UseCase | undefined,
  settings: WorkshopRunSettings
): Promise<RunPrice | undefined> {
  if (!useCase || !model.routerId) return undefined
  const rule = ruleFor(model.routerId, useCase)
  if (!rule) return publishedPrice(model.routerId, useCase)
  const context = pricingContext(
    rule,
    settings,
    referenceImages(useCase, settings)
  )
  return context && evaluateRule(rule, context)
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
