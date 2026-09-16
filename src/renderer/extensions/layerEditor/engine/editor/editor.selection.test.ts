import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Compositor, CompositeInput, FBOHandle } from '../compositor'
import { registerBuiltinKinds } from '../kinds'
import { defaultControl, registerTool } from '../tool'
import type { ToolContext } from '../tool'
import { registerBuiltinTools } from '../tools'
import { createEditor } from './editor'
import type { Editor } from './editor'
import { rectMask } from './selectionMath'

beforeAll(() => {
  registerBuiltinKinds()
  registerBuiltinTools()
})

class FakeCompositor implements Compositor {
  init() {
    return true
  }
  resize() {}
  composite(_inputs: CompositeInput[], _t?: FBOHandle | null) {}
  allocTarget(width: number, height: number): FBOHandle {
    return { id: 1, width, height }
  }
  freeTarget() {}
  targetTexture(): WebGLTexture {
    return {}
  }
  upload(): WebGLTexture {
    return {}
  }
  readback(): ImageData {
    return {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray(4)
    } as unknown as ImageData
  }
  async toBlob(): Promise<Blob> {
    return new Blob()
  }
  getCanvas() {
    return null
  }
  dispose() {}
}

interface PixelBuf {
  w: number
  h: number
  data: Uint8ClampedArray
}

interface FakeImg {
  width: number
  height: number
  data: Uint8ClampedArray
}

const bufs = new WeakMap<HTMLCanvasElement, PixelBuf>()

function bufOf(c: HTMLCanvasElement): PixelBuf {
  let b = bufs.get(c)
  if (!b || b.w !== c.width || b.h !== c.height) {
    b = {
      w: c.width,
      h: c.height,
      data: new Uint8ClampedArray(c.width * c.height * 4)
    }
    bufs.set(c, b)
  }
  return b
}

function parseHex(style: string): { r: number; g: number; b: number } {
  const m = /^#([0-9a-f]{6})$/i.exec(style)
  const v = m ? parseInt(m[1], 16) : 0
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff }
}

function makePixelCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  let tx = 0
  let ty = 0
  const stack: Array<{ tx: number; ty: number }> = []
  const writeRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    rgba: [number, number, number, number]
  ): void => {
    const b = bufOf(canvas)
    const x0 = Math.max(0, Math.floor(x))
    const y0 = Math.max(0, Math.floor(y))
    const x1 = Math.min(b.w, Math.ceil(x + w))
    const y1 = Math.min(b.h, Math.ceil(y + h))
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        b.data.set(rgba, (py * b.w + px) * 4)
      }
    }
  }
  const ctx = {
    canvas,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    globalCompositeOperation: 'source-over',
    fillStyle: '#000000',
    save: () => {
      stack.push({ tx, ty })
    },
    restore: () => {
      const s = stack.pop()
      if (s) {
        tx = s.tx
        ty = s.ty
      }
    },
    translate: (x: number, y: number) => {
      tx += x
      ty += y
    },
    rotate: () => {},
    scale: () => {},
    beginPath: () => {},
    rect: () => {},
    clip: () => {},
    clearRect: (x: number, y: number, w: number, h: number) => {
      writeRect(x + tx, y + ty, w, h, [0, 0, 0, 0])
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      const c = parseHex(ctx.fillStyle)
      writeRect(x + tx, y + ty, w, h, [c.r, c.g, c.b, 255])
    },
    drawImage: (src: unknown, ...rest: number[]) => {
      if (!(src instanceof HTMLCanvasElement)) return
      const sb = bufOf(src)
      let sx = 0
      let sy = 0
      let sw = sb.w
      let sh = sb.h
      let dx: number
      let dy: number
      let dw: number
      let dh: number
      if (rest.length >= 8) {
        ;[sx, sy, sw, sh, dx, dy, dw, dh] = rest
      } else if (rest.length >= 4) {
        ;[dx, dy, dw, dh] = rest
      } else {
        ;[dx, dy] = rest
        dw = sw
        dh = sh
      }
      dx += tx
      dy += ty
      const db = bufOf(canvas)
      const diff = ctx.globalCompositeOperation === 'difference'
      for (let y = 0; y < Math.round(dh); y++) {
        const py = Math.floor(dy) + y
        if (py < 0 || py >= db.h) continue
        const syi = sy + Math.floor((y * sh) / dh)
        for (let x = 0; x < Math.round(dw); x++) {
          const px = Math.floor(dx) + x
          if (px < 0 || px >= db.w) continue
          const sxi = sx + Math.floor((x * sw) / dw)
          if (sxi < 0 || syi < 0 || sxi >= sb.w || syi >= sb.h) continue
          const si = (syi * sb.w + sxi) * 4
          const di = (py * db.w + px) * 4
          const sa = sb.data[si + 3]
          if (diff) {
            db.data[di] = Math.abs(db.data[di] - sb.data[si])
            db.data[di + 1] = Math.abs(db.data[di + 1] - sb.data[si + 1])
            db.data[di + 2] = Math.abs(db.data[di + 2] - sb.data[si + 2])
            db.data[di + 3] = Math.max(db.data[di + 3], sa)
          } else if (sa > 0) {
            db.data[di] = sb.data[si]
            db.data[di + 1] = sb.data[si + 1]
            db.data[di + 2] = sb.data[si + 2]
            db.data[di + 3] = sa
          }
        }
      }
    },
    getImageData: (x: number, y: number, w: number, h: number): FakeImg => {
      const b = bufOf(canvas)
      const out: FakeImg = {
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4)
      }
      for (let yy = 0; yy < h; yy++) {
        const sy = y + yy
        if (sy < 0 || sy >= b.h) continue
        for (let xx = 0; xx < w; xx++) {
          const sx = x + xx
          if (sx < 0 || sx >= b.w) continue
          const si = (sy * b.w + sx) * 4
          out.data.set(b.data.subarray(si, si + 4), (yy * w + xx) * 4)
        }
      }
      return out
    },
    putImageData: (img: FakeImg, x: number, y: number) => {
      const b = bufOf(canvas)
      for (let yy = 0; yy < img.height; yy++) {
        const dy = y + yy
        if (dy < 0 || dy >= b.h) continue
        for (let xx = 0; xx < img.width; xx++) {
          const dx = x + xx
          if (dx < 0 || dx >= b.w) continue
          const si = (yy * img.width + xx) * 4
          b.data.set(img.data.subarray(si, si + 4), (dy * b.w + dx) * 4)
        }
      }
    },
    createImageData: (w: number, h: number): FakeImg => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4)
    })
  }
  return ctx as unknown as CanvasRenderingContext2D
}

