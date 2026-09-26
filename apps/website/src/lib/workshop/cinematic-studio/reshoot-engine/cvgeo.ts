/**
 * Reader for the file CrossViewGeometryExport writes (comfyrob/
 * ComfyUI-CrossViewWarp, crossview_demo_nodes.py): the prepared frames as
 * JPEGs plus MoGe metric depth at the same preview scale.
 */

const MAGIC = 'CVGEO1\0\0'

interface Header {
  readonly version: number
  readonly frames: number
  readonly width: number
  readonly height: number
  readonly fps: number
  readonly source_width: number
  readonly source_height: number
  readonly fx_norm: number | null
  readonly jpegs: readonly { offset: number; length: number }[]
  readonly depth: {
    offset: number
    length: number
    dtype: 'float16'
    shape: [number, number, number]
    encoding: string
  }
}

export interface Geometry {
  readonly frames: number
  readonly width: number
  readonly height: number
  readonly fps: number
  /** Size of the frames the generation itself uses. */
  readonly sourceWidth: number
  readonly sourceHeight: number
  /** MoGe's focal length as a fraction of width, if it produced intrinsics. */
  readonly fxNorm: number | null
  readonly jpegs: readonly Blob[]
  /** Metres, NaN where MoGe had no geometry. One plane per frame. */
  readonly depth: readonly Float32Array[]
  /** The raw half floats, ready for an R16F texture. */
  readonly depthHalf: readonly Uint16Array[]
}

let halfTable: Float32Array | undefined

function halfToFloat(): Float32Array {
  if (halfTable) return halfTable
  const out = new Float32Array(65536)
  for (let h = 0; h < 65536; h++) {
    const sign = h & 0x8000 ? -1 : 1
    const exp = (h >> 10) & 0x1f
    const frac = h & 0x3ff
    out[h] =
      exp === 0
        ? sign * 2 ** -14 * (frac / 1024)
        : exp === 31
          ? frac
            ? NaN
            : sign * Infinity
          : sign * 2 ** (exp - 15) * (1 + frac / 1024)
  }
  return (halfTable = out)
}

async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function readGeometry(buffer: ArrayBuffer): Promise<Geometry> {
  const bytes = new Uint8Array(buffer)
  if (new TextDecoder().decode(bytes.subarray(0, 8)) !== MAGIC)
    throw new Error('Not a CrossView geometry file.')
  const headLength = new DataView(buffer).getUint32(8, true)
  const header = JSON.parse(
    new TextDecoder().decode(bytes.subarray(12, 12 + headLength))
  ) as Header
  if (header.version !== 1 || header.depth.encoding !== 'shuffle2+zlib')
    throw new Error(`Unsupported geometry file (v${header.version}).`)
  const blobs = bytes.subarray(12 + headLength)

  const jpegs = header.jpegs.map(
    ({ offset, length }) =>
      new Blob([blobs.subarray(offset, offset + length)], {
        type: 'image/jpeg'
      })
  )

  // Every low byte, then every high byte: interleave them back into halves.
  const { offset, length, shape } = header.depth
  const planes = await inflate(blobs.subarray(offset, offset + length))
  const [n, h, w] = shape
  const count = n * h * w
  const halves = new Uint16Array(count)
  for (let i = 0; i < count; i++)
    halves[i] = planes[i] | (planes[count + i] << 8)

  const table = halfToFloat()
  const depthHalf: Uint16Array[] = []
  const depth: Float32Array[] = []
  for (let f = 0; f < n; f++) {
    const plane = halves.subarray(f * h * w, (f + 1) * h * w)
    depthHalf.push(plane)
    depth.push(Float32Array.from(plane, (x) => table[x]))
  }

  return {
    frames: n,
    width: w,
    height: h,
    fps: header.fps,
    sourceWidth: header.source_width,
    sourceHeight: header.source_height,
    fxNorm: header.fx_norm,
    jpegs,
    depth,
    depthHalf
  }
}
