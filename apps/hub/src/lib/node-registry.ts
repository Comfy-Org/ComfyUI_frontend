/**
 * Registry of ComfyUI custom nodes and their package information.
 * Used to identify which custom nodes a workflow requires and provide
 * installation links via ComfyUI Manager.
 */

export interface CustomNodeInfo {
  package: string
  url: string
  description?: string
}

/**
 * ComfyUI Manager base URL for installing custom nodes
 */
export const COMFYUI_MANAGER_INSTALL_URL =
  'https://github.com/ltdrdata/ComfyUI-Manager#how-to-use'

/**
 * Built-in ComfyUI node types that don't require custom node installation.
 * These are included in the base ComfyUI installation.
 */
export const BUILTIN_NODE_TYPES = new Set([
  // Core nodes
  'KSampler',
  'KSamplerAdvanced',
  'KSamplerSelect',
  'SamplerCustomAdvanced',
  'CheckpointLoaderSimple',
  'CLIPLoader',
  'CLIPTextEncode',
  'CLIPVisionLoader',
  'CLIPVisionEncode',
  'VAELoader',
  'VAEDecode',
  'VAEDecodeTiled',
  'VAEEncode',
  'UNETLoader',
  'DualCLIPLoader',
  'LoraLoader',
  'LoraLoaderModelOnly',
  'LoadImage',
  'SaveImage',
  'PreviewImage',
  'LoadVideo',
  'SaveVideo',
  'CreateVideo',
  'LoadAudio',
  'EmptyLatentImage',
  'EmptySD3LatentImage',
  'LatentUpscale',
  'ImageScale',
  'ImageScaleToTotalPixels',
  'ImageCrop',
  'ImageBatch',
  'ImageFromBatch',
  'ConditioningCombine',
  'ConditioningZeroOut',
  'ConditioningSetMask',
  'ControlNetLoader',
  'ControlNetApply',
  'CFGGuider',
  'BasicGuider',
  'BasicScheduler',
  'RandomNoise',
  'FluxGuidance',
  'ModelSamplingSD3',
  'ModelSamplingAuraFlow',
  'Canny',
  'MaskToImage',
  'ImageToMask',
  'SolidMask',
  'InvertMask',
  'CropMask',
  'FeatherMask',
  'GrowMask',

  // Utility/UI nodes
  'Note',
  'MarkdownNote',
  'Reroute',
  'PrimitiveNode',
  'PrimitiveInt',
  'PrimitiveFloat',
  'PrimitiveStringMultiline',
  'PreviewAny',
  'Preview3D',

  // Data types (not actual nodes, but type identifiers)
  'CLIP',
  'VAE',
  'MODEL',
  'LATENT',
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'CONDITIONING',
  'CONTROL_NET',
  'STRING',
  'INT',
  'FLOAT',
  'BOOLEAN',
  'MASK',
  'SIGMAS',
  'SAMPLER',
  'NOISE',
  'GUIDER',
  'COMBO',
  'INT,FLOAT',
  'CLIP_VISION',
  'CLIP_VISION_OUTPUT',
  'MESH',
  'VOXEL',

  // Wan/Video nodes (built-in with ComfyUI video support)
  'WanImageToVideo',
  'WanFirstLastFrameToVideo',

  // LTX nodes (built-in)
  'LTXVConditioning',
  'LTXVImgToVideoInplace',
  'LTXVSeparateAVLatent',
  'LTXVConcatAVLatent',
  'LTXVLatentUpsampler',
  'LTXVEmptyLatentAudio',
  'LTXVAudioVAELoader',
  'LTXVAudioVAEDecode',
  'LTXAVTextEncoderLoader',
  'EmptyLTXVLatentVideo',

  // Flux nodes (built-in)
  'Flux2Scheduler',
  'EmptyFlux2LatentImage',

  // API nodes (built-in cloud API integrations)
  'GeminiImage2Node',
  'GeminiNode',
  'KlingStartEndFrameNode'
])

/**
 * Mapping of custom node types to their package information.
 * Key: node type as it appears in workflow JSON
 * Value: package info with GitHub repo URL
 */
