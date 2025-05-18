import type { LGraphNode } from '@comfyorg/litegraph'

// Direct mapping of node names to prices
export const NODE_PRICES: Record<string, string> = {
  // OpenAI models
  OpenAIDalle2: '$0.02/Run',
  OpenAIDalle3: '$0.08/Run',
  OpenAIGPTImage1: '$0.07/Run',
  // Ideogram models
  IdeogramV1: '$0.06/Run',
  IdeogramV2: '$0.08/Run',
  IdeogramV3: 'Variable pricing',
  // Minimax models
  MinimaxTextToVideoNode: '$0.43/Run',
  MinimaxImageToVideoNode: '$0.43/Run',
  // Google Veo
  VeoVideoGenerationNode: '$5.0/Run',
  // Kling models
  KlingTextToVideoNode: 'Variable pricing',
  KlingImage2VideoNode: 'Variable pricing',
  KlingCameraControlI2VNode: '$0.49/Run',
  KlingCameraControlT2VNode: '$0.14/Run',
  KlingStartEndFrameNode: 'Variable pricing',
  KlingVideoExtendNode: '$0.28/Run',
  KlingLipSyncAudioToVideoNode: '$0.07/Run',
  KlingLipSyncTextToVideoNode: '$0.07/Run',
  KlingVirtualTryOnNode: '$0.07/Run',
  KlingImageGenerationNode: 'Variable pricing',
  KlingSingleImageVideoEffectNode: 'Variable pricing',
  KlingDualCharacterVideoEffectNode: 'Variable pricing',
  // Flux Pro models
  FluxProUltraImageNode: '$0.06/Run',
  FluxProExpandNode: '$0.05/Run',
  FluxProFillNode: '$0.05/Run',
  FluxProCannyNode: '$0.05/Run',
  FluxProDepthNode: '$0.05/Run',
  // Luma models
  LumaVideoNode: 'Variable pricing',
  LumaImageToVideoNode: 'Variable pricing',
  LumaImageNode: 'Variable pricing',
  LumaImageModifyNode: 'Variable pricing',
  // Recraft models
  RecraftTextToImageNode: '$0.04/Run',
  RecraftImageToImageNode: '$0.04/Run',
  RecraftImageInpaintingNode: '$0.04/Run',
  RecraftTextToVectorNode: '$0.08/Run',
  RecraftVectorizeImageNode: '$0.01/Run',
  RecraftRemoveBackgroundNode: '$0.01/Run',
  RecraftReplaceBackgroundNode: '$0.04/Run',
  RecraftCrispUpscaleNode: '$0.004/Run',
  RecraftCreativeUpscaleNode: '$0.004/Run',
  // Pixverse models
  PixverseTextToVideoNode: '$0.9/Run',
  PixverseImageToVideoNode: '$0.9/Run',
  PixverseTransitionVideoNode: '$0.9/Run',
  // Stability models
  StabilityStableImageUltraNode: '$0.08/Run',
  StabilityStableImageSD_3_5Node: 'Variable pricing',
  StabilityUpscaleConservativeNode: '$0.25/Run',
  StabilityUpscaleCreativeNode: '$0.25/Run',
  StabilityUpscaleFastNode: '$0.01/Run',
  // Pika models
  PikaImageToVideoNode2_2: 'Variable pricing',
  PikaTextToVideoNode2_2: 'Variable pricing',
  PikaScenesV2_2: 'Variable pricing',
  PikaStartEndFrameNode2_2: 'Variable pricing',
  Pikadditions: '$0.3/Run',
  Pikaswaps: '$0.3/Run',
  Pikaffects: '$0.45/Run'
}

/**
 * Simple utility function to get the price for a node
 * Returns a formatted price string or default value if the node isn't found
 */
export function getNodePrice(
  node: LGraphNode,
  defaultPrice = '0.02/Run (approx)'
): string {
  if (!node.constructor.nodeData?.api_node) {
    return ''
  }
  return NODE_PRICES[node.constructor.name] || defaultPrice
}

/**
 * Composable to get node pricing information for API nodes
 */
export const useNodePricing = () => {
  /**
   * Get the price display for a node
   */
  const getNodePriceDisplay = (node: LGraphNode): string => {
    if (!node.constructor.nodeData?.api_node) {
      return ''
    }
    return NODE_PRICES[node.constructor.name] || '0.02/Run (approx)'
  }

  return {
    getNodePriceDisplay
  }
}
