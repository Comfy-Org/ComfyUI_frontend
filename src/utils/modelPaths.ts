/**
 * Model path utilities for generating standard ComfyUI directory structures.
 * Preserves exact folder ordering and subfolder structure from legacy API (assets "off" mode).
 *
 * Manual inspection documented:
 * - 14 main directories in specific order
 * - 3 hierarchical: controlnet, loras, upscale_models
 * - 11 flat: checkpoints, clip, clip_vision, configs, diffusion_models, embeddings, gligen, hypernetworks, style_models, unet, vae
 */

interface DirectoryConfig {
  /** Order position from legacy API (0-based) */
  order: number
  /** Alternative directory names for this model type */
  aliases: string[]
  /** Subfolders within this directory (empty if flat structure) */
  subfolders: string[]
}

/**
 * Consolidated directory configuration preserving legacy API structure
 * Each entry contains all metadata for a model directory type
 */
const DIRECTORY_CONFIG: Record<string, DirectoryConfig> = {
  // Legacy API order preserved (manually documented)
  checkpoints: {
    order: 0,
    aliases: ['checkpoints', 'Stable-diffusion'],
    subfolders: []
  },
  clip: { order: 1, aliases: ['clip'], subfolders: [] },
  clip_vision: { order: 2, aliases: ['clip_vision'], subfolders: [] },
  configs: { order: 3, aliases: ['configs'], subfolders: [] },
  controlnet: {
    order: 4,
    aliases: ['controlnet', 'ControlNet'],
    subfolders: ['preprocessors', 'diffusers_xl', 'diffusers']
  },
  diffusion_models: {
    order: 5,
    aliases: ['diffusion_models', 'unet'],
    subfolders: []
  },
  embeddings: {
    order: 6,
    aliases: ['embeddings', 'textual_inversion'],
    subfolders: []
  },
  gligen: { order: 7, aliases: ['gligen'], subfolders: [] },
  hypernetworks: { order: 8, aliases: ['hypernetworks'], subfolders: [] },
  loras: {
    order: 9,
    aliases: ['loras', 'Lora'],
    subfolders: ['character', 'style', 'concept']
  },
  style_models: { order: 10, aliases: ['style_models'], subfolders: [] },
  unet: { order: 11, aliases: ['unet', 'diffusion_models'], subfolders: [] },
  upscale_models: {
    order: 12,
    aliases: ['upscale_models', 'ESRGAN', 'RealESRGAN', 'SwinIR'],
    subfolders: ['RealESRGAN', 'ESRGAN', 'SwinIR']
  },
  vae: { order: 13, aliases: ['vae', 'VAE'], subfolders: [] },

  // Extended types not in legacy API
  controlnet_aux: { order: 100, aliases: ['controlnet_aux'], subfolders: [] },
  t2i_adapter: { order: 101, aliases: ['t2i_adapter'], subfolders: [] },
  ip_adapter: { order: 102, aliases: ['ipadapter'], subfolders: [] },
  ultralytics: { order: 103, aliases: ['ultralytics'], subfolders: [] },
  text_encoders: {
    order: 104,
    aliases: ['text_encoders', 'clip'],
    subfolders: []
  },
  animatediff_models: {
    order: 105,
    aliases: ['animatediff_models'],
    subfolders: []
  },
  animatediff_motion_lora: {
    order: 106,
    aliases: ['animatediff_motion_lora'],
    subfolders: []
  },
  instantid: { order: 107, aliases: ['instantid'], subfolders: [] },
  custom_nodes: { order: 108, aliases: ['custom_nodes'], subfolders: [] },
  classifiers: { order: 109, aliases: ['classifiers'], subfolders: [] },
  sams: { order: 110, aliases: ['sams'], subfolders: [] },
  'grounding-dino': { order: 111, aliases: ['grounding-dino'], subfolders: [] },
  llm_gguf: { order: 112, aliases: ['llm_gguf'], subfolders: [] },
  whisper: { order: 113, aliases: ['whisper'], subfolders: [] },
  deepbooru: { order: 114, aliases: ['deepbooru'], subfolders: [] },
  onnx: { order: 115, aliases: ['onnx'], subfolders: [] },
  photomaker: { order: 116, aliases: ['photomaker'], subfolders: [] }
}

