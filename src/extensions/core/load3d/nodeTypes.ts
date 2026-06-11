/**
 * Canonical lists of node types backed by the Load3D viewer infrastructure.
 * Adding a new node type that uses the viewer = one line change here.
 */

const LOAD3D_PREVIEW_NODES = new Set([
  'Preview3D',
  'PreviewGaussianSplat',
  'PreviewPointCloud'
])

const LOAD3D_ALL_NODES = new Set([
  ...LOAD3D_PREVIEW_NODES,
  'Load3D',
  'Load3DAdvanced',
  'SaveGLB'
])

export const isLoad3dPreviewNode = (nodeType: string): boolean =>
  LOAD3D_PREVIEW_NODES.has(nodeType)

export const isLoad3dNode = (nodeType: string): boolean =>
  LOAD3D_ALL_NODES.has(nodeType)
