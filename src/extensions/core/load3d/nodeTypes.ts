/**
 * Canonical lists of node types backed by the Load3D viewer infrastructure.
 * Adding a new node type that uses the viewer = one line change here.
 */

const LOAD3D_RESULT_VIEWER_NODES = new Set([
  'Preview3D',
  'PreviewGaussianSplat',
  'PreviewPointCloud',
  'Save3DAdvanced',
  'SaveGaussianSplat',
  'SavePointCloud'
])

const LOAD3D_ALL_NODES = new Set([
  ...LOAD3D_RESULT_VIEWER_NODES,
  'Load3D',
  'Load3DAdvanced',
  'SaveGLB'
])

export const isLoad3dResultViewerNode = (nodeType: string): boolean =>
  LOAD3D_RESULT_VIEWER_NODES.has(nodeType)

export const isLoad3dNode = (nodeType: string): boolean =>
  LOAD3D_ALL_NODES.has(nodeType)
