/**
 * Load3D constants that don't require THREE.js
 * This file can be imported without pulling in the entire THREE.js bundle
 */

import { THREE_D_LOADABLE_EXTENSIONS } from '@comfyorg/shared-frontend-utils/mediaExtensions'

export const SUPPORTED_EXTENSIONS = new Set(
  THREE_D_LOADABLE_EXTENSIONS.map((extension) => `.${extension}`)
)

export const SUPPORTED_EXTENSIONS_ACCEPT = [...SUPPORTED_EXTENSIONS].join(',')

export const SUPPORTED_HDRI_EXTENSIONS = new Set(['.hdr', '.exr'])

export const SUPPORTED_HDRI_EXTENSIONS_ACCEPT = [
  ...SUPPORTED_HDRI_EXTENSIONS
].join(',')
