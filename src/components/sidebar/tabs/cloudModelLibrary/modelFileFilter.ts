import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const MODEL_FILE_EXTENSIONS = new Set([
  'safetensors',
  'sft',
  'ckpt',
  'pt',
  'pt2',
  'pth',
  'bin',
  'onnx',
  'gguf',
  'ggml',
  'pkl',
  'h5',
  'pb',
  'tflite',
  'engine',
  'trt'
])

const JUNK_BASENAMES = new Set(['license', 'readme', 'notice', 'changelog'])

function extensionOf(name: string): string | null {
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === name.length - 1) return null
  const candidate = name.slice(dotIndex + 1)
  // Display names like "Flux.1 [dev]" contain dots that aren't extensions;
  // only treat short alphanumeric trailing segments as one.
  if (!/^[a-zA-Z0-9]{1,12}$/.test(candidate)) return null
  return candidate.toLowerCase()
}

function basenameOf(name: string): string {
  const segments = name.split('/')
  const last = segments[segments.length - 1]
  const dotIndex = last.lastIndexOf('.')
  return dotIndex > 0 ? last.slice(0, dotIndex) : last
}

/**
 * Whether a library entry looks like an actual model file rather than a
 * sidecar shipped alongside one (configs, tokenizers, fonts, licenses).
 * Names without a parseable extension are kept: cloud display names often
 * omit the file extension, so only a recognised non-model extension or a
 * known junk basename excludes an entry.
 */
export function isLikelyModelFile(asset: AssetItem): boolean {
  const fileName =
    typeof asset.metadata?.filename === 'string'
      ? asset.metadata.filename
      : asset.name
  if (JUNK_BASENAMES.has(basenameOf(fileName).toLowerCase())) return false
  const extension = extensionOf(fileName)
  if (!extension) return true
  return MODEL_FILE_EXTENSIONS.has(extension)
}
