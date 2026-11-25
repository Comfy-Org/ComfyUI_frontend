import type { Compositor } from './compositor'
import { createWebGLCompositor } from './compositor/webglCompositor'
import { createEditor } from './editor/editor'
import { registerBuiltinKinds } from './kinds'
import { registerBuiltinTools } from './tools'

export interface SessionOptions {
  createCompositor?: () => Compositor
  onChange?: () => void
}

export function createSession(opts: SessionOptions = {}) {
  registerBuiltinKinds()
  registerBuiltinTools()

  const compositor = (opts.createCompositor ?? createWebGLCompositor)()
  let onContextRestored: (() => void) | null = null
  const glOk = compositor.init({
    width: 1024,
    height: 1024,
    onContextRestored: () => onContextRestored?.()
  })
  const editor = createEditor({ compositor, onChange: opts.onChange })
  onContextRestored = () => editor.invalidate()

  return {
    editor,
    compositor,
    glOk,
    dispose(): void {
      onContextRestored = null
      compositor.dispose()
    }
  }
}