const DEFAULT_BASE_PATHS = [
  '/ComfyUI/models',
  '/app/ComfyUI/models',
  'C:\\ComfyUI\\models',
  './models'
]

/**
 * Builds a filesystem path with proper separator detection
 */
function buildPath(basePath: string, ...segments: string[]): string {
  const separator = basePath.includes('\\') ? '\\' : '/'
  return [basePath, ...segments].join(separator)
}

/**
 * Generates all possible paths for a directory type including subfolders
 */
function generateDirectoryPaths(
  directoryType: string,
  basePaths: string[] = DEFAULT_BASE_PATHS
): string[] {
  const config = DIRECTORY_CONFIG[directoryType] || {
    order: 999,
    aliases: [directoryType],
    subfolders: []
  }

  return basePaths.flatMap((basePath) =>
    config.aliases.flatMap((alias) => {
      const mainPath = buildPath(basePath, alias)
      const subfolderPaths = config.subfolders.map((subfolder) =>
        buildPath(mainPath, subfolder)
      )
      return [mainPath, ...subfolderPaths]
    })
  )
}

/**
 * Returns directories in legacy API order
 */
function getLegacyOrderedDirectories(): string[] {
  return Object.keys(DIRECTORY_CONFIG)
    .filter((dir) => DIRECTORY_CONFIG[dir].order < 100) // Only legacy directories
    .sort((a, b) => DIRECTORY_CONFIG[a].order - DIRECTORY_CONFIG[b].order)
}

/**
 * Maps directories to their generated paths
 */
function mapDirectoriesToPaths(
  directories: string[],
  basePaths: string[]
): Record<string, string[]> {
  return directories.reduce<Record<string, string[]>>((result, directory) => {
    result[directory] = generateDirectoryPaths(directory, basePaths)
    return result
  }, {})
}

/**
 * Generates complete folder paths mapping preserving legacy order
 */
export function generateAllStandardPaths(
  basePaths: string[] = DEFAULT_BASE_PATHS
): Record<string, string[]> {
  const legacyDirectories = getLegacyOrderedDirectories()
  return mapDirectoriesToPaths(legacyDirectories, basePaths)
}

/**
 * Merges asset API directories with standard paths, preserving legacy order
 */
export function mergeWithAssetDirectories(
  assetDirectories: string[],
  basePaths: string[] = DEFAULT_BASE_PATHS
): Record<string, string[]> {
  const legacyDirectories = getLegacyOrderedDirectories()

  // Add known directories in legacy order
  const knownDirectories = legacyDirectories.filter((directory) =>
    assetDirectories.includes(directory)
  )
  const legacyResult = mapDirectoriesToPaths(knownDirectories, basePaths)

  // Add unknown directories
  const unknownDirectories = assetDirectories.filter(
    (directory) => !legacyResult[directory]
  )
  const unknownResult = mapDirectoriesToPaths(unknownDirectories, basePaths)

  return { ...legacyResult, ...unknownResult }
}

/**
 * Gets directory configuration metadata
 */
export function getDirectoryConfig(
  directoryType: string
): DirectoryConfig | undefined {
  return DIRECTORY_CONFIG[directoryType]
}

/**
 * Checks if directory has hierarchical structure
 */
export function hasSubfolders(directoryType: string): boolean {
  return (getDirectoryConfig(directoryType)?.subfolders?.length ?? 0) > 0
}

/**
 * Gets the legacy directory order as documented from manual inspection
 */
export function getLegacyDirectoryOrder(): string[] {
  return getLegacyOrderedDirectories()
}
