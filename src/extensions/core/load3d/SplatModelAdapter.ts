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
    fitToViewer: false,
    requiresMaterialRebuild: false,
    gizmoTransform: false,
    lighting: false,
    exportable: false,
    materialModes: [],
    fitTargetSize: 5
  }

  async load(
    ctx: ModelLoadContext,
    path: string,
    filename: string
  ): Promise<THREE.Object3D> {
    const arrayBuffer = await fetchModelData(path, filename)

    const splatMesh = new SplatMesh({ fileBytes: arrayBuffer })
    ctx.setOriginalModel(splatMesh)

    const splatGroup = new THREE.Group()
    splatGroup.add(splatMesh)
    return splatGroup
  }
}
