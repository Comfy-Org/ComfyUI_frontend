import { SUPPORTED_EXTENSIONS } from '@comfyorg/viewport3d/load3d/constants'

export function isSupportedModelFilename(filename: string): boolean {
  const name = filename.toLowerCase()
  return SUPPORTED_EXTENSIONS.has(name.slice(name.lastIndexOf('.')))
}