export const CUSTOM_NODE_REGISTRY: Record<string, CustomNodeInfo> = {
  // ComfyUI Essentials
  'SimpleMath+': {
    package: 'ComfyUI_essentials',
    url: 'https://github.com/cubiq/ComfyUI_essentials',
    description: 'Essential utility nodes including math operations'
  },
  GetImageSize: {
    package: 'ComfyUI_essentials',
    url: 'https://github.com/cubiq/ComfyUI_essentials',
    description: 'Essential utility nodes missing from ComfyUI core'
  },
  ResizeAndPadImage: {
    package: 'ComfyUI_essentials',
    url: 'https://github.com/cubiq/ComfyUI_essentials',
    description: 'Essential utility nodes missing from ComfyUI core'
  },
  ImageBatchMulti: {
    package: 'ComfyUI_essentials',
    url: 'https://github.com/cubiq/ComfyUI_essentials',
    description: 'Essential utility nodes missing from ComfyUI core'
  },
  BatchImagesNode: {
    package: 'ComfyUI_essentials',
    url: 'https://github.com/cubiq/ComfyUI_essentials',
    description: 'Essential utility nodes missing from ComfyUI core'
  },

  // Qwen Image nodes
  TextEncodeQwenImageEditPlus: {
    package: 'ComfyUI-QwenVL-Nodes',
    url: 'https://github.com/ZHO-ZHO-ZHO/ComfyUI-QwenVL-Nodes',
    description: 'Qwen Vision-Language model integration'
  },

  // Reference/Style nodes
  ReferenceLatent: {
    package: 'ComfyUI-Reference-Latent',
    url: 'https://github.com/Clybius/ComfyUI-Reference-Latent',
    description: 'Reference latent conditioning for style transfer'
  },

  // CFG utilities
  CFGNorm: {
    package: 'ComfyUI-CFGNorm',
    url: 'https://github.com/Clybius/ComfyUI-CFGNorm',
    description: 'CFG normalization for improved generation quality'
  },

  // Regex utilities
  RegexReplace: {
    package: 'ComfyUI-Custom-Scripts',
    url: 'https://github.com/pythongosssss/ComfyUI-Custom-Scripts',
    description: 'UI enhancements and utility scripts for ComfyUI'
  },
  RegexExtract: {
    package: 'ComfyUI-Custom-Scripts',
    url: 'https://github.com/pythongosssss/ComfyUI-Custom-Scripts',
    description: 'UI enhancements and utility scripts for ComfyUI'
  },

  // Video helpers
  GetVideoComponents: {
    package: 'ComfyUI-VideoHelperSuite',
    url: 'https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite',
    description: 'Video loading, combining, and processing nodes'
  },
  VHS_BatchManager: {
    package: 'ComfyUI-VideoHelperSuite',
    url: 'https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite',
    description: 'Video loading, combining, and processing nodes'
  },
  VHS_VIDEOINFO: {
    package: 'ComfyUI-VideoHelperSuite',
    url: 'https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite',
    description: 'Video loading, combining, and processing nodes'
  },
  VHS_LoadVideo: {
    package: 'ComfyUI-VideoHelperSuite',
    url: 'https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite',
    description: 'Video loading, combining, and processing nodes'
  },
  VHS_VideoCombine: {
    package: 'ComfyUI-VideoHelperSuite',
    url: 'https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite',
    description: 'Video loading, combining, and processing nodes'
  },
  VHS_VideoInfo: {
    package: 'ComfyUI-VideoHelperSuite',
    url: 'https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite',
    description: 'Video loading, combining, and processing nodes'
  },

  // Audio nodes
  SaveAudioMP3: {
    package: 'ComfyUI-AudioScheduler',
    url: 'https://github.com/a1lazydog/ComfyUI-AudioScheduler',
    description: 'Audio processing and scheduling nodes for animation control'
  },

  // Manual sigmas
  ManualSigmas: {
    package: 'ComfyUI-sampler-scheduler-transforms',
    url: 'https://github.com/WASasquatch/ComfyUI-sampler-scheduler-transforms',
    description: 'Custom sampler and scheduler transform utilities'
  },

  // Latent upscale
  LatentUpscaleModelLoader: {
    package: 'ComfyUI-LatentUpscaler',
    url: 'https://github.com/city96/ComfyUI-LatentUpscaler',
    description: 'Neural network-based latent space upscaling'
  },

  // Ultimate SD Upscale
  UltimateSDUpscale: {
    package: 'ComfyUI_UltimateSDUpscale',
    url: 'https://github.com/ssitu/ComfyUI_UltimateSDUpscale',
    description: 'Tiled upscaling with SD models'
  },

  // Impact Pack nodes
  SAMLoader: {
    package: 'ComfyUI-Impact-Pack',
    url: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack',
    description:
      'Detector and detailer nodes for automatic facial enhancement and iterative upscaling'
  },
  SAMDetectorCombined: {
    package: 'ComfyUI-Impact-Pack',
    url: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack',
    description:
      'Detector and detailer nodes for automatic facial enhancement and iterative upscaling'
  },
  FaceDetailer: {
    package: 'ComfyUI-Impact-Pack',
    url: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack',
    description:
      'Detector and detailer nodes for automatic facial enhancement and iterative upscaling'
  },
  DetailerForEach: {
    package: 'ComfyUI-Impact-Pack',
    url: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack',
    description:
      'Detector and detailer nodes for automatic facial enhancement and iterative upscaling'
  },

  // ControlNet Aux
  CannyEdgePreprocessor: {
    package: 'comfyui_controlnet_aux',
    url: 'https://github.com/Fannovel16/comfyui_controlnet_aux',
    description:
      'Plug-and-play preprocessors for generating ControlNet hint images'
  },
  DepthAnythingPreprocessor: {
    package: 'comfyui_controlnet_aux',
    url: 'https://github.com/Fannovel16/comfyui_controlnet_aux',
    description:
      'Plug-and-play preprocessors for generating ControlNet hint images'
  },
  OpenPosePreprocessor: {
    package: 'comfyui_controlnet_aux',
    url: 'https://github.com/Fannovel16/comfyui_controlnet_aux',
    description:
      'Plug-and-play preprocessors for generating ControlNet hint images'
  },
  LineArtPreprocessor: {
    package: 'comfyui_controlnet_aux',
    url: 'https://github.com/Fannovel16/comfyui_controlnet_aux',
    description:
      'Plug-and-play preprocessors for generating ControlNet hint images'
  },
  DWPreprocessor: {
    package: 'comfyui_controlnet_aux',
    url: 'https://github.com/Fannovel16/comfyui_controlnet_aux',
    description:
      'Plug-and-play preprocessors for generating ControlNet hint images'
  },
  PixelPerfectResolution: {
    package: 'comfyui_controlnet_aux',
    url: 'https://github.com/Fannovel16/comfyui_controlnet_aux',
    description:
      'Plug-and-play preprocessors for generating ControlNet hint images'
  },

  // IP-Adapter
  IPAdapterUnifiedLoader: {
    package: 'ComfyUI_IPAdapter_plus',
    url: 'https://github.com/cubiq/ComfyUI_IPAdapter_plus',
    description:
      'Image conditioning via IPAdapter models for style and composition transfer'
  },
  IPAdapterApply: {
    package: 'ComfyUI_IPAdapter_plus',
    url: 'https://github.com/cubiq/ComfyUI_IPAdapter_plus',
    description:
      'Image conditioning via IPAdapter models for style and composition transfer'
  },

  // AnimateDiff
  AnimateDiffLoader: {
    package: 'ComfyUI-AnimateDiff-Evolved',
    url: 'https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved',
    description: 'AnimateDiff motion module integration for video generation'
  },
  AnimateDiffModuleLoader: {
    package: 'ComfyUI-AnimateDiff-Evolved',
    url: 'https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved',
    description: 'AnimateDiff motion module integration for video generation'
  },

  // Florence2
  Florence2: {
    package: 'ComfyUI-Florence2',
    url: 'https://github.com/kijai/ComfyUI-Florence2',
    description:
      'Florence2 vision-language model for object detection, captioning, segmentation, and OCR'
  },

  // InstantID
  InstantIDFaceAnalysis: {
    package: 'ComfyUI_InstantID',
    url: 'https://github.com/cubiq/ComfyUI_InstantID',
    description:
      'Native InstantID face identity preservation for consistent character generation'
  },
  ApplyInstantID: {
    package: 'ComfyUI_InstantID',
    url: 'https://github.com/cubiq/ComfyUI_InstantID',
    description:
      'Native InstantID face identity preservation for consistent character generation'
  },

  // Segment Anything
  GroundingDinoSAMSegment: {
    package: 'comfyui_segment_anything',
    url: 'https://github.com/storyicon/comfyui_segment_anything',
    description: 'Text-prompted image segmentation using GroundingDINO and SAM'
  },

  // Frame Interpolation
  'FILM VFI': {
    package: 'ComfyUI-Frame-Interpolation',
    url: 'https://github.com/Fannovel16/ComfyUI-Frame-Interpolation',
    description:
      'Video frame interpolation for smooth slow-motion and frame rate conversion'
  },

  // Depth Anything V2
  DepthAnything_V2: {
    package: 'ComfyUI-DepthAnythingV2',
    url: 'https://github.com/kijai/ComfyUI-DepthAnythingV2',
    description: 'Depth Anything V2 monocular depth estimation'
  },
  DownloadAndLoadDepthAnythingV2Model: {
    package: 'ComfyUI-DepthAnythingV2',
    url: 'https://github.com/kijai/ComfyUI-DepthAnythingV2',
    description: 'Depth Anything V2 monocular depth estimation'
  },

  // Segment Anything 2
  Sam2Segmentation: {
    package: 'ComfyUI-segment-anything-2',
    url: 'https://github.com/kijai/ComfyUI-segment-anything-2',
    description:
      'SAM 2 segmentation for images and video with point and box prompts'
  },
  DownloadAndLoadSAM2Model: {
    package: 'ComfyUI-segment-anything-2',
    url: 'https://github.com/kijai/ComfyUI-segment-anything-2',
    description:
      'SAM 2 segmentation for images and video with point and box prompts'
  }
}

