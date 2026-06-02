import { beforeEach, describe, expect, it, vi } from 'vitest'

// Override the global @sparkjsdev/spark mock from vitest.setup.ts (the real
// PlyReader pulls in WASM that doesn't run under Node) with a thin stub
// driven by per-test fixtures — see `mockNextParseHeader` below. Keeping the
// PLY-format parsing out of the test file because (a) it would be a parallel
// implementation that can drift from sparkjs, and (b) sparkjs's PlyReader
// already has its own coverage. We're only testing what isGaussianSplatPLY
// does with the parsed result.
type StubProperty = { isList: boolean; type: string }
type StubElement = {
  name: string
  count: number
  properties: Record<string, StubProperty>
}

const {
  nextHeaderResultMock,
  resetParseHeaderMock,
  mockNextParseHeader,
  mockNextParseHeaderError
} = vi.hoisted(() => {
  let next: { elements?: Record<string, StubElement>; error?: Error } = {}
  return {
    nextHeaderResultMock: () => next,
    resetParseHeaderMock: () => {
      next = {}
    },
    mockNextParseHeader: (elements: Record<string, StubElement>) => {
      next = { elements }
    },
    mockNextParseHeaderError: (error: Error) => {
      next = { error }
    }
  }
})

vi.mock('@sparkjsdev/spark', () => ({
  PlyReader: class {
    elements: Record<string, StubElement> = {}
    constructor(_: unknown) {}
    parseHeader(): Promise<void> {
      const { elements, error } = nextHeaderResultMock()
      if (error) return Promise.reject(error)
      this.elements = elements ?? {}
      return Promise.resolve()
    }
  }
}))

import {
  isGaussianSplatPLY,
  isPLYAsciiFormat,
  parseASCIIPLY
} from '@/scripts/metadata/ply'

const FLOAT = { isList: false, type: 'float' }
const UCHAR = { isList: false, type: 'uchar' }
const vertex = (
  props: Record<string, StubProperty>
): Record<string, StubElement> => ({
  vertex: { name: 'vertex', count: 1, properties: props }
})
const GAUSSIAN_SPLAT_PROPS = {
  x: FLOAT,
  y: FLOAT,
  z: FLOAT,
  f_dc_0: FLOAT,
  f_dc_1: FLOAT,
  f_dc_2: FLOAT,
  opacity: FLOAT,
  scale_0: FLOAT,
  scale_1: FLOAT,
  scale_2: FLOAT,
  rot_0: FLOAT,
  rot_1: FLOAT,
  rot_2: FLOAT,
  rot_3: FLOAT
}
const POINT_CLOUD_PROPS = {
  x: FLOAT,
  y: FLOAT,
  z: FLOAT,
  red: UCHAR,
  green: UCHAR,
  blue: UCHAR
}
const DC_ONLY_PROPS = {
  x: FLOAT,
  y: FLOAT,
  z: FLOAT,
  f_dc_0: FLOAT,
  f_dc_1: FLOAT,
  f_dc_2: FLOAT
}

function createPLYBuffer(content: string): ArrayBuffer {
  return new TextEncoder().encode(content).buffer
}

