import type * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader'

import { api } from '@/scripts/api'

import type { MaterialMode } from './interfaces'

export interface ModelLoadContext {
  setOriginalModel(model: THREE.Object3D | THREE.BufferGeometry | GLTF): void
  registerOriginalMaterial(
    mesh: THREE.Mesh,
    material: THREE.Material | THREE.Material[]
  ): void
  readonly standardMaterial: THREE.MeshStandardMaterial
  readonly materialMode: MaterialMode
}

export type ModelAdapterKind = 'mesh' | 'pointCloud' | 'splat'

export interface ModelAdapterCapabilities {
  /**
   * Whether auto-normalize/centering on load and the explicit fit-to-viewer
   * action should run. Splats render self-sized and are placed at a fixed
   * camera distance instead.
   */
  fitToViewer: boolean
  /**
   * Whether a material mode change must rebuild the scene object instead of
   * traversing the existing mesh tree. True for point-cloud PLY (Mesh <->
   * Points swap); false for regular meshes and self-rendering splats.
   */
  requiresMaterialRebuild: boolean
  /**
   * Whether the gizmo transform UI (translate/rotate/scale) should be
   * exposed for this model type. False for formats whose renderer ignores
   * scene-graph transforms (Gaussian splat) or where transforming the
   * already-normalized output produces no useful result (PLY point cloud).
   */
  gizmoTransform: boolean
  /** Whether scene-lighting controls apply. False for self-lit formats. */
  lighting: boolean
  /** Whether the model can be exported (GLB/OBJ/STL). */
  exportable: boolean
  /**
   * Material modes offered in the UI for this format. An empty array hides
   * the material-mode dropdown entirely.
   */
  materialModes: readonly MaterialMode[]
}

export const DEFAULT_MODEL_CAPABILITIES: ModelAdapterCapabilities = {
  fitToViewer: true,
  requiresMaterialRebuild: false,
  gizmoTransform: true,
  lighting: true,
  exportable: true,
  materialModes: ['original', 'normal', 'wireframe']
}

export interface ModelAdapter {
  readonly kind: ModelAdapterKind
  readonly extensions: readonly string[]
  readonly capabilities: ModelAdapterCapabilities
  load(
    ctx: ModelLoadContext,
    path: string,
    filename: string
  ): Promise<THREE.Object3D | null>
}

export async function fetchModelData(
  path: string,
  filename: string
): Promise<ArrayBuffer> {
  const route = '/' + path.replace(/^api\//, '') + encodeURIComponent(filename)
  const response = await api.fetchApi(route)
  if (!response.ok) {
    throw new Error(`Failed to fetch model: ${response.status}`)
  }
  return response.arrayBuffer()
}
