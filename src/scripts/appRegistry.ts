import { assert } from '@/base/assert'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { ComfyApp } from '@/types/comfy'

interface InternalComfyApp extends ComfyApp {
  createRootGraph(): LGraph
  activateRootGraph(graph: LGraph): void
  enqueueGraphLoad<T>(operation: () => Promise<T>): Promise<T>
}

let instance: InternalComfyApp | undefined

export function registerApp(app: InternalComfyApp) {
  instance = app
}

export function useApp(): InternalComfyApp {
  assert(instance, 'ComfyApp accessed before registerApp')
  return instance
}
