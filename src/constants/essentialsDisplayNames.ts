import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const BLUEPRINT_PREFIX = 'SubgraphBlueprint.'

/**
 * Static mapping of node names to their Essentials tab display names.
 * Only includes nodes that currently exist (status ✅ in the tracker).
 */
const EXACT_NAME_MAP: Record<string, string> = {
  // Basics
  LoadImage: 'Load Image',
  SaveImage: 'Save Image',
  LoadVideo: 'Load Video',
  SaveVideo: 'Save Video',
  Load3D: 'Load 3D model',
  SaveGLB: 'Save 3D Model',
  CLIPTextEncode: 'Text',

  // Image Tools
  ImageBatch: 'Batch Image',
  ImageCrop: 'Crop Image',
  ImageScale: 'Resize Image',
  ImageRotate: 'Rotate',
  ImageBlur: 'Blur',
  ImageInvert: 'Invert',
  Canny: 'Canny',
  RecraftRemoveBackgroundNode: 'Remove Background',
  'image compare': 'Image compare',

  // Video Tools
  GetVideoComponents: 'Extract frame',

  // Image Generation
  LoraLoader: 'Load style (LoRA)',

  // Video Generation
  KlingLipSyncAudioToVideoNode: 'Lipsync',

  // Text Generation
  OpenAIChatNode: 'Text generation (LLM)',

  // 3D
  TencentTextToModelNode: 'Text to 3D model',
  TencentImageToModelNode: 'Image to 3D Model',

  // Audio
  StabilityTextToAudio: 'Music generation',
  LoadAudio: 'Load Audio',
  SaveAudio: 'Save Audio'
}

/**
 * Blueprint prefix patterns mapped to display names.
 * Entries are matched by checking if the blueprint filename
 * (after removing the SubgraphBlueprint. prefix) starts with the key.
 * Ordered longest-first so more specific prefixes match before shorter ones.
 */
const BLUEPRINT_PREFIX_MAP: [prefix: string, displayName: string][] = [
  // Image Generation
  ['image_inpainting_', 'Inpaint image'],
  ['image_outpainting_', 'Outpaint image'],
  ['image_edit', 'Image to image'],
  ['text_to_image', 'Text to image'],
  ['pose_to_image', 'Pose to image'],
  ['canny_to_image', 'Canny to image'],
  ['depth_to_image', 'Depth to image'],

  // Video Generation
  ['text_to_video', 'Text to video'],
  ['image_to_video', 'Image to video'],
  ['pose_to_video', 'Pose to video'],
  ['canny_to_video', 'Canny to video'],
  ['depth_to_video', 'Depth to video']
]

function resolveBlueprintDisplayName(
  blueprintName: string
): string | undefined {
  for (const [prefix, displayName] of BLUEPRINT_PREFIX_MAP) {
    if (blueprintName.startsWith(prefix)) {
      return displayName
    }
  }
  return undefined
}

/**
 * Resolves the Essentials tab display name for a given node definition.
 * Returns `undefined` if the node has no Essentials display name mapping.
 */
export function resolveEssentialsDisplayName(
  nodeDef: Pick<ComfyNodeDefImpl, 'name'>
): string | undefined {
  const { name } = nodeDef

  if (name.startsWith(BLUEPRINT_PREFIX)) {
    const blueprintName = name.slice(BLUEPRINT_PREFIX.length)
    return resolveBlueprintDisplayName(blueprintName)
  }

  return EXACT_NAME_MAP[name]
}
