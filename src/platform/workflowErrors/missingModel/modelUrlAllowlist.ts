const ALLOWED_SOURCES = [
  'https://civitai.com/',
  'https://civitai.red/',
  'https://huggingface.co/'
] as const

/** Exact model URLs the editor downloads from outside the allowed sources. */
export const WHITE_LISTED_URLS: ReadonlySet<string> = new Set([
  'https://huggingface.co/stabilityai/stable-zero123/resolve/main/stable_zero123.ckpt',
  'https://huggingface.co/TencentARC/T2I-Adapter/resolve/main/models/t2iadapter_depth_sd14v1.pth?download=true',
  'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth',
  'http://localhost:8188/api/devtools/fake_model.safetensors'
])

/** Whether the editor may download a model from this URL. */
export function isModelUrlAllowlisted(url: string): boolean {
  return (
    WHITE_LISTED_URLS.has(url) ||
    ALLOWED_SOURCES.some((source) => url.startsWith(source))
  )
}
