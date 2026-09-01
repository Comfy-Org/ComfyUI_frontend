import type * as THREE from 'three'

import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'

import { MeshModelAdapter } from './MeshModelAdapter'
import { createAdapterRef, fetchModelData } from './ModelAdapter'
import type {
  AdapterRef,
  ModelAdapter,
  ModelAdapterCapabilities,
  ModelLoadContext
} from './ModelAdapter'
import { PointCloudModelAdapter } from './PointCloudModelAdapter'
import { SplatModelAdapter } from './SplatModelAdapter'
import type {
  EventManagerInterface,
  LoadModelOptions,
  LoaderManagerInterface,
  ModelManagerInterface
} from './interfaces'

/**
 * three.js's HttpError attaches the failed `Response` to the thrown Error.
 * fetchModelData throws a plain Error whose message embeds the status code.
 * Detect both forms so we can keep the toast for parse / network failures
 * but stay silent on 404 when the caller opted in.
 */
function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response &&
    error.response.status === 404
  ) {
    return true
  }
  return /\b404\b/.test(error.message)
}

/**
 * Default adapter set: mesh + splat + pointCloud. Each adapter declares the
 * file extensions it owns. For shared extensions (.ply), the adapter with an
 * async `matches()` tiebreaker is tried first; the unconditional adapter acts
 * as the fallback — so SplatModelAdapter precedes PointCloudModelAdapter.
 */
function defaultAdapters(): ModelAdapter[] {
  return [
    new MeshModelAdapter(),
    new SplatModelAdapter(),
    new PointCloudModelAdapter()
  ]
}

export class LoaderManager implements LoaderManagerInterface {
  private readonly modelManager: ModelManagerInterface
  private readonly eventManager: EventManagerInterface
  private readonly adapters: ModelAdapter[]
  private readonly adapterRef: AdapterRef
  private currentLoadId: number = 0

  constructor(
    modelManager: ModelManagerInterface,
    eventManager: EventManagerInterface,
    adapters?: readonly ModelAdapter[],
    adapterRef?: AdapterRef
  ) {
    this.modelManager = modelManager
    this.eventManager = eventManager
    this.adapters = adapters ? [...adapters] : defaultAdapters()
    this.adapterRef = adapterRef ?? createAdapterRef()
  }

  getCurrentAdapter(): ModelAdapter | null {
    return this.adapterRef.current
  }

  init(): void {}

  dispose(): void {}

  async loadModel(
    url: string,
    originalFileName?: string,
    options?: LoadModelOptions
  ): Promise<void> {
    const loadId = ++this.currentLoadId

    try {
      this.eventManager.emitEvent('modelLoadingStart', null)

      this.modelManager.clearModel()
      this.adapterRef.current = null
      this.adapterRef.capabilities = null

      this.modelManager.originalURL = url

      let fileExtension: string | undefined
      if (originalFileName) {
        fileExtension = originalFileName.split('.').pop()?.toLowerCase()

        this.modelManager.originalFileName =
          originalFileName.split('/').pop()?.split('.')[0] || 'model'
      } else {
        const filename = new URLSearchParams(url.split('?')[1]).get('filename')
        fileExtension = filename?.split('.').pop()?.toLowerCase()
        this.modelManager.originalFileName = filename
          ? filename.split('.')[0] || 'model'
          : 'model'
      }

      if (!fileExtension) {
        useToastStore().addAlert(t('toastMessages.couldNotDetermineFileType'))
        return
      }

      const result = await this.loadModelInternal(url, fileExtension)

      if (loadId !== this.currentLoadId) {
        // A newer loadModel has superseded us — do not publish our adapter
        // and do not setup the model. Whichever load is current owns the
        // shared state.
        return
      }

      if (result) {
        // Publish only after the staleness check so a slow older load
        // can't clobber adapterRef.current that a newer load already
        // wrote (or cleared).
        this.adapterRef.current = result.adapter
        this.adapterRef.capabilities = result.capabilities
        await this.modelManager.setupModel(result.object)
      }

      this.eventManager.emitEvent('modelLoadingEnd', null)
    } catch (error) {
      if (loadId === this.currentLoadId) {
        this.eventManager.emitEvent('modelLoadingEnd', null)
        console.error('Error loading model:', error)
        if (!(options?.silentOnNotFound && isNotFoundError(error))) {
          useToastStore().addAlert(t('toastMessages.errorLoadingModel'))
        }
      }
    }
  }

  private async pickAdapter(
    extension: string,
    fetchBytes: () => Promise<ArrayBuffer>
  ): Promise<ModelAdapter | null> {
    const candidates = this.adapters.filter((a) =>
      a.extensions.includes(extension)
    )
    for (const adapter of candidates) {
      if (!adapter.matches) return adapter
      if (await adapter.matches(extension, fetchBytes)) return adapter
    }
    return null
  }

  private createLoadContext(): ModelLoadContext {
    const mm = this.modelManager
    return {
      setOriginalModel: (model) => mm.setOriginalModel(model),
      registerOriginalMaterial: (mesh, material) =>
        mm.originalMaterials.set(mesh, material),
      get standardMaterial() {
        return mm.standardMaterial
      },
      get materialMode() {
        return mm.materialMode
      }
    }
  }

  private async loadModelInternal(
    url: string,
    fileExtension: string
  ): Promise<{
    object: THREE.Object3D
    adapter: ModelAdapter
    capabilities: ModelAdapterCapabilities
  } | null> {
    const params = new URLSearchParams(url.split('?')[1])
    const filename = params.get('filename')

    if (!filename) {
      console.error('Missing filename in URL:', url)
      return null
    }

    const requestedType = params.get('type')
    const loadRootFolder =
      requestedType === 'output' || requestedType === 'temp'
        ? requestedType
        : 'input'
    const subfolder = params.get('subfolder') ?? ''
    const path =
      'api/view?type=' +
      loadRootFolder +
      '&subfolder=' +
      encodeURIComponent(subfolder) +
      '&filename='

    let bytesPromise: Promise<ArrayBuffer> | null = null
    const fetchBytes = () => (bytesPromise ??= fetchModelData(path, filename))

    const adapter = await this.pickAdapter(fileExtension, fetchBytes)
    if (!adapter) return null

    const loadResult = await adapter.load(
      this.createLoadContext(),
      path,
      filename,
      fetchBytes
    )
    return loadResult
      ? {
          object: loadResult.object,
          capabilities: loadResult.capabilities,
          adapter
        }
      : null
  }
}
