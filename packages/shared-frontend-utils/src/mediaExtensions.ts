/**
 * Extensions the in-app load3d viewer can load directly.
 */
export const THREE_D_LOADABLE_EXTENSIONS = [
  'gltf',
  'glb',
  'obj',
  'fbx',
  'stl',
  'spz',
  'splat',
  'ply',
  'ksplat'
] as const

const THREE_D_NON_LOADABLE_MEDIA_EXTENSIONS = ['usdz'] as const

/**
 * Shared 3D file extension registries.
 *
 * Keep 3D media classification and load3d viewer support in one module so new
 * formats do not silently fall out of sync across the queue, asset sidebar,
 * and drag/drop flows.
 */
export const THREE_D_MEDIA_EXTENSIONS = [
  ...THREE_D_LOADABLE_EXTENSIONS,
  ...THREE_D_NON_LOADABLE_MEDIA_EXTENSIONS
] as const

export type ThreeDMediaExtension = (typeof THREE_D_MEDIA_EXTENSIONS)[number]
export type ThreeDLoadableExtension =
  (typeof THREE_D_LOADABLE_EXTENSIONS)[number]

export function isThreeDMediaExtension(
  extension: string | null | undefined
): extension is ThreeDMediaExtension {
  return (
    typeof extension === 'string' &&
    THREE_D_MEDIA_EXTENSIONS.includes(extension as ThreeDMediaExtension)
  )
}

export function isThreeDLoadableExtension(
  extension: string | null | undefined
): extension is ThreeDLoadableExtension {
  return (
    typeof extension === 'string' &&
    THREE_D_LOADABLE_EXTENSIONS.includes(extension as ThreeDLoadableExtension)
  )
}
