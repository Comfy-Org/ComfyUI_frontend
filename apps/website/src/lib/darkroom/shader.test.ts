import { beforeEach, describe, expect, it, vi } from 'vitest'

// The module keeps one WebGL renderer for the page, so each test loads it anew.
async function loadShader() {
  return import('./shader')
}

/** Enough of WebGL to link a program and count what gets drawn. */
function fakeWebGl() {
  const draws: number[][] = []
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    LINK_STATUS: 3,
    ARRAY_BUFFER: 4,
    STATIC_DRAW: 5,
    FLOAT: 6,
    TRIANGLE_STRIP: 7,
    createProgram: () => ({}),
    createShader: () => ({}),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: () => true,
    useProgram: vi.fn(),
    createBuffer: () => ({}),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: () => 0,
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    getUniformLocation: () => ({}),
    viewport: (_x: number, _y: number, width: number, height: number) =>
      draws.push([width, height]),
    uniform2f: vi.fn(),
    uniform1f: vi.fn(),
    drawArrays: vi.fn()
  }
  return { gl, draws }
}

function stubCanvas(gl: unknown) {
  const drawImage = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement, kind: string) {
      return (kind === 'webgl' ? gl : { drawImage }) as never
    }
  )
  return drawImage
}

beforeEach(() => {
  vi.resetModules()
})

describe('loading tiles', () => {
  it('sizes a tile to its shape and draws it still when motion is reduced', async () => {
    const { startLoadingTile } = await loadShader()
    const { gl, draws } = fakeWebGl()
    const drawImage = stubCanvas(gl)
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const frames = vi.spyOn(window, 'requestAnimationFrame')

    const wide = document.createElement('canvas')
    startLoadingTile(wide, 16 / 9, 3)
    const tall = document.createElement('canvas')
    startLoadingTile(tall, 9 / 16, 4)

    expect([wide.width, wide.height]).toEqual([224, 126])
    expect([tall.width, tall.height]).toEqual([126, 224])
    expect(draws).toEqual([
      [224, 126],
      [126, 224]
    ])
    expect(drawImage).toHaveBeenCalledTimes(2)
    // One still frame each: nothing is left animating.
    expect(frames).not.toHaveBeenCalled()
  })

  it('animates a tile until it is stopped', async () => {
    const { startLoadingTile, stopLoadingTile } = await loadShader()
    const { gl, draws } = fakeWebGl()
    stubCanvas(gl)
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    let next: FrameRequestCallback | undefined
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      next = callback
      return 1
    })
    const canvas = document.createElement('canvas')

    startLoadingTile(canvas, 1, 1)
    next?.(performance.now() + 1_000)
    expect(draws).toHaveLength(1)

    stopLoadingTile(canvas)
    next?.(performance.now() + 2_000)
    expect(draws).toHaveLength(1)
  })
})
