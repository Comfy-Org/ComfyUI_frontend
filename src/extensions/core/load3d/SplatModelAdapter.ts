import { SplatMesh } from '@sparkjsdev/spark'
import * as THREE from 'three'

import {
  fetchModelData,
  type ModelAdapter,
  type ModelAdapterCapabilities,
  type ModelLoadContext
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
    materialModes: []
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
