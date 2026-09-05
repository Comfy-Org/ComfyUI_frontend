import { downloadUrlToHfRepoUrl, isCivitaiModelUrl } from '@/utils/formatUtil'
import { isDesktop } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import type { AssetDownload } from '@/stores/assetDownloadStore'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import type { ComfyDesktop2Bridge } from '@/types'

class ModelDownloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelDownloadError'
  }
}

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

function isRemoteComfyUISession(): boolean {
  if (typeof window === 'undefined') return false
  if (window.__comfyDesktop2Remote) return true
  const host = window.location.hostname.toLowerCase()
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]'
}

export interface ModelWithUrl {
  name: string
  url: string
  directory: string
}

function makeDownloadEntry(
  key: string,
  model: ModelWithUrl,
  status: AssetDownload['status'],
  progress = 0,
  error?: string
): AssetDownload {
  const store = useMissingModelStore()
  const bytesTotal = store.fileSizes[model.url] ?? 0
  return {
    taskId: key,
    assetName: model.name,
    bytesTotal,
    bytesDownloaded: Math.round(bytesTotal * progress),
    progress,
    status,
    lastUpdate: Date.now(),
    modelType: model.directory,
    error
  }
}

async function pollServerDownloadProgress(
  model: ModelWithUrl,
  stateKey: string,
  stop: { value: boolean }
) {
  const store = useMissingModelStore()
  while (!stop.value) {
    try {
      const params = new URLSearchParams({
        save_dir: model.directory,
        filename: model.name
      })
      const response = await api.fetchApi(
        `/download_model/progress?${params.toString()}`
      )
      if (response.ok) {
        const data = await response.json()
        const progress = Number(data.progress ?? 0)
        const bytesTotal = Number(
          data.bytes_total ?? store.fileSizes[model.url] ?? 0
        )
        const bytesDownloaded = Number(data.bytes_downloaded ?? 0)
        const status: AssetDownload['status'] =
          data.status === 'completed'
            ? 'completed'
            : data.status === 'failed'
              ? 'failed'
              : 'running'
        store.setDirectDownload(stateKey, {
          taskId: stateKey,
          assetName: model.name,
          bytesTotal: bytesTotal || bytesDownloaded,
          bytesDownloaded,
          progress:
            status === 'completed'
              ? 1
              : Math.max(
                  progress,
                  bytesTotal ? bytesDownloaded / bytesTotal : 0
                ),
          status,
          lastUpdate: Date.now(),
          modelType: model.directory,
          error: data.error
        })
        if (status === 'completed' || status === 'failed') break
      }
    } catch {
      // Keep polling while the main request runs.
    }
    await new Promise((resolve) => setTimeout(resolve, 750))
  }
}

async function downloadModelViaServer(
  model: ModelWithUrl,
  stateKey?: string
): Promise<void> {
  const store = useMissingModelStore()
  if (stateKey) {
    store.setDirectDownload(
      stateKey,
      makeDownloadEntry(stateKey, model, 'running')
    )
  }

  const stop = { value: false }
  const pollPromise = stateKey
    ? pollServerDownloadProgress(model, stateKey, stop)
    : Promise.resolve()

  try {
    const response = await api.fetchApi('/download_model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: model.url,
        save_dir: model.directory,
        filename: model.name
      })
    })
    if (!response.ok) {
      let message = `Download failed (${response.status})`
      try {
        const body = await response.json()
        if (body?.error) message = body.error
      } catch {
        // Ignore malformed error responses.
      }
      throw new ModelDownloadError(message)
    }
    if (stateKey) {
      store.setDirectDownload(
        stateKey,
        makeDownloadEntry(stateKey, model, 'completed', 1)
      )
    }
  } catch (error) {
    if (stateKey) {
      store.setDirectDownload(
        stateKey,
        makeDownloadEntry(
          stateKey,
          model,
          'failed',
          0,
          error instanceof Error ? error.message : String(error)
        )
      )
    }
    throw error
  } finally {
    stop.value = true
    await pollPromise
  }
}

async function startDesktop2ModelDownload(
  bridge: ComfyDesktop2Bridge,
  model: ModelWithUrl
): Promise<void> {
  try {
    await bridge.downloadModel?.(model.url, model.name, model.directory)
  } catch (error: unknown) {
    console.error('Failed to start Desktop2 model download:', error)
  }
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

export async function downloadModel(
  model: ModelWithUrl,
  paths: Record<string, string[]>,
  stateKey?: string
): Promise<void> {
  if (!isModelDownloadable(model)) return

  const desktop2Bridge = window.__comfyDesktop2
  if (isRemoteComfyUISession() || !isDesktop) {
    await downloadModelViaServer(model, stateKey)
    return
  }

  if (desktop2Bridge?.downloadModel) {
    await startDesktop2ModelDownload(desktop2Bridge, model)
    return
  }

  const modelPaths = paths[model.directory]
  if (modelPaths[0]) {
    useSidebarTabStore().activeSidebarTabId = MODEL_LIBRARY_TAB_ID
    await useElectronDownloadStore().start({
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

interface MetadataFetchResult {
  metadata: ModelMetadata
  cacheable: boolean
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

export function clearMetadataCache(): void {
  metadataCache.clear()
  inflight.clear()
}

async function fetchCivitaiMetadata(url: string): Promise<MetadataFetchResult> {
  try {
    const pathname = new URL(url).pathname
    const versionIdMatch =
      pathname.match(/^\/api\/download\/models\/(\d+)$/) ??
      pathname.match(/^\/api\/v1\/models-versions\/(\d+)$/)

    if (!versionIdMatch) {
      return {
        metadata: { fileSize: null, gatedRepoUrl: null },
        cacheable: false
      }
    }

    const [, modelVersionId] = versionIdMatch
    const apiUrl = `https://civitai.com/api/v1/model-versions/${modelVersionId}`
    const res = await fetch(apiUrl)
    if (!res.ok) {
      return {
        metadata: { fileSize: null, gatedRepoUrl: null },
        cacheable: false
      }
    }

    const data: CivitaiModelVersionResponse = await res.json()
    const matchingFile = data.files.find((file) => {
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
      cacheable: true
    }
  } catch {
    return {
      metadata: { fileSize: null, gatedRepoUrl: null },
      cacheable: false
    }
  }
}

const GATED_STATUS_CODES = new Set([401, 403, 451])
const HUGGING_FACE_GATED_ERROR_CODE = 'GatedRepo'

async function fetchHeadMetadata(url: string): Promise<MetadataFetchResult> {
  try {
    // Deliberately uncredentialed HEADs prevent re-checks from clearing gating.
    const response = await fetch(url, { method: 'HEAD' })
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
          cacheable: true
        }
      }
      return {
        metadata: { fileSize: null, gatedRepoUrl: null },
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
      cacheable: true
    }
  } catch {
    return {
      metadata: { fileSize: null, gatedRepoUrl: null },
      cacheable: false
    }
  }
}

export async function fetchModelMetadata(url: string): Promise<ModelMetadata> {
  if (!isModelUrlAllowlisted(url)) {
    return { fileSize: null, gatedRepoUrl: null }
  }

  const cached = metadataCache.get(url)
  if (cached !== undefined) return cached

  const existing = inflight.get(url)
  if (existing) return existing

  const promise = (async () => {
    const result = isCivitaiModelUrl(url)
      ? await fetchCivitaiMetadata(url)
      : await fetchHeadMetadata(url)
    if (result.cacheable) {
      metadataCache.set(url, result.metadata)
    }
    return result.metadata
  })()

  inflight.set(url, promise)
  try {
    return await promise
  } finally {
    inflight.delete(url)
  }
}
