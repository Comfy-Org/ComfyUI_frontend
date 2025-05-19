import type { LGraphNode } from '@comfyorg/litegraph'

import { ApiNodeCostRecord } from '@/types/apiNodeTypes'

const apiNodeCosts: ApiNodeCostRecord = {
  FluxProCannyNode: {
    vendor: 'BFL',
    nodeName: 'Flux 1: Canny Control Image',
    pricingParams: '-',
    pricePerRunRange: '$0.05',
    displayPrice: '$0.05/Run'
  },
  FluxProDepthNode: {
    vendor: 'BFL',
    nodeName: 'Flux 1: Depth Control Image',
    pricingParams: '-',
    pricePerRunRange: '$0.05',
    displayPrice: '$0.05/Run'
  },
  FluxProExpandNode: {
    vendor: 'BFL',
    nodeName: 'Flux 1: Expand Image',
    pricingParams: '-',
    pricePerRunRange: '$0.05',
    rateDocumentationUrl: 'https://docs.bfl.ml/pricing/',
    displayPrice: '$0.05/Run'
  },
  FluxProFillNode: {
    vendor: 'BFL',
    nodeName: 'Flux 1: Fill Image',
    pricingParams: '-',
    pricePerRunRange: '$0.05',
    displayPrice: '$0.05/Run'
  },
  FluxProUltraImageNode: {
    vendor: 'BFL',
    nodeName: 'Flux 1.1: [pro] Ultra Image',
    pricingParams: '-',
    pricePerRunRange: '$0.06',
    displayPrice: '$0.06/Run'
  },
  IdeogramV1: {
    vendor: 'Ideogram',
    nodeName: 'Ideogram V1',
    pricingParams: '-',
    pricePerRunRange: '$0.06',
    rateDocumentationUrl: 'https://about.ideogram.ai/api-pricing',
    displayPrice: '$0.06/Run'
  },
  IdeogramV2: {
    vendor: 'Ideogram',
    nodeName: 'Ideogram V2',
    pricingParams: '-',
    pricePerRunRange: '$0.08',
    displayPrice: '$0.08/Run'
  },
  IdeogramV3: {
    vendor: 'Ideogram',
    nodeName: 'Ideogram V3',
    pricingParams: 'rendering_speed',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing (low to medium)'
  },
  KlingCameraControlI2VNode: {
    vendor: 'Kling',
    nodeName: 'Kling Image to Video (Camera Control)',
    pricingParams: '-',
    pricePerRunRange: '$0.49',
    displayPrice: '$0.49/Run'
  },
  KlingCameraControlT2VNode: {
    vendor: 'Kling',
    nodeName: 'Kling Text to Video (Camera Control)',
    pricingParams: '-',
    pricePerRunRange: '$0.14',
    displayPrice: '$0.14/Run'
  },
  KlingDualCharacterVideoEffectNode: {
    vendor: 'Kling',
    nodeName: 'Kling Dual Character Video Effects',
    pricingParams: 'Priced the same as t2v based on mode, model, and duration.',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing (medium)'
  },
  KlingImage2VideoNode: {
    vendor: 'Kling',
    nodeName: 'Kling Image to Video',
    pricingParams: 'Same as Text to Video',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing (medium)'
  },
  KlingImageGenerationNode: {
    vendor: 'Kling',
    nodeName: 'Kling Image Generation',
    pricingParams: 'modality | model',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing (low)'
  },
  KlingLipSyncAudioToVideoNode: {
    vendor: 'Kling',
    nodeName: 'Kling Lip Sync Video with Audio',
    pricingParams: 'duration of input video',
    pricePerRunRange: '$0.07',
    displayPrice: '$0.07/Run'
  },
  KlingLipSyncTextToVideoNode: {
    vendor: 'Kling',
    nodeName: 'Kling Lip Sync Video with Text',
    pricingParams: 'duration of input video',
    pricePerRunRange: '$0.07',
    displayPrice: '$0.07/Run'
  },
  KlingSingleImageVideoEffectNode: {
    vendor: 'Kling',
    nodeName: 'Kling Video Effects',
    pricingParams: 'effect_scene',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing (medium)'
  },
  KlingStartEndFrameNode: {
    vendor: 'Kling',
    nodeName: 'Kling Start-End Frame to Video',
    pricingParams: 'Same as text to video',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing (medium)'
  },
  KlingTextToVideoNode: {
    vendor: 'Kling',
    nodeName: 'Kling Text to Video',
    pricingParams: 'model | duration | mode',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing (medium to high)'
  },
  KlingVideoExtendNode: {
    vendor: 'Kling',
    nodeName: 'Kling Video Extend',
    pricingParams: '-',
    pricePerRunRange: '$0.28',
    displayPrice: '$0.28/Run'
  },
  KlingVirtualTryOnNode: {
    vendor: 'Kling',
    nodeName: 'Kling Virtual Try On',
    pricingParams: '-',
    pricePerRunRange: '$0.07',
    displayPrice: '$0.07/Run'
  },
  LumaImageToVideoNode: {
    vendor: 'Luma',
    nodeName: 'Luma Image to Video',
    pricingParams: 'Same as Text to Video',
    pricePerRunRange: 'dynamic',
    rateDocumentationUrl: 'https://lumalabs.ai/api/pricing',
    displayPrice: 'Variable pricing (medium to high)'
  },
  LumaVideoNode: {
    vendor: 'Luma',
    nodeName: 'Luma Text to Video',
    pricingParams: 'model | resolution | duration',
    pricePerRunRange: 'dynamic',
    rateDocumentationUrl: 'https://lumalabs.ai/api/pricing',
    displayPrice: 'Variable pricing (medium to high)'
  },
  MinimaxImageToVideoNode: {
    vendor: 'Minimax',
    nodeName: 'MiniMax Image to Video',
    pricingParams: '-',
    pricePerRunRange: '$0.43',
    rateDocumentationUrl: 'https://www.minimax.io/price',
    displayPrice: '$0.43/Run'
  },
  MinimaxTextToVideoNode: {
    vendor: 'Minimax',
    nodeName: 'MiniMax Text to Video',
    pricingParams: '-',
    pricePerRunRange: '$0.43',
    rateDocumentationUrl: 'https://www.minimax.io/price',
    displayPrice: '$0.43/Run'
  },
  OpenAIDalle2: {
    vendor: 'OpenAI',
    nodeName: 'dall-e-2',
    pricingParams: 'size',
    pricePerRunRange: 'dynamic',
    rateDocumentationUrl: 'https://platform.openai.com/docs/pricing',
    displayPrice: 'Variable pricing (low)'
  },
  OpenAIDalle3: {
    vendor: 'OpenAI',
    nodeName: 'dall-e-3',
    pricingParams: 'size | quality',
    pricePerRunRange: 'dynamic',
    rateDocumentationUrl: 'https://platform.openai.com/docs/pricing',
    displayPrice: 'Variable pricing (medium)'
  },
  OpenAIGPTImage1: {
    vendor: 'OpenAI',
    nodeName: 'gpt-image-1',
    pricingParams: 'quality',
    pricePerRunRange: 'dynamic',
    rateDocumentationUrl: 'https://platform.openai.com/docs/pricing',
    displayPrice: 'Variable pricing (low to high)'
  },
  PikaImageToVideoNode2_2: {
    vendor: 'Pika',
    nodeName: 'Pika Image to Video',
    pricingParams: 'duration | resolution',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing (medium)'
  },
  PikaScenesV2_2: {
    vendor: 'Pika',
    nodeName: 'Pika Scenes (Video Image Composition)',
    pricingParams: 'duration | resolution',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing (medium)'
  },
  PikaStartEndFrameNode2_2: {
    vendor: 'Pika',
    nodeName: 'Pika Start and End Frame to Video',
    pricingParams: 'duration | resolution',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing (medium)'
  },
  PikaTextToVideoNode2_2: {
    vendor: 'Pika',
    nodeName: 'Pika Text to Video',
    pricingParams: 'duration | resolution',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing (medium)'
  },
  Pikadditions: {
    vendor: 'Pika',
    nodeName: 'Pikadditions (Video Object Insertion)',
    pricingParams: '-',
    pricePerRunRange: '$0.3',
    displayPrice: '$0.3/Run'
  },
  Pikaffects: {
    vendor: 'Pika',
    nodeName: 'Pikaffects (Video Effects)',
    pricingParams: '-',
    pricePerRunRange: '$0.45',
    displayPrice: '$0.45/Run'
  },
  Pikaswaps: {
    vendor: 'Pika',
    nodeName: 'Pika Swaps (Video Object Replacement)',
    pricingParams: '-',
    pricePerRunRange: '$0.3',
    displayPrice: '$0.3/Run'
  },
  PixverseImageToVideoNode: {
    vendor: 'Pixverse',
    nodeName: 'PixVerse Image to Video',
    pricingParams: 'same as text to video',
    pricePerRunRange: '$0.9',
    displayPrice: '$0.9/Run'
  },
  PixverseTextToVideoNode: {
    vendor: 'Pixverse',
    nodeName: 'PixVerse Text to Video',
    pricingParams: 'duration | quality | motion_mode',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing (medium to high)'
  },
  PixverseTransitionVideoNode: {
    vendor: 'Pixverse',
    nodeName: 'PixVerse Transition Video',
    pricingParams: 'same as text to video',
    pricePerRunRange: '$0.9',
    displayPrice: '$0.9/Run'
  },
  RecraftCreativeUpscaleNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Creative Upscale Image',
    pricingParams: '-',
    pricePerRunRange: '$0.25',
    rateDocumentationUrl: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.25/Run'
  },
  RecraftCrispUpscaleNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Crisp Upscale Image',
    pricingParams: '-',
    pricePerRunRange: '$0.004',
    rateDocumentationUrl: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.004/Run'
  },
  RecraftImageInpaintingNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Image Inpainting',
    pricingParams: 'n',
    pricePerRunRange: '$$0.04 x n',
    rateDocumentationUrl: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.04 x n/Run'
  },
  RecraftImageToImageNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Image to Image',
    pricingParams: 'n',
    pricePerRunRange: '$0.04 x n',
    rateDocumentationUrl: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.04 x n/Run'
  },
  RecraftRemoveBackgroundNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Remove Background',
    pricingParams: '-',
    pricePerRunRange: '$0.01',
    rateDocumentationUrl: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.01/Run'
  },
  RecraftReplaceBackgroundNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Replace Background',
    pricingParams: 'n',
    pricePerRunRange: '$0.04',
    rateDocumentationUrl: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.04/Run'
  },
  RecraftTextToImageNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Text to Image',
    pricingParams: 'model | n',
    pricePerRunRange: '$0.04 x n',
    rateDocumentationUrl: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.04 x n/Run'
  },
  RecraftTextToVectorNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Text to Vector',
    pricingParams: 'model | n',
    pricePerRunRange: '$0.08 x n',
    rateDocumentationUrl: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.08 x n/Run'
  },
  RecraftVectorizeImageNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Vectorize Image',
    pricingParams: '-',
    pricePerRunRange: '$0.01',
    rateDocumentationUrl: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.01/Run'
  },
  StabilityStableImageSD_3_5Node: {
    vendor: 'Stability',
    nodeName: 'Stability AI Stable Diffusion 3.5 Image',
    pricingParams: 'model',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing (low)'
  },
  StabilityStableImageUltraNode: {
    vendor: 'Stability',
    nodeName: 'Stability AI Stable Image Ultra',
    pricingParams: '-',
    pricePerRunRange: '$0.08',
    displayPrice: '$0.08/Run'
  },
  StabilityUpscaleConservativeNode: {
    vendor: 'Stability',
    nodeName: 'Stability AI Upscale Conservative',
    pricingParams: '-',
    pricePerRunRange: '$0.25',
    displayPrice: '$0.25/Run'
  },
  StabilityUpscaleCreativeNode: {
    vendor: 'Stability',
    nodeName: 'Stability AI Upscale Creative',
    pricingParams: '-',
    pricePerRunRange: '$0.25',
    displayPrice: '$0.25/Run'
  },
  StabilityUpscaleFastNode: {
    vendor: 'Stability',
    nodeName: 'Stability AI Upscale Fast',
    pricingParams: '-',
    pricePerRunRange: '$0.01',
    displayPrice: '$0.01/Run'
  },
  VeoVideoGenerationNode: {
    vendor: 'Veo',
    nodeName: 'Google Veo2 Video Generation',
    pricingParams: 'duration_seconds',
    pricePerRunRange: 'dynamic',
    rateDocumentationUrl:
      'https://cloud.google.com/vertex-ai/generative-ai/pricing',
    displayPrice: 'Variable pricing (high)'
  },
  LumaTextToImageNode: {
    vendor: 'Luma',
    nodeName: 'Luma Text to Image',
    pricingParams: 'model | aspect_ratio',
    pricePerRunRange: 'dynamic',
    rateDocumentationUrl: 'https://lumalabs.ai/api/pricing',
    displayPrice: 'Variable pricing (low to medium)'
  },
  LumaImageToImageNode: {
    vendor: 'Luma',
    nodeName: 'Luma Image to Image',
    pricingParams: 'Same as Text to Image',
    pricePerRunRange: 'dynamic',
    rateDocumentationUrl: 'https://lumalabs.ai/api/pricing',
    displayPrice: 'Variable pricing (low to medium)'
  }
}

/**
 * Composable to get node pricing information for API nodes
 */
export const useNodePricing = () => {
  const getNodePrice = (nodeName: string): string =>
    apiNodeCosts[nodeName]?.displayPrice || ''

  /**
   * Get the price display for a node
   */
  const getNodeDisplayPrice = (node: LGraphNode): string => {
    if (!node.constructor.nodeData?.api_node) return ''
    return getNodePrice(node.constructor.nodeData.name)
  }

  return {
    getNodeDisplayPrice
  }
}
