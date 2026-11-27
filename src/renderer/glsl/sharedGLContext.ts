export interface SharedGLHandle {
  canvas: OffscreenCanvas
  gl: WebGL2RenderingContext
  release: () => void
}

interface SharedGL {
  canvas: OffscreenCanvas
  gl: WebGL2RenderingContext
  refs: number
}

let current: SharedGL | undefined

function loseContext(gl: WebGL2RenderingContext): void {
  gl.getExtension('WEBGL_lose_context')?.loseContext()
}

function createSharedGL(): SharedGL | undefined {
  const canvas = new OffscreenCanvas(1, 1)
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true
  })
  if (!gl) return undefined

  if (!gl.getExtension('EXT_color_buffer_float')) {
    loseContext(gl)
    return undefined
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  return { canvas, gl, refs: 0 }
}

export function acquireSharedGL(): SharedGLHandle | undefined {
  if (current?.gl.isContextLost()) current = undefined

  current ??= createSharedGL()
  if (!current) return undefined

  const entry = current
  entry.refs++
  let released = false
  return {
    canvas: entry.canvas,
    gl: entry.gl,
    release() {
      if (released) return
      released = true
      entry.refs--
      if (entry.refs > 0) return
      if (current === entry) current = undefined
      loseContext(entry.gl)
    }
  }
}
