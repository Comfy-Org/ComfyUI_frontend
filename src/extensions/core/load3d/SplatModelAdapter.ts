import { SplatMesh } from '@sparkjsdev/spark'
import * as THREE from 'three'

import { isGaussianSplatPLY } from '@/scripts/metadata/ply'

import { fetchModelData } from './ModelAdapter'
import type {
  ModelAdapter,
  ModelAdapterCapabilities,
  ModelLoadContext,
  ModelLoadResult
} from './ModelAdapter'

export class SplatModelAdapter implements ModelAdapter {
  readonly kind = 'splat' as const
  readonly extensions = ['spz', 'splat', 'ksplat', 'ply'] as const
  readonly capabilities: ModelAdapterCapabilities = {
    fitToViewer: true,
    requiresMaterialRebuild: false,
    gizmoTransform: true,
    lighting: false,
    exportable: true,
    materialModes: [],
    fitTargetSize: 20
  }

  async matches(
    extension: string,
    fetchBytes: () => Promise<ArrayBuffer>
  ): Promise<boolean> {
    if (extension !== 'ply') return true
    return isGaussianSplatPLY(await fetchBytes())
  }

  async load(
    ctx: ModelLoadContext,
    path: string,
    filename: string,
    fetchBytes?: () => Promise<ArrayBuffer>
  ): Promise<ModelLoadResult> {
    const arrayBuffer = await (fetchBytes?.() ?? fetchModelData(path, filename))

    const splatMesh = new SplatMesh({
      fileBytes: arrayBuffer,
      fileName: filename
    })
    await splatMesh.initialized
    splatMesh.quaternion.set(1, 0, 0, 0)
    ctx.setOriginalModel(splatMesh)

    const splatGroup = new THREE.Group()
    splatGroup.add(splatMesh)
    return { object: splatGroup, capabilities: this.capabilities }
  }

  computeBounds(model: THREE.Object3D): THREE.Box3 | null {
    const splat = model.children[0]
    if (!(splat instanceof SplatMesh)) return null
    splat.updateWorldMatrix(true, false)
    return splat.getBoundingBox(false).clone().applyMatrix4(splat.matrixWorld)
  }

  disposeModel(model: THREE.Object3D): void {
    model.traverse((child) => {
      if (child instanceof SplatMesh) {
        child.dispose()
      }
    })
  }

  defaultCameraPose(): { size: THREE.Vector3; center: THREE.Vector3 } {
    return {
      size: new THREE.Vector3(5, 5, 5),
      center: new THREE.Vector3(0, 2.5, 0)
    }
  }
}
