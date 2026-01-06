import { formatCreditsFromUsd } from '@/base/credits/comfyCredits'
import type { INodeInputSlot, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IComboWidget } from '@/lib/litegraph/src/types/widgets'

const DEFAULT_NUMBER_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
}

type CreditFormatOptions = {
  suffix?: string
  note?: string
  approximate?: boolean
  separator?: string
}

const formatCreditsValue = (usd: number): string =>
  formatCreditsFromUsd({
    usd,
    numberOptions: DEFAULT_NUMBER_OPTIONS
  })

const makePrefix = (approximate?: boolean) => (approximate ? '~' : '')

const makeSuffix = (suffix?: string) => suffix ?? '/Run'

const appendNote = (note?: string) => (note ? ` ${note}` : '')

const formatCreditsLabel = (
  usd: number,
  { suffix, note, approximate }: CreditFormatOptions = {}
): string =>
  `${makePrefix(approximate)}${formatCreditsValue(usd)} credits${makeSuffix(suffix)}${appendNote(note)}`

const formatCreditsRangeLabel = (
  minUsd: number,
  maxUsd: number,
  { suffix, note, approximate }: CreditFormatOptions = {}
): string => {
  const min = formatCreditsValue(minUsd)
  const max = formatCreditsValue(maxUsd)
  const rangeValue = min === max ? min : `${min}-${max}`
  return `${makePrefix(approximate)}${rangeValue} credits${makeSuffix(suffix)}${appendNote(note)}`
}

const formatCreditsListLabel = (
  usdValues: number[],
  { suffix, note, approximate, separator }: CreditFormatOptions = {}
): string => {
  const parts = usdValues.map((value) => formatCreditsValue(value))
  const value = parts.join(separator ?? '/')
  return `${makePrefix(approximate)}${value} credits${makeSuffix(suffix)}${appendNote(note)}`
}

/**
 * Function that calculates dynamic pricing based on node widget values
 */
type PricingFunction = (node: LGraphNode) => string

/**
 * Safely executes a pricing function with error handling
 * Returns null if the function throws an error, allowing the node to still render
 */
function safePricingExecution(
  fn: PricingFunction,
  node: LGraphNode,
  fallback: string = ''
): string {
  try {
    return fn(node)
  } catch (error) {
    // Log error in development but don't throw to avoid breaking node rendering
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        'Pricing calculation failed for node:',
        node.constructor?.nodeData?.name,
        error
      )
    }
    return fallback
  }
}

/**
 * Helper function to calculate Runway duration-based pricing
 * @param node - The LiteGraph node
 * @returns Formatted price string
 */
const calculateRunwayDurationPrice = (node: LGraphNode): string => {
  const durationWidget = node.widgets?.find(
    (w) => w.name === 'duration'
  ) as IComboWidget

  if (!durationWidget) return formatCreditsLabel(0.0715, { suffix: '/second' })

  const duration = Number(durationWidget.value)
  const validDuration = isNaN(duration) ? 5 : duration
  const cost = 0.0715 * validDuration
  return formatCreditsLabel(cost)
}

const makeOmniProDurationCalculator =
  (pricePerSecond: number): PricingFunction =>
  (node: LGraphNode): string => {
    const durationWidget = node.widgets?.find(
      (w) => w.name === 'duration'
    ) as IComboWidget
    if (!durationWidget)
      return formatCreditsLabel(pricePerSecond, { suffix: '/second' })

    const seconds = parseFloat(String(durationWidget.value))
    if (!Number.isFinite(seconds))
      return formatCreditsLabel(pricePerSecond, { suffix: '/second' })

    const cost = pricePerSecond * seconds
    return formatCreditsLabel(cost)
  }

const klingMotionControlPricingCalculator: PricingFunction = (
  node: LGraphNode
): string => {
  const modeWidget = node.widgets?.find(
    (w) => w.name === 'mode'
  ) as IComboWidget

  if (!modeWidget) {
    return formatCreditsListLabel([0.07, 0.112], {
      suffix: '/second',
      note: '(std/pro)'
    })
  }

  const mode = String(modeWidget.value).toLowerCase()

  if (mode === 'pro') return formatCreditsLabel(0.112, { suffix: '/second' })
  if (mode === 'std') return formatCreditsLabel(0.07, { suffix: '/second' })

  return formatCreditsListLabel([0.07, 0.112], {
    suffix: '/second',
    note: '(std/pro)'
  })
}

const pixversePricingCalculator = (node: LGraphNode): string => {
  const durationWidget = node.widgets?.find(
    (w) => w.name === 'duration_seconds'
  ) as IComboWidget
  const qualityWidget = node.widgets?.find(
    (w) => w.name === 'quality'
  ) as IComboWidget
  const motionModeWidget = node.widgets?.find(
    (w) => w.name === 'motion_mode'
  ) as IComboWidget

  if (!durationWidget || !qualityWidget) {
    return formatCreditsRangeLabel(0.45, 1.2, {
      note: '(varies with duration, quality & motion mode)'
    })
  }

  const duration = String(durationWidget.value)
  const quality = String(qualityWidget.value)
  const motionMode = String(motionModeWidget?.value)

  // Basic pricing based on duration and quality
  if (duration.includes('5')) {
    if (quality.includes('1080p')) return formatCreditsLabel(1.2)
    if (quality.includes('720p') && motionMode?.includes('fast'))
      return formatCreditsLabel(1.2)
    if (quality.includes('720p') && motionMode?.includes('normal'))
      return formatCreditsLabel(0.6)
    if (quality.includes('540p') && motionMode?.includes('fast'))
      return formatCreditsLabel(0.9)
    if (quality.includes('540p') && motionMode?.includes('normal'))
      return formatCreditsLabel(0.45)
    if (quality.includes('360p') && motionMode?.includes('fast'))
      return formatCreditsLabel(0.9)
    if (quality.includes('360p') && motionMode?.includes('normal'))
      return formatCreditsLabel(0.45)
  } else if (duration.includes('8')) {
    if (quality.includes('540p') && motionMode?.includes('normal'))
      return formatCreditsLabel(0.9)
    if (quality.includes('540p') && motionMode?.includes('fast'))
      return formatCreditsLabel(1.2)
    if (quality.includes('360p') && motionMode?.includes('normal'))
      return formatCreditsLabel(0.9)
    if (quality.includes('360p') && motionMode?.includes('fast'))
      return formatCreditsLabel(1.2)
    if (quality.includes('1080p') && motionMode?.includes('normal'))
      return formatCreditsLabel(1.2)
    if (quality.includes('1080p') && motionMode?.includes('fast'))
      return formatCreditsLabel(1.2)
    if (quality.includes('720p') && motionMode?.includes('normal'))
      return formatCreditsLabel(1.2)
    if (quality.includes('720p') && motionMode?.includes('fast'))
      return formatCreditsLabel(1.2)
  }

  return formatCreditsLabel(0.9)
}

const byteDanceVideoPricingCalculator = (node: LGraphNode): string => {
  const modelWidget = node.widgets?.find(
    (w) => w.name === 'model'
  ) as IComboWidget
  const durationWidget = node.widgets?.find(
    (w) => w.name === 'duration'
  ) as IComboWidget
  const resolutionWidget = node.widgets?.find(
    (w) => w.name === 'resolution'
  ) as IComboWidget

  if (!modelWidget || !durationWidget || !resolutionWidget) return 'Token-based'

  const model = String(modelWidget.value).toLowerCase()
  const resolution = String(resolutionWidget.value).toLowerCase()
  const seconds = parseFloat(String(durationWidget.value))
  const priceByModel: Record<string, Record<string, [number, number]>> = {
    'seedance-1-0-pro': {
      '480p': [0.23, 0.24],
      '720p': [0.51, 0.56],
      '1080p': [1.18, 1.22]
    },
    'seedance-1-0-pro-fast': {
      '480p': [0.09, 0.1],
      '720p': [0.21, 0.23],
      '1080p': [0.47, 0.49]
    },
    'seedance-1-0-lite': {
      '480p': [0.17, 0.18],
      '720p': [0.37, 0.41],
      '1080p': [0.85, 0.88]
    }
  }

  const modelKey = model.includes('seedance-1-0-pro-fast')
    ? 'seedance-1-0-pro-fast'
    : model.includes('seedance-1-0-pro')
      ? 'seedance-1-0-pro'
      : model.includes('seedance-1-0-lite')
        ? 'seedance-1-0-lite'
        : ''

  const resKey = resolution.includes('1080')
    ? '1080p'
    : resolution.includes('720')
      ? '720p'
      : resolution.includes('480')
        ? '480p'
        : ''

  const baseRange =
    modelKey && resKey ? priceByModel[modelKey]?.[resKey] : undefined
  if (!baseRange) return 'Token-based'

  const [min10s, max10s] = baseRange
  const scale = seconds / 10
  const minCost = min10s * scale
  const maxCost = max10s * scale

  if (minCost === maxCost) return formatCreditsLabel(minCost)
  return formatCreditsRangeLabel(minCost, maxCost)
}

