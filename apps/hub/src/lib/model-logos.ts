const MODEL_TO_LOGO: Record<string, string> = {
  Grok: 'grok',
  OpenAI: 'openai',
  Stability: 'stability',
  'Stable Diffusion': 'stability',
  SDXL: 'stability',
  'SDXL-Inpainting': 'stability',
  'Stable Audio': 'stability',
  Wan: 'wan',
  Flux: 'bfl',
  Google: 'google',
  Runway: 'runway',
  Luma: 'luma',
  Kling: 'kling',
  Hunyuan: 'hunyuan',
  ByteDance: 'bytedance',
  HitPaw: 'hitpaw',
  Recraft: 'recraft',
  Topaz: 'topaz',
  Vidu: 'vidu',
  WaveSpeed: 'wavespeed',
  Mochi: 'mochi',
  Pika: 'pika',
  Sora: 'sora',
  Minimax: 'minimax',
  Lightricks: 'lightricks',
  Ideogram: 'ideogram',
  Magnific: 'magnific',
  Rodin: 'rodin',
  Tripo: 'tripo',
  PixVerse: 'pixverse',
  Bria: 'bria'
}

export function getModelLogoPath(
  modelName: string,
  provider?: string
): string | null {
  if (provider) {
    const slug = MODEL_TO_LOGO[provider]
    if (slug) return `/logos/${slug}.png`
  }
  const slug = MODEL_TO_LOGO[modelName]
  if (slug) return `/logos/${slug}.png`

  const lower = modelName.toLowerCase()
  for (const [key, val] of Object.entries(MODEL_TO_LOGO)) {
    if (lower.includes(key.toLowerCase())) {
      return `/logos/${val}.png`
    }
  }
  return null
}
