import type { LGraphNode } from '@comfyorg/litegraph'
import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'

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
    IdeogramV1: {
      displayPrice: '$0.06/Run'
    },
    IdeogramV2: {
      displayPrice: '$0.08/Run'
    },
    IdeogramV3: {
      displayPrice: (node: LGraphNode): string => {
        const renderingSpeedWidget = node.widgets?.find(
          (w) => w.name === 'rendering_speed'
        ) as IComboWidget

        if (!renderingSpeedWidget)
          return '$0.03-0.08/Run (varies with rendering speed)'

        const renderingSpeed = String(renderingSpeedWidget.value)
        if (renderingSpeed.toLowerCase().includes('quality')) {
          return '$0.08/Run'
        } else if (renderingSpeed.toLowerCase().includes('balanced')) {
          return '$0.06/Run'
        } else if (renderingSpeed.toLowerCase().includes('turbo')) {
          return '$0.03/Run'
        }

        return '$0.06/Run'
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
          if (modelValue.includes('v2-master')) {
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
        if (modelValue.includes('v2-master')) {
          if (durationValue.includes('10')) {
            return '$2.80/Run'
          }
          return '$1.40/Run' // 5s default
        } else if (modelValue.includes('v1-6') || modelValue.includes('v1-5')) {
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

        if (!modelWidget)
          return '$0.0035-0.028/Run (varies with modality & model)'

        const model = String(modelWidget.value)

        if (modality.includes('text to image')) {
          if (model.includes('kling-v1')) {
            return '$0.0035/Run'
          } else if (
            model.includes('kling-v1-5') ||
            model.includes('kling-v2')
          ) {
            return '$0.014/Run'
          }
        } else if (modality.includes('image to image')) {
          if (model.includes('kling-v1')) {
            return '$0.0035/Run'
          } else if (model.includes('kling-v1-5')) {
            return '$0.028/Run'
          }
        }

        return '$0.014/Run'
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
          effectScene.includes('squish') ||
          effectScene.includes('expansion')
        ) {
          return '$0.28/Run'
        } else if (
          effectScene.includes('dizzydizzy') ||
          effectScene.includes('bloombloom')
        ) {
          return '$0.49/Run'
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
            if (resolution.includes('1080p')) return '$2.30/Run'
            if (resolution.includes('720p')) return '$0.71/Run'
            if (resolution.includes('540p')) return '$0.40/Run'
          } else if (duration.includes('9s')) {
            if (resolution.includes('4k')) return '$11.47/Run'
            if (resolution.includes('1080p')) return '$4.14/Run'
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
            if (resolution.includes('1080p')) return '$2.30/Run'
            if (resolution.includes('720p')) return '$0.71/Run'
            if (resolution.includes('540p')) return '$0.40/Run'
          } else if (duration.includes('9s')) {
            if (resolution.includes('4k')) return '$11.47/Run'
            if (resolution.includes('1080p')) return '$4.14/Run'
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
    OpenAIDalle2: {
      displayPrice: (node: LGraphNode): string => {
        const sizeWidget = node.widgets?.find(
          (w) => w.name === 'size'
        ) as IComboWidget

        if (!sizeWidget) return '$0.016-0.02/Run (varies with size)'

        const size = String(sizeWidget.value)
        if (size.includes('1024x1024')) {
          return '$0.02/Run'
        } else if (size.includes('512x512')) {
          return '$0.018/Run'
        } else if (size.includes('256x256')) {
          return '$0.016/Run'
        }

        return '$0.02/Run'
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

        if (!qualityWidget) return '$0.011-0.30/Run (varies with quality)'

        const quality = String(qualityWidget.value)
        if (quality.includes('high')) {
          return '$0.167-0.30/Run'
        } else if (quality.includes('medium')) {
          return '$0.046-0.07/Run'
        } else if (quality.includes('low')) {
          return '$0.011-0.02/Run'
        }

        return '$0.046-0.07/Run'
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
          if (resolution.includes('1080p')) return '~$0.3/Run'
        } else if (duration.includes('10')) {
          if (resolution.includes('720p')) return '$0.25/Run'
          if (resolution.includes('1080p')) return '$1.0/Run'
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
          if (resolution.includes('1080p')) return '~$0.45/Run'
        } else if (duration.includes('10')) {
          if (resolution.includes('720p')) return '$0.6/Run'
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
      displayPrice: '$0.01/Run'
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
        const aspectRatio = String(aspectRatioWidget.value)

        if (model.includes('photon-flash-1')) {
          if (aspectRatio.includes('1:1')) return '$0.0045/Run'
          if (aspectRatio.includes('16:9')) return '$0.0045/Run'
          if (aspectRatio.includes('4:3')) return '$0.0046/Run'
          if (aspectRatio.includes('21:9')) return '$0.0047/Run'
        } else if (model.includes('photon-1')) {
          if (aspectRatio.includes('1:1')) return '$0.0172/Run'
          if (aspectRatio.includes('16:9')) return '$0.0172/Run'
          if (aspectRatio.includes('4:3')) return '$0.0176/Run'
          if (aspectRatio.includes('21:9')) return '$0.0182/Run'
        }

        return '$0.0172/Run'
      }
    },
    LumaImageModifyNode: {
      displayPrice: (node: LGraphNode): string => {
        const modelWidget = node.widgets?.find(
          (w) => w.name === 'model'
        ) as IComboWidget
        const aspectRatioWidget = node.widgets?.find(
          (w) => w.name === 'aspect_ratio'
        ) as IComboWidget

        if (!modelWidget) {
          return '$0.0045-0.0182/Run (varies with model & aspect ratio)'
        }

        const model = String(modelWidget.value)
        const aspectRatio = aspectRatioWidget
          ? String(aspectRatioWidget.value)
          : null

        if (model.includes('photon-flash-1')) {
          if (!aspectRatio) return '$0.0045/Run'
          if (aspectRatio.includes('1:1')) return '~$0.0045/Run'
          if (aspectRatio.includes('16:9')) return '~$0.0045/Run'
          if (aspectRatio.includes('4:3')) return '~$0.0046/Run'
          if (aspectRatio.includes('21:9')) return '~$0.0047/Run'
        } else if (model.includes('photon-1')) {
          if (!aspectRatio) return '$0.0172/Run'
          if (aspectRatio.includes('1:1')) return '~$0.0172/Run'
          if (aspectRatio.includes('16:9')) return '~$0.0172/Run'
          if (aspectRatio.includes('4:3')) return '~$0.0176/Run'
          if (aspectRatio.includes('21:9')) return '~$0.0182/Run'
        }

        return '$0.0172/Run'
      }
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
      KlingImageGenerationNode: ['modality', 'model_name'],
      KlingDualCharacterVideoEffectNode: ['mode', 'model_name', 'duration'],
      KlingSingleImageVideoEffectNode: ['effect_scene'],
      KlingStartEndFrameNode: ['mode', 'model_name', 'duration'],
      OpenAIDalle3: ['size', 'quality'],
      OpenAIDalle2: ['size'],
      OpenAIGPTImage1: ['quality'],
      IdeogramV3: ['rendering_speed'],
      VeoVideoGenerationNode: ['duration_seconds'],
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
      RecraftTextToVectorNode: ['n']
    }
    return widgetMap[nodeType] || []
  }

  return {
    getNodeDisplayPrice,
    getNodePricingConfig,
    getRelevantWidgetNames
  }
}