const origGetContext = HTMLCanvasElement.prototype.getContext

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    kind: string
  ) {
    return kind === '2d' ? makePixelCtx(this) : null
  } as typeof HTMLCanvasElement.prototype.getContext
})

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = origGetContext
})

function makeEditor(): Editor {
  const editor = createEditor({ compositor: new FakeCompositor() })
  const doc = editor.document()
  doc.width = 40
  doc.height = 40
  return editor
}

function probeToolContext(editor: Editor): ToolContext {
  let captured: ToolContext | null = null
  registerTool({
    id: 'sel-probe',
    create: (ctx) => {
      captured = ctx
      return {
        id: 'sel-probe',
        control: defaultControl(),
        onButtonPress: () => {},
        onMotion: () => {},
        onButtonRelease: () => {},
        onHover: () => {},
        cursorFor: () => 'default',
        drawOverlay: () => {}
      }
    }
  })
  editor.setTool('sel-probe')
  return captured!
}

describe('createEditor — selection channel ops', () => {
  it('tools combine selection shapes against the current mask', () => {
    const editor = makeEditor()
    const ctx = probeToolContext(editor)
    ctx.selection.combineShape(
      'Marquee',
      rectMask(40, 40, { x: 4, y: 4, w: 10, h: 10 }),
      'replace'
    )
    expect(editor.selectionBounds()).toEqual({ x: 4, y: 4, w: 10, h: 10 })
    ctx.selection.combineShape(
      'Marquee',
      rectMask(40, 40, { x: 20, y: 20, w: 6, h: 6 }),
      'add'
    )
    expect(editor.selectionBounds()).toEqual({ x: 4, y: 4, w: 22, h: 22 })
    const mask = ctx.selection.currentMask()
    expect(mask).not.toBeNull()
    expect(mask!.data[5 * 40 + 5]).toBe(1)
    expect(mask!.data[15 * 40 + 15]).toBe(0)
    ctx.selection.combineShape(
      'Clear',
      rectMask(40, 40, { x: 0, y: 0, w: 40, h: 40 }),
      'subtract'
    )
    expect(editor.selectionBounds()).toBeNull()
    ctx.selection.none()
    expect(editor.selectionBounds()).toBeNull()
  })

  it('a committed selection draws marching-ants outlines in the overlay', () => {
    const editor = makeEditor()
    const ctx = probeToolContext(editor)
    ctx.selection.combineShape(
      'Marquee',
      rectMask(40, 40, { x: 5, y: 5, w: 8, h: 8 }),
      'replace'
    )
    const polys = editor.overlay.items.filter((i) => i.type === 'polyline')
    expect(polys).toHaveLength(1)
    expect(polys[0]).toMatchObject({ closed: true, ants: true })
  })
})
