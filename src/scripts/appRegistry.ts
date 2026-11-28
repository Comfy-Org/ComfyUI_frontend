import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { ComfyApp } from '@/types/comfy'

interface InternalComfyApp extends ComfyApp {
  hasPendingCamera(graph: LGraph): boolean
}

let instance: InternalComfyApp | undefined

export function registerApp(app: InternalComfyApp) {
  instance = app
}

export function useApp(): InternalComfyApp {
  // oxlint-disable-next-line comfy/no-new-error-throw
  if (!instance) throw new Error('ComfyApp accessed before registerApp')
  return instance
}
