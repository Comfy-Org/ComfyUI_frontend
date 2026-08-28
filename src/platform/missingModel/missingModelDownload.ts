import { downloadUrlToHfRepoUrl, isCivitaiModelUrl } from '@/utils/formatUtil'
import { isDesktop } from '@/platform/distribution/types'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const ALLOWED_SOURCES = [
  'https://civitai.com/',
  'https://civitai.red/',
  'https://huggingface.co/'
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
  'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth',
  'http://localhost:8188/api/devtools/fake_model.safetensors'
])

function isModelUrlAllowlisted(url: string): boolean {
  return (
    WHITE_LISTED_URLS.has(url) ||
    ALLOWED_SOURCES.some((source) => url.startsWith(source))
  )
}

const MODEL_LIBRARY_TAB_ID = 'model-library'

export interface ModelWithUrl {
  name: string
  url: string
  directory: string
}

export type ModelDownloadDispatchOutcome =
  | {
      status: 'not-dispatched'
      reason: 'not-downloadable' | 'missing-directory-path'
    }
  | { status: 'browser-requested' }
  | {
      status: 'host-requested'
      host: 'desktop2' | 'electron'
      hostResult: Promise<boolean>
    }
  | {
      status: 'dispatch-failed'
      host: 'desktop2' | 'electron'
      error: unknown
    }

function openUrlInNewTab(url: string, downloadAs?: string): void {
  try {
    const protocol = new URL(url).protocol
    if (protocol !== 'https:' && protocol !== 'http:') {
      console.warn('[missingModelDownload] Blocked unsupported URL scheme')
      return
    }
  } catch {
    console.warn('[missingModelDownload] Blocked malformed download URL')
    return
  }

  const link = document.createElement('a')
  link.href = url
  if (downloadAs) link.download = downloadAs
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.click()
}

export function openGatedRepoPage(url: string): void {
  if (!isTrustedHuggingFaceUrl(url)) return
  openUrlInNewTab(url)
}

function hasHuggingFaceHost(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === 'huggingface.co'
  } catch {
    return false
  }
}

export function isTrustedHuggingFaceUrl(url: string): boolean {
  try {
    return new URL(url).origin === 'https://huggingface.co'
  } catch {
    return false
  }
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
  if (hasHuggingFaceHost(url)) {
    return url.replace('/resolve/', '/blob/')
  }
  return url
}

export function isModelDownloadable(model: ModelWithUrl): boolean {
  if (!isModelUrlAllowlisted(model.url)) return false
  if (WHITE_LISTED_URLS.has(model.url)) return true
  if (!ALLOWED_SUFFIXES.some((suffix) => model.name.endsWith(suffix)))
    return false
  return true
}

export function dispatchModelDownload(
  model: ModelWithUrl,
  paths: Record<string, string[]>,
  { revealLegacyDownload = true }: { revealLegacyDownload?: boolean } = {}
): ModelDownloadDispatchOutcome {
  if (!isModelDownloadable(model)) {
    return { status: 'not-dispatched', reason: 'not-downloadable' }
  }

  const desktop2Bridge = window.__comfyDesktop2
  if (desktop2Bridge?.downloadModel && !desktop2Bridge.isRemote()) {
    try {
      return {
        status: 'host-requested',
        host: 'desktop2',
        hostResult: Promise.resolve(
          desktop2Bridge.downloadModel(model.url, model.name, model.directory)
        )
      }
    } catch (error) {
      return { status: 'dispatch-failed', host: 'desktop2', error }
    }
  }

  if (!isDesktop) {
    openUrlInNewTab(model.url, model.name)
    return { status: 'browser-requested' }
  }

  const savePath = paths[model.directory]?.[0]
  if (!savePath) {
    return { status: 'not-dispatched', reason: 'missing-directory-path' }
  }

  if (revealLegacyDownload) {
    useSidebarTabStore().activeSidebarTabId = MODEL_LIBRARY_TAB_ID
  }
  try {
    return {
      status: 'host-requested',
      host: 'electron',
      hostResult: Promise.resolve(
        useElectronDownloadStore().start({
          url: model.url,
          savePath,
          filename: model.name
        })
      )
    }
  } catch (error) {
    return { status: 'dispatch-failed', host: 'electron', error }
  }
}

export function downloadModel(
  model: ModelWithUrl,
  paths: Record<string, string[]>
): void {
  const outcome = dispatchModelDownload(model, paths)

  if (outcome.status === 'dispatch-failed') {
    console.error(
      `Failed to start ${outcome.host === 'desktop2' ? 'Desktop2' : 'Electron'} model download:`,
      outcome.error
    )
    return
  }

  if (outcome.status !== 'host-requested') return

  void outcome.hostResult.catch((error: unknown) => {
    console.error(
      `Failed to start ${outcome.host === 'desktop2' ? 'Desktop2' : 'Electron'} model download:`,
      error
    )
  })
}

