/**
 * Load3D constants that don't require THREE.js
 * This file can be imported without pulling in the entire THREE.js bundle
 */

export const SUPPORTED_MESH_EXTENSIONS = new Set([
  '.gltf',
  '.glb',
  '.obj',
  '.fbx',
  '.stl'
])

export const SUPPORTED_EXTENSIONS = new Set([
  ...SUPPORTED_MESH_EXTENSIONS,
  '.spz',
  '.splat',
  '.ply',
  '.ksplat'
])

export const SUPPORTED_EXTENSIONS_ACCEPT = [...SUPPORTED_EXTENSIONS].join(',')

export const SUPPORTED_HDRI_EXTENSIONS = new Set(['.hdr', '.exr'])

export const SUPPORTED_HDRI_EXTENSIONS_ACCEPT = [
  ...SUPPORTED_HDRI_EXTENSIONS
].join(',')

export const LOAD3D_NONE_MODEL = 'none'

export const DIRECT_EXPORT_FORMATS = new Set(['ply', 'spz', 'splat', 'ksplat'])

interface ExportFormatOption {
  label: string
  value: string
}

const CONVERTIBLE_EXPORT_FORMAT_OPTIONS: ExportFormatOption[] = [
  { label: 'GLB', value: 'glb' },
  { label: 'OBJ', value: 'obj' },
  { label: 'STL', value: 'stl' },
  { label: 'FBX', value: 'fbx' }
]

export function getExportFormatOptions(
  sourceFormat: string | null | undefined
): ExportFormatOption[] {
  const format = sourceFormat?.toLowerCase()
  if (format && DIRECT_EXPORT_FORMATS.has(format)) {
    return [{ label: format.toUpperCase(), value: format }]
  }
  return CONVERTIBLE_EXPORT_FORMAT_OPTIONS
}