/**
 * Checks if a node type is a built-in ComfyUI node
 */
export function isBuiltinNode(nodeType: string): boolean {
  if (BUILTIN_NODE_TYPES.has(nodeType)) {
    return true
  }

  // UUID-style types are subgraphs, not custom nodes
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      nodeType
    )
  ) {
    return true
  }

  // Pure type identifiers (all caps with optional underscores)
  if (/^[A-Z_]+$/.test(nodeType)) {
    return true
  }

  return false
}

/**
 * Gets custom node info for a node type, or undefined if it's built-in or unknown
 */
export function getCustomNodeInfo(
  nodeType: string
): CustomNodeInfo | undefined {
  if (isBuiltinNode(nodeType)) {
    return undefined
  }
  return CUSTOM_NODE_REGISTRY[nodeType]
}

/**
 * Extracts all node types from a ComfyUI workflow JSON
 */
export function extractNodeTypes(workflowJson: unknown): string[] {
  const nodeTypes = new Set<string>()

  if (typeof workflowJson !== 'object' || workflowJson === null) {
    return []
  }

  const workflow = workflowJson as { nodes?: Array<{ type?: string }> }

  if (Array.isArray(workflow.nodes)) {
    for (const node of workflow.nodes) {
      if (typeof node.type === 'string' && node.type) {
        nodeTypes.add(node.type)
      }
    }
  }

  return Array.from(nodeTypes).sort()
}

/**
 * Identifies required custom nodes from a workflow
 */
export function identifyRequiredNodes(
  workflowJson: unknown
): Array<{ nodeType: string; info: CustomNodeInfo }> {
  const nodeTypes = extractNodeTypes(workflowJson)
  const requiredNodes: Array<{ nodeType: string; info: CustomNodeInfo }> = []
  const seenPackages = new Set<string>()

  for (const nodeType of nodeTypes) {
    const info = getCustomNodeInfo(nodeType)
    if (info && !seenPackages.has(info.package)) {
      seenPackages.add(info.package)
      requiredNodes.push({ nodeType, info })
    }
  }

  return requiredNodes
}
