import type { INodeInputSlot, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IComboWidget } from '@/lib/litegraph/src/types/widgets'

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

  if (!durationWidget) return '$0.0715/second'

  const duration = Number(durationWidget.value)
  // If duration is 0 or NaN, don't fall back to 5 seconds - just use 0
  const validDuration = isNaN(duration) ? 5 : duration
  const cost = (0.0715 * validDuration).toFixed(2)
  return `$${cost}/Run`
}

const makeOmniProDurationCalculator =
  (pricePerSecond: number): PricingFunction =>
  (node: LGraphNode): string => {
    const durationWidget = node.widgets?.find(
      (w) => w.name === 'duration'
    ) as IComboWidget
    if (!durationWidget) return `$${pricePerSecond.toFixed(3)}/second`

    const seconds = parseFloat(String(durationWidget.value))
    if (!Number.isFinite(seconds)) return `$${pricePerSecond.toFixed(3)}/second`

    const cost = pricePerSecond * seconds
    return `$${cost.toFixed(2)}/Run`
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
    return '$0.45-1.2/Run (varies with duration, quality & motion mode)'
  }

  const duration = String(durationWidget.value)
  const quality = String(qualityWidget.value)
  const motionMode = String(motionModeWidget?.value)

  // Basic pricing based on duration and quality
  if (duration.includes('5')) {
    if (quality.includes('1080p')) return '$1.2/Run'
    if (quality.includes('720p') && motionMode?.includes('fast'))
      return '$1.2/Run'
    if (quality.includes('720p') && motionMode?.includes('normal'))
      return '$0.6/Run'
    if (quality.includes('540p') && motionMode?.includes('fast'))
      return '$0.9/Run'
    if (quality.includes('540p') && motionMode?.includes('normal'))
      return '$0.45/Run'
    if (quality.includes('360p') && motionMode?.includes('fast'))
      return '$0.9/Run'
    if (quality.includes('360p') && motionMode?.includes('normal'))
      return '$0.45/Run'
    if (quality.includes('720p') && motionMode?.includes('fast'))
      return '$1.2/Run'
  } else if (duration.includes('8')) {
    if (quality.includes('720p') && motionMode?.includes('normal'))
      return '$1.2/Run'
    if (quality.includes('540p') && motionMode?.includes('normal'))
      return '$0.9/Run'
    if (quality.includes('540p') && motionMode?.includes('fast'))
      return '$1.2/Run'
    if (quality.includes('360p') && motionMode?.includes('normal'))
      return '$0.9/Run'
    if (quality.includes('360p') && motionMode?.includes('fast'))
      return '$1.2/Run'
    if (quality.includes('1080p') && motionMode?.includes('normal'))
      return '$1.2/Run'
    if (quality.includes('1080p') && motionMode?.includes('fast'))
      return '$1.2/Run'
    if (quality.includes('720p') && motionMode?.includes('normal'))
      return '$1.2/Run'
    if (quality.includes('720p') && motionMode?.includes('fast'))
      return '$1.2/Run'
  }

  return '$0.9/Run'
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

  const minStr = `$${minCost.toFixed(2)}/Run`
  const maxStr = `$${maxCost.toFixed(2)}/Run`

  return minStr === maxStr
    ? minStr
    : `$${minCost.toFixed(2)}-$${maxCost.toFixed(2)}/Run`
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

  const fallback = '$0.04-0.24/second'
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

  const cost = (pps * seconds).toFixed(2)
  return `$${cost}/Run`
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
    return '$0.35-1.40/Run (varies with duration & audio)'
  }

  const duration = String(durationWidget.value)
  const generateAudio =
    String(generateAudioWidget.value).toLowerCase() === 'true'

  if (duration === '5') {
    return generateAudio ? '$0.70/Run' : '$0.35/Run'
  }

  if (duration === '10') {
    return generateAudio ? '$1.40/Run' : '$0.70/Run'
  }

  // Fallback for unexpected duration values
  return '$0.35-1.40/Run (varies with duration & audio)'
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
  return `$${(perSec * duration).toFixed(2)}/Run`
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
    return '$0.1-0.65/Run (varies with quad, style, texture & quality)'
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
  return `$${dollars.toFixed(2)}/Run`
}

/**
 * Static pricing data for API nodes, now supporting both strings and functions
 */
