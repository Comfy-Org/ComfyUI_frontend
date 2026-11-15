import { crc32, deflateSync } from 'node:zlib'

const distressedGpu = [
  '',
  '        HHH HHH H  H HH',
  '        H   H   HH H H H',
  '        HHH HH  H HH H H',
  '          H H   H  H H H',
  '        HHH HHH H  H HH',
  '',
  '            f      f',
  '           f!f   f!f',
  '        f  f!!f f!!f',
  '       f!ff!!!ff!!!f',
  '    ########################',
  '    #BBBBBBBBBBBBBBBBBBBBBB#',
  '    #BB##################BB#',
  '    #BB#CCCCCCCCCCCCCCCC#BB#',
  '    #BB#CC#C#CCCCOOOOCCC#BB#',
  '    #BB#CCC#CCCCC OOOCCC#BB#~',
  '    #BB#CC#C#CCCCOOOOCCC#BB#~~',
  '    #BB#CCCCCCCCCCCCCCCC#BB# ~',
  '    #BB#CCCC########CCCC#BB#',
  '    #BB#CCC#OOOOOOOO#CCC#BB#',
  '    #BB#CCCC########CCCC#BB#',
  '    #BB##################BB#',
  '    #BBBBBBBBBBBBBBBBBBBBBB#',
  '    ########################',
  '         H H H H H H H H',
  '',
  '         HH   H  H   H',
  '         H H H H HH HH',
  '         HH  HHH H H H',
  '         H H H H H   H',
  '         H H H H H   H',
  ''
]

const gpuColors: Record<string, number> = {
  '#': 0x080818,
  B: 0x187848,
  C: 0x808898,
  O: 0xd0d8e0,
  H: 0xd0a020,
  f: 0xd04018,
  '!': 0xe0b020,
  '~': 0x2088c0
}

function noiseAt(index: number, seed: number): number {
  const mixed = Math.imul(index ^ Math.imul(seed, 0x9e3779b9), 0x85ebca6b)
  const hashed = Math.imul(mixed ^ (mixed >>> 16), 0xc2b2ae35)
  return (hashed ^ (hashed >>> 13)) & 31
}

function createRow(width: number, artRow: string): Uint8Array {
  return new Uint8Array(width * 3 + 1).map((_, offset) => {
    if (offset === 0) return 0
    const x = Math.floor((offset - 1) / 3)
    const symbol = artRow[Math.floor((x * 32) / width)] ?? ' '
    const color = gpuColors[symbol] ?? 0x302048
    const shift = (2 - ((offset - 1) % 3)) * 8
    return (color >>> shift) & 255
  })
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

export function createLargePng(
  width: number,
  height: number,
  seed = 1
): Buffer {
  const rows = distressedGpu.map((row) => createRow(width, row))
  const raw = Buffer.concat(
    Array.from({ length: height }, (_, y) =>
      rows[Math.floor((y * rows.length) / height)].map((color, offset) =>
        offset === 0 ? 0 : color + noiseAt(y * width * 3 + offset, seed)
      )
    )
  )
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 1 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}
