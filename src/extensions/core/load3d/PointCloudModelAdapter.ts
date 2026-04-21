import * as THREE from 'three'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader'

import { useSettingStore } from '@/platform/settings/settingStore'
import { isPLYAsciiFormat } from '@/scripts/metadata/ply'

import {
  fetchModelData,
  type ModelAdapter,
  type ModelAdapterCapabilities,
  type ModelLoadContext
} from './ModelAdapter'
import type { MaterialMode } from './interfaces'
import { FastPLYLoader } from './loader/FastPLYLoader'

export function getPLYEngine(): string {
  return useSettingStore().get('Comfy.Load3D.PLYEngine') as string
}

export class PointCloudModelAdapter implements ModelAdapter {
  readonly kind = 'pointCloud' as const
  readonly extensions = ['ply'] as const
  readonly capabilities: ModelAdapterCapabilities = {
    fitToViewer: false,
    requiresMaterialRebuild: true,
    gizmoTransform: false,
    lighting: true,
    exportable: true,
    materialModes: ['original', 'pointCloud', 'normal', 'wireframe']
  }

  private readonly plyLoader = new PLYLoader()
  private readonly fastPlyLoader = new FastPLYLoader()

  async load(
    ctx: ModelLoadContext,
    path: string,
    filename: string
  ): Promise<THREE.Object3D | null> {
    const arrayBuffer = await fetchModelData(path, filename)
    const isASCII = isPLYAsciiFormat(arrayBuffer)

    const plyGeometry =
      isASCII && getPLYEngine() === 'fastply'
        ? this.fastPlyLoader.parse(arrayBuffer)
        : (this.plyLoader.setPath(path), this.plyLoader.parse(arrayBuffer))

    ctx.setOriginalModel(plyGeometry)
    plyGeometry.computeVertexNormals()

    const hasVertexColors = plyGeometry.attributes.color !== undefined

    if (ctx.materialMode === 'pointCloud') {
      return buildPointsGroup(ctx, plyGeometry, hasVertexColors)
    }

    return buildMeshGroup(ctx, plyGeometry, hasVertexColors)
  }
}

function buildPointsGroup(
  ctx: ModelLoadContext,
  geometry: THREE.BufferGeometry,
  hasVertexColors: boolean
): THREE.Group {
  geometry.computeBoundingSphere()
  if (geometry.boundingSphere) {
    const { center, radius } = geometry.boundingSphere
    geometry.translate(-center.x, -center.y, -center.z)
    if (radius > 0) {
      const scale = 1.0 / radius
      geometry.scale(scale, scale, scale)
    }
  }

  const pointMaterial = hasVertexColors
    ? new THREE.PointsMaterial({
        size: 0.005,
        vertexColors: true,
        sizeAttenuation: true
      })
    : new THREE.PointsMaterial({
        size: 0.005,
        color: 0xcccccc,
        sizeAttenuation: true
      })

  const points = new THREE.Points(geometry, pointMaterial)
  ctx.registerOriginalMaterial(points as unknown as THREE.Mesh, pointMaterial)

  const group = new THREE.Group()
  group.add(points)
  return group
}

function buildMeshGroup(
  ctx: ModelLoadContext,
  geometry: THREE.BufferGeometry,
  hasVertexColors: boolean
): THREE.Group {
  const material = hasVertexColors
    ? new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.0,
        roughness: 0.5,
        side: THREE.DoubleSide
      })
    : ctx.standardMaterial.clone()

  if (!hasVertexColors && material instanceof THREE.MeshStandardMaterial) {
    material.side = THREE.DoubleSide
  }

  const mesh = new THREE.Mesh(geometry, material)
  ctx.registerOriginalMaterial(mesh, material)

  const group = new THREE.Group()
  group.add(mesh)
  return group
}

export function buildPointCloudForMaterialMode(
  originalGeometry: THREE.BufferGeometry,
  mode: MaterialMode,
  standardMaterial: THREE.MeshStandardMaterial,
  originalMaterials: WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>
): THREE.Group {
  const geometry = originalGeometry.clone()
  const hasVertexColors = geometry.attributes.color !== undefined

  const ctx: ModelLoadContext = {
    setOriginalModel: () => {},
    registerOriginalMaterial: (mesh, material) =>
      originalMaterials.set(mesh, material),
    standardMaterial,
    materialMode: mode
  }

  if (mode === 'pointCloud') {
    return buildPointsGroup(ctx, geometry, hasVertexColors)
  }

  const group = buildMeshGroup(ctx, geometry, hasVertexColors)

  if (mode === 'normal' || mode === 'wireframe') {
    const mesh = group.children[0] as THREE.Mesh
    mesh.material =
      mode === 'normal'
        ? new THREE.MeshNormalMaterial({
            flatShading: false,
            side: THREE.DoubleSide
          })
        : new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true
          })
  }

  return group
}
