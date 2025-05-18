import { ApiNodeCostRecord } from '@/types/apiNodeTypes'

/**
 * API Node cost data for pricing display
 */

export const apiNodeCosts: ApiNodeCostRecord = {
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
    rateDocumentation: 'https://docs.bfl.ml/pricing/',
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
    rateDocumentation: 'https://about.ideogram.ai/api-pricing',
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
    displayPrice: 'Variable pricing'
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
    displayPrice: 'Variable pricing'
  },
  KlingImage2VideoNode: {
    vendor: 'Kling',
    nodeName: 'Kling Image to Video',
    pricingParams: 'Same as Text to Video',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing'
  },
  KlingImageGenerationNode: {
    vendor: 'Kling',
    nodeName: 'Kling Image Generation',
    pricingParams: 'modality | model',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing'
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
    displayPrice: 'Variable pricing'
  },
  KlingStartEndFrameNode: {
    vendor: 'Kling',
    nodeName: 'Kling Start-End Frame to Video',
    pricingParams: 'Same as text to video',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing'
  },
  KlingTextToVideoNode: {
    vendor: 'Kling',
    nodeName: 'Kling Text to Video',
    pricingParams: 'model | duration | mode',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing'
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
    rateDocumentation: 'https://lumalabs.ai/api/pricing',
    displayPrice: 'Variable pricing'
  },
  LumaVideoNode: {
    vendor: 'Luma',
    nodeName: 'Luma Text to Video',
    pricingParams: 'model | resolution | duration',
    pricePerRunRange: 'dynamic',
    rateDocumentation: 'https://lumalabs.ai/api/pricing',
    displayPrice: 'Variable pricing'
  },
  MinimaxImageToVideoNode: {
    vendor: 'Minimax',
    nodeName: 'MiniMax Image to Video',
    pricingParams: '-',
    pricePerRunRange: '$0.43',
    rateDocumentation: 'https://www.minimax.io/price',
    displayPrice: '$0.43/Run'
  },
  MinimaxTextToVideoNode: {
    vendor: 'Minimax',
    nodeName: 'MiniMax Text to Video',
    pricingParams: '-',
    pricePerRunRange: '$0.43',
    rateDocumentation: 'https://www.minimax.io/price',
    displayPrice: '$0.43/Run'
  },
  OpenAIDalle2: {
    vendor: 'OpenAI',
    nodeName: 'dall-e-2',
    pricingParams: 'size',
    pricePerRunRange: 'dynamic',
    rateDocumentation: 'https://platform.openai.com/docs/pricing',
    displayPrice: 'Variable pricing'
  },
  OpenAIDalle3: {
    vendor: 'OpenAI',
    nodeName: 'dall-e-3',
    pricingParams: 'size | quality',
    pricePerRunRange: 'dynamic',
    rateDocumentation: 'https://platform.openai.com/docs/pricing',
    displayPrice: 'Variable pricing'
  },
  OpenAIGPTImage1: {
    vendor: 'OpenAI',
    nodeName: 'gpt-image-1',
    pricingParams: 'quality',
    pricePerRunRange: 'dynamic',
    rateDocumentation: 'https://platform.openai.com/docs/pricing',
    displayPrice: 'Variable pricing'
  },
  PikaImageToVideoNode2_2: {
    vendor: 'Pika',
    nodeName: 'Pika Image to Video',
    pricingParams: 'duration | resolution',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing'
  },
  PikaScenesV2_2: {
    vendor: 'Pika',
    nodeName: 'Pika Scenes (Video Image Composition)',
    pricingParams: 'duration | resolution',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing'
  },
  PikaStartEndFrameNode2_2: {
    vendor: 'Pika',
    nodeName: 'Pika Start and End Frame to Video',
    pricingParams: 'duration | resolution',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing'
  },
  PikaTextToVideoNode2_2: {
    vendor: 'Pika',
    nodeName: 'Pika Text to Video',
    pricingParams: 'duration | resolution',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing'
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
    displayPrice: 'Variable pricing'
  },
  PixverseTransitionVideoNode: {
    vendor: 'Pixverse',
    nodeName: 'PixVerse Transition Video',
    pricingParams: 'same as text to video',
    pricePerRunRange: '$0.9',
    displayPrice: '$0.9/Run'
  },
  RecraftCrispUpscaleNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Crisp Upscale Image',
    pricingParams: '-',
    pricePerRunRange: '$0.004',
    rateDocumentation: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.004/Run'
  },
  RecraftImageInpaintingNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Image Inpainting',
    pricingParams: 'n',
    pricePerRunRange: '$$0.04 x n',
    rateDocumentation: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.04 x n/Run'
  },
  RecraftImageToImageNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Image to Image',
    pricingParams: 'n',
    pricePerRunRange: '$0.04 x n',
    rateDocumentation: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.04 x n/Run'
  },
  RecraftRemoveBackgroundNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Remove Background',
    pricingParams: '-',
    pricePerRunRange: '$0.01',
    rateDocumentation: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.01/Run'
  },
  RecraftReplaceBackgroundNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Replace Background',
    pricingParams: 'n',
    pricePerRunRange: '$0.04',
    rateDocumentation: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.04/Run'
  },
  RecraftTextToImageNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Text to Image',
    pricingParams: 'model | n',
    pricePerRunRange: '$0.04 x n',
    rateDocumentation: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.04 x n/Run'
  },
  RecraftTextToVectorNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Text to Vector',
    pricingParams: 'model | n',
    pricePerRunRange: '$0.08 x n',
    rateDocumentation: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.08 x n/Run'
  },
  RecraftVectorizeImageNode: {
    vendor: 'Recraft',
    nodeName: 'Recraft Vectorize Image',
    pricingParams: '-',
    pricePerRunRange: '$0.01',
    rateDocumentation: 'https://www.recraft.ai/docs#pricing',
    displayPrice: '$0.01/Run'
  },
  StabilityStableImageSD_3_5Node: {
    vendor: 'Stability',
    nodeName: 'Stability AI Stable Diffusion 3.5 Image',
    pricingParams: 'model',
    pricePerRunRange: 'dynamic',
    displayPrice: 'Variable pricing'
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
    rateDocumentation:
      'https://cloud.google.com/vertex-ai/generative-ai/pricing',
    displayPrice: 'Variable pricing'
  }
}

/**
 * Get the display price for a node
 * Returns empty string if the node isn't found or has no pricing info
 */
export function getNodeDisplayPrice(nodeName: string): string {
  return apiNodeCosts[nodeName]?.displayPrice || ''
}
