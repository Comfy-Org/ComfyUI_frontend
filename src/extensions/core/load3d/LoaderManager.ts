import type * as THREE from 'three'

import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'

import { MeshModelAdapter } from './MeshModelAdapter'
import type { ModelAdapter, ModelLoadContext } from './ModelAdapter'
import { PointCloudModelAdapter, getPLYEngine } from './PointCloudModelAdapter'
import { SplatModelAdapter } from './SplatModelAdapter'
import {
  type EventManagerInterface,
  type LoaderManagerInterface,
  type ModelManagerInterface
} from './interfaces'

/**
 * Default adapter set: mesh + pointCloud + splat. Each adapter declares the
 * file extensions it owns; LoaderManager picks one by extension.
 */
function defaultAdapters(): ModelAdapter[] {
  return [
    new MeshModelAdapter(),
    new PointCloudModelAdapter(),
    new SplatModelAdapter()
  ]
}

export class LoaderManager implements LoaderManagerInterface {
  private readonly modelManager: ModelManagerInterface
  private readonly eventManager: EventManagerInterface
  private readonly adapters: ModelAdapter[]
  private currentLoadId: number = 0
  private _currentAdapter: ModelAdapter | null = null

  constructor(
    modelManager: ModelManagerInterface,
    eventManager: EventManagerInterface,
    adapters?: readonly ModelAdapter[]
  ) {
    this.modelManager = modelManager
    this.eventManager = eventManager
    this.adapters = adapters ? [...adapters] : defaultAdapters()
  }

  getCurrentAdapter(): ModelAdapter | null {
    return this._currentAdapter
  }

  init(): void {}

  dispose(): void {}

  async loadModel(url: string, originalFileName?: string): Promise<void> {
    const loadId = ++this.currentLoadId

    try {
      this.eventManager.emitEvent('modelLoadingStart', null)

      this.modelManager.clearModel()
      this._currentAdapter = null

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
        return
      }

      if (result && result.model) {
        this._currentAdapter = result.adapter
        await this.modelManager.setupModel(result.model)
      }

      this.eventManager.emitEvent('modelLoadingEnd', null)
    } catch (error) {
      if (loadId === this.currentLoadId) {
        this._currentAdapter = null
        this.eventManager.emitEvent('modelLoadingEnd', null)
        console.error('Error loading model:', error)
        useToastStore().addAlert(t('toastMessages.errorLoadingModel'))
      }
    }
  }

  private pickAdapter(extension: string): ModelAdapter | null {
    const match = this.adapters.find((adapter) =>
      adapter.extensions.includes(extension)
    )
    if (!match) return null

    // PLY may be routed through the splat adapter when the PLYEngine setting
    // is sparkjs. Only honor the routing when both adapters are registered.
    if (match.kind === 'pointCloud' && getPLYEngine() === 'sparkjs') {
      const splat = this.adapters.find((adapter) => adapter.kind === 'splat')
      if (splat) return splat
    }
    return match
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
  ): Promise<{ adapter: ModelAdapter; model: THREE.Object3D | null } | null> {
    const params = new URLSearchParams(url.split('?')[1])
    const filename = params.get('filename')

    if (!filename) {
      console.error('Missing filename in URL:', url)
      return null
    }

    const loadRootFolder = params.get('type') === 'output' ? 'output' : 'input'
    const subfolder = params.get('subfolder') ?? ''
    const path =
      'api/view?type=' +
      loadRootFolder +
      '&subfolder=' +
      encodeURIComponent(subfolder) +
      '&filename='

    const adapter = this.pickAdapter(fileExtension)
    if (!adapter) return null

    const model = await adapter.load(this.createLoadContext(), path, filename)
    return { adapter, model }
  }
}