export interface ModelMetadata {
  fileSize: number | null
  gatedRepoUrl: string | null
}

export type ModelMetadataFetchOutcome = {
  metadata: ModelMetadata
  resolution: 'resolved' | 'failed'
}

interface MetadataFetchResult extends ModelMetadataFetchOutcome {
  cacheable: boolean
}

interface CivitaiModelFile {
  sizeKB: number
  downloadUrl: string
}

interface CivitaiModelVersionResponse {
  files: CivitaiModelFile[]
}

const metadataCache = new Map<string, ModelMetadataFetchOutcome>()
const inflight = new Map<string, Promise<ModelMetadataFetchOutcome>>()

export function clearMetadataCache(): void {
  metadataCache.clear()
  inflight.clear()
}

async function fetchCivitaiMetadata(
  url: string,
  signal?: AbortSignal
): Promise<MetadataFetchResult> {
  try {
    const pathname = new URL(url).pathname
    const versionIdMatch =
      pathname.match(/^\/api\/download\/models\/(\d+)$/) ??
      pathname.match(/^\/api\/v1\/models-versions\/(\d+)$/)

    if (!versionIdMatch) {
      return {
        metadata: { fileSize: null, gatedRepoUrl: null },
        resolution: 'failed',
        cacheable: false
      }
    }

    const [, modelVersionId] = versionIdMatch
    const apiUrl = `https://civitai.com/api/v1/model-versions/${modelVersionId}`
    const res = signal ? await fetch(apiUrl, { signal }) : await fetch(apiUrl)
    if (!res.ok) {
      return {
        metadata: { fileSize: null, gatedRepoUrl: null },
        resolution: 'failed',
        cacheable: false
      }
    }

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
    return {
      metadata: { fileSize, gatedRepoUrl: null },
      resolution: 'resolved',
      cacheable: true
    }
  } catch {
    return {
      metadata: { fileSize: null, gatedRepoUrl: null },
      resolution: 'failed',
      cacheable: false
    }
  }
}

const GATED_STATUS_CODES = new Set([401, 403, 451])
const HUGGING_FACE_GATED_ERROR_CODE = 'GatedRepo'

async function fetchHeadMetadata(
  url: string,
  signal?: AbortSignal
): Promise<MetadataFetchResult> {
  try {
    // Deliberately uncredentialed HEADs prevent re-checks from clearing gating.
    const response = await fetch(url, {
      method: 'HEAD',
      ...(signal && { signal })
    })
    if (!response.ok) {
      if (
        isTrustedHuggingFaceUrl(url) &&
        GATED_STATUS_CODES.has(response.status) &&
        response.headers.get('x-error-code') === HUGGING_FACE_GATED_ERROR_CODE
      ) {
        return {
          metadata: {
            fileSize: null,
            gatedRepoUrl: downloadUrlToHfRepoUrl(url)
          },
          resolution: 'resolved',
          cacheable: true
        }
      }
      return {
        metadata: { fileSize: null, gatedRepoUrl: null },
        resolution: 'failed',
        cacheable: false
      }
    }
    const size = response.headers.get('content-length')
    const parsedSize = size ? parseInt(size, 10) : null
    return {
      metadata: {
        fileSize:
          parsedSize !== null && !Number.isNaN(parsedSize) ? parsedSize : null,
        gatedRepoUrl: null
      },
      resolution: 'resolved',
      cacheable: true
    }
  } catch {
    return {
      metadata: { fileSize: null, gatedRepoUrl: null },
      resolution: 'failed',
      cacheable: false
    }
  }
}

async function fetchMetadataResult(
  url: string,
  signal?: AbortSignal
): Promise<ModelMetadataFetchOutcome> {
  const result = isCivitaiModelUrl(url)
    ? await fetchCivitaiMetadata(url, signal)
    : await fetchHeadMetadata(url, signal)
  const outcome: ModelMetadataFetchOutcome = {
    metadata: result.metadata,
    resolution: result.resolution
  }
  if (result.cacheable) metadataCache.set(url, outcome)
  return outcome
}

export async function fetchModelMetadataWithStatus(
  url: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<ModelMetadataFetchOutcome> {
  if (!isModelUrlAllowlisted(url)) {
    return {
      metadata: { fileSize: null, gatedRepoUrl: null },
      resolution: 'resolved'
    }
  }

  const cached = metadataCache.get(url)
  if (cached !== undefined) return cached

  if (signal) return fetchMetadataResult(url, signal)

  const existing = inflight.get(url)
  if (existing) return existing

  const promise = fetchMetadataResult(url)

  inflight.set(url, promise)
  try {
    return await promise
  } finally {
    inflight.delete(url)
  }
}

export async function fetchModelMetadata(url: string): Promise<ModelMetadata> {
  return (await fetchModelMetadataWithStatus(url)).metadata
}
