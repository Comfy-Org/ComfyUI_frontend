import { downloadUrlToHfRepoUrl, isCivitaiModelUrl } from '@/utils/formatUtil'
import { isDesktop } from '@/platform/distribution/types'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'

const ALLOWED_SOURCES = [
  'https://civitai.com/',
  'https://huggingface.co/',
  'http://localhost:'
] as const

// Intentionally restrictive subset of model extensions permitted for download.
// Does not include .bin, .onnx, .gguf — see MODEL_FILE_EXTENSIONS in
// missingModelScan.ts for the broader scanning set.
const ALLOWED_SUFFIXES = [
  '.safetensors',
  '.sft',
  '.ckpt',
  '.pth',
  '.pt'
] as const

const WHITE_LISTED_URLS: ReadonlySet<string> = new Set([
  'https://huggingface.co/stabilityai/stable-zero123/resolve/main/stable_zero123.ckpt',
  'https://huggingface.co/TencentARC/T2I-Adapter/resolve/main/models/t2iadapter_depth_sd14v1.pth?download=true',
  'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth'
])

interface ModelWithUrl {
  name: string
  url: string
  directory: string
}

/**
 * Converts a model download URL to a browsable page URL.
 * - HuggingFace: `/resolve/` → `/blob/` (file page with model info)
 * - Civitai: strips `/api/download` or `/api/v1` prefix (model page)
 */
export function toBrowsableUrl(url: string): string {
  if (isCivitaiModelUrl(url)) {
    return url.replace('/api/download/', '/').replace('/api/v1/', '/')
  }
  if (url.includes('huggingface.co')) {
    return url.replace('/resolve/', '/blob/')
  }
  return url
}

export function isModelDownloadable(model: ModelWithUrl): boolean {
  if (WHITE_LISTED_URLS.has(model.url)) return true
  if (!ALLOWED_SOURCES.some((source) => model.url.startsWith(source)))
    return false
  if (!ALLOWED_SUFFIXES.some((suffix) => model.name.endsWith(suffix)))
    return false
  return true
}

export function downloadModel(
  model: ModelWithUrl,
  paths: Record<string, string[]>
): void {
  if (!isDesktop) {
    const link = document.createElement('a')
    link.href = model.url
    link.download = model.name
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.click()
    return
  }

  const modelPaths = paths[model.directory]
  if (modelPaths?.[0]) {
    void useElectronDownloadStore().start({
      url: model.url,
      savePath: modelPaths[0],
      filename: model.name
    })
  }
}

interface ModelMetadata {
  fileSize: number | null
  gatedRepoUrl: string | null
}

interface CivitaiModelFile {
  sizeKB: number
  downloadUrl: string
}

interface CivitaiModelVersionResponse {
  files: CivitaiModelFile[]
}

const metadataCache = new Map<string, ModelMetadata>()
const inflight = new Map<string, Promise<ModelMetadata>>()

async function fetchCivitaiMetadata(url: string): Promise<ModelMetadata> {
  try {
    const pathname = new URL(url).pathname
    const versionIdMatch =
      pathname.match(/^\/api\/download\/models\/(\d+)$/) ??
      pathname.match(/^\/api\/v1\/models-versions\/(\d+)$/)

    if (!versionIdMatch) return { fileSize: null, gatedRepoUrl: null }

    const [, modelVersionId] = versionIdMatch
    const apiUrl = `https://civitai.com/api/v1/model-versions/${modelVersionId}`
    const res = await fetch(apiUrl)
    if (!res.ok) return { fileSize: null, gatedRepoUrl: null }

    const data: CivitaiModelVersionResponse = await res.json()
    const matchingFile = data.files?.find((file) => {
      const downloadUrl = file.downloadUrl
      return (
        typeof downloadUrl === 'string' &&
        downloadUrl.length > 0 &&
        downloadUrl.startsWith(url)
      )
    })
    const fileSize = matchingFile?.sizeKB ? matchingFile.sizeKB * 1024 : null
    return { fileSize, gatedRepoUrl: null }
  } catch {
    return { fileSize: null, gatedRepoUrl: null }
  }
}

const GATED_STATUS_CODES = new Set([401, 403, 451])

async function fetchHeadMetadata(url: string): Promise<ModelMetadata> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (!response.ok) {
      if (
        url.includes('huggingface.co') &&
        GATED_STATUS_CODES.has(response.status)
      ) {
        return { fileSize: null, gatedRepoUrl: downloadUrlToHfRepoUrl(url) }
      }
      return { fileSize: null, gatedRepoUrl: null }
    }
    const size = response.headers.get('content-length')
    const parsedSize = size ? parseInt(size, 10) : null
    return {
      fileSize:
        parsedSize !== null && !Number.isNaN(parsedSize) ? parsedSize : null,
      gatedRepoUrl: null
    }
  } catch {
    return { fileSize: null, gatedRepoUrl: null }
  }
}

function isComplete(metadata: ModelMetadata): boolean {
  return metadata.fileSize !== null || metadata.gatedRepoUrl !== null
}

export async function fetchModelMetadata(url: string): Promise<ModelMetadata> {
  const cached = metadataCache.get(url)
  if (cached !== undefined) return cached

  const existing = inflight.get(url)
  if (existing) return existing

  const promise = (async () => {
    const metadata = isCivitaiModelUrl(url)
      ? await fetchCivitaiMetadata(url)
      : await fetchHeadMetadata(url)

    if (isComplete(metadata)) {
      metadataCache.set(url, metadata)
    }
    return metadata
  })()

  inflight.set(url, promise)
  try {
    return await promise
  } finally {
    inflight.delete(url)
  }
}