const ltxvPricingCalculator = (node: LGraphNode): string => {
  const modelWidget = node.widgets?.find(
    (w) => w.name === 'model'
  ) as IComboWidget
  const durationWidget = node.widgets?.find(
    (w) => w.name === 'duration'
  ) as IComboWidget
  const resolutionWidget = node.widgets?.find(
    (w) => w.name === 'resolution'
  ) as IComboWidget

  const fallback = formatCreditsRangeLabel(0.04, 0.24, {
    suffix: '/second'
  })
  if (!modelWidget || !durationWidget || !resolutionWidget) return fallback

  const model = String(modelWidget.value).toLowerCase()
  const resolution = String(resolutionWidget.value).toLowerCase()
  const seconds = parseFloat(String(durationWidget.value))
  const priceByModel: Record<string, Record<string, number>> = {
    'ltx-2 (pro)': {
      '1920x1080': 0.06,
      '2560x1440': 0.12,
      '3840x2160': 0.24
    },
    'ltx-2 (fast)': {
      '1920x1080': 0.04,
      '2560x1440': 0.08,
      '3840x2160': 0.16
    }
  }

  const modelTable = priceByModel[model]
  if (!modelTable) return fallback

  const pps = modelTable[resolution]
  if (!pps) return fallback

  const cost = pps * seconds
  return formatCreditsLabel(cost)
}

const klingVideoWithAudioPricingCalculator: PricingFunction = (
  node: LGraphNode
): string => {
  const durationWidget = node.widgets?.find(
    (w) => w.name === 'duration'
  ) as IComboWidget
  const generateAudioWidget = node.widgets?.find(
    (w) => w.name === 'generate_audio'
  ) as IComboWidget

  if (!durationWidget || !generateAudioWidget) {
    return formatCreditsRangeLabel(0.35, 1.4, {
      note: '(varies with duration & audio)'
    })
  }

  const duration = String(durationWidget.value)
  const generateAudio =
    String(generateAudioWidget.value).toLowerCase() === 'true'

  if (duration === '5') {
    return generateAudio ? formatCreditsLabel(0.7) : formatCreditsLabel(0.35)
  }

  if (duration === '10') {
    return generateAudio ? formatCreditsLabel(1.4) : formatCreditsLabel(0.7)
  }

  // Fallback for unexpected duration values
  return formatCreditsRangeLabel(0.35, 1.4, {
    note: '(varies with duration & audio)'
  })
}

// ---- constants ----
const SORA_SIZES = {
  BASIC: new Set(['720x1280', '1280x720']),
  PRO: new Set(['1024x1792', '1792x1024'])
}
const ALL_SIZES = new Set([...SORA_SIZES.BASIC, ...SORA_SIZES.PRO])

// ---- sora-2 pricing helpers ----
function validateSora2Selection(
  modelRaw: string,
  duration: number,
  sizeRaw: string
): string | undefined {
  const model = modelRaw?.toLowerCase() ?? ''
  const size = sizeRaw?.toLowerCase() ?? ''

  if (!duration || Number.isNaN(duration)) return 'Set duration (4s / 8s / 12s)'
  if (!size) return 'Set size (720x1280, 1280x720, 1024x1792, 1792x1024)'
  if (!ALL_SIZES.has(size))
    return 'Invalid size. Must be 720x1280, 1280x720, 1024x1792, or 1792x1024.'

  if (model.includes('sora-2-pro')) return undefined

  if (model.includes('sora-2') && !SORA_SIZES.BASIC.has(size))
    return 'sora-2 supports only 720x1280 or 1280x720'

  if (!model.includes('sora-2')) return 'Unsupported model'

  return undefined
}

function perSecForSora2(modelRaw: string, sizeRaw: string): number {
  const model = modelRaw?.toLowerCase() ?? ''
  const size = sizeRaw?.toLowerCase() ?? ''

  if (model.includes('sora-2-pro')) {
    return SORA_SIZES.PRO.has(size) ? 0.5 : 0.3
  }
  if (model.includes('sora-2')) return 0.1

  return SORA_SIZES.PRO.has(size) ? 0.5 : 0.1
}

function formatRunPrice(perSec: number, duration: number) {
  return formatCreditsLabel(Number((perSec * duration).toFixed(2)))
}

// ---- pricing calculator ----
const sora2PricingCalculator: PricingFunction = (node: LGraphNode): string => {
  const getWidgetValue = (name: string) =>
    String(node.widgets?.find((w) => w.name === name)?.value ?? '')

  const model = getWidgetValue('model')
  const size = getWidgetValue('size')
  const duration = Number(
    node.widgets?.find((w) => ['duration', 'duration_s'].includes(w.name))
      ?.value
  )

  if (!model || !size || !duration) return 'Set model, duration & size'

  const validationError = validateSora2Selection(model, duration, size)
  if (validationError) return validationError

  const perSec = perSecForSora2(model, size)
  return formatRunPrice(perSec, duration)
}

/**
 * Pricing for Tripo 3D generation nodes (Text / Image / Multiview)
 * based on Tripo credits:
 *
 * Turbo / V3 / V2.5 / V2.0:
 *   Text  -> 10 (no texture) / 20 (standard texture)
 *   Image -> 20 (no texture) / 30 (standard texture)
 *   Multiview -> 20 (no texture) / 30 (standard texture)
 *
 * V1.4:
 *   Text  -> 20
 *   Image -> 30
 *   (Multiview treated same as Image if used)
 *
 * Advanced extras (added on top of generation credits):
 *   quad               -> +5 credits
 *   style              -> +5 credits (if style != "None")
 *   HD texture         -> +10 credits (texture_quality = "detailed")
 *   detailed geometry  -> +20 credits (geometry_quality = "detailed")
 *
 * 1 credit = $0.01
 */
const calculateTripo3DGenerationPrice = (
  node: LGraphNode,
  task: 'text' | 'image' | 'multiview'
): string => {
  const getWidget = (name: string): IComboWidget | undefined =>
    node.widgets?.find((w) => w.name === name) as IComboWidget | undefined

  const getString = (name: string, defaultValue: string): string => {
    const widget = getWidget(name)
    if (!widget || widget.value === undefined || widget.value === null) {
      return defaultValue
    }
    return String(widget.value)
  }

  const getBool = (name: string, defaultValue: boolean): boolean => {
    const widget = getWidget(name)
    if (!widget || widget.value === undefined || widget.value === null) {
      return defaultValue
    }

    const v = widget.value
    if (typeof v === 'number') return v !== 0
    const lower = String(v).toLowerCase()
    if (lower === 'true') return true
    if (lower === 'false') return false

    return defaultValue
  }

  // ---- read widget values with sensible defaults (mirroring backend) ----
  const modelVersionRaw = getString('model_version', '').toLowerCase()
  if (modelVersionRaw === '')
    return formatCreditsRangeLabel(0.1, 0.65, {
      note: '(varies with quad, style, texture & quality)'
    })
  const styleRaw = getString('style', 'None')
  const hasStyle = styleRaw.toLowerCase() !== 'none'

  // Backend defaults: texture=true, pbr=true, quad=false, qualities="standard"
  const hasTexture = getBool('texture', false)
  const hasPbr = getBool('pbr', false)
  const quad = getBool('quad', false)

  const textureQualityRaw = getString(
    'texture_quality',
    'standard'
  ).toLowerCase()
  const geometryQualityRaw = getString(
    'geometry_quality',
    'standard'
  ).toLowerCase()

  const isHdTexture = textureQualityRaw === 'detailed'
  const isDetailedGeometry = geometryQualityRaw === 'detailed'

  const withTexture = hasTexture || hasPbr

  let baseCredits: number

  if (modelVersionRaw.includes('v1.4')) {
    // V1.4 model: Text=20, Image=30, Refine=30
    if (task === 'text') {
      baseCredits = 20
    } else {
      // treat Multiview same as Image if V1.4 is ever used there
      baseCredits = 30
    }
  } else {
    // V3.0, V2.5, V2.0 models
    if (!withTexture) {
      if (task === 'text') {
        baseCredits = 10 // Text to 3D without texture
      } else {
        baseCredits = 20 // Image/Multiview to 3D without texture
      }
    } else {
      if (task === 'text') {
        baseCredits = 20 // Text to 3D with standard texture
      } else {
        baseCredits = 30 // Image/Multiview to 3D with standard texture
      }
    }
  }

  // ---- advanced extras on top of base generation ----
  let credits = baseCredits

  if (hasStyle) credits += 5 // Style
  if (quad) credits += 5 // Quad Topology
  if (isHdTexture) credits += 10 // HD Texture
  if (isDetailedGeometry) credits += 20 // Detailed Geometry Quality

  const dollars = credits * 0.01
  return formatCreditsLabel(dollars)
}

/**
 * Static pricing data for API nodes, now supporting both strings and functions
 */
