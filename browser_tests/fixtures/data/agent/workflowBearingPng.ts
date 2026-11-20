import { crc32, deflateSync } from 'node:zlib'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

function isLatin1(value: string): boolean {
  return Buffer.from(value, 'latin1').toString('latin1') === value
}

/**
 * `tEXt` is Latin-1 by specification, so PIL — and therefore SaveImage — falls
 * back to a UTF-8 `iTXt` chunk for a workflow that Latin-1 cannot hold. Mirror
 * that, or a workflow with non-English prompts would be unrepresentable here.
 */
function textChunk(keyword: string, value: string): Buffer {
  const key = Buffer.concat([Buffer.from(keyword, 'latin1'), Buffer.alloc(1)])
  if (isLatin1(value)) {
    return chunk('tEXt', Buffer.concat([key, Buffer.from(value, 'latin1')]))
  }
  return chunk(
    'iTXt',
    Buffer.concat([
      key,
      Buffer.from([0, 0]), // uncompressed, compression method 0
      Buffer.alloc(1), // empty language tag
      Buffer.alloc(1), // empty translated keyword
      Buffer.from(value, 'utf8')
    ])
  )
}

function imageHeader(): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(1, 0)
  header.writeUInt32BE(1, 4)
  header[8] = 8
  header[9] = 2
  return header
}

function singlePixel(pixel: [number, number, number]): Buffer {
  return deflateSync(Buffer.from([0, ...pixel]), { level: 1 })
}

/** A decodable 1x1 PNG carrying the given ComfyUI metadata in `tEXt`. */
export function createWorkflowBearingPng(
  metadata: { workflow?: unknown; prompt?: unknown },
  options: { pixel?: [number, number, number] } = {}
): Buffer {
  const text = (['workflow', 'prompt'] as const).flatMap((key) =>
    metadata[key] === undefined
      ? []
      : [textChunk(key, JSON.stringify(metadata[key]))]
  )

  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    chunk('IHDR', imageHeader()),
    ...text,
    chunk('IDAT', singlePixel(options.pixel ?? [0x40, 0x80, 0xc0])),
    chunk('IEND', Buffer.alloc(0))
  ])
}