const apiNodeCosts: Record<string, { displayPrice: string | PricingFunction }> =
  {
    FluxProCannyNode: {
      displayPrice: '$0.05/Run'
    },
    FluxProDepthNode: {
      displayPrice: '$0.05/Run'
    },
    FluxProExpandNode: {
      displayPrice: '$0.05/Run'
    },
    FluxProFillNode: {
      displayPrice: '$0.05/Run'
    },
    FluxProUltraImageNode: {
      displayPrice: '$0.06/Run'
    },
    FluxProKontextProNode: {
      displayPrice: '$0.04/Run'
    },
    FluxProKontextMaxNode: {
      displayPrice: '$0.08/Run'
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
          return '$0.03–$0.15/Run'
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
          return `~$${parseFloat(minTotal.toFixed(3))}–$${parseFloat(maxTotal.toFixed(3))}/Run`
        }

        // Precise text-to-image price
        return `$${parseFloat(outputCost.toFixed(3))}/Run`
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

        if (!numImagesWidget) return '$0.03-0.09 x num_images/Run'

        const numImages = Number(numImagesWidget.value) || 1
        const turbo = String(turboWidget?.value).toLowerCase() === 'true'
        const basePrice = turbo ? 0.0286 : 0.0858
        const cost = (basePrice * numImages).toFixed(2)
        return `$${cost}/Run`
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

        if (!numImagesWidget) return '$0.07-0.11 x num_images/Run'

        const numImages = Number(numImagesWidget.value) || 1
        const turbo = String(turboWidget?.value).toLowerCase() === 'true'
        const basePrice = turbo ? 0.0715 : 0.1144
        const cost = (basePrice * numImages).toFixed(2)
        return `$${cost}/Run`
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
          return '$0.04-0.11 x num_images/Run (varies with rendering speed & num_images)'

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

        const totalCost = (basePrice * numImages).toFixed(2)
        return `$${totalCost}/Run`
      }
    },
    KlingCameraControlI2VNode: {
      displayPrice: '$0.49/Run'
    },
    KlingCameraControlT2VNode: {
      displayPrice: '$0.14/Run'
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
          return '$0.14-2.80/Run (varies with model, mode & duration)'

        const modeValue = String(modeWidget.value)
        const durationValue = String(durationWidget.value)
        const modelValue = String(modelWidget.value)

        // Same pricing matrix as KlingTextToVideoNode
        if (modelValue.includes('v1-6') || modelValue.includes('v1-5')) {
          if (modeValue.includes('pro')) {
            return durationValue.includes('10') ? '$0.98/Run' : '$0.49/Run'
          } else {
            return durationValue.includes('10') ? '$0.56/Run' : '$0.28/Run'
          }
        } else if (modelValue.includes('v1')) {
          if (modeValue.includes('pro')) {
            return durationValue.includes('10') ? '$0.98/Run' : '$0.49/Run'
          } else {
            return durationValue.includes('10') ? '$0.28/Run' : '$0.14/Run'
          }
        }

        return '$0.14/Run'
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
            return '$0.14-2.80/Run (varies with model, mode & duration)'

          const modelValue = String(modelWidget.value)
          if (
            modelValue.includes('v2-1-master') ||
            modelValue.includes('v2-master')
          ) {
            return '$1.40/Run'
          } else if (
            modelValue.includes('v1-6') ||
            modelValue.includes('v1-5')
          ) {
            return '$0.28/Run'
          }
          return '$0.14/Run'
        }

        const modeValue = String(modeWidget.value)
        const durationValue = String(durationWidget.value)
        const modelValue = String(modelWidget.value)

        // Same pricing matrix as KlingTextToVideoNode
        if (modelValue.includes('v2-5-turbo')) {
          if (durationValue.includes('10')) {
            return '$0.70/Run'
          }
          return '$0.35/Run' // 5s default
        } else if (
          modelValue.includes('v2-1-master') ||
          modelValue.includes('v2-master')
        ) {
          if (durationValue.includes('10')) {
            return '$2.80/Run'
          }
          return '$1.40/Run' // 5s default
        } else if (
          modelValue.includes('v2-1') ||
          modelValue.includes('v1-6') ||
          modelValue.includes('v1-5')
        ) {
          if (modeValue.includes('pro')) {
            return durationValue.includes('10') ? '$0.98/Run' : '$0.49/Run'
          } else {
            return durationValue.includes('10') ? '$0.56/Run' : '$0.28/Run'
          }
        } else if (modelValue.includes('v1')) {
          if (modeValue.includes('pro')) {
            return durationValue.includes('10') ? '$0.98/Run' : '$0.49/Run'
          } else {
            return durationValue.includes('10') ? '$0.28/Run' : '$0.14/Run'
          }
        }

        return '$0.14/Run'
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
          return '$0.0035-0.028 x n/Run (varies with modality & model)'

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

        const totalCost = (basePrice * n).toFixed(4)
        return `$${totalCost}/Run`
      }
    },
    KlingLipSyncAudioToVideoNode: {
      displayPrice: '~$0.10/Run'
    },
    KlingLipSyncTextToVideoNode: {
      displayPrice: '~$0.10/Run'
    },
    KlingSingleImageVideoEffectNode: {
      displayPrice: (node: LGraphNode): string => {
        const effectSceneWidget = node.widgets?.find(
          (w) => w.name === 'effect_scene'
        ) as IComboWidget

        if (!effectSceneWidget)
          return '$0.28-0.49/Run (varies with effect scene)'

        const effectScene = String(effectSceneWidget.value)
        if (
          effectScene.includes('fuzzyfuzzy') ||
          effectScene.includes('squish')
        ) {
          return '$0.28/Run'
        } else if (effectScene.includes('dizzydizzy')) {
          return '$0.49/Run'
        } else if (effectScene.includes('bloombloom')) {
          return '$0.49/Run'
        } else if (effectScene.includes('expansion')) {
          return '$0.28/Run'
        }

        return '$0.28/Run'
      }
    },
    KlingStartEndFrameNode: {
      displayPrice: (node: LGraphNode): string => {
        // Same pricing as KlingTextToVideoNode per CSV ("Same as text to video")
        const modeWidget = node.widgets?.find(
          (w) => w.name === 'mode'
        ) as IComboWidget
        if (!modeWidget)
          return '$0.14-2.80/Run (varies with model, mode & duration)'

        const modeValue = String(modeWidget.value)

        // Same pricing matrix as KlingTextToVideoNode
        if (modeValue.includes('v2-5-turbo')) {
          if (modeValue.includes('10')) {
            return '$0.70/Run'
          }
          return '$0.35/Run' // 5s default
        } else if (modeValue.includes('v2-1')) {
          if (modeValue.includes('10s')) {
            return '$0.98/Run' // pro, 10s
          }
          return '$0.49/Run' // pro, 5s default
        } else if (modeValue.includes('v2-master')) {
          if (modeValue.includes('10s')) {
            return '$2.80/Run'
          }
          return '$1.40/Run' // 5s default
        } else if (modeValue.includes('v1-6')) {
          if (modeValue.includes('pro')) {
            return modeValue.includes('10s') ? '$0.98/Run' : '$0.49/Run'
          } else {
            return modeValue.includes('10s') ? '$0.56/Run' : '$0.28/Run'
          }
        } else if (modeValue.includes('v1')) {
          if (modeValue.includes('pro')) {
            return modeValue.includes('10s') ? '$0.98/Run' : '$0.49/Run'
          } else {
            return modeValue.includes('10s') ? '$0.28/Run' : '$0.14/Run'
          }
        }

        return '$0.14/Run'
      }
    },
    KlingTextToVideoNode: {
      displayPrice: (node: LGraphNode): string => {
        const modeWidget = node.widgets?.find(
          (w) => w.name === 'mode'
        ) as IComboWidget
        if (!modeWidget)
          return '$0.14-2.80/Run (varies with model, mode & duration)'

        const modeValue = String(modeWidget.value)

        // Pricing matrix from CSV data based on mode string content
        if (modeValue.includes('v2-5-turbo')) {
          if (modeValue.includes('10')) {
            return '$0.70/Run'
          }
          return '$0.35/Run' // 5s default
        } else if (modeValue.includes('v2-1-master')) {
          if (modeValue.includes('10s')) {
            return '$2.80/Run' // price is the same as for v2-master model
          }
          return '$1.40/Run' // price is the same as for v2-master model
        } else if (modeValue.includes('v2-master')) {
          if (modeValue.includes('10s')) {
            return '$2.80/Run'
          }
          return '$1.40/Run' // 5s default
        } else if (modeValue.includes('v1-6')) {
          if (modeValue.includes('pro')) {
            return modeValue.includes('10s') ? '$0.98/Run' : '$0.49/Run'
          } else {
            return modeValue.includes('10s') ? '$0.56/Run' : '$0.28/Run'
          }
        } else if (modeValue.includes('v1')) {
          if (modeValue.includes('pro')) {
            return modeValue.includes('10s') ? '$0.98/Run' : '$0.49/Run'
          } else {
            return modeValue.includes('10s') ? '$0.28/Run' : '$0.14/Run'
          }
        }

        return '$0.14/Run'
      }
    },
    KlingVideoExtendNode: {
      displayPrice: '$0.28/Run'
    },
    KlingVirtualTryOnNode: {
      displayPrice: '$0.07/Run'
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
    KlingOmniProEditVideoNode: {
      displayPrice: '$0.168/second'
    },
    KlingOmniProImageNode: {
      displayPrice: '$0.028/Run'
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
          return '$0.20-16.40/Run (varies with model, resolution & duration)'
        }

        const model = String(modelWidget.value)
        const resolution = String(resolutionWidget.value).toLowerCase()
        const duration = String(durationWidget.value)

        if (model.includes('ray-flash-2')) {
          if (duration.includes('5s')) {
            if (resolution.includes('4k')) return '$3.13/Run'
            if (resolution.includes('1080p')) return '$0.79/Run'
            if (resolution.includes('720p')) return '$0.34/Run'
            if (resolution.includes('540p')) return '$0.20/Run'
          } else if (duration.includes('9s')) {
            if (resolution.includes('4k')) return '$5.65/Run'
            if (resolution.includes('1080p')) return '$1.42/Run'
            if (resolution.includes('720p')) return '$0.61/Run'
            if (resolution.includes('540p')) return '$0.36/Run'
          }
        } else if (model.includes('ray-2')) {
          if (duration.includes('5s')) {
            if (resolution.includes('4k')) return '$9.11/Run'
            if (resolution.includes('1080p')) return '$2.27/Run'
            if (resolution.includes('720p')) return '$1.02/Run'
            if (resolution.includes('540p')) return '$0.57/Run'
          } else if (duration.includes('9s')) {
            if (resolution.includes('4k')) return '$16.40/Run'
            if (resolution.includes('1080p')) return '$4.10/Run'
            if (resolution.includes('720p')) return '$1.83/Run'
            if (resolution.includes('540p')) return '$1.03/Run'
          }
        } else if (model.includes('ray-1-6')) {
          return '$0.50/Run'
        }

        return '$0.79/Run'
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
          return '$0.20-16.40/Run (varies with model, resolution & duration)'
        }

        const model = String(modelWidget.value)
        const resolution = String(resolutionWidget.value).toLowerCase()
        const duration = String(durationWidget.value)

        if (model.includes('ray-flash-2')) {
          if (duration.includes('5s')) {
            if (resolution.includes('4k')) return '$3.13/Run'
            if (resolution.includes('1080p')) return '$0.79/Run'
            if (resolution.includes('720p')) return '$0.34/Run'
            if (resolution.includes('540p')) return '$0.20/Run'
          } else if (duration.includes('9s')) {
            if (resolution.includes('4k')) return '$5.65/Run'
            if (resolution.includes('1080p')) return '$1.42/Run'
            if (resolution.includes('720p')) return '$0.61/Run'
            if (resolution.includes('540p')) return '$0.36/Run'
          }
        } else if (model.includes('ray-2')) {
          if (duration.includes('5s')) {
            if (resolution.includes('4k')) return '$9.11/Run'
            if (resolution.includes('1080p')) return '$2.27/Run'
            if (resolution.includes('720p')) return '$1.02/Run'
            if (resolution.includes('540p')) return '$0.57/Run'
          } else if (duration.includes('9s')) {
            if (resolution.includes('4k')) return '$16.40/Run'
            if (resolution.includes('1080p')) return '$4.10/Run'
            if (resolution.includes('720p')) return '$1.83/Run'
            if (resolution.includes('540p')) return '$1.03/Run'
          }
        } else if (model.includes('ray-1-6')) {
          return '$0.50/Run'
        }

        return '$0.79/Run'
      }
    },
    MinimaxImageToVideoNode: {
      displayPrice: '$0.43/Run'
    },
    MinimaxTextToVideoNode: {
      displayPrice: '$0.43/Run'
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
          return '$0.28-0.56/Run (varies with resolution & duration)'
        }

        const resolution = String(resolutionWidget.value)
        const duration = String(durationWidget.value)

        if (resolution.includes('768P')) {
          if (duration.includes('6')) return '$0.28/Run'
          if (duration.includes('10')) return '$0.56/Run'
        } else if (resolution.includes('1080P')) {
          if (duration.includes('6')) return '$0.49/Run'
        }

        return '$0.43/Run' // default median
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

        if (!sizeWidget) return '$0.016-0.02 x n/Run (varies with size & n)'

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

        const totalCost = (basePrice * n).toFixed(3)
        return `$${totalCost}/Run`
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
          return '$0.04-0.12/Run (varies with size & quality)'

        const size = String(sizeWidget.value)
        const quality = String(qualityWidget.value)

        // Pricing matrix based on CSV data
        if (size.includes('1024x1024')) {
          return quality.includes('hd') ? '$0.08/Run' : '$0.04/Run'
        } else if (size.includes('1792x1024') || size.includes('1024x1792')) {
          return quality.includes('hd') ? '$0.12/Run' : '$0.08/Run'
        }

        // Default value
        return '$0.04/Run'
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
          return '$0.011-0.30 x n/Run (varies with quality & n)'

        const quality = String(qualityWidget.value)
        const n = Number(nWidget?.value) || 1
        let basePriceRange = '$0.046-0.07' // default medium

        if (quality.includes('high')) {
          basePriceRange = '$0.167-0.30'
        } else if (quality.includes('medium')) {
          basePriceRange = '$0.046-0.07'
        } else if (quality.includes('low')) {
          basePriceRange = '$0.011-0.02'
        }

        if (n === 1) {
          return `${basePriceRange}/Run`
        } else {
          return `${basePriceRange} x ${n}/Run`
        }
      }
    },
    PikaImageToVideoNode2_2: {
      displayPrice: (node: LGraphNode): string => {
        const durationWidget = node.widgets?.find(
          (w) => w.name === 'duration'
        ) as IComboWidget
        const resolutionWidget = node.widgets?.find(
          (w) => w.name === 'resolution'
        ) as IComboWidget

        if (!durationWidget || !resolutionWidget) {
          return '$0.2-1.0/Run (varies with duration & resolution)'
        }

        const duration = String(durationWidget.value)
        const resolution = String(resolutionWidget.value)

        if (duration.includes('5')) {
          if (resolution.includes('1080p')) return '$0.45/Run'
          if (resolution.includes('720p')) return '$0.2/Run'
        } else if (duration.includes('10')) {
          if (resolution.includes('1080p')) return '$1.0/Run'
          if (resolution.includes('720p')) return '$0.6/Run'
        }

        return '$0.2/Run'
      }
    },
    PikaScenesV2_2: {
      displayPrice: (node: LGraphNode): string => {
        const durationWidget = node.widgets?.find(
          (w) => w.name === 'duration'
        ) as IComboWidget
        const resolutionWidget = node.widgets?.find(
          (w) => w.name === 'resolution'
        ) as IComboWidget

        if (!durationWidget || !resolutionWidget) {
          return '$0.2-1.0/Run (varies with duration & resolution)'
        }

        const duration = String(durationWidget.value)
        const resolution = String(resolutionWidget.value)

        if (duration.includes('5')) {
          if (resolution.includes('720p')) return '$0.3/Run'
          if (resolution.includes('1080p')) return '$0.5/Run'
        } else if (duration.includes('10')) {
          if (resolution.includes('720p')) return '$0.4/Run'
          if (resolution.includes('1080p')) return '$1.5/Run'
        }

        return '$0.3/Run'
      }
    },
    PikaStartEndFrameNode2_2: {
      displayPrice: (node: LGraphNode): string => {
        const durationWidget = node.widgets?.find(
          (w) => w.name === 'duration'
        ) as IComboWidget
        const resolutionWidget = node.widgets?.find(
          (w) => w.name === 'resolution'
        ) as IComboWidget

        if (!durationWidget || !resolutionWidget) {
          return '$0.2-1.0/Run (varies with duration & resolution)'
        }

        const duration = String(durationWidget.value)
        const resolution = String(resolutionWidget.value)

        if (duration.includes('5')) {
          if (resolution.includes('720p')) return '$0.2/Run'
          if (resolution.includes('1080p')) return '$0.3/Run'
        } else if (duration.includes('10')) {
          if (resolution.includes('720p')) return '$0.25/Run'
          if (resolution.includes('1080p')) return '$1.0/Run'
        }

        return '$0.2/Run'
      }
    },
    PikaTextToVideoNode2_2: {
      displayPrice: (node: LGraphNode): string => {
        const durationWidget = node.widgets?.find(
          (w) => w.name === 'duration'
        ) as IComboWidget
        const resolutionWidget = node.widgets?.find(
          (w) => w.name === 'resolution'
        ) as IComboWidget

        if (!durationWidget || !resolutionWidget) {
          return '$0.2-1.5/Run (varies with duration & resolution)'
        }

        const duration = String(durationWidget.value)
        const resolution = String(resolutionWidget.value)

        if (duration.includes('5')) {
          if (resolution.includes('1080p')) return '$0.45/Run'
          if (resolution.includes('720p')) return '$0.2/Run'
        } else if (duration.includes('10')) {
          if (resolution.includes('1080p')) return '$1.0/Run'
          if (resolution.includes('720p')) return '$0.6/Run'
        }

        return '$0.45/Run'
      }
    },
    Pikadditions: {
      displayPrice: '$0.3/Run'
    },
    Pikaffects: {
      displayPrice: '$0.45/Run'
    },
    Pikaswaps: {
      displayPrice: '$0.3/Run'
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
      displayPrice: '$0.25/Run'
    },
    RecraftCrispUpscaleNode: {
      displayPrice: '$0.004/Run'
    },
    RecraftGenerateColorFromImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return '$0.04 x n/Run'

        const n = Number(nWidget.value) || 1
        const cost = (0.04 * n).toFixed(2)
        return `$${cost}/Run`
      }
    },
    RecraftGenerateImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return '$0.04 x n/Run'

        const n = Number(nWidget.value) || 1
        const cost = (0.04 * n).toFixed(2)
        return `$${cost}/Run`
      }
    },
    RecraftGenerateVectorImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return '$0.08 x n/Run'

        const n = Number(nWidget.value) || 1
        const cost = (0.08 * n).toFixed(2)
        return `$${cost}/Run`
      }
    },
    RecraftImageInpaintingNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return '$0.04 x n/Run'

        const n = Number(nWidget.value) || 1
        const cost = (0.04 * n).toFixed(2)
        return `$${cost}/Run`
      }
    },
    RecraftImageToImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return '$0.04 x n/Run'

        const n = Number(nWidget.value) || 1
        const cost = (0.04 * n).toFixed(2)
        return `$${cost}/Run`
      }
    },
    RecraftRemoveBackgroundNode: {
      displayPrice: '$0.01/Run'
    },
    RecraftReplaceBackgroundNode: {
      displayPrice: '$0.04/Run'
    },
    RecraftTextToImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return '$0.04 x n/Run'

        const n = Number(nWidget.value) || 1
        const cost = (0.04 * n).toFixed(2)
        return `$${cost}/Run`
      }
    },
    RecraftTextToVectorNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return '$0.08 x n/Run'

        const n = Number(nWidget.value) || 1
        const cost = (0.08 * n).toFixed(2)
        return `$${cost}/Run`
      }
    },
    RecraftVectorizeImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const nWidget = node.widgets?.find(
          (w) => w.name === 'n'
        ) as IComboWidget
        if (!nWidget) return '$0.01 x n/Run'

        const n = Number(nWidget.value) || 1
        const cost = (0.01 * n).toFixed(2)
        return `$${cost}/Run`
      }
    },
    StabilityStableImageSD_3_5Node: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget

        if (!modelWidget) return '$0.035-0.065/Run (varies with model)'

        const model = String(modelWidget.value).toLowerCase()
        if (model.includes('large')) {
          return '$0.065/Run'
        } else if (model.includes('medium')) {
          return '$0.035/Run'
        }

        return '$0.035/Run'
      }
    },
    StabilityStableImageUltraNode: {
      displayPrice: '$0.08/Run'
    },
    StabilityUpscaleConservativeNode: {
      displayPrice: '$0.25/Run'
    },
    StabilityUpscaleCreativeNode: {
      displayPrice: '$0.25/Run'
    },
    StabilityUpscaleFastNode: {
      displayPrice: '$0.01/Run'
    },
    StabilityTextToAudio: {
      displayPrice: '$0.20/Run'
    },
    StabilityAudioToAudio: {
      displayPrice: '$0.20/Run'
    },
    StabilityAudioInpaint: {
      displayPrice: '$0.20/Run'
    },
    VeoVideoGenerationNode: {
      displayPrice: (node: LGraphNode): string => {
        const durationWidget = node.widgets?.find(
          (w) => w.name === 'duration_seconds'
        ) as IComboWidget

        if (!durationWidget) return '$2.50-5.0/Run (varies with duration)'

        const price = 0.5 * Number(durationWidget.value)
        return `$${price.toFixed(2)}/Run`
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
          return '$0.80-3.20/Run (varies with model & audio generation)'
        }

        const model = String(modelWidget.value)
        const generateAudio =
          String(generateAudioWidget.value).toLowerCase() === 'true'

        if (
          model.includes('veo-3.0-fast-generate-001') ||
          model.includes('veo-3.1-fast-generate')
        ) {
          return generateAudio ? '$1.20/Run' : '$0.80/Run'
        } else if (
          model.includes('veo-3.0-generate-001') ||
          model.includes('veo-3.1-generate')
        ) {
          return generateAudio ? '$3.20/Run' : '$1.60/Run'
        }

        // Default fallback
        return '$0.80-3.20/Run'
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
          return '$0.40-3.20/Run (varies with model & audio generation)'
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
          return '$0.40-3.20/Run'
        }
        const cost = pricePerSecond * seconds
        return `$${cost.toFixed(2)}/Run`
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
          return '$0.0064-0.026/Run (varies with model & aspect ratio)'
        }

        const model = String(modelWidget.value)

        if (model.includes('photon-flash-1')) {
          return '$0.0027/Run'
        } else if (model.includes('photon-1')) {
          return '$0.0104/Run'
        }

        return '$0.0246/Run'
      }
    },
    LumaImageModifyNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget

        if (!modelWidget) {
          return '$0.0027-0.0104/Run (varies with model)'
        }

        const model = String(modelWidget.value)

        if (model.includes('photon-flash-1')) {
          return '$0.0027/Run'
        } else if (model.includes('photon-1')) {
          return '$0.0104/Run'
        }

        return '$0.0246/Run'
      }
    },
    MoonvalleyTxt2VideoNode: {
      displayPrice: (node: LGraphNode): string => {
        const lengthWidget = node.widgets?.find(
          (w) => w.name === 'length'
        ) as IComboWidget

        // If no length widget exists, default to 5s pricing
        if (!lengthWidget) return '$1.50/Run'

        const length = String(lengthWidget.value)
        if (length === '5s') {
          return '$1.50/Run'
        } else if (length === '10s') {
          return '$3.00/Run'
        }

        return '$1.50/Run'
      }
    },
    MoonvalleyImg2VideoNode: {
      displayPrice: (node: LGraphNode): string => {
        const lengthWidget = node.widgets?.find(
          (w) => w.name === 'length'
        ) as IComboWidget

        // If no length widget exists, default to 5s pricing
        if (!lengthWidget) return '$1.50/Run'

        const length = String(lengthWidget.value)
        if (length === '5s') {
          return '$1.50/Run'
        } else if (length === '10s') {
          return '$3.00/Run'
        }

        return '$1.50/Run'
      }
    },
    MoonvalleyVideo2VideoNode: {
      displayPrice: (node: LGraphNode): string => {
        const lengthWidget = node.widgets?.find(
          (w) => w.name === 'length'
        ) as IComboWidget

        // If no length widget exists, default to 5s pricing
        if (!lengthWidget) return '$2.25/Run'

        const length = String(lengthWidget.value)
        if (length === '5s') {
          return '$2.25/Run'
        } else if (length === '10s') {
          return '$4.00/Run'
        }

        return '$2.25/Run'
      }
    },
    // Runway nodes - using actual node names from ComfyUI
    RunwayTextToImageNode: {
      displayPrice: '$0.11/Run'
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
      displayPrice: '$0.4/Run'
    },
    Rodin3D_Detail: {
      displayPrice: '$0.4/Run'
    },
    Rodin3D_Smooth: {
      displayPrice: '$0.4/Run'
    },
    Rodin3D_Sketch: {
      displayPrice: '$0.4/Run'
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

        if (!textureQualityWidget) return '$0.1-0.2/Run (varies with quality)'

        const textureQuality = String(textureQualityWidget.value)
        return textureQuality.includes('detailed') ? '$0.2/Run' : '$0.1/Run'
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
        const dollars = credits * 0.01
        return `$${dollars.toFixed(2)}/Run`
      }
    },
    TripoRetargetNode: {
      displayPrice: '$0.10/Run'
    },
    TripoRefineNode: {
      displayPrice: '$0.30/Run'
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
          return '$0.5/second'
        } else if (model.includes('gemini-2.5-flash-preview-04-17')) {
          return '$0.0003/$0.0025 per 1K tokens'
        } else if (model.includes('gemini-2.5-flash')) {
          return '$0.0003/$0.0025 per 1K tokens'
        } else if (model.includes('gemini-2.5-pro-preview-05-06')) {
          return '$0.00125/$0.01 per 1K tokens'
        } else if (model.includes('gemini-2.5-pro')) {
          return '$0.00125/$0.01 per 1K tokens'
        } else if (model.includes('gemini-3-pro-preview')) {
          return '$0.002/$0.012 per 1K tokens'
        }
        // For other Gemini models, show token-based pricing info
        return 'Token-based'
      }
    },
    GeminiImageNode: {
      displayPrice: '~$0.039/Image (1K)'
    },
    GeminiImage2Node: {
      displayPrice: (node: LGraphNode): string => {
        const resolutionWidget = node.widgets?.find(
          (w) => w.name === 'resolution'
        ) as IComboWidget

        if (!resolutionWidget) return 'Token-based'

        const resolution = String(resolutionWidget.value)
        if (resolution.includes('1K')) {
          return '~$0.134/Image'
        } else if (resolution.includes('2K')) {
          return '~$0.134/Image'
        } else if (resolution.includes('4K')) {
          return '~$0.24/Image'
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
          return '$0.0011/$0.0044 per 1K tokens'
        } else if (model.includes('o1-pro')) {
          return '$0.15/$0.60 per 1K tokens'
        } else if (model.includes('o1')) {
          return '$0.015/$0.06 per 1K tokens'
        } else if (model.includes('o3-mini')) {
          return '$0.0011/$0.0044 per 1K tokens'
        } else if (model.includes('o3')) {
          return '$0.01/$0.04 per 1K tokens'
        } else if (model.includes('gpt-4o')) {
          return '$0.0025/$0.01 per 1K tokens'
        } else if (model.includes('gpt-4.1-nano')) {
          return '$0.0001/$0.0004 per 1K tokens'
        } else if (model.includes('gpt-4.1-mini')) {
          return '$0.0004/$0.0016 per 1K tokens'
        } else if (model.includes('gpt-4.1')) {
          return '$0.002/$0.008 per 1K tokens'
        } else if (model.includes('gpt-5-nano')) {
          return '$0.00005/$0.0004 per 1K tokens'
        } else if (model.includes('gpt-5-mini')) {
          return '$0.00025/$0.002 per 1K tokens'
        } else if (model.includes('gpt-5')) {
          return '$0.00125/$0.01 per 1K tokens'
        }
        return 'Token-based'
      }
    },
    ViduTextToVideoNode: {
      displayPrice: '$0.4/Run'
    },
    ViduImageToVideoNode: {
      displayPrice: '$0.4/Run'
    },
    ViduReferenceVideoNode: {
      displayPrice: '$0.4/Run'
    },
    ViduStartEndToVideoNode: {
      displayPrice: '$0.4/Run'
    },
    ByteDanceImageNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget

        if (!modelWidget) return 'Token-based'

        const model = String(modelWidget.value)

        if (model.includes('seedream-3-0-t2i')) {
          return '$0.03/Run'
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
          return '$0.03/Run'
        }
        return 'Token-based'
      }
    },
    ByteDanceSeedreamNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget
        const sequentialGenerationWidget = node.widgets?.find(
          (w) => w.name === 'sequential_image_generation'
        ) as IComboWidget
        const maxImagesWidget = node.widgets?.find(
          (w) => w.name === 'max_images'
        ) as IComboWidget

        const model = String(modelWidget?.value ?? '').toLowerCase()
        let pricePerImage = 0.03 // default for seedream-4-0-250828 and fallback
        if (model.includes('seedream-4-5-251128')) {
          pricePerImage = 0.04
        } else if (model.includes('seedream-4-0-250828')) {
          pricePerImage = 0.03
        }

        if (!sequentialGenerationWidget || !maxImagesWidget) {
          return `$${pricePerImage}/Run ($${pricePerImage} for one output image)`
        }

        const seqMode = String(sequentialGenerationWidget.value).toLowerCase()
        if (seqMode === 'disabled') {
          return `$${pricePerImage}/Run`
        }

        const maxImagesRaw = Number(maxImagesWidget.value)
        const maxImages =
          Number.isFinite(maxImagesRaw) && maxImagesRaw > 0 ? maxImagesRaw : 1
        if (maxImages === 1) {
          return `$${pricePerImage}/Run`
        }
        const totalCost = (pricePerImage * maxImages).toFixed(2)
        return `$${totalCost}/Run ($${pricePerImage} for one output image)`
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

        if (!durationWidget || !resolutionWidget) return '$0.05-0.15/second'

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
        if (isNaN(seconds) || !pps) return '$0.05-0.15/second'

        const cost = (pps * seconds).toFixed(2)
        return `$${cost}/Run`
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

        if (!durationWidget || !resolutionWidget) return '$0.05-0.15/second'

        const seconds = parseFloat(String(durationWidget.value))
        const resolution = String(resolutionWidget.value).trim().toLowerCase()

        const pricePerSecond: Record<string, number> = {
          '480p': 0.05,
          '720p': 0.1,
          '1080p': 0.15
        }

        const pps = pricePerSecond[resolution]
        if (isNaN(seconds) || !pps) return '$0.05-0.15/second'

        const cost = (pps * seconds).toFixed(2)
        return `$${cost}/Run`
      }
    },
    WanTextToImageApi: {
      displayPrice: '$0.03/Run'
    },
    WanImageToImageApi: {
      displayPrice: '$0.03/Run'
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
      VeoVideoGenerationNode: ['duration_seconds'],
      Veo3VideoGenerationNode: ['model', 'generate_audio'],
      Veo3FirstLastFrameNode: ['model', 'generate_audio', 'duration'],
      LumaVideoNode: ['model', 'resolution', 'duration'],
      LumaImageToVideoNode: ['model', 'resolution', 'duration'],
      LumaImageNode: ['model', 'aspect_ratio'],
      LumaImageModifyNode: ['model', 'aspect_ratio'],
      PikaTextToVideoNode2_2: ['duration', 'resolution'],
      PikaImageToVideoNode2_2: ['duration', 'resolution'],
      PikaScenesV2_2: ['duration', 'resolution'],
      PikaStartEndFrameNode2_2: ['duration', 'resolution'],
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