describe('PLY metadata parser', () => {
  describe('isPLYAsciiFormat', () => {
    it('should return true for ASCII format PLY', () => {
      const ply = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
end_header
0 0 0
1 0 0
0 1 0`

      const buffer = createPLYBuffer(ply)
      expect(isPLYAsciiFormat(buffer)).toBe(true)
    })

    it('should return false for binary format PLY', () => {
      const ply = `ply
format binary_little_endian 1.0
element vertex 3
property float x
property float y
property float z
end_header`

      const buffer = createPLYBuffer(ply)
      expect(isPLYAsciiFormat(buffer)).toBe(false)
    })

    it('should return false for binary big endian format', () => {
      const ply = `ply
format binary_big_endian 1.0
element vertex 3
end_header`

      const buffer = createPLYBuffer(ply)
      expect(isPLYAsciiFormat(buffer)).toBe(false)
    })

    it('should handle empty buffer', () => {
      const buffer = new ArrayBuffer(0)
      expect(isPLYAsciiFormat(buffer)).toBe(false)
    })
  })

  describe('isGaussianSplatPLY', () => {
    beforeEach(resetParseHeaderMock)

    it('detects a 3DGS PLY by scale_0..2 + rot_0..3 properties on the vertex element', async () => {
      mockNextParseHeader(vertex(GAUSSIAN_SPLAT_PROPS))
      expect(await isGaussianSplatPLY(new ArrayBuffer(0))).toBe(true)
    })

    it('returns false for a point-cloud PLY with no scale/rot properties', async () => {
      mockNextParseHeader(vertex(POINT_CLOUD_PROPS))
      expect(await isGaussianSplatPLY(new ArrayBuffer(0))).toBe(false)
    })

    it('returns false when only the f_dc_* DC term is present (no scale/rot)', async () => {
      mockNextParseHeader(vertex(DC_ONLY_PROPS))
      expect(await isGaussianSplatPLY(new ArrayBuffer(0))).toBe(false)
    })

    it('returns false when parseHeader rejects (malformed / unsupported PLY)', async () => {
      mockNextParseHeaderError(new Error('Failed to read header'))
      expect(await isGaussianSplatPLY(new ArrayBuffer(0))).toBe(false)
    })

    it('returns false when the vertex element is missing entirely', async () => {
      mockNextParseHeader({})
      expect(await isGaussianSplatPLY(new ArrayBuffer(0))).toBe(false)
    })
  })

  describe('parseASCIIPLY', () => {
    it('should parse simple PLY with positions only', () => {
      const ply = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
end_header
0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).not.toBeNull()
      expect(result!.vertexCount).toBe(3)
      expect(result!.colors).toBeNull()
      expect(result!.positions).toBeInstanceOf(Float32Array)
      expect(result!.positions.length).toBe(9)

      expect(result!.positions[0]).toBeCloseTo(0.0)
      expect(result!.positions[1]).toBeCloseTo(0.0)
      expect(result!.positions[2]).toBeCloseTo(0.0)

      expect(result!.positions[3]).toBeCloseTo(1.0)
      expect(result!.positions[4]).toBeCloseTo(0.0)
      expect(result!.positions[5]).toBeCloseTo(0.0)

      expect(result!.positions[6]).toBeCloseTo(0.0)
      expect(result!.positions[7]).toBeCloseTo(1.0)
      expect(result!.positions[8]).toBeCloseTo(0.0)
    })

    it('should parse PLY with positions and colors', () => {
      const ply = `ply
format ascii 1.0
element vertex 2
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
end_header
1.0 2.0 3.0 255 128 0
-1.0 -2.0 -3.0 0 255 128`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).not.toBeNull()
      expect(result!.vertexCount).toBe(2)
      expect(result!.colors).not.toBeNull()
      expect(result!.colors).toBeInstanceOf(Float32Array)
      expect(result!.colors!.length).toBe(6)

      // First vertex position
      expect(result!.positions[0]).toBeCloseTo(1.0)
      expect(result!.positions[1]).toBeCloseTo(2.0)
      expect(result!.positions[2]).toBeCloseTo(3.0)

      // First vertex color (normalized to 0-1)
      expect(result!.colors![0]).toBeCloseTo(1.0) // 255/255
      expect(result!.colors![1]).toBeCloseTo(128 / 255)
      expect(result!.colors![2]).toBeCloseTo(0.0)

      // Second vertex color
      expect(result!.colors![3]).toBeCloseTo(0.0)
      expect(result!.colors![4]).toBeCloseTo(1.0)
      expect(result!.colors![5]).toBeCloseTo(128 / 255)
    })

    it('should handle properties in non-standard order', () => {
      const ply = `ply
format ascii 1.0
element vertex 1
property uchar red
property float z
property uchar green
property float x
property uchar blue
property float y
end_header
255 3.0 128 1.0 64 2.0`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).not.toBeNull()
      expect(result!.vertexCount).toBe(1)

      expect(result!.positions[0]).toBeCloseTo(1.0)
      expect(result!.positions[1]).toBeCloseTo(2.0)
      expect(result!.positions[2]).toBeCloseTo(3.0)

      expect(result!.colors![0]).toBeCloseTo(1.0)
      expect(result!.colors![1]).toBeCloseTo(128 / 255)
      expect(result!.colors![2]).toBeCloseTo(64 / 255)
    })

    it('should handle extra properties', () => {
      const ply = `ply
format ascii 1.0
element vertex 1
property float x
property float y
property float z
property float nx
property float ny
property float nz
property uchar red
property uchar green
property uchar blue
property uchar alpha
end_header
1.0 2.0 3.0 0.0 1.0 0.0 255 128 64 255`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).not.toBeNull()
      expect(result!.positions[0]).toBeCloseTo(1.0)
      expect(result!.positions[1]).toBeCloseTo(2.0)
      expect(result!.positions[2]).toBeCloseTo(3.0)

      expect(result!.colors![0]).toBeCloseTo(1.0)
      expect(result!.colors![1]).toBeCloseTo(128 / 255)
      expect(result!.colors![2]).toBeCloseTo(64 / 255)
    })

    it('should handle negative coordinates', () => {
      const ply = `ply
format ascii 1.0
element vertex 1
property float x
property float y
property float z
end_header
-1.5 -2.5 -3.5`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).not.toBeNull()
      expect(result!.positions[0]).toBeCloseTo(-1.5)
      expect(result!.positions[1]).toBeCloseTo(-2.5)
      expect(result!.positions[2]).toBeCloseTo(-3.5)
    })

    it('should handle scientific notation', () => {
      const ply = `ply
format ascii 1.0
element vertex 1
property float x
property float y
property float z
end_header
1.5e-3 2.5e+2 -3.5e1`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).not.toBeNull()
      expect(result!.positions[0]).toBeCloseTo(0.0015)
      expect(result!.positions[1]).toBeCloseTo(250)
      expect(result!.positions[2]).toBeCloseTo(-35)
    })

    it('should skip empty lines in vertex data', () => {
      const ply = `ply
format ascii 1.0
element vertex 2
property float x
property float y
property float z
end_header

1.0 0.0 0.0

0.0 1.0 0.0
`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).not.toBeNull()
      expect(result!.vertexCount).toBe(2)
      expect(result!.positions[0]).toBeCloseTo(1.0)
      expect(result!.positions[3]).toBeCloseTo(0.0)
      expect(result!.positions[4]).toBeCloseTo(1.0)
    })

    it('should handle whitespace variations', () => {
      const ply = `ply
format ascii 1.0
element vertex 1
property float x
property float y
property float z
end_header
  1.0   2.0   3.0  `

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).not.toBeNull()
      expect(result!.positions[0]).toBeCloseTo(1.0)
      expect(result!.positions[1]).toBeCloseTo(2.0)
      expect(result!.positions[2]).toBeCloseTo(3.0)
    })

    it('should return null for invalid header - missing vertex count', () => {
      const ply = `ply
format ascii 1.0
property float x
property float y
property float z
end_header
1.0 2.0 3.0`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).toBeNull()
    })

    it('should return null for invalid header - missing x property', () => {
      const ply = `ply
format ascii 1.0
element vertex 1
property float y
property float z
end_header
2.0 3.0`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).toBeNull()
    })

    it('should return null for invalid header - missing y property', () => {
      const ply = `ply
format ascii 1.0
element vertex 1
property float x
property float z
end_header
1.0 3.0`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).toBeNull()
    })

    it('should return null for invalid header - missing z property', () => {
      const ply = `ply
format ascii 1.0
element vertex 1
property float x
property float y
end_header
1.0 2.0`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).toBeNull()
    })

    it('should return null for empty buffer', () => {
      const buffer = new ArrayBuffer(0)
      const result = parseASCIIPLY(buffer)

      expect(result).toBeNull()
    })

    it('should handle large vertex count', () => {
      const vertexCount = 1000
      let plyContent = `ply
format ascii 1.0
element vertex ${vertexCount}
property float x
property float y
property float z
end_header
`
      for (let i = 0; i < vertexCount; i++) {
        plyContent += `${i} ${i * 2} ${i * 3}\n`
      }

      const buffer = createPLYBuffer(plyContent)
      const result = parseASCIIPLY(buffer)

      expect(result).not.toBeNull()
      expect(result!.vertexCount).toBe(vertexCount)
      expect(result!.positions.length).toBe(vertexCount * 3)

      expect(result!.positions[0]).toBeCloseTo(0)
      expect(result!.positions[1]).toBeCloseTo(0)
      expect(result!.positions[2]).toBeCloseTo(0)

      const lastIdx = (vertexCount - 1) * 3
      expect(result!.positions[lastIdx]).toBeCloseTo(vertexCount - 1)
      expect(result!.positions[lastIdx + 1]).toBeCloseTo((vertexCount - 1) * 2)
      expect(result!.positions[lastIdx + 2]).toBeCloseTo((vertexCount - 1) * 3)
    })

    it('should handle partial color properties', () => {
      const ply = `ply
format ascii 1.0
element vertex 1
property float x
property float y
property float z
property uchar red
end_header
1.0 2.0 3.0 255`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).not.toBeNull()
      // hasColor is true but green/blue indices are -1, so colors won't be parsed
      expect(result!.positions[0]).toBeCloseTo(1.0)
    })

    it('should handle double property type', () => {
      const ply = `ply
format ascii 1.0
element vertex 1
property double x
property double y
property double z
end_header
1.123456789 2.987654321 3.111111111`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).not.toBeNull()
      expect(result!.positions[0]).toBeCloseTo(1.123456789)
      expect(result!.positions[1]).toBeCloseTo(2.987654321)
      expect(result!.positions[2]).toBeCloseTo(3.111111111)
    })

    it('should stop parsing at vertex count limit', () => {
      const ply = `ply
format ascii 1.0
element vertex 2
property float x
property float y
property float z
end_header
1.0 0.0 0.0
0.0 1.0 0.0
0.0 0.0 1.0
999 999 999`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).not.toBeNull()
      expect(result!.vertexCount).toBe(2)
      expect(result!.positions.length).toBe(6)
    })

    it('should handle face elements after vertices', () => {
      const ply = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
element face 1
property list uchar int vertex_indices
end_header
0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
3 0 1 2`

      const buffer = createPLYBuffer(ply)
      const result = parseASCIIPLY(buffer)

      expect(result).not.toBeNull()
      expect(result!.vertexCount).toBe(3)
    })
  })
})
