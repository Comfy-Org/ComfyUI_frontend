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

function textChunk(keyword: string, value: string): Buffer {
  return chunk(
    'tEXt',
    Buffer.concat([
      Buffer.from(keyword, 'latin1'),
      Buffer.alloc(1),
      Buffer.from(value, 'latin1')
    ])
  )
}

/**
 * A real, decodable 1×1 PNG carrying `workflow` (and optionally `prompt`) in
 * `tEXt`, the way ComfyUI's own SaveImage writes them.
 *
 * Valid rather than minimal on purpose: the composer builds an object URL and
 * renders the attachment as an image, so a malformed PNG would exercise the
 * broken-image path instead of the one under test. CRCs are real for the same
 * reason — nothing in the read path verifies them today, and a fixture that
 * depends on that staying true is a fixture that breaks later for no reason.
 */
export function createWorkflowBearingPng(
  metadata: { workflow?: unknown; prompt?: unknown },
  options: { pixel?: [number, number, number] } = {}
): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(1, 0)
  header.writeUInt32BE(1, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // truecolor

  // One row: the filter byte plus a single RGB pixel.
  const [r, g, b] = options.pixel ?? [0x40, 0x80, 0xc0]
  const raw = Buffer.from([0, r, g, b])

  // Each chunk is written only when its key is present, so a caller can build
  // the prompt-only shape that third-party tools and API submissions produce.
  const text = (['workflow', 'prompt'] as const).flatMap((key) =>
    metadata[key] === undefined
      ? []
      : [textChunk(key, JSON.stringify(metadata[key]))]
  )

  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    chunk('IHDR', header),
    ...text,
    chunk('IDAT', deflateSync(raw, { level: 1 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** A decodable 1×1 PNG with no ComfyUI metadata at all. */
export function createPlainPng(): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(1, 0)
  header.writeUInt32BE(1, 4)
  header[8] = 8
  header[9] = 2
  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    chunk('IHDR', header),
    chunk(
      'IDAT',
      deflateSync(Buffer.from([0, 0x10, 0x20, 0x30]), { level: 1 })
    ),
    chunk('IEND', Buffer.alloc(0))
  ])
}
