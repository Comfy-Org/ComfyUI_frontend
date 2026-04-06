export const LOCALE_INDEX_FILES: Record<string, string> = {
  en: 'index.json',
  zh: 'index.zh.json',
  'zh-TW': 'index.zh-TW.json',
  ja: 'index.ja.json',
  ko: 'index.ko.json',
  es: 'index.es.json',
  fr: 'index.fr.json',
  ru: 'index.ru.json',
  tr: 'index.tr.json',
  ar: 'index.ar.json',
  'pt-BR': 'index.pt-BR.json'
}

export const DEFAULT_LOCALE = 'en'

export const ASSET_EXTENSIONS = [
  '.webp',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.mp3',
  '.mp4',
  '.webm'
]

export const HEAVY_NODE_TYPES = new Set([
  'KSampler',
  'KSamplerAdvanced',
  'SamplerCustom',
  'SamplerCustomAdvanced',
  'VAEDecode',
  'VAEEncode',
  'CheckpointLoaderSimple',
  'UNETLoader',
  'DualCLIPLoader',
  'CLIPLoader',
  'ControlNetLoader',
  'LoraLoader',
  'VideoLinearCFGGuidance',
  'ImageUpscaleWithModel'
])

export const VIDEO_NODE_TYPES = new Set([
  'VHS_VideoCombine',
  'VideoLinearCFGGuidance',
  'ImageOnlyCheckpointLoader'
])

export const LOGO_FILENAME_FIXES: Record<string, string> = {
  'recarft.png': 'recraft.png'
}
