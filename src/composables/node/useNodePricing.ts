import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
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

  if (!durationWidget) return '$0.05/second'

  const duration = Number(durationWidget.value)
  // If duration is 0 or NaN, don't fall back to 5 seconds - just use 0
  const validDuration = isNaN(duration) ? 5 : duration
  const cost = (0.05 * validDuration).toFixed(2)
  return `$${cost}/Run`
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
    IdeogramV1: {
      displayPrice: (node: LGraphNode): string => {
        const numImagesWidget = node.widgets?.find(
          (w) => w.name === 'num_images'
        ) as IComboWidget
        const turboWidget = node.widgets?.find(
          (w) => w.name === 'turbo'
        ) as IComboWidget

        if (!numImagesWidget) return '$0.02-0.06 x num_images/Run'

        const numImages = Number(numImagesWidget.value) || 1
        const turbo = String(turboWidget?.value).toLowerCase() === 'true'
        const basePrice = turbo ? 0.02 : 0.06
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

        if (!numImagesWidget) return '$0.05-0.08 x num_images/Run'

        const numImages = Number(numImagesWidget.value) || 1
        const turbo = String(turboWidget?.value).toLowerCase() === 'true'
        const basePrice = turbo ? 0.05 : 0.08
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

        if (!renderingSpeedWidget)
          return '$0.03-0.08 x num_images/Run (varies with rendering speed & num_images)'

        const numImages = Number(numImagesWidget?.value) || 1
        let basePrice = 0.06 // default balanced price

        const renderingSpeed = String(renderingSpeedWidget.value)
        if (renderingSpeed.toLowerCase().includes('quality')) {
          basePrice = 0.09
        } else if (renderingSpeed.toLowerCase().includes('balanced')) {
          basePrice = 0.06
        } else if (renderingSpeed.toLowerCase().includes('turbo')) {
          basePrice = 0.03
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
        console.log('modelValue', modelValue)
        console.log('modeValue', modeValue)
        console.log('durationValue', durationValue)

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
        console.log('modelValue', modelValue)
        console.log('modeValue', modeValue)
        console.log('durationValue', durationValue)

        // Same pricing matrix as KlingTextToVideoNode
        if (
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
        if (modeValue.includes('v2-master')) {
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
        if (modeValue.includes('v2-1-master')) {
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
          return '$0.14-11.47/Run (varies with model, resolution & duration)'
        }

        const model = String(modelWidget.value)
        const resolution = String(resolutionWidget.value).toLowerCase()
        const duration = String(durationWidget.value)
        console.log('model', model)
        console.log('resolution', resolution)
        console.log('duration', duration)

        if (model.includes('ray-flash-2')) {
          if (duration.includes('5s')) {
            if (resolution.includes('4k')) return '$2.19/Run'
            if (resolution.includes('1080p')) return '$0.55/Run'
            if (resolution.includes('720p')) return '$0.24/Run'
            if (resolution.includes('540p')) return '$0.14/Run'
          } else if (duration.includes('9s')) {
            if (resolution.includes('4k')) return '$3.95/Run'
            if (resolution.includes('1080p')) return '$0.99/Run'
            if (resolution.includes('720p')) return '$0.43/Run'
            if (resolution.includes('540p')) return '$0.252/Run'
          }
        } else if (model.includes('ray-2')) {
          if (duration.includes('5s')) {
            if (resolution.includes('4k')) return '$6.37/Run'
            if (resolution.includes('1080p')) return '$1.59/Run'
            if (resolution.includes('720p')) return '$0.71/Run'
            if (resolution.includes('540p')) return '$0.40/Run'
          } else if (duration.includes('9s')) {
            if (resolution.includes('4k')) return '$11.47/Run'
            if (resolution.includes('1080p')) return '$2.87/Run'
            if (resolution.includes('720p')) return '$1.28/Run'
            if (resolution.includes('540p')) return '$0.72/Run'
          }
        } else if (model.includes('ray-1.6')) {
          return '$0.35/Run'
        }

        return '$0.55/Run'
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
          return '$0.14-11.47/Run (varies with model, resolution & duration)'
        }

        const model = String(modelWidget.value)
        const resolution = String(resolutionWidget.value).toLowerCase()
        const duration = String(durationWidget.value)

        if (model.includes('ray-flash-2')) {
          if (duration.includes('5s')) {
            if (resolution.includes('4k')) return '$2.19/Run'
            if (resolution.includes('1080p')) return '$0.55/Run'
            if (resolution.includes('720p')) return '$0.24/Run'
            if (resolution.includes('540p')) return '$0.14/Run'
          } else if (duration.includes('9s')) {
            if (resolution.includes('4k')) return '$3.95/Run'
            if (resolution.includes('1080p')) return '$0.99/Run'
            if (resolution.includes('720p')) return '$0.43/Run'
            if (resolution.includes('540p')) return '$0.252/Run'
          }
        } else if (model.includes('ray-2')) {
          if (duration.includes('5s')) {
            if (resolution.includes('4k')) return '$6.37/Run'
            if (resolution.includes('1080p')) return '$1.59/Run'
            if (resolution.includes('720p')) return '$0.71/Run'
            if (resolution.includes('540p')) return '$0.40/Run'
          } else if (duration.includes('9s')) {
            if (resolution.includes('4k')) return '$11.47/Run'
            if (resolution.includes('1080p')) return '$2.87/Run'
            if (resolution.includes('720p')) return '$1.28/Run'
            if (resolution.includes('540p')) return '$0.72/Run'
          }
        } else if (model.includes('ray-1-6')) {
          return '$0.35/Run'
        }

        return '$0.55/Run'
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
          return '$2.00-6.00/Run (varies with model & audio generation)'
        }

        const model = String(modelWidget.value)
        const generateAudio =
          String(generateAudioWidget.value).toLowerCase() === 'true'

        if (model.includes('veo-3.0-fast-generate-001')) {
          return generateAudio ? '$3.20/Run' : '$2.00/Run'
        } else if (model.includes('veo-3.0-generate-001')) {
          return generateAudio ? '$6.00/Run' : '$4.00/Run'
        }

        // Default fallback
        return '$2.00-6.00/Run'
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
          return '$0.0045-0.0182/Run (varies with model & aspect ratio)'
        }

        const model = String(modelWidget.value)

        if (model.includes('photon-flash-1')) {
          return '$0.0019/Run'
        } else if (model.includes('photon-1')) {
          return '$0.0073/Run'
        }

        return '$0.0172/Run'
      }
    },
    LumaImageModifyNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget

        if (!modelWidget) {
          return '$0.0019-0.0073/Run (varies with model)'
        }

        const model = String(modelWidget.value)

        if (model.includes('photon-flash-1')) {
          return '$0.0019/Run'
        } else if (model.includes('photon-1')) {
          return '$0.0073/Run'
        }

        return '$0.0172/Run'
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
      displayPrice: '$0.08/Run'
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
      displayPrice: (node: LGraphNode): string => {
        const quadWidget = node.widgets?.find(
          (w) => w.name === 'quad'
        ) as IComboWidget
        const styleWidget = node.widgets?.find(
          (w) => w.name === 'style'
        ) as IComboWidget
        const textureWidget = node.widgets?.find(
          (w) => w.name === 'texture'
        ) as IComboWidget
        const textureQualityWidget = node.widgets?.find(
          (w) => w.name === 'texture_quality'
        ) as IComboWidget

        if (!quadWidget || !styleWidget || !textureWidget)
          return '$0.1-0.4/Run (varies with quad, style, texture & quality)'

        const quad = String(quadWidget.value).toLowerCase() === 'true'
        const style = String(styleWidget.value).toLowerCase()
        const texture = String(textureWidget.value).toLowerCase() === 'true'
        const textureQuality = String(
          textureQualityWidget?.value || 'standard'
        ).toLowerCase()

        // Pricing logic based on CSV data
        if (style.includes('none')) {
          if (!quad) {
            if (!texture) return '$0.10/Run'
            else return '$0.15/Run'
          } else {
            if (textureQuality.includes('detailed')) {
              if (!texture) return '$0.30/Run'
              else return '$0.35/Run'
            } else {
              if (!texture) return '$0.20/Run'
              else return '$0.25/Run'
            }
          }
        } else {
          // any style
          if (!quad) {
            if (!texture) return '$0.15/Run'
            else return '$0.20/Run'
          } else {
            if (textureQuality.includes('detailed')) {
              if (!texture) return '$0.35/Run'
              else return '$0.40/Run'
            } else {
              if (!texture) return '$0.25/Run'
              else return '$0.30/Run'
            }
          }
        }
      }
    },
    TripoImageToModelNode: {
      displayPrice: (node: LGraphNode): string => {
        const quadWidget = node.widgets?.find(
          (w) => w.name === 'quad'
        ) as IComboWidget
        const styleWidget = node.widgets?.find(
          (w) => w.name === 'style'
        ) as IComboWidget
        const textureWidget = node.widgets?.find(
          (w) => w.name === 'texture'
        ) as IComboWidget
        const textureQualityWidget = node.widgets?.find(
          (w) => w.name === 'texture_quality'
        ) as IComboWidget

        if (!quadWidget || !styleWidget || !textureWidget)
          return '$0.2-0.5/Run (varies with quad, style, texture & quality)'

        const quad = String(quadWidget.value).toLowerCase() === 'true'
        const style = String(styleWidget.value).toLowerCase()
        const texture = String(textureWidget.value).toLowerCase() === 'true'
        const textureQuality = String(
          textureQualityWidget?.value || 'standard'
        ).toLowerCase()

        // Pricing logic based on CSV data for Image to Model
        if (style.includes('none')) {
          if (!quad) {
            if (!texture) return '$0.20/Run'
            else return '$0.25/Run'
          } else {
            if (textureQuality.includes('detailed')) {
              if (!texture) return '$0.40/Run'
              else return '$0.45/Run'
            } else {
              if (!texture) return '$0.30/Run'
              else return '$0.35/Run'
            }
          }
        } else {
          // any style
          if (!quad) {
            if (!texture) return '$0.25/Run'
            else return '$0.30/Run'
          } else {
            if (textureQuality.includes('detailed')) {
              if (!texture) return '$0.45/Run'
              else return '$0.50/Run'
            } else {
              if (!texture) return '$0.35/Run'
              else return '$0.40/Run'
            }
          }
        }
      }
    },
    TripoRefineNode: {
      displayPrice: '$0.3/Run'
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
    TripoConvertModelNode: {
      displayPrice: '$0.10/Run'
    },
    TripoRetargetRiggedModelNode: {
      displayPrice: '$0.10/Run'
    },
    TripoMultiviewToModelNode: {
      displayPrice: (node: LGraphNode): string => {
        const quadWidget = node.widgets?.find(
          (w) => w.name === 'quad'
        ) as IComboWidget
        const styleWidget = node.widgets?.find(
          (w) => w.name === 'style'
        ) as IComboWidget
        const textureWidget = node.widgets?.find(
          (w) => w.name === 'texture'
        ) as IComboWidget
        const textureQualityWidget = node.widgets?.find(
          (w) => w.name === 'texture_quality'
        ) as IComboWidget

        if (!quadWidget || !styleWidget || !textureWidget)
          return '$0.2-0.5/Run (varies with quad, style, texture & quality)'

        const quad = String(quadWidget.value).toLowerCase() === 'true'
        const style = String(styleWidget.value).toLowerCase()
        const texture = String(textureWidget.value).toLowerCase() === 'true'
        const textureQuality = String(
          textureQualityWidget?.value || 'standard'
        ).toLowerCase()

        // Pricing logic based on CSV data for Multiview to Model (same as Image to Model)
        if (style.includes('none')) {
          if (!quad) {
            if (!texture) return '$0.20/Run'
            else return '$0.25/Run'
          } else {
            if (textureQuality.includes('detailed')) {
              if (!texture) return '$0.40/Run'
              else return '$0.45/Run'
            } else {
              if (!texture) return '$0.30/Run'
              else return '$0.35/Run'
            }
          }
        } else {
          // any style
          if (!quad) {
            if (!texture) return '$0.25/Run'
            else return '$0.30/Run'
          } else {
            if (textureQuality.includes('detailed')) {
              if (!texture) return '$0.45/Run'
              else return '$0.50/Run'
            } else {
              if (!texture) return '$0.35/Run'
              else return '$0.40/Run'
            }
          }
        }
      }
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
        }
        // For other Gemini models, show token-based pricing info
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
      MinimaxHailuoVideoNode: ['resolution', 'duration'],
      OpenAIDalle3: ['size', 'quality'],
      OpenAIDalle2: ['size', 'n'],
      OpenAIGPTImage1: ['quality', 'n'],
      IdeogramV1: ['num_images', 'turbo'],
      IdeogramV2: ['num_images', 'turbo'],
      IdeogramV3: ['rendering_speed', 'num_images'],
      FluxProKontextProNode: [],
      FluxProKontextMaxNode: [],
      VeoVideoGenerationNode: ['duration_seconds'],
      Veo3VideoGenerationNode: ['model', 'generate_audio'],
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
      TripoTextToModelNode: ['quad', 'style', 'texture', 'texture_quality'],
      TripoImageToModelNode: ['quad', 'style', 'texture', 'texture_quality'],
      TripoTextureNode: ['texture_quality'],
      // Google/Gemini nodes
      GeminiNode: ['model'],
      // OpenAI nodes
      OpenAIChatNode: ['model']
    }
    return widgetMap[nodeType] || []
  }

  return {
    getNodeDisplayPrice,
    getNodePricingConfig,
    getRelevantWidgetNames
  }
}
