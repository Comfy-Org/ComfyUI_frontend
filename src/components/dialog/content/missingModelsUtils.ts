// TODO: Read this from server internal API rather than hardcoding here
// as some installations may wish to use custom sources
const ALLOWED_SOURCES = [
  'https://civitai.com/',
  'https://huggingface.co/',
  'http://localhost:' // Included for testing usage only
]

const ALLOWED_SUFFIXES = ['.safetensors', '.sft']

// Models that fail above conditions but are still allowed
const WHITE_LISTED_URLS = new Set([
  'https://huggingface.co/stabilityai/stable-zero123/resolve/main/stable_zero123.ckpt',
  'https://huggingface.co/TencentARC/T2I-Adapter/resolve/main/models/t2iadapter_depth_sd14v1.pth?download=true',
  'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth'
])

const DIRECTORY_BADGE_MAP: Record<string, string> = {
  vae: 'VAE',
  diffusion_models: 'DIFFUSION',
  text_encoders: 'TEXT ENCODER',
  loras: 'LORA',
  checkpoints: 'CHECKPOINT'
}

interface ModelWithUrl {
  name: string
  url: string
  directory: string
}

export function isModelDownloadable(model: ModelWithUrl): boolean {
  if (WHITE_LISTED_URLS.has(model.url)) return true
  if (!ALLOWED_SOURCES.some((source) => model.url.startsWith(source)))
    return false
  if (!ALLOWED_SUFFIXES.some((suffix) => model.name.endsWith(suffix)))
    return false
  return true
}

export function hasValidDirectory(
  model: ModelWithUrl,
  paths: Record<string, string[]>
): boolean {
  return !!paths[model.directory]
}

export function getBadgeLabel(directory: string): string {
  return DIRECTORY_BADGE_MAP[directory] ?? directory.toUpperCase()
}
