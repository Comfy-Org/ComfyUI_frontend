/**
 * Single source of truth for Essentials tab node categorization and ordering.
 *
 * Adding a new node to the Essentials tab? Add it to ESSENTIALS_NODE_PATHS.
 *
 * Section/subgroup labels mirror the Jump-To menu structure defined in
 * src/constants/essentialsPlaceholders.ts so the "All Nodes" tree and the
 * Essentials tab navigation stay aligned.
 *
 * Source: https://www.notion.so/comfy-org/2fe6d73d365080d0a951d14cdf540778
 */

export const ESSENTIALS_ICON_OVERRIDES: Record<string, string> = {
  LoadImage: 'icon-s1.3-[lucide--image-up]',
  LoadImageOutput: 'icon-s1.3-[lucide--image-up]',
  SaveImage: 'icon-s1.3-[lucide--image-down]',
  PrimitiveStringMultiline: 'icon-s1.3-[lucide--text]',
  ImageCrop: 'icon-s1.3-[lucide--crop]',
  VideoCrop: 'icon-s1.3-[lucide--crop]',
  KlingLipSyncAudioToVideoNode: 'icon-s1.3-[lucide--mic-vocal]',
  WebcamCapture: 'icon-s1.3-[lucide--camera]'
}

/**
 * A node's placement in the Essentials tree.
 * Section and subgroup labels match ESSENTIAL_PLACEHOLDER_SECTIONS.
 */
export interface EssentialsPath {
  section: EssentialsSection
  subgroup?: string
}

export const ESSENTIALS_SECTIONS = [
  'Inputs & Outputs',
  'Generate',
  'Control & Guidance',
  'Editing & Utilities'
] as const

export type EssentialsSection = (typeof ESSENTIALS_SECTIONS)[number]

export const ESSENTIALS_SUBGROUPS: Record<
  EssentialsSection,
  readonly string[]
> = {
  'Inputs & Outputs': [],
  Generate: ['Image', 'Video', 'Text', 'Audio', '3D'],
  'Control & Guidance': ['Image', 'Video'],
  'Editing & Utilities': [
    'Image Transform',
    'Image Utilities',
    'Image Filters & Effects',
    'Image Color',
    'Image Selection & Masking',
    'Video Transform',
    'Video Compose',
    'Video Selection & Masking',
    '3D Transform'
  ]
}

/**
 * Ordered list of (node name, path) pairs.
 * Array order = display order within each section/subgroup bucket.
 */
export const ESSENTIALS_NODE_PATHS: ReadonlyArray<
  readonly [string, EssentialsPath]
> = [
  // Inputs & Outputs
  ['LoadImage', { section: 'Inputs & Outputs' }],
  ['LoadVideo', { section: 'Inputs & Outputs' }],
  ['Load3D', { section: 'Inputs & Outputs' }],
  ['LoadAudio', { section: 'Inputs & Outputs' }],
  ['LoadImageMask', { section: 'Inputs & Outputs' }],
  ['PrimitiveStringMultiline', { section: 'Inputs & Outputs' }],
  ['SaveImage', { section: 'Inputs & Outputs' }],
  ['SaveVideo', { section: 'Inputs & Outputs' }],
  ['SaveGLB', { section: 'Inputs & Outputs' }],
  ['SaveAudio', { section: 'Inputs & Outputs' }],
  ['SaveAudioMP3', { section: 'Inputs & Outputs' }],
  ['PreviewImage', { section: 'Inputs & Outputs' }],

  // Generate / Image
  ['LoraLoader', { section: 'Generate', subgroup: 'Image' }],
  ['LoraLoaderModelOnly', { section: 'Generate', subgroup: 'Image' }],
  ['ConditioningCombine', { section: 'Generate', subgroup: 'Image' }],
  ['RecraftVectorizeImageNode', { section: 'Generate', subgroup: 'Image' }],

  // Generate / Video
  [
    'SubgraphBlueprint.pose_to_video_ltx_2_0',
    { section: 'Generate', subgroup: 'Video' }
  ],
  [
    'SubgraphBlueprint.canny_to_video_ltx_2_0',
    { section: 'Generate', subgroup: 'Video' }
  ],
  ['KlingLipSyncAudioToVideoNode', { section: 'Generate', subgroup: 'Video' }],
  ['KlingOmniProEditVideoNode', { section: 'Generate', subgroup: 'Video' }],

  // Generate / Text
  ['OpenAIChatNode', { section: 'Generate', subgroup: 'Text' }],

  // Generate / Audio
  ['StabilityTextToAudio', { section: 'Generate', subgroup: 'Audio' }],
  ['EmptyLatentAudio', { section: 'Generate', subgroup: 'Audio' }],

  // Generate / 3D
  ['TencentTextToModelNode', { section: 'Generate', subgroup: '3D' }],
  ['TencentImageToModelNode', { section: 'Generate', subgroup: '3D' }],

  // Control & Guidance / Image
  ['Canny', { section: 'Control & Guidance', subgroup: 'Image' }],

  // Editing & Utilities / Image Transform
  [
    'ImageCrop',
    { section: 'Editing & Utilities', subgroup: 'Image Transform' }
  ],
  [
    'ImageCropV2',
    { section: 'Editing & Utilities', subgroup: 'Image Transform' }
  ],
  [
    'ImageScale',
    { section: 'Editing & Utilities', subgroup: 'Image Transform' }
  ],
  [
    'ImageScaleBy',
    { section: 'Editing & Utilities', subgroup: 'Image Transform' }
  ],
  [
    'ImageRotate',
    { section: 'Editing & Utilities', subgroup: 'Image Transform' }
  ],

  // Editing & Utilities / Image Utilities
  [
    'ImageBatch',
    { section: 'Editing & Utilities', subgroup: 'Image Utilities' }
  ],
  [
    'ImageBlend',
    { section: 'Editing & Utilities', subgroup: 'Image Utilities' }
  ],
  [
    'ImageCompare',
    { section: 'Editing & Utilities', subgroup: 'Image Utilities' }
  ],

  // Editing & Utilities / Image Filters & Effects
  [
    'ImageBlur',
    { section: 'Editing & Utilities', subgroup: 'Image Filters & Effects' }
  ],
  [
    'ImageInvert',
    { section: 'Editing & Utilities', subgroup: 'Image Filters & Effects' }
  ],
  [
    'GLSLShader',
    { section: 'Editing & Utilities', subgroup: 'Image Filters & Effects' }
  ],

  // Editing & Utilities / Image Selection & Masking
  [
    'RecraftRemoveBackgroundNode',
    {
      section: 'Editing & Utilities',
      subgroup: 'Image Selection & Masking'
    }
  ],

  // Editing & Utilities / Video Compose
  [
    'GetVideoComponents',
    { section: 'Editing & Utilities', subgroup: 'Video Compose' }
  ],
  [
    'CreateVideo',
    { section: 'Editing & Utilities', subgroup: 'Video Compose' }
  ],
  ['Video Slice', { section: 'Editing & Utilities', subgroup: 'Video Compose' }]
]

