import { SplatMesh } from '@sparkjsdev/spark'
import * as THREE from 'three'

import { fetchModelData } from './ModelAdapter'
import type {
  ModelAdapter,
  ModelAdapterCapabilities,
  ModelLoadContext
} from './ModelAdapter'

export class SplatModelAdapter implements ModelAdapter {
  readonly kind = 'splat' as const
  readonly extensions = ['spz', 'splat', 'ksplat'] as const
  readonly capabilities: ModelAdapterCapabilities = {
    fitToViewer: true,
    requiresMaterialRebuild: false,
    gizmoTransform: true,
    lighting: false,
    exportable: false,
    materialModes: [],
    fitTargetSize: 20
  }

  async load(
    ctx: ModelLoadContext,
    path: string,
    filename: string
  ): Promise<THREE.Object3D> {
    const arrayBuffer = await fetchModelData(path, filename)

    const splatMesh = new SplatMesh({ fileBytes: arrayBuffer })
    await splatMesh.initialized
    splatMesh.quaternion.set(1, 0, 0, 0)
    ctx.setOriginalModel(splatMesh)

    const splatGroup = new THREE.Group()
    splatGroup.add(splatMesh)
    return splatGroup
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
