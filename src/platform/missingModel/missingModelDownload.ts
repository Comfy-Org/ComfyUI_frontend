import { downloadUrlToHfRepoUrl, isCivitaiModelUrl } from '@/utils/formatUtil'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { isDesktop } from '@/platform/distribution/types'
import { useModelDownloadStore } from '@/platform/modelManager/stores/modelDownloadStore'
import { DownloadApiError } from '@/platform/modelManager/types'
import { buildModelId } from '@/platform/modelManager/utils/modelId'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import type { ComfyDesktop2Bridge } from '@/types'

const ALLOWED_SOURCES = [
  'https://civitai.com/',
  'https://civitai.red/',
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

const MODEL_LIBRARY_TAB_ID = 'model-library'
const MODEL_MANAGER_TAB_ID = 'model-manager'

export interface ModelWithUrl {
  name: string
  url: string
  directory: string
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

function revealDownloadManager(): void {
  useSidebarTabStore().activeSidebarTabId = MODEL_MANAGER_TAB_ID
}

/**
 * Already on disk: surface a confirmation, refresh the model folder, and
 * re-scan missing models so any node error for this model clears. Loaded
 * lazily to keep this module's import graph (and its unit tests) light.
 */
async function refreshAfterModelAvailable(model: ModelWithUrl): Promise<void> {
  try {
    const [{ useModelStore }, { useMissingModelStore }] = await Promise.all([
      import('@/stores/modelStore'),
      import('@/platform/missingModel/missingModelStore')
    ])
    if (model.directory) {
      try {
        await useModelStore().refreshModelFolder(model.directory)
      } catch (error) {
        console.warn(
          '[MissingModel] Failed to refresh model folder after model available',
          error
        )
      }
    }
    void useMissingModelStore().refreshMissingModels()
  } catch (error) {
    console.warn(
      '[MissingModel] Failed to refresh after model available',
      error
    )
  }
}

/**
 * Enqueues a server-side download and reveals the Model Manager panel so the
 * user can watch live progress, status, and completion. The two benign `409`
 * cases get an info toast: `ALREADY_DOWNLOADING` links to the existing job,
 * `ALREADY_AVAILABLE` confirms it's installed and clears the node error. Any
 * other failure is reported via an error toast.
 */
async function startServerSideModelDownload(
  model: ModelWithUrl
): Promise<void> {
  const toast = useToastStore()
  try {
    await useModelDownloadStore().enqueue({
      url: model.url,
      model_id: buildModelId(model.directory, model.name)
    })
    revealDownloadManager()
  } catch (error: unknown) {
    if (error instanceof DownloadApiError && error.is('ALREADY_DOWNLOADING')) {
      revealDownloadManager()
      toast.add({
        severity: 'info',
        summary: t('modelManager.alreadyDownloading'),
        detail: model.name,
        life: 4000
      })
      return
    }
    if (error instanceof DownloadApiError && error.is('ALREADY_AVAILABLE')) {
      toast.add({
        severity: 'info',
        summary: t('modelManager.alreadyInstalled'),
        detail: model.name,
        life: 4000
      })
      void refreshAfterModelAvailable(model)
      return
    }
    toast.add({
      severity: 'error',
      summary: t('modelManager.actionFailed'),
      detail: error instanceof Error ? error.message : String(error),
      life: 5000
    })
  }
}

function startBrowserModelDownload(model: ModelWithUrl): void {
  const link = document.createElement('a')
  link.href = model.url
  link.download = model.name
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.click()
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
  const desktop2Bridge = window.__comfyDesktop2
  if (desktop2Bridge?.downloadModel && !desktop2Bridge.isRemote()) {
    void startDesktop2ModelDownload(desktop2Bridge, model)
    return
  }

  if (!isDesktop) {
    if (useFeatureFlags().flags.serverSideModelDownloads) {
      void startServerSideModelDownload(model)
    } else {
      startBrowserModelDownload(model)
    }
    return
  }

  const modelPaths = paths[model.directory]
  if (modelPaths?.[0]) {
    useSidebarTabStore().activeSidebarTabId = MODEL_LIBRARY_TAB_ID
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
