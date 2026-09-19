import type { ComfyExtension } from '@/types/comfy'

export function createExtensionCapture() {
  const extensions = new Map<string, ComfyExtension>()

  return {
    registerExtension(extension: ComfyExtension) {
      extensions.set(extension.name, extension)
    },
    getExtension(name: string): ComfyExtension {
      const extension = extensions.get(name)
      if (!extension) throw new Error(`Extension ${name} was not registered`)
      return extension
    }
  }
}
