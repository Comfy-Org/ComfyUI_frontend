/**
 * Toolkit (Essentials) node detection constants.
 *
 * Used by telemetry to track toolkit node adoption and popularity.
 * Only novel nodes — basic nodes (LoadImage, SaveImage, etc.) are excluded.
 *
 * Source: https://www.notion.so/comfy-org/2fe6d73d365080d0a951d14cdf540778
 */

/**
 * Canonical node type names for individual toolkit nodes.
 */
export const TOOLKIT_NODE_NAMES: ReadonlySet<string> = new Set([
  // Image Tools
  'ImageCrop',
  'ImageRotate',
  'ImageBlur',
  'ImageInvert',
  'ImageCompare',
  'Canny',

  // Video Tools
  'Video Slice',

  // API Nodes
  'RecraftRemoveBackgroundNode',
  'RecraftVectorizeImageNode',
  'KlingOmniProEditVideoNode'
])

/**
 * python_module values that identify toolkit blueprint nodes.
 * Essentials blueprints are registered with node_pack 'comfy_essentials',
 * which maps to python_module on the node def.
 */
export const TOOLKIT_BLUEPRINT_MODULES: ReadonlySet<string> = new Set([
  'comfy_essentials'
])
