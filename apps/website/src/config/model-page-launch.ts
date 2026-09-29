export type ModelPageLaunch = 'all' | ReadonlySet<string>

export const WAVE_1_ROUTER_IDS_BY_FAMILY = {
  'Krea 2': [
    'krea/krea-2-large',
    'krea/krea-2-medium',
    'krea/krea-2-medium-turbo'
  ],
  'Seedance 2': [
    'byteplus/dreamina-seedance-2-5-260628',
    'byteplus/dreamina-seedance-2-0-260128',
    'byteplus/dreamina-seedance-2-0-fast-260128',
    'byteplus/dreamina-seedance-2-0-mini'
  ],
  'FLUX 3': ['bfl/flux-3-video'],
  'SeedVR2 and WaveSpeed upscalers': [
    'wavespeed/seedvr2',
    'wavespeed/flashvsr',
    'wavespeed/ultimate-image-upscaler'
  ],
  Ideogram: ['ideogram/ideogram-v3', 'ideogram/ideogram-v4'],
  Wan: [
    'wan/wan2.5-i2i-preview',
    'wan/wan2.5-t2i-preview',
    'wan/wan2.6-i2v',
    'wan/wan2.6-r2v',
    'wan/wan2.6-t2v',
    'wan/wan2.7-i2v',
    'wan/wan2.7-r2v',
    'wan/wan2.7-t2v',
    'wan/wan2.7-videoedit',
    'wan/wan3.0-video',
    'wan/wan3.0-video-prime'
  ],
  'FLUX 2 and Kontext': [
    'bfl/flux-2-max',
    'bfl/flux-2-pro',
    'bfl/flux-kontext-max',
    'bfl/flux-kontext-pro'
  ],
  'Gemini Omni': [
    'gemini-interactions/gemini-omni-1.1-flash',
    'gemini-interactions/gemini-omni-flash-preview'
  ],
  'Grok Imagine': [
    'xai/grok-imagine-image',
    'xai/grok-imagine-image-2.0',
    'xai/grok-imagine-video',
    'xai/grok-imagine-video-1.5'
  ],
  'GPT Image': [
    'openai/gpt-image-1',
    'openai/gpt-image-1.5',
    'openai/gpt-image-2',
    'openai/gpt-image-2.5-flare',
    'openai/gpt-image-2.5-sunburst'
  ]
} as const satisfies Readonly<Record<string, readonly string[]>>

export const launchedModelPages: ModelPageLaunch = new Set(
  Object.values(WAVE_1_ROUTER_IDS_BY_FAMILY).flat()
)
