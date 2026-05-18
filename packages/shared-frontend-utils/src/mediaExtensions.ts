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

// Classification is broader than viewer support: some valid 3D assets, such
// as USDZ, can be listed/downloaded but cannot be loaded by the in-app viewer.
export const THREE_D_MEDIA_EXTENSIONS = [
  ...THREE_D_LOADABLE_EXTENSIONS,
  ...THREE_D_NON_LOADABLE_MEDIA_EXTENSIONS
] as const

export type ThreeDLoadableExtension =
  (typeof THREE_D_LOADABLE_EXTENSIONS)[number]
export type ThreeDMediaExtension = (typeof THREE_D_MEDIA_EXTENSIONS)[number]

export function isThreeDLoadableExtension(
  extension: string | null | undefined
): boolean {
  const normalized = extension?.toLowerCase()
  return (
    typeof normalized === 'string' &&
    THREE_D_LOADABLE_EXTENSIONS.includes(normalized as ThreeDLoadableExtension)
  )
}

export function isThreeDMediaExtension(
  extension: string | null | undefined
): boolean {
  const normalized = extension?.toLowerCase()
  return (
    typeof normalized === 'string' &&
    THREE_D_MEDIA_EXTENSIONS.includes(normalized as ThreeDMediaExtension)
  )
}