/**
 * Lookup: node name → path.
 * Frontend takes precedence over backend `essentials_category` for known nodes.
 */
export const ESSENTIALS_NODE_PATH_MAP: ReadonlyMap<string, EssentialsPath> =
  new Map(ESSENTIALS_NODE_PATHS)

/**
 * Display order rank for sections. Lower = earlier.
 */
export const ESSENTIALS_SECTION_RANK: ReadonlyMap<string, number> = new Map(
  ESSENTIALS_SECTIONS.map((s, i) => [s, i])
)

/**
 * Display order rank for subgroups within each section.
 */
export const ESSENTIALS_SUBGROUP_RANK: ReadonlyMap<
  string,
  ReadonlyMap<string, number>
> = new Map(
  (Object.entries(ESSENTIALS_SUBGROUPS) as [EssentialsSection, string[]][]).map(
    ([section, subs]) => [section, new Map(subs.map((s, i) => [s, i]))]
  )
)

/**
 * Display order rank for nodes within each (section, subgroup) bucket.
 */
export const ESSENTIALS_NODE_RANK: ReadonlyMap<string, number> = (() => {
  const rank = new Map<string, number>()
  const counters = new Map<string, number>()
  for (const [name, path] of ESSENTIALS_NODE_PATHS) {
    const key = path.subgroup
      ? `${path.section}\0${path.subgroup}`
      : path.section
    const idx = counters.get(key) ?? 0
    rank.set(name, idx)
    counters.set(key, idx + 1)
  }
  return rank
})()

/**
 * Legacy backend categories (lower-case) → section label.
 * Allows older `essentials_category` values from the backend to slot into
 * the new structure as a section-only path.
 */
const LEGACY_BACKEND_CATEGORY_TO_SECTION: ReadonlyMap<
  string,
  EssentialsSection
> = new Map([
  ['basics', 'Inputs & Outputs'],
  ['text generation', 'Generate'],
  ['image generation', 'Generate'],
  ['video generation', 'Generate'],
  ['audio', 'Generate'],
  ['3d', 'Generate'],
  ['image tools', 'Editing & Utilities'],
  ['video tools', 'Editing & Utilities']
])

/**
 * Case-insensitive lookup mapping any known category string (new section
 * labels, subgroup labels, or legacy backend names) to its canonical form.
 *
 * Used by `nodeDefStore` to normalize backend `essentials_category` values.
 */
export const ESSENTIALS_CATEGORY_CANONICAL: ReadonlyMap<string, string> =
  new Map<string, string>([
    ...ESSENTIALS_SECTIONS.map((s): [string, string] => [s.toLowerCase(), s]),
    ...Object.values(ESSENTIALS_SUBGROUPS)
      .flat()
      .map((s): [string, string] => [s.toLowerCase(), s]),
    ...Array.from(LEGACY_BACKEND_CATEGORY_TO_SECTION.entries())
  ])

/**
 * Resolve a raw backend `essentials_category` string to a section-only path.
 * Returns undefined if the value isn't recognized.
 */
export function resolveBackendEssentialsPath(
  raw: string | undefined
): EssentialsPath | undefined {
  if (!raw) return undefined
  const lower = raw.toLowerCase()
  const legacy = LEGACY_BACKEND_CATEGORY_TO_SECTION.get(lower)
  if (legacy) return { section: legacy }
  const section = ESSENTIALS_SECTIONS.find((s) => s.toLowerCase() === lower)
  if (section) return { section }
  return undefined
}

/**
 * "Novel" toolkit nodes for telemetry — Inputs & Outputs excluded.
 */
export const TOOLKIT_NOVEL_NODE_NAMES: ReadonlySet<string> = new Set(
  ESSENTIALS_NODE_PATHS.filter(
    ([, path]) => path.section !== 'Inputs & Outputs'
  )
    .map(([name]) => name)
    .filter((n) => !n.startsWith('SubgraphBlueprint.'))
)

/**
 * python_module values that identify toolkit blueprint nodes.
 */
export const TOOLKIT_BLUEPRINT_MODULES: ReadonlySet<string> = new Set([
  'comfy_essentials'
])
