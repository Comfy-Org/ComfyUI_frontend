import type * as THREE from 'three'

import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'

import { MeshModelAdapter } from './MeshModelAdapter'
import { createAdapterRef, fetchModelData } from './ModelAdapter'
import type {
  AdapterRef,
  ModelAdapter,
  ModelAdapterCapabilities,
  ModelLoadContext,
  ModelLoadResult
} from './ModelAdapter'
import { PointCloudModelAdapter } from './PointCloudModelAdapter'
import { SplatModelAdapter } from './SplatModelAdapter'
import { disposeObject3D } from './SceneModelManager'
import type {
  EventManagerInterface,
  LoadModelOptions,
  LoadModelOutcome,
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
  private disposed = false

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

  init(): void {
    this.disposed = false
  }

  dispose(): void {
    this.disposed = true
    this.currentLoadId += 1
  }

  async loadModel(
    url: string,
    originalFileName?: string,
    options?: LoadModelOptions
  ): Promise<LoadModelOutcome> {
    if (this.disposed) return 'cancelled'
    const loadId = ++this.currentLoadId

    try {
      this.eventManager.emitEvent('modelLoadingStart', null)

      this.modelManager.clearModel()
      this.adapterRef.current = null
      this.adapterRef.capabilities = null

      this.modelManager.originalURL = url

      const fileExtension = this.setOriginalFileName(url, originalFileName)

      if (!fileExtension) {
        // The agent path may pass an untrusted, credential-bearing URL —
        // never embed it in a thrown/reported error (see the redaction in
        // the catch block and in modelThumbnail.ts's reportError call).
        if (options?.silent) throw new TypeError('Unknown model file type')
        useToastStore().addAlert(t('toastMessages.couldNotDetermineFileType'))
        this.eventManager.emitEvent('modelLoadingEnd', null)
        return 'empty'
      }

      const result = await this.loadModelInternal(
        url,
        fileExtension,
        loadId,
        options?.silent
      )
      return await this.publishLoadResult(
        result,
        loadId,
        fileExtension,
        options?.silent
      )
    } catch (error) {
      return this.handleLoadError(error, loadId, options)
    }
  }

  private async publishLoadResult(
    result: (ModelLoadResult & { adapter: ModelAdapter }) | null,
    loadId: number,
    fileExtension: string,
    silent?: boolean
  ): Promise<LoadModelOutcome> {
    if (loadId !== this.currentLoadId) {
      // A newer loadModel has superseded us. createLoadContext gates on
      // loadId, so the result never entered the scene and is safe to dispose.
      if (result) this.disposeLoadResult(result)
      return 'cancelled'
    }
    if (!result && silent) {
      throw new TypeError(`No model was produced for type: ${fileExtension}`)
    }
    if (result) {
      this.adapterRef.current = result.adapter
      this.adapterRef.capabilities = result.capabilities
      await this.modelManager.setupModel(result.object)
      if (loadId !== this.currentLoadId) return 'cancelled'
    }
    this.eventManager.emitEvent('modelLoadingEnd', null)
    return result ? 'loaded' : 'empty'
  }

  private setOriginalFileName(
    url: string,
    originalFileName?: string
  ): string | undefined {
    if (originalFileName) {
      this.modelManager.originalFileName =
        originalFileName.split('/').pop()?.split('.')[0] || 'model'
      return originalFileName.split('.').pop()?.toLowerCase()
    }

    const filename = new URLSearchParams(url.split('?')[1]).get('filename')
    this.modelManager.originalFileName = filename
      ? filename.split('.')[0] || 'model'
      : 'model'
    return filename?.split('.').pop()?.toLowerCase()
  }

  private handleLoadError(
    error: unknown,
    loadId: number,
    options?: LoadModelOptions
  ): LoadModelOutcome {
    if (loadId !== this.currentLoadId) return 'cancelled'
    this.eventManager.emitEvent('modelLoadingEnd', null)
    // A silent load's error (and the untrusted URL it may embed, e.g.
    // from three.js's FileLoader "fetch for <url> responded with ...")
    // is the caller's to report — logging it here on their behalf would
    // write it to the console unredacted regardless of what the caller
    // does with the rethrown error.
    if (options?.silent) throw error
    console.error('Error loading model:', error)
    if (!(options?.silentOnNotFound && isNotFoundError(error))) {
      useToastStore().addAlert(t('toastMessages.errorLoadingModel'))
    }
    return 'failed'
  }

  private disposeLoadResult(
    result: ModelLoadResult & { adapter: ModelAdapter }
  ): void {
    result.adapter.disposeModel?.(result.object)
    disposeObject3D(result.object, this.modelManager.standardMaterial)
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

  private createLoadContext(loadId: number): ModelLoadContext {
    const mm = this.modelManager
    // Adapters call setOriginalModel / registerOriginalMaterial synchronously
    // during adapter.load(), before loadModel can check whether this load is
    // still current. Gate those writes on identity here so a superseded
    // load's result can never land in modelManager — that is what makes it
    // safe to unconditionally dispose a stale result afterward (see the
    // loadId !== this.currentLoadId branch in loadModel).
    const isCurrent = () => loadId === this.currentLoadId
    return {
      setOriginalModel: (model) => {
        if (isCurrent()) mm.setOriginalModel(model)
      },
      registerOriginalMaterial: (mesh, material) => {
        if (isCurrent()) mm.originalMaterials.set(mesh, material)
      },
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
    fileExtension: string,
    loadId: number,
    silent?: boolean
  ): Promise<{
    object: THREE.Object3D
    adapter: ModelAdapter
    capabilities: ModelAdapterCapabilities
  } | null> {
    const params = new URLSearchParams(url.split('?')[1])
    const filename = params.get('filename')

    if (!filename) {
      // Silent loads may carry an untrusted, credential-bearing URL (see the
      // redaction note in loadModel's catch block) — never log it here on
      // the caller's behalf.
      if (!silent) console.error('Missing filename in URL:', url)
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
      this.createLoadContext(loadId),
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
