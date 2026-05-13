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
   * exposed for this model type. False for adapters whose already-normalized
   * output makes user transforms meaningless (PLY point cloud).
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
  /**
   * World-space target size along the largest dimension after
   * fit-to-viewer normalization. Controls how large the model ends up
   * relative to the 20-unit scene grid; splats use a larger value so they
   * don't shrink to a quarter of the floor.
   */
  fitTargetSize: number
}

export const DEFAULT_MODEL_CAPABILITIES: ModelAdapterCapabilities = {
  fitToViewer: true,
  requiresMaterialRebuild: false,
  gizmoTransform: true,
  lighting: true,
  exportable: true,
  materialModes: ['original', 'normal', 'wireframe'],
  fitTargetSize: 5
}

/**
 * Mutable handle to the currently active ModelAdapter. A single ref is
 * created in `createLoad3d` and shared between LoaderManager (writer) and
 * SceneModelManager + Load3d (readers), so capability/bounds/dispose lookups
 * don't depend on construction order between those collaborators.
 */
export type AdapterRef = { current: ModelAdapter | null }

export const createAdapterRef = (): AdapterRef => ({ current: null })

export interface ModelAdapter {
  readonly kind: ModelAdapterKind
  readonly extensions: readonly string[]
  readonly capabilities: ModelAdapterCapabilities
  load(
    ctx: ModelLoadContext,
    path: string,
    filename: string
  ): Promise<THREE.Object3D | null>
  /**
   * Optional. Return a world-space AABB for the given model. Adapters for
   * renderers whose geometry is not walked by `Box3.setFromObject` (e.g.
   * Gaussian splats) implement this; the default path uses
   * `Box3.setFromObject` when this is absent.
   */
  computeBounds?(model: THREE.Object3D): THREE.Box3 | null
  /**
   * Optional. Release renderer-owned resources on this model beyond what
   * THREE's geometry/material.dispose covers (e.g. sparkjs SplatMesh
   * internal GPU/worker state). Called when the model is removed from the
   * scene due to a reload or teardown. Missing for adapters whose models
   * the default traversal already handles.
   */
  disposeModel?(model: THREE.Object3D): void
  /**
   * Optional. Default camera placement for adapters that opt out of
   * fit-to-viewer (capabilities.fitToViewer === false). The size/center
   * pair is forwarded to CameraManager.setupForModel as if the model had
   * been normalized. Splat geometry is self-sized and uses this to seat
   * the camera at a known-good distance.
   */
  defaultCameraPose?(): { size: THREE.Vector3; center: THREE.Vector3 }
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
