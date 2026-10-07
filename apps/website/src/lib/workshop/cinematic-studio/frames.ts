import { dimensions } from '@/config/router-parameter-options'
import type { RouterRenderParameters } from '@/config/router-parameters'
import {
  createRouterParameters,
  routerParameterMappings
} from '@/config/router-parameters'
import type { WorkshopContract } from '@/config/workshop-contract'
import { formForContract } from '@/config/workshop-contract'
import type { FieldSchema } from '@/config/workshop-playground'
import {
  defaultValues,
  schemaForModel,
  urlUploadField
} from '@/config/workshop-playground'
import { ASPECT_RATIOS } from './catalog'
import type { AspectRatio } from './catalog'

/*
 * What a model's Router contract says it can make and take. The Router maps a
 * requested aspect ratio to the nearest size a model offers by pixel count, not
 * by shape, so a studio that promises a frame reads the sizes itself: it only
 * offers the frames a model can make, and names that size.
 */

/** How far a listed size may stray from a frame and still count as it:
 * Recraft's 1344x768 is 16:9 to 1.6%, Krea's 2.35:1 is 21:9 to 0.7%, while
 * 4:3 and 3:2 stay 12% apart. */
const SHAPE_TOLERANCE = 0.03

const contractSchemas = new WeakMap<WorkshopContract, readonly FieldSchema[]>()

function contractSchema(contract: WorkshopContract): readonly FieldSchema[] {
  const cached = contractSchemas.get(contract)
  if (cached) return cached
  const schema = schemaForModel({ fields: [], form: formForContract(contract) })
  contractSchemas.set(contract, schema)
  return schema
}

function ratioOf(value: unknown): number | undefined {
  const size = dimensions(value)
  return size && size.width / size.height
}

function shapeError(a: number, b: number): number {
  return Math.abs(a / b - 1)
}

function sameShape(a: number, b: number): boolean {
  return shapeError(a, b) <= SHAPE_TOLERANCE
}

/** The size fields a model lists, when its frames are a fixed menu. */
function sizeMenus(contract: WorkshopContract) {
  return contractSchema(contract).flatMap((field) =>
    field.kind === 'select' && /(?:size|aspect|ratio)/i.test(field.name)
      ? [field]
      : []
  )
}

/**
 * The studio frames a model can make. A model with free width and height (or
 * no size menu at all) makes every frame.
 */
export function contractAspects(
  contract: WorkshopContract
): readonly AspectRatio[] {
  const shapes = sizeMenus(contract).flatMap((field) =>
    field.options.flatMap((option) => ratioOf(option) ?? [])
  )
  const all = ASPECT_RATIOS.map(({ id }) => id)
  if (!shapes.length) return all
  return all.filter((aspect) => {
    const ratio = ratioOf(aspect)!
    return shapes.some((shape) => sameShape(shape, ratio))
  })
}

/**
 * The size to ask for, keyed by the model's own field, when its sizes are a
 * menu: of those with this shape, the one whose short side is nearest the
 * resolution. Free-size models need none; the Router mapping sizes them.
 */
export function frameSize(
  contract: WorkshopContract,
  aspect: AspectRatio,
  shortSide: number
): Readonly<Record<string, string>> | undefined {
  const ratio = ratioOf(aspect)!
  const entries = sizeMenus(contract).flatMap((field) => {
    const choices = field.options.flatMap((option) => {
      const size = dimensions(option)
      return size &&
        size.width >= 100 &&
        sameShape(size.width / size.height, ratio)
        ? [
            {
              option,
              short: Math.min(size.width, size.height),
              error: shapeError(size.width / size.height, ratio)
            }
          ]
        : []
    })
    choices.sort(
      (a, b) =>
        Math.abs(a.short - shortSide) - Math.abs(b.short - shortSide) ||
        a.error - b.error
    )
    return choices.length
      ? [[field.name, String(choices[0].option)] as const]
      : []
  })
  return entries.length ? Object.fromEntries(entries) : undefined
}

/** How many reference images a model's contract takes. */
export function referenceCapacity(contract: WorkshopContract): number {
  const mappings = routerParameterMappings(contract)
  return contractSchema(contract).reduce((total, field) => {
    const media = field.kind === 'file' ? field : urlUploadField(field)
    if (!media) return total
    const mapped = createRouterParameters(
      [field],
      defaultValues([field]),
      mappings
    ).router_get_closest_value(
      field.kind === 'file'
        ? []
        : Array.from({ length: 10 }, () => 'https://example.com/reference.png'),
      'reference_images'
    )
    return total + (mapped !== undefined ? (media.maxItems ?? 1) : 0)
  }, 0)
}

/**
 * Every watermark switch a contract has, turned off. Some providers stamp a
 * visible "AI generated" mark by default (Seedream's `watermark` is on unless
 * asked otherwise); a studio frame should come back clean.
 */
export function watermarksOff(
  contract: WorkshopContract | undefined
): Readonly<Record<string, boolean>> | undefined {
  if (!contract) return undefined
  const entries = contractSchema(contract).flatMap((field) =>
    field.kind === 'toggle' && /watermark/i.test(field.name)
      ? [[field.name, false] as const]
      : []
  )
  return entries.length ? Object.fromEntries(entries) : undefined
}

/** The Router parameters for one studio frame. */
export function frameParameters(
  contract: WorkshopContract | undefined,
  aspect: AspectRatio,
  shortSide: number
): RouterRenderParameters {
  const size = contract && frameSize(contract, aspect, shortSide)
  return {
    aspect_ratio: aspect,
    resolution: shortSide,
    ...(size ? { model_specific: size } : {})
  }
}

/** The allowed frame closest in shape, for a frame the model cannot make. */
export function nearestAspect(
  aspect: AspectRatio,
  allowed: readonly AspectRatio[]
): AspectRatio {
  if (!allowed.length || allowed.includes(aspect)) return aspect
  const target = Math.log(ratioOf(aspect)!)
  const distance = (candidate: AspectRatio) =>
    Math.abs(Math.log(ratioOf(candidate)!) - target)
  return allowed.reduce((best, candidate) =>
    distance(candidate) < distance(best) ? candidate : best
  )
}
