import type { JsonataEvalContext } from '@comfyorg/shared-frontend-utils/nodePricing'
import { normalizeWidgetValue } from '@comfyorg/shared-frontend-utils/nodePricing'

import type { UseCase } from './models-catalogue'
import type { workshopNodePricingSchema } from './workshop-node-pricing.schema'

type PricingRule = Pick<
  ReturnType<typeof workshopNodePricingSchema.parse>[number],
  'priceBadge' | 'widgets'
>

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

const IMAGE_INPUT_USE_CASES: ReadonlySet<UseCase> = new Set([
  'edit-images',
  'animate-images'
])

/** Reference images a run sends: as asked, else one for image-input work. */
export function referenceImages(
  useCase: UseCase,
  settings: WorkshopRunSettings
): number {
  return settings.images ?? (IMAGE_INPUT_USE_CASES.has(useCase) ? 1 : 0)
}

function sizeSetting(
  widget: string,
  settings: WorkshopRunSettings
): number | undefined {
  const name = widget.split('.').at(-1)
  if (name === 'width') return settings.width
  if (name === 'height') return settings.height
  return undefined
}

/**
 * The context a node's price badge is evaluated in, with the run's size in
 * place of the node's default width and height. Undefined when a widget the
 * rule depends on has no usable value.
 */
export function pricingContext(
  rule: PricingRule,
  settings: WorkshopRunSettings,
  images: number
): JsonataEvalContext | undefined {
  const { depends_on } = rule.priceBadge
  const widgets = Object.fromEntries(
    depends_on.widgets.map((dep) => [
      dep.name,
      normalizeWidgetValue(
        sizeSetting(dep.name, settings) ?? rule.widgets[dep.name],
        dep.type
      )
    ])
  )
  if (Object.values(widgets).includes(null)) return undefined
  return {
    widgets,
    inputs: Object.fromEntries(
      depends_on.inputs.map((name) => [name, { connected: images > 0 }])
    ),
    inputGroups: Object.fromEntries(
      depends_on.input_groups.map((name) => [name, images])
    )
  }
}