const apiNodeCosts: Record<string, { displayPrice: string | PricingFunction }> =
  {
    FluxProCannyNode: {
      displayPrice: formatCreditsLabel(0.05)
    },
    FluxProDepthNode: {
      displayPrice: formatCreditsLabel(0.05)
    },
    FluxProExpandNode: {
      displayPrice: formatCreditsLabel(0.05)
    },
    FluxProFillNode: {
      displayPrice: formatCreditsLabel(0.05)
    },
    FluxProUltraImageNode: {
      displayPrice: formatCreditsLabel(0.06)
    },
    FluxProKontextProNode: {
      displayPrice: formatCreditsLabel(0.04)
    },
    FluxProKontextMaxNode: {
      displayPrice: formatCreditsLabel(0.08)
    },
    Flux2ProImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const widthW = node.widgets?.find(
          (w) => w.name === 'width'
        ) as IComboWidget
        const heightW = node.widgets?.find(
          (w) => w.name === 'height'
        ) as IComboWidget

        const w = Number(widthW?.value)
        const h = Number(heightW?.value)
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
          // global min/max for this node given schema bounds (1MP..4MP output)
          return formatCreditsRangeLabel(0.03, 0.15)
        }

        // Is the 'images' input connected?
        const imagesInput = node.inputs?.find(
          (i) => i.name === 'images'
        ) as INodeInputSlot
        const hasRefs =
          typeof imagesInput?.link !== 'undefined' && imagesInput.link != null

        // Output cost: ceil((w*h)/MP); first MP $0.03, each additional $0.015
        const MP = 1024 * 1024
        const outMP = Math.max(1, Math.floor((w * h + MP - 1) / MP))
        const outputCost = 0.03 + 0.015 * Math.max(outMP - 1, 0)

        if (hasRefs) {
          // Unknown ref count/size on the frontend:
          // min extra is $0.015, max extra is $0.120 (8 MP cap / 8 refs)
          const minTotal = outputCost + 0.015
          const maxTotal = outputCost + 0.12
          return formatCreditsRangeLabel(minTotal, maxTotal, {
            approximate: true
          })
        }

        // Precise text-to-image price
        return formatCreditsLabel(outputCost)
      }
    },
    Flux2MaxImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const widthW = node.widgets?.find(
          (w) => w.name === 'width'
        ) as IComboWidget
        const heightW = node.widgets?.find(
          (w) => w.name === 'height'
        ) as IComboWidget

        const w = Number(widthW?.value)
        const h = Number(heightW?.value)
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
          // global min/max for this node given schema bounds (1MP..4MP output)
          return formatCreditsRangeLabel(0.07, 0.35)
        }

        // Is the 'images' input connected?
        const imagesInput = node.inputs?.find(
          (i) => i.name === 'images'
        ) as INodeInputSlot
        const hasRefs =
          typeof imagesInput?.link !== 'undefined' && imagesInput.link != null

        // Output cost: ceil((w*h)/MP); first MP $0.07, each additional $0.03
        const MP = 1024 * 1024
        const outMP = Math.max(1, Math.floor((w * h + MP - 1) / MP))
        const outputCost = 0.07 + 0.03 * Math.max(outMP - 1, 0)

        if (hasRefs) {
          // Unknown ref count/size on the frontend:
          // min extra is $0.03, max extra is $0.24 (8 MP cap / 8 refs)
          const minTotal = outputCost + 0.03
          const maxTotal = outputCost + 0.24
          return formatCreditsRangeLabel(minTotal, maxTotal)
        }

        return formatCreditsLabel(outputCost)
      }
    },
    OpenAIVideoSora2: {
      displayPrice: sora2PricingCalculator
    },
    IdeogramV1: {
      displayPrice: (node: LGraphNode): string => {
        const numImagesWidget = node.widgets?.find(
          (w) => w.name === 'num_images'
        ) as IComboWidget
        const turboWidget = node.widgets?.find(
          (w) => w.name === 'turbo'
        ) as IComboWidget

        if (!numImagesWidget)
          return formatCreditsRangeLabel(0.03, 0.09, {
            suffix: ' x num_images/Run'
          })

        const numImages = Number(numImagesWidget.value) || 1
        const turbo = String(turboWidget?.value).toLowerCase() === 'true'
        const basePrice = turbo ? 0.0286 : 0.0858
        const cost = Number((basePrice * numImages).toFixed(2))
        return formatCreditsLabel(cost)
      }
    },
    IdeogramV2: {
      displayPrice: (node: LGraphNode): string => {
        const numImagesWidget = node.widgets?.find(
          (w) => w.name === 'num_images'
        ) as IComboWidget
        const turboWidget = node.widgets?.find(
          (w) => w.name === 'turbo'
        ) as IComboWidget

        if (!numImagesWidget)
          return formatCreditsRangeLabel(0.07, 0.11, {
            suffix: ' x num_images/Run'
          })

        const numImages = Number(numImagesWidget.value) || 1
        const turbo = String(turboWidget?.value).toLowerCase() === 'true'
        const basePrice = turbo ? 0.0715 : 0.1144
        const cost = Number((basePrice * numImages).toFixed(2))
        return formatCreditsLabel(cost)
      }
    },
    IdeogramV3: {
      displayPrice: (node: LGraphNode): string => {
        const renderingSpeedWidget = node.widgets?.find(
          (w) => w.name === 'rendering_speed'
        ) as IComboWidget
        const numImagesWidget = node.widgets?.find(
          (w) => w.name === 'num_images'
        ) as IComboWidget
        const characterInput = node.inputs?.find(
          (i) => i.name === 'character_image'
        ) as INodeInputSlot
        const hasCharacter =
          typeof characterInput?.link !== 'undefined' &&
          characterInput.link != null

        if (!renderingSpeedWidget)
          return formatCreditsRangeLabel(0.04, 0.11, {
            suffix: ' x num_images/Run',
            note: '(varies with rendering speed & num_images)'
          })

        const numImages = Number(numImagesWidget?.value) || 1
        let basePrice = 0.0858 // default balanced price

        const renderingSpeed = String(renderingSpeedWidget.value)
        if (renderingSpeed.toLowerCase().includes('quality')) {
          if (hasCharacter) {
            basePrice = 0.286
          } else {
            basePrice = 0.1287
          }
        } else if (renderingSpeed.toLowerCase().includes('default')) {
          if (hasCharacter) {
            basePrice = 0.2145
          } else {
            basePrice = 0.0858
          }
        } else if (renderingSpeed.toLowerCase().includes('turbo')) {
          if (hasCharacter) {
            basePrice = 0.143
          } else {
            basePrice = 0.0429
          }
        }

        const totalCost = Number((basePrice * numImages).toFixed(2))
        return formatCreditsLabel(totalCost)
      }
    },
    KlingCameraControlI2VNode: {
      displayPrice: formatCreditsLabel(0.49)
    },
    KlingCameraControlT2VNode: {
      displayPrice: formatCreditsLabel(0.14)
    },
    KlingDualCharacterVideoEffectNode: {
      displayPrice: (node: LGraphNode): string => {
        const modeWidget = node.widgets?.find(
          (w) => w.name === 'mode'
        ) as IComboWidget
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model_name'
        ) as IComboWidget
        const durationWidget = node.widgets?.find(
          (w) => w.name === 'duration'
        ) as IComboWidget
        if (!modeWidget || !modelWidget || !durationWidget)
          return formatCreditsRangeLabel(0.14, 2.8, {
            note: '(varies with model, mode & duration)'
          })

        const modeValue = String(modeWidget.value)
        const durationValue = String(durationWidget.value)
        const modelValue = String(modelWidget.value)

        // Same pricing matrix as KlingTextToVideoNode
        if (modelValue.includes('v1-6') || modelValue.includes('v1-5')) {
          if (modeValue.includes('pro')) {
            return durationValue.includes('10')
              ? formatCreditsLabel(0.98)
              : formatCreditsLabel(0.49)
          } else {
            return durationValue.includes('10')
              ? formatCreditsLabel(0.56)
              : formatCreditsLabel(0.28)
          }
        } else if (modelValue.includes('v1')) {
          if (modeValue.includes('pro')) {
            return durationValue.includes('10')
              ? formatCreditsLabel(0.98)
              : formatCreditsLabel(0.49)
          } else {
            return durationValue.includes('10')
              ? formatCreditsLabel(0.28)
              : formatCreditsLabel(0.14)
          }
        }

        return formatCreditsLabel(0.14)
      }
    },
    KlingImage2VideoNode: {
      displayPrice: (node: LGraphNode): string => {
        const modeWidget = node.widgets?.find(
          (w) => w.name === 'mode'
        ) as IComboWidget
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model_name'
        ) as IComboWidget
        const durationWidget = node.widgets?.find(
          (w) => w.name === 'duration'
        ) as IComboWidget

        if (!modeWidget) {
          if (!modelWidget)
            return formatCreditsRangeLabel(0.14, 2.8, {
              note: '(varies with model, mode & duration)'
            })

          const modelValue = String(modelWidget.value)
          if (
            modelValue.includes('v2-1-master') ||
            modelValue.includes('v2-master')
          ) {
            return formatCreditsLabel(1.4)
          } else if (
            modelValue.includes('v1-6') ||
            modelValue.includes('v1-5')
          ) {
            return formatCreditsLabel(0.28)
          }
          return formatCreditsLabel(0.14)
        }

        const modeValue = String(modeWidget.value)
        const durationValue = String(durationWidget.value)
        const modelValue = String(modelWidget.value)

        // Same pricing matrix as KlingTextToVideoNode
        if (modelValue.includes('v2-5-turbo')) {
          if (durationValue.includes('10')) {
            return formatCreditsLabel(0.7)
          }
          return formatCreditsLabel(0.35) // 5s default
        } else if (
          modelValue.includes('v2-1-master') ||
          modelValue.includes('v2-master')
        ) {
          if (durationValue.includes('10')) {
            return formatCreditsLabel(2.8)
          }
          return formatCreditsLabel(1.4) // 5s default
        } else if (
          modelValue.includes('v2-1') ||
          modelValue.includes('v1-6') ||
          modelValue.includes('v1-5')
        ) {
          if (modeValue.includes('pro')) {
            return durationValue.includes('10')
              ? formatCreditsLabel(0.98)
              : formatCreditsLabel(0.49)
          } else {
            return durationValue.includes('10')
              ? formatCreditsLabel(0.56)
              : formatCreditsLabel(0.28)
          }
        } else if (modelValue.includes('v1')) {
          if (modeValue.includes('pro')) {
            return durationValue.includes('10')
              ? formatCreditsLabel(0.98)
              : formatCreditsLabel(0.49)
          } else {
            return durationValue.includes('10')
              ? formatCreditsLabel(0.28)
              : formatCreditsLabel(0.14)
          }
        }

        return formatCreditsLabel(0.14)
      }
    },
    KlingImageGenerationNode: {
      displayPrice: (node: LGraphNode): string => {
        const imageInputWidget = node.inputs?.find((i) => i.name === 'image')
        // If link is not null => image is connected => modality is image to image
        const modality = imageInputWidget?.link
          ? 'image to image'
          : 'text to image'
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model_name'
        ) as IComboWidget
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget

        if (!modelWidget)
          return formatCreditsRangeLabel(0.0035, 0.028, {
            suffix: ' x n/Run',
            note: '(varies with modality & model)'
          })

        const model = String(modelWidget.value)
        const n = Number(nWidget?.value) || 1
        let basePrice = 0.014 // default

        if (modality.includes('text to image')) {
          if (model.includes('kling-v1-5') || model.includes('kling-v2')) {
            basePrice = 0.014
          } else if (model.includes('kling-v1')) {
            basePrice = 0.0035
          }
        } else if (modality.includes('image to image')) {
          if (model.includes('kling-v1-5')) {
            basePrice = 0.028
          } else if (model.includes('kling-v1')) {
            basePrice = 0.0035
          }
        }

        const totalCost = basePrice * n
        return formatCreditsLabel(totalCost)
      }
    },
    KlingLipSyncAudioToVideoNode: {
      displayPrice: formatCreditsLabel(0.1, { approximate: true })
    },
    KlingLipSyncTextToVideoNode: {
      displayPrice: formatCreditsLabel(0.1, { approximate: true })
    },
    KlingSingleImageVideoEffectNode: {
      displayPrice: (node: LGraphNode): string => {
        const effectSceneWidget = node.widgets?.find(
          (w) => w.name === 'effect_scene'
        ) as IComboWidget

        if (!effectSceneWidget)
          return formatCreditsRangeLabel(0.28, 0.49, {
            note: '(varies with effect scene)'
          })

        const effectScene = String(effectSceneWidget.value)
        if (
          effectScene.includes('fuzzyfuzzy') ||
          effectScene.includes('squish')
        ) {
          return formatCreditsLabel(0.28)
        } else if (effectScene.includes('dizzydizzy')) {
          return formatCreditsLabel(0.49)
        } else if (effectScene.includes('bloombloom')) {
          return formatCreditsLabel(0.49)
        } else if (effectScene.includes('expansion')) {
          return formatCreditsLabel(0.28)
        }

        return formatCreditsLabel(0.28)
      }
    },
    KlingStartEndFrameNode: {
      displayPrice: (node: LGraphNode): string => {
        // Same pricing as KlingTextToVideoNode per CSV ("Same as text to video")
        const modeWidget = node.widgets?.find(
          (w) => w.name === 'mode'
        ) as IComboWidget
        if (!modeWidget)
          return formatCreditsRangeLabel(0.14, 2.8, {
            note: '(varies with model, mode & duration)'
          })

        const modeValue = String(modeWidget.value)

        // Same pricing matrix as KlingTextToVideoNode
        if (modeValue.includes('v2-5-turbo')) {
          if (modeValue.includes('10')) {
            return formatCreditsLabel(0.7)
          }
          return formatCreditsLabel(0.35) // 5s default
        } else if (modeValue.includes('v2-1')) {
          if (modeValue.includes('10s')) {
            return formatCreditsLabel(0.98) // pro, 10s
          }
          return formatCreditsLabel(0.49) // pro, 5s default
        } else if (modeValue.includes('v2-master')) {
          if (modeValue.includes('10s')) {
            return formatCreditsLabel(2.8)
          }
          return formatCreditsLabel(1.4) // 5s default
        } else if (modeValue.includes('v1-6')) {
          if (modeValue.includes('pro')) {
            return modeValue.includes('10s')
              ? formatCreditsLabel(0.98)
              : formatCreditsLabel(0.49)
          } else {
            return modeValue.includes('10s')
              ? formatCreditsLabel(0.56)
              : formatCreditsLabel(0.28)
          }
        } else if (modeValue.includes('v1')) {
          if (modeValue.includes('pro')) {
            return modeValue.includes('10s')
              ? formatCreditsLabel(0.98)
              : formatCreditsLabel(0.49)
          } else {
            return modeValue.includes('10s')
              ? formatCreditsLabel(0.28)
              : formatCreditsLabel(0.14)
          }
        }

        return formatCreditsLabel(0.14)
      }
    },
    KlingTextToVideoNode: {
      displayPrice: (node: LGraphNode): string => {
        const modeWidget = node.widgets?.find(
          (w) => w.name === 'mode'
        ) as IComboWidget
        if (!modeWidget)
          return formatCreditsRangeLabel(0.14, 2.8, {
            note: '(varies with model, mode & duration)'
          })

        const modeValue = String(modeWidget.value)

        // Pricing matrix from CSV data based on mode string content
        if (modeValue.includes('v2-5-turbo')) {
          if (modeValue.includes('10')) {
            return formatCreditsLabel(0.7)
          }
          return formatCreditsLabel(0.35) // 5s default
        } else if (modeValue.includes('v2-1-master')) {
          if (modeValue.includes('10s')) {
            return formatCreditsLabel(2.8) // price is the same as for v2-master model
          }
          return formatCreditsLabel(1.4) // price is the same as for v2-master model
        } else if (modeValue.includes('v2-master')) {
          if (modeValue.includes('10s')) {
            return formatCreditsLabel(2.8)
          }
          return formatCreditsLabel(1.4) // 5s default
        } else if (modeValue.includes('v1-6')) {
          if (modeValue.includes('pro')) {
            return modeValue.includes('10s')
              ? formatCreditsLabel(0.98)
              : formatCreditsLabel(0.49)
          } else {
            return modeValue.includes('10s')
              ? formatCreditsLabel(0.56)
              : formatCreditsLabel(0.28)
          }
        } else if (modeValue.includes('v1')) {
          if (modeValue.includes('pro')) {
            return modeValue.includes('10s')
              ? formatCreditsLabel(0.98)
              : formatCreditsLabel(0.49)
          } else {
            return modeValue.includes('10s')
              ? formatCreditsLabel(0.28)
              : formatCreditsLabel(0.14)
          }
        }

        return formatCreditsLabel(0.14)
      }
    },
    KlingVideoExtendNode: {
      displayPrice: formatCreditsLabel(0.28)
    },
    KlingVirtualTryOnNode: {
      displayPrice: formatCreditsLabel(0.07)
    },
    KlingOmniProTextToVideoNode: {
      displayPrice: makeOmniProDurationCalculator(0.112)
    },
    KlingOmniProFirstLastFrameNode: {
      displayPrice: makeOmniProDurationCalculator(0.112)
    },
    KlingOmniProImageToVideoNode: {
      displayPrice: makeOmniProDurationCalculator(0.112)
    },
    KlingOmniProVideoToVideoNode: {
      displayPrice: makeOmniProDurationCalculator(0.168)
    },
    KlingMotionControl: {
      displayPrice: klingMotionControlPricingCalculator
    },
    KlingOmniProEditVideoNode: {
      displayPrice: formatCreditsLabel(0.168, { suffix: '/second' })
    },
    KlingOmniProImageNode: {
      displayPrice: formatCreditsLabel(0.028)
    },
    KlingTextToVideoWithAudio: {
      displayPrice: klingVideoWithAudioPricingCalculator
    },
    KlingImageToVideoWithAudio: {
      displayPrice: klingVideoWithAudioPricingCalculator
    },
    LumaImageToVideoNode: {
      displayPrice: (node: LGraphNode): string => {
        // Same pricing as LumaVideoNode per CSV
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget
        const resolutionWidget = node.widgets?.find(
          (w) => w.name === 'resolution'
        ) as IComboWidget
        const durationWidget = node.widgets?.find(
          (w) => w.name === 'duration'
        ) as IComboWidget

        if (!modelWidget || !resolutionWidget || !durationWidget) {
          return formatCreditsRangeLabel(0.2, 16.4, {
            note: '(varies with model, resolution & duration)'
          })
        }

        const model = String(modelWidget.value)
        const resolution = String(resolutionWidget.value).toLowerCase()
        const duration = String(durationWidget.value)

        if (model.includes('ray-flash-2')) {
          if (duration.includes('5s')) {
            if (resolution.includes('4k')) return formatCreditsLabel(3.13)
            if (resolution.includes('1080p')) return formatCreditsLabel(0.79)
            if (resolution.includes('720p')) return formatCreditsLabel(0.34)
            if (resolution.includes('540p')) return formatCreditsLabel(0.2)
          } else if (duration.includes('9s')) {
            if (resolution.includes('4k')) return formatCreditsLabel(5.65)
            if (resolution.includes('1080p')) return formatCreditsLabel(1.42)
            if (resolution.includes('720p')) return formatCreditsLabel(0.61)
            if (resolution.includes('540p')) return formatCreditsLabel(0.36)
          }
        } else if (model.includes('ray-2')) {
          if (duration.includes('5s')) {
            if (resolution.includes('4k')) return formatCreditsLabel(9.11)
            if (resolution.includes('1080p')) return formatCreditsLabel(2.27)
            if (resolution.includes('720p')) return formatCreditsLabel(1.02)
            if (resolution.includes('540p')) return formatCreditsLabel(0.57)
          } else if (duration.includes('9s')) {
            if (resolution.includes('4k')) return formatCreditsLabel(16.4)
            if (resolution.includes('1080p')) return formatCreditsLabel(4.1)
            if (resolution.includes('720p')) return formatCreditsLabel(1.83)
            if (resolution.includes('540p')) return formatCreditsLabel(1.03)
          }
        } else if (model.includes('ray-1-6')) {
          return formatCreditsLabel(0.5)
        }

        return formatCreditsLabel(0.79)
      }
    },
    LumaVideoNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget
        const resolutionWidget = node.widgets?.find(
          (w) => w.name === 'resolution'
        ) as IComboWidget
        const durationWidget = node.widgets?.find(
          (w) => w.name === 'duration'
        ) as IComboWidget

        if (!modelWidget || !resolutionWidget || !durationWidget) {
          return formatCreditsRangeLabel(0.2, 16.4, {
            note: '(varies with model, resolution & duration)'
          })
        }

        const model = String(modelWidget.value)
        const resolution = String(resolutionWidget.value).toLowerCase()
        const duration = String(durationWidget.value)

        if (model.includes('ray-flash-2')) {
          if (duration.includes('5s')) {
            if (resolution.includes('4k')) return formatCreditsLabel(3.13)
            if (resolution.includes('1080p')) return formatCreditsLabel(0.79)
            if (resolution.includes('720p')) return formatCreditsLabel(0.34)
            if (resolution.includes('540p')) return formatCreditsLabel(0.2)
          } else if (duration.includes('9s')) {
            if (resolution.includes('4k')) return formatCreditsLabel(5.65)
            if (resolution.includes('1080p')) return formatCreditsLabel(1.42)
            if (resolution.includes('720p')) return formatCreditsLabel(0.61)
            if (resolution.includes('540p')) return formatCreditsLabel(0.36)
          }
        } else if (model.includes('ray-2')) {
          if (duration.includes('5s')) {
            if (resolution.includes('4k')) return formatCreditsLabel(9.11)
            if (resolution.includes('1080p')) return formatCreditsLabel(2.27)
            if (resolution.includes('720p')) return formatCreditsLabel(1.02)
            if (resolution.includes('540p')) return formatCreditsLabel(0.57)
          } else if (duration.includes('9s')) {
            if (resolution.includes('4k')) return formatCreditsLabel(16.4)
            if (resolution.includes('1080p')) return formatCreditsLabel(4.1)
            if (resolution.includes('720p')) return formatCreditsLabel(1.83)
            if (resolution.includes('540p')) return formatCreditsLabel(1.03)
          }
        } else if (model.includes('ray-1-6')) {
          return formatCreditsLabel(0.5)
        }

        return formatCreditsLabel(0.79)
      }
    },
    MinimaxImageToVideoNode: {
      displayPrice: formatCreditsLabel(0.43)
    },
    MinimaxTextToVideoNode: {
      displayPrice: formatCreditsLabel(0.43)
    },
    MinimaxHailuoVideoNode: {
      displayPrice: (node: LGraphNode): string => {
        const resolutionWidget = node.widgets?.find(
          (w) => w.name === 'resolution'
        ) as IComboWidget
        const durationWidget = node.widgets?.find(
          (w) => w.name === 'duration'
        ) as IComboWidget

        if (!resolutionWidget || !durationWidget) {
          return formatCreditsRangeLabel(0.28, 0.56, {
            note: '(varies with resolution & duration)'
          })
        }

        const resolution = String(resolutionWidget.value)
        const duration = String(durationWidget.value)

        if (resolution.includes('768P')) {
          if (duration.includes('6')) return formatCreditsLabel(0.28)
          if (duration.includes('10')) return formatCreditsLabel(0.56)
        } else if (resolution.includes('1080P')) {
          if (duration.includes('6')) return formatCreditsLabel(0.49)
        }

        return formatCreditsLabel(0.43) // default median
      }
    },
    OpenAIDalle2: {
      displayPrice: (node: LGraphNode): string => {
        const sizeWidget = node.widgets?.find(
          (w) => w.name === 'size'
        ) as IComboWidget
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget

        if (!sizeWidget)
          return formatCreditsRangeLabel(0.016, 0.02, {
            suffix: ' x n/Run',
            note: '(varies with size & n)'
          })

        const size = String(sizeWidget.value)
        const n = Number(nWidget?.value) || 1
        let basePrice = 0.02 // default

        if (size.includes('1024x1024')) {
          basePrice = 0.02
        } else if (size.includes('512x512')) {
          basePrice = 0.018
        } else if (size.includes('256x256')) {
          basePrice = 0.016
        }

        const totalCost = Number((basePrice * n).toFixed(3))
        return formatCreditsLabel(totalCost)
      }
    },
    OpenAIDalle3: {
      displayPrice: (node: LGraphNode): string => {
        // Get size and quality widgets
        const sizeWidget = node.widgets?.find(
          (w) => w.name === 'size'
        ) as IComboWidget
        const qualityWidget = node.widgets?.find(
          (w) => w.name === 'quality'
        ) as IComboWidget

        if (!sizeWidget || !qualityWidget)
          return formatCreditsRangeLabel(0.04, 0.12, {
            note: '(varies with size & quality)'
          })

        const size = String(sizeWidget.value)
        const quality = String(qualityWidget.value)

        // Pricing matrix based on CSV data
        if (size.includes('1024x1024')) {
          return quality.includes('hd')
            ? formatCreditsLabel(0.08)
            : formatCreditsLabel(0.04)
        } else if (size.includes('1792x1024') || size.includes('1024x1792')) {
          return quality.includes('hd')
            ? formatCreditsLabel(0.12)
            : formatCreditsLabel(0.08)
        }

        // Default value
        return formatCreditsLabel(0.04)
      }
    },
    OpenAIGPTImage1: {
      displayPrice: (node: LGraphNode): string => {
        const qualityWidget = node.widgets?.find(
          (w) => w.name === 'quality'
        ) as IComboWidget
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget

        if (!qualityWidget)
          return formatCreditsRangeLabel(0.011, 0.3, {
            suffix: ' x n/Run',
            note: '(varies with quality & n)'
          })

        const quality = String(qualityWidget.value)
        const n = Number(nWidget?.value) || 1
        let range: [number, number] = [0.046, 0.07] // default medium

        if (quality.includes('high')) {
          range = [0.167, 0.3]
        } else if (quality.includes('medium')) {
          range = [0.046, 0.07]
        } else if (quality.includes('low')) {
          range = [0.011, 0.02]
        }

        if (n === 1) {
          return formatCreditsRangeLabel(range[0], range[1])
        }
        return formatCreditsRangeLabel(range[0], range[1], {
          suffix: ` x ${n}/Run`
        })
      }
    },
    PixverseImageToVideoNode: {
      displayPrice: pixversePricingCalculator
    },
    PixverseTextToVideoNode: {
      displayPrice: pixversePricingCalculator
    },
    PixverseTransitionVideoNode: {
      displayPrice: pixversePricingCalculator
    },
    RecraftCreativeUpscaleNode: {
      displayPrice: formatCreditsLabel(0.25)
    },
    RecraftCrispUpscaleNode: {
      displayPrice: formatCreditsLabel(0.004)
    },
    RecraftGenerateColorFromImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return formatCreditsLabel(0.04, { suffix: ' x n/Run' })

        const n = Number(nWidget.value) || 1
        const cost = Number((0.04 * n).toFixed(2))
        return formatCreditsLabel(cost)
      }
    },
    RecraftGenerateImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return formatCreditsLabel(0.04, { suffix: ' x n/Run' })

        const n = Number(nWidget.value) || 1
        const cost = Number((0.04 * n).toFixed(2))
        return formatCreditsLabel(cost)
      }
    },
    RecraftGenerateVectorImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return formatCreditsLabel(0.08, { suffix: ' x n/Run' })

        const n = Number(nWidget.value) || 1
        const cost = Number((0.08 * n).toFixed(2))
        return formatCreditsLabel(cost)
      }
    },
    RecraftImageInpaintingNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return formatCreditsLabel(0.04, { suffix: ' x n/Run' })

        const n = Number(nWidget.value) || 1
        const cost = Number((0.04 * n).toFixed(2))
        return formatCreditsLabel(cost)
      }
    },
    RecraftImageToImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return formatCreditsLabel(0.04, { suffix: ' x n/Run' })

        const n = Number(nWidget.value) || 1
        const cost = Number((0.04 * n).toFixed(2))
        return formatCreditsLabel(cost)
      }
    },
    RecraftRemoveBackgroundNode: {
      displayPrice: formatCreditsLabel(0.01)
    },
    RecraftReplaceBackgroundNode: {
      displayPrice: formatCreditsLabel(0.04)
    },
    RecraftTextToImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return formatCreditsLabel(0.04, { suffix: ' x n/Run' })

        const n = Number(nWidget.value) || 1
        const cost = Number((0.04 * n).toFixed(2))
        return formatCreditsLabel(cost)
      }
    },
    RecraftTextToVectorNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return formatCreditsLabel(0.08, { suffix: ' x n/Run' })

        const n = Number(nWidget.value) || 1
        const cost = Number((0.08 * n).toFixed(2))
        return formatCreditsLabel(cost)
      }
    },
    RecraftVectorizeImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return formatCreditsLabel(0.01, { suffix: ' x n/Run' })

        const n = Number(nWidget.value) || 1
        const cost = Number((0.01 * n).toFixed(2))
        return formatCreditsLabel(cost)
      }
    },
    StabilityStableImageSD_3_5Node: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget

        if (!modelWidget)
          return formatCreditsRangeLabel(0.035, 0.065, {
            note: '(varies with model)'
          })

        const model = String(modelWidget.value).toLowerCase()
        if (model.includes('large')) {
          return formatCreditsLabel(0.065)
        } else if (model.includes('medium')) {
          return formatCreditsLabel(0.035)
        }

        return formatCreditsLabel(0.035)
      }
    },
    StabilityStableImageUltraNode: {
      displayPrice: formatCreditsLabel(0.08)
    },
    StabilityUpscaleConservativeNode: {
      displayPrice: formatCreditsLabel(0.25)
    },
    StabilityUpscaleCreativeNode: {
      displayPrice: formatCreditsLabel(0.25)
    },
    StabilityUpscaleFastNode: {
      displayPrice: formatCreditsLabel(0.01)
    },
    StabilityTextToAudio: {
      displayPrice: formatCreditsLabel(0.2)
    },
    StabilityAudioToAudio: {
      displayPrice: formatCreditsLabel(0.2)
    },
    StabilityAudioInpaint: {
      displayPrice: formatCreditsLabel(0.2)
    },
    VeoVideoGenerationNode: {
      displayPrice: (node: LGraphNode): string => {
        const durationWidget = node.widgets?.find(
          (w) => w.name === 'duration_seconds'
        ) as IComboWidget

        if (!durationWidget)
          return formatCreditsRangeLabel(2.5, 5.0, {
            note: '(varies with duration)'
          })

        const price = 0.5 * Number(durationWidget.value)
        return formatCreditsLabel(price)
      }
    },
    Veo3VideoGenerationNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget
        const generateAudioWidget = node.widgets?.find(
          (w) => w.name === 'generate_audio'
        ) as IComboWidget

        if (!modelWidget || !generateAudioWidget) {
          return formatCreditsRangeLabel(0.8, 3.2, {
            note: '(varies with model & audio generation)'
          })
        }

        const model = String(modelWidget.value)
        const generateAudio =
          String(generateAudioWidget.value).toLowerCase() === 'true'

        if (
          model.includes('veo-3.0-fast-generate-001') ||
          model.includes('veo-3.1-fast-generate')
        ) {
          return generateAudio
            ? formatCreditsLabel(1.2)
            : formatCreditsLabel(0.8)
        } else if (
          model.includes('veo-3.0-generate-001') ||
          model.includes('veo-3.1-generate')
        ) {
          return generateAudio
            ? formatCreditsLabel(3.2)
            : formatCreditsLabel(1.6)
        }

        // Default fallback
        return formatCreditsRangeLabel(0.8, 3.2)
      }
    },
    Veo3FirstLastFrameNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget
        const generateAudioWidget = node.widgets?.find(
          (w) => w.name === 'generate_audio'
        ) as IComboWidget
        const durationWidget = node.widgets?.find(
          (w) => w.name === 'duration'
        ) as IComboWidget

        if (!modelWidget || !generateAudioWidget || !durationWidget) {
          return formatCreditsRangeLabel(0.4, 3.2, {
            note: '(varies with model & audio generation)'
          })
        }

        const model = String(modelWidget.value)
        const generateAudio =
          String(generateAudioWidget.value).toLowerCase() === 'true'
        const seconds = parseFloat(String(durationWidget.value))

        let pricePerSecond: number | null = null
        if (model.includes('veo-3.1-fast-generate')) {
          pricePerSecond = generateAudio ? 0.15 : 0.1
        } else if (model.includes('veo-3.1-generate')) {
          pricePerSecond = generateAudio ? 0.4 : 0.2
        }
        if (pricePerSecond === null) {
          return formatCreditsRangeLabel(0.4, 3.2)
        }
        const cost = pricePerSecond * seconds
        return formatCreditsLabel(cost)
      }
    },
    LumaImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget
        const aspectRatioWidget = node.widgets?.find(
          (w) => w.name === 'aspect_ratio'
        ) as IComboWidget

        if (!modelWidget || !aspectRatioWidget) {
          return formatCreditsRangeLabel(0.0064, 0.026, {
            note: '(varies with model & aspect ratio)'
          })
        }

        const model = String(modelWidget.value)

        if (model.includes('photon-flash-1')) {
          return formatCreditsLabel(0.0027)
        } else if (model.includes('photon-1')) {
          return formatCreditsLabel(0.0104)
        }

        return formatCreditsLabel(0.0246)
      }
    },
    LumaImageModifyNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget

        if (!modelWidget) {
          return formatCreditsRangeLabel(0.0027, 0.0104, {
            note: '(varies with model)'
          })
        }

        const model = String(modelWidget.value)

        if (model.includes('photon-flash-1')) {
          return formatCreditsLabel(0.0027)
        } else if (model.includes('photon-1')) {
          return formatCreditsLabel(0.0104)
        }

        return formatCreditsLabel(0.0246)
      }
    },
    MoonvalleyTxt2VideoNode: {
      displayPrice: (node: LGraphNode): string => {
        const lengthWidget = node.widgets?.find(
          (w) => w.name === 'length'
        ) as IComboWidget

        // If no length widget exists, default to 5s pricing
        if (!lengthWidget) return formatCreditsLabel(1.5)

        const length = String(lengthWidget.value)
        if (length === '5s') {
          return formatCreditsLabel(1.5)
        } else if (length === '10s') {
          return formatCreditsLabel(3.0)
        }

        return formatCreditsLabel(1.5)
      }
    },
    MoonvalleyImg2VideoNode: {
      displayPrice: (node: LGraphNode): string => {
        const lengthWidget = node.widgets?.find(
          (w) => w.name === 'length'
        ) as IComboWidget

        // If no length widget exists, default to 5s pricing
        if (!lengthWidget) return formatCreditsLabel(1.5)

        const length = String(lengthWidget.value)
        if (length === '5s') {
          return formatCreditsLabel(1.5)
        } else if (length === '10s') {
          return formatCreditsLabel(3.0)
        }

        return formatCreditsLabel(1.5)
      }
    },
    MoonvalleyVideo2VideoNode: {
      displayPrice: (node: LGraphNode): string => {
        const lengthWidget = node.widgets?.find(
          (w) => w.name === 'length'
        ) as IComboWidget

        // If no length widget exists, default to 5s pricing
        if (!lengthWidget) return formatCreditsLabel(2.25)

        const length = String(lengthWidget.value)
        if (length === '5s') {
          return formatCreditsLabel(2.25)
        } else if (length === '10s') {
          return formatCreditsLabel(4.0)
        }

        return formatCreditsLabel(2.25)
      }
    },
    // Runway nodes - using actual node names from ComfyUI
    RunwayTextToImageNode: {
      displayPrice: formatCreditsLabel(0.11)
    },
    RunwayImageToVideoNodeGen3a: {
      displayPrice: calculateRunwayDurationPrice
    },
    RunwayImageToVideoNodeGen4: {
      displayPrice: calculateRunwayDurationPrice
    },
    RunwayFirstLastFrameNode: {
      displayPrice: calculateRunwayDurationPrice
    },
    // Rodin nodes - all have the same pricing structure
    Rodin3D_Regular: {
      displayPrice: formatCreditsLabel(0.4)
    },
    Rodin3D_Detail: {
      displayPrice: formatCreditsLabel(0.4)
    },
    Rodin3D_Smooth: {
      displayPrice: formatCreditsLabel(0.4)
    },
    Rodin3D_Sketch: {
      displayPrice: formatCreditsLabel(0.4)
    },
    // Tripo nodes - using actual node names from ComfyUI
    TripoTextToModelNode: {
      displayPrice: (node: LGraphNode): string =>
        calculateTripo3DGenerationPrice(node, 'text')
    },
    TripoImageToModelNode: {
      displayPrice: (node: LGraphNode): string =>
        calculateTripo3DGenerationPrice(node, 'image')
    },
    TripoMultiviewToModelNode: {
      displayPrice: (node: LGraphNode): string =>
        calculateTripo3DGenerationPrice(node, 'multiview')
    },
    TripoTextureNode: {
      displayPrice: (node: LGraphNode): string => {
        const textureQualityWidget = node.widgets?.find(
          (w) => w.name === 'texture_quality'
        ) as IComboWidget

        if (!textureQualityWidget)
          return formatCreditsRangeLabel(0.1, 0.2, {
            note: '(varies with quality)'
          })

        const textureQuality = String(textureQualityWidget.value)
        return textureQuality.includes('detailed')
          ? formatCreditsLabel(0.2)
          : formatCreditsLabel(0.1)
      }
    },
    TripoRigNode: {
      displayPrice: '$0.25/Run'
    },
    TripoConversionNode: {
      displayPrice: (node: LGraphNode): string => {
        const getWidgetValue = (name: string) =>
          node.widgets?.find((w) => w.name === name)?.value

        const getNumber = (name: string, defaultValue: number): number => {
          const raw = getWidgetValue(name)
          if (raw === undefined || raw === null || raw === '')
            return defaultValue
          if (typeof raw === 'number')
            return Number.isFinite(raw) ? raw : defaultValue
          const n = Number(raw)
          return Number.isFinite(n) ? n : defaultValue
        }

        const getBool = (name: string, defaultValue: boolean): boolean => {
          const v = getWidgetValue(name)
          if (v === undefined || v === null) return defaultValue

          if (typeof v === 'number') return v !== 0
          const lower = String(v).toLowerCase()
          if (lower === 'true') return true
          if (lower === 'false') return false
          return defaultValue
        }

        let hasAdvancedParam = false

        // ---- booleans that trigger advanced when true ----
        if (getBool('quad', false)) hasAdvancedParam = true
        if (getBool('force_symmetry', false)) hasAdvancedParam = true
        if (getBool('flatten_bottom', false)) hasAdvancedParam = true
        if (getBool('pivot_to_center_bottom', false)) hasAdvancedParam = true
        if (getBool('with_animation', false)) hasAdvancedParam = true
        if (getBool('pack_uv', false)) hasAdvancedParam = true
        if (getBool('bake', false)) hasAdvancedParam = true
        if (getBool('export_vertex_colors', false)) hasAdvancedParam = true
        if (getBool('animate_in_place', false)) hasAdvancedParam = true

        // ---- numeric params with special default sentinels ----
        const faceLimit = getNumber('face_limit', -1)
        if (faceLimit !== -1) hasAdvancedParam = true

        const textureSize = getNumber('texture_size', 4096)
        if (textureSize !== 4096) hasAdvancedParam = true

        const flattenBottomThreshold = getNumber(
          'flatten_bottom_threshold',
          0.0
        )
        if (flattenBottomThreshold !== 0.0) hasAdvancedParam = true

        const scaleFactor = getNumber('scale_factor', 1.0)
        if (scaleFactor !== 1.0) hasAdvancedParam = true

        // ---- string / combo params with non-default values ----
        const textureFormatRaw = String(
          getWidgetValue('texture_format') ?? 'JPEG'
        ).toUpperCase()
        if (textureFormatRaw !== 'JPEG') hasAdvancedParam = true

        const partNamesRaw = String(getWidgetValue('part_names') ?? '')
        if (partNamesRaw.trim().length > 0) hasAdvancedParam = true

        const fbxPresetRaw = String(
          getWidgetValue('fbx_preset') ?? 'blender'
        ).toLowerCase()
        if (fbxPresetRaw !== 'blender') hasAdvancedParam = true

        const exportOrientationRaw = String(
          getWidgetValue('export_orientation') ?? 'default'
        ).toLowerCase()
        if (exportOrientationRaw !== 'default') hasAdvancedParam = true

        const credits = hasAdvancedParam ? 10 : 5
        return formatCreditsLabel(credits * 0.01)
      }
    },
    TripoRetargetNode: {
      displayPrice: formatCreditsLabel(0.1)
    },
    TripoRefineNode: {
      displayPrice: formatCreditsLabel(0.3)
    },
    // Google/Gemini nodes
    GeminiNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget

        if (!modelWidget) return 'Token-based'

        const model = String(modelWidget.value)

        // Google Veo video generation
        if (model.includes('veo-2.0')) {
          return formatCreditsLabel(0.5, { suffix: '/second' })
        } else if (model.includes('gemini-2.5-flash-preview-04-17')) {
          return formatCreditsListLabel([0.0003, 0.0025], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('gemini-2.5-flash')) {
          return formatCreditsListLabel([0.0003, 0.0025], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('gemini-2.5-pro-preview-05-06')) {
          return formatCreditsListLabel([0.00125, 0.01], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('gemini-2.5-pro')) {
          return formatCreditsListLabel([0.00125, 0.01], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('gemini-3-pro-preview')) {
          return formatCreditsListLabel([0.002, 0.012], {
            suffix: ' per 1K tokens'
          })
        }
        // For other Gemini models, show token-based pricing info
        return 'Token-based'
      }
    },
    GeminiImageNode: {
      displayPrice: formatCreditsLabel(0.039, {
        suffix: '/Image (1K)',
        approximate: true
      })
    },
    GeminiImage2Node: {
      displayPrice: (node: LGraphNode): string => {
        const resolutionWidget = node.widgets?.find(
          (w) => w.name === 'resolution'
        ) as IComboWidget

        if (!resolutionWidget) return 'Token-based'

        const resolution = String(resolutionWidget.value)
        if (resolution.includes('1K')) {
          return formatCreditsLabel(0.134, {
            suffix: '/Image',
            approximate: true
          })
        } else if (resolution.includes('2K')) {
          return formatCreditsLabel(0.134, {
            suffix: '/Image',
            approximate: true
          })
        } else if (resolution.includes('4K')) {
          return formatCreditsLabel(0.24, {
            suffix: '/Image',
            approximate: true
          })
        }
        return 'Token-based'
      }
    },
    // OpenAI nodes
    OpenAIChatNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget

        if (!modelWidget) return 'Token-based'

        const model = String(modelWidget.value)

        // Specific pricing for exposed models based on official pricing data (converted to per 1K tokens)
        if (model.includes('o4-mini')) {
          return formatCreditsListLabel([0.0011, 0.0044], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('o1-pro')) {
          return formatCreditsListLabel([0.15, 0.6], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('o1')) {
          return formatCreditsListLabel([0.015, 0.06], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('o3-mini')) {
          return formatCreditsListLabel([0.0011, 0.0044], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('o3')) {
          return formatCreditsListLabel([0.01, 0.04], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('gpt-4o')) {
          return formatCreditsListLabel([0.0025, 0.01], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('gpt-4.1-nano')) {
          return formatCreditsListLabel([0.0001, 0.0004], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('gpt-4.1-mini')) {
          return formatCreditsListLabel([0.0004, 0.0016], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('gpt-4.1')) {
          return formatCreditsListLabel([0.002, 0.008], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('gpt-5-nano')) {
          return formatCreditsListLabel([0.00005, 0.0004], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('gpt-5-mini')) {
          return formatCreditsListLabel([0.00025, 0.002], {
            suffix: ' per 1K tokens'
          })
        } else if (model.includes('gpt-5')) {
          return formatCreditsListLabel([0.00125, 0.01], {
            suffix: ' per 1K tokens'
          })
        }
        return 'Token-based'
      }
    },
    ViduTextToVideoNode: {
      displayPrice: formatCreditsLabel(0.4)
    },
    ViduImageToVideoNode: {
      displayPrice: formatCreditsLabel(0.4)
    },
    ViduReferenceVideoNode: {
      displayPrice: formatCreditsLabel(0.4)
    },
    ViduStartEndToVideoNode: {
      displayPrice: formatCreditsLabel(0.4)
    },
    ByteDanceImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget

        if (!modelWidget) return 'Token-based'

        const model = String(modelWidget.value)

        if (model.includes('seedream-3-0-t2i')) {
          return formatCreditsLabel(0.03)
        }
        return 'Token-based'
      }
    },
    ByteDanceImageEditNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget

        if (!modelWidget) return 'Token-based'

        const model = String(modelWidget.value)

        if (model.includes('seededit-3-0-i2i')) {
          return formatCreditsLabel(0.03)
        }
        return 'Token-based'
      }
    },
    ByteDanceSeedreamNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget

        const model = String(modelWidget?.value ?? '').toLowerCase()
        let pricePerImage = 0.03 // default for seedream-4-0-250828 and fallback
        if (model.includes('seedream-4-5-251128')) {
          pricePerImage = 0.04
        } else if (model.includes('seedream-4-0-250828')) {
          pricePerImage = 0.03
        }
        return formatCreditsLabel(pricePerImage, {
          suffix: ' x images/Run',
          approximate: true
        })
      }
    },
    ByteDanceTextToVideoNode: {
      displayPrice: byteDanceVideoPricingCalculator
    },
    ByteDanceImageToVideoNode: {
      displayPrice: byteDanceVideoPricingCalculator
    },
    ByteDanceFirstLastFrameNode: {
      displayPrice: byteDanceVideoPricingCalculator
    },
    ByteDanceImageReferenceNode: {
      displayPrice: byteDanceVideoPricingCalculator
    },
    WanTextToVideoApi: {
      displayPrice: (node: LGraphNode): string => {
        const durationWidget = node.widgets?.find(
          (w) => w.name === 'duration'
        ) as IComboWidget
        const resolutionWidget = node.widgets?.find(
          (w) => w.name === 'size'
        ) as IComboWidget

        if (!durationWidget || !resolutionWidget)
          return formatCreditsRangeLabel(0.05, 0.15, { suffix: '/second' })

        const seconds = parseFloat(String(durationWidget.value))
        const resolutionStr = String(resolutionWidget.value).toLowerCase()

        const resKey = resolutionStr.includes('1080')
          ? '1080p'
          : resolutionStr.includes('720')
            ? '720p'
            : resolutionStr.includes('480')
              ? '480p'
              : (resolutionStr.match(/^\s*(\d{3,4}p)/)?.[1] ?? '')

        const pricePerSecond: Record<string, number> = {
          '480p': 0.05,
          '720p': 0.1,
          '1080p': 0.15
        }

        const pps = pricePerSecond[resKey]
        if (isNaN(seconds) || !pps)
          return formatCreditsRangeLabel(0.05, 0.15, { suffix: '/second' })

        const cost = Number((pps * seconds).toFixed(2))
        return formatCreditsLabel(cost)
      }
    },
    WanImageToVideoApi: {
      displayPrice: (node: LGraphNode): string => {
        const durationWidget = node.widgets?.find(
          (w) => w.name === 'duration'
        ) as IComboWidget
        const resolutionWidget = node.widgets?.find(
          (w) => w.name === 'resolution'
        ) as IComboWidget

        if (!durationWidget || !resolutionWidget)
          return formatCreditsRangeLabel(0.05, 0.15, { suffix: '/second' })

        const seconds = parseFloat(String(durationWidget.value))
        const resolution = String(resolutionWidget.value).trim().toLowerCase()

        const pricePerSecond: Record<string, number> = {
          '480p': 0.05,
          '720p': 0.1,
          '1080p': 0.15
        }

        const pps = pricePerSecond[resolution]
        if (isNaN(seconds) || !pps)
          return formatCreditsRangeLabel(0.05, 0.15, { suffix: '/second' })

        const cost = Number((pps * seconds).toFixed(2))
        return formatCreditsLabel(cost)
      }
    },
    WanTextToImageApi: {
      displayPrice: formatCreditsLabel(0.03)
    },
    WanImageToImageApi: {
      displayPrice: formatCreditsLabel(0.03)
    },
    LtxvApiTextToVideo: {
      displayPrice: ltxvPricingCalculator
    },
    LtxvApiImageToVideo: {
      displayPrice: ltxvPricingCalculator
    }
  }

/**
 * Composable to get node pricing information for API nodes
 */
export const useNodePricing = () => {
  /**
   * Get the price display for a node
   */
  const getNodeDisplayPrice = (node: LGraphNode): string => {
    if (!node.constructor?.nodeData?.api_node) return ''

    const nodeName = node.constructor.nodeData.name
    const priceConfig = apiNodeCosts[nodeName]

    if (!priceConfig) return ''

    // If it's a function, call it with the node to get dynamic pricing
    if (typeof priceConfig.displayPrice === 'function') {
      return safePricingExecution(priceConfig.displayPrice, node, '')
    }

    // Otherwise return the static price
    return priceConfig.displayPrice
  }

  const getNodePricingConfig = (node: LGraphNode) =>
    apiNodeCosts[node.constructor.nodeData?.name ?? '']

  const getRelevantWidgetNames = (nodeType: string): string[] => {
    const widgetMap: Record<string, string[]> = {
      KlingTextToVideoNode: ['mode', 'model_name', 'duration'],
      KlingImage2VideoNode: ['mode', 'model_name', 'duration'],
      KlingImageGenerationNode: ['modality', 'model_name', 'n'],
      KlingDualCharacterVideoEffectNode: ['mode', 'model_name', 'duration'],
      KlingSingleImageVideoEffectNode: ['effect_scene'],
      KlingStartEndFrameNode: ['mode', 'model_name', 'duration'],
      KlingTextToVideoWithAudio: ['duration', 'generate_audio'],
      KlingImageToVideoWithAudio: ['duration', 'generate_audio'],
      KlingOmniProTextToVideoNode: ['duration'],
      KlingOmniProFirstLastFrameNode: ['duration'],
      KlingOmniProImageToVideoNode: ['duration'],
      KlingOmniProVideoToVideoNode: ['duration'],
      KlingMotionControl: ['mode'],
      MinimaxHailuoVideoNode: ['resolution', 'duration'],
      OpenAIDalle3: ['size', 'quality'],
      OpenAIDalle2: ['size', 'n'],
      OpenAIVideoSora2: ['model', 'size', 'duration'],
      OpenAIGPTImage1: ['quality', 'n'],
      IdeogramV1: ['num_images', 'turbo'],
      IdeogramV2: ['num_images', 'turbo'],
      IdeogramV3: ['rendering_speed', 'num_images', 'character_image'],
      FluxProKontextProNode: [],
      FluxProKontextMaxNode: [],
      Flux2ProImageNode: ['width', 'height', 'images'],
      Flux2MaxImageNode: ['width', 'height', 'images'],
      VeoVideoGenerationNode: ['duration_seconds'],
      Veo3VideoGenerationNode: ['model', 'generate_audio'],
      Veo3FirstLastFrameNode: ['model', 'generate_audio', 'duration'],
      LumaVideoNode: ['model', 'resolution', 'duration'],
      LumaImageToVideoNode: ['model', 'resolution', 'duration'],
      LumaImageNode: ['model', 'aspect_ratio'],
      LumaImageModifyNode: ['model', 'aspect_ratio'],
      PixverseTextToVideoNode: ['duration_seconds', 'quality', 'motion_mode'],
      PixverseTransitionVideoNode: [
        'duration_seconds',
        'motion_mode',
        'quality'
      ],
      PixverseImageToVideoNode: ['duration_seconds', 'quality', 'motion_mode'],
      StabilityStableImageSD_3_5Node: ['model'],
      RecraftTextToImageNode: ['n'],
      RecraftImageToImageNode: ['n'],
      RecraftImageInpaintingNode: ['n'],
      RecraftTextToVectorNode: ['n'],
      RecraftVectorizeImageNode: ['n'],
      RecraftGenerateColorFromImageNode: ['n'],
      RecraftGenerateImageNode: ['n'],
      RecraftGenerateVectorImageNode: ['n'],
      MoonvalleyTxt2VideoNode: ['length'],
      MoonvalleyImg2VideoNode: ['length'],
      MoonvalleyVideo2VideoNode: ['length'],
      // Runway nodes
      RunwayImageToVideoNodeGen3a: ['duration'],
      RunwayImageToVideoNodeGen4: ['duration'],
      RunwayFirstLastFrameNode: ['duration'],
      // Tripo nodes
      TripoTextToModelNode: [
        'model_version',
        'quad',
        'style',
        'texture',
        'pbr',
        'texture_quality',
        'geometry_quality'
      ],
      TripoImageToModelNode: [
        'model_version',
        'quad',
        'style',
        'texture',
        'pbr',
        'texture_quality',
        'geometry_quality'
      ],
      TripoMultiviewToModelNode: [
        'model_version',
        'quad',
        'texture',
        'pbr',
        'texture_quality',
        'geometry_quality'
      ],
      TripoConversionNode: [
        'quad',
        'face_limit',
        'texture_size',
        'texture_format',
        'force_symmetry',
        'flatten_bottom',
        'flatten_bottom_threshold',
        'pivot_to_center_bottom',
        'scale_factor',
        'with_animation',
        'pack_uv',
        'bake',
        'part_names',
        'fbx_preset',
        'export_vertex_colors',
        'export_orientation',
        'animate_in_place'
      ],
      TripoTextureNode: ['texture_quality'],
      // Google/Gemini nodes
      GeminiNode: ['model'],
      GeminiImage2Node: ['resolution'],
      // OpenAI nodes
      OpenAIChatNode: ['model'],
      // ByteDance
      ByteDanceImageNode: ['model'],
      ByteDanceImageEditNode: ['model'],
      ByteDanceSeedreamNode: [
        'model',
        'sequential_image_generation',
        'max_images'
      ],
      ByteDanceTextToVideoNode: ['model', 'duration', 'resolution'],
      ByteDanceImageToVideoNode: ['model', 'duration', 'resolution'],
      ByteDanceFirstLastFrameNode: ['model', 'duration', 'resolution'],
      ByteDanceImageReferenceNode: ['model', 'duration', 'resolution'],
      WanTextToVideoApi: ['duration', 'size'],
      WanImageToVideoApi: ['duration', 'resolution'],
      LtxvApiTextToVideo: ['model', 'duration', 'resolution'],
      LtxvApiImageToVideo: ['model', 'duration', 'resolution']
    }
    return widgetMap[nodeType] || []
  }

  return {
    getNodeDisplayPrice,
    getNodePricingConfig,
    getRelevantWidgetNames
  }
}
