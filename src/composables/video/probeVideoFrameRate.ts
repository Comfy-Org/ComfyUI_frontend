import { fetchHttpResourceByteSize } from '@/utils/httpResourceByteSize'

const PROBE_CHUNK_BYTES = 512 * 1024
const MAX_FRAME_RATE = 240

interface BoxRange {
  type: string
  start: number
  end: number
}

function readUint32(data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) return 0
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  return view.getUint32(offset)
}

function readBoxType(data: Uint8Array, offset: number): string {
  if (offset + 4 > data.length) return ''
  return String.fromCharCode(
    data[offset],
    data[offset + 1],
    data[offset + 2],
    data[offset + 3]
  )
}

function* iterateBoxes(
  data: Uint8Array,
  start: number,
  end: number
): Generator<BoxRange> {
  let pos = start

  while (pos + 8 <= end) {
    let size = readUint32(data, pos)
    const type = readBoxType(data, pos + 4)
    let headerSize = 8

    if (size === 1) {
      if (pos + 16 > end) return
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
      size = Number(view.getBigUint64(pos + 8))
      headerSize = 16
    }

    if (size < headerSize) return

    const boxEnd = pos + size
    if (boxEnd > end) return

    yield { type, start: pos + headerSize, end: boxEnd }
    pos = boxEnd
  }
}

function findBox(
  data: Uint8Array,
  start: number,
  end: number,
  type: string
): BoxRange | undefined {
  for (const box of iterateBoxes(data, start, end)) {
    if (box.type === type) return box
  }
  return undefined
}

function findBoxDeep(
  data: Uint8Array,
  root: BoxRange,
  type: string
): BoxRange | undefined {
  const direct = findBox(data, root.start, root.end, type)
  if (direct) return direct

  for (const child of iterateBoxes(data, root.start, root.end)) {
    const nested = findBoxDeep(data, child, type)
    if (nested) return nested
  }

  return undefined
}

function isVideoTrack(data: Uint8Array, trak: BoxRange): boolean {
  const handler = findBoxDeep(data, trak, 'hdlr')
  if (!handler || handler.start + 12 > handler.end) return false
  return readBoxType(data, handler.start + 8) === 'vide'
}

function readUint64(data: Uint8Array, offset: number): number {
  if (offset + 8 > data.length) return 0
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  return Number(view.getBigUint64(offset))
}

function frameRateFromTrack(
  data: Uint8Array,
  trak: BoxRange,
  durationSeconds: number
): number | undefined {
  const mediaHeader = findBoxDeep(data, trak, 'mdhd')
  const sampleSizes = findBoxDeep(data, trak, 'stsz')
  if (!mediaHeader || !sampleSizes) return undefined

  const version = data[mediaHeader.start]
  let timescale: number
  let mediaDurationTicks: number

  if (version === 1) {
    timescale = readUint32(data, mediaHeader.start + 20)
    mediaDurationTicks = readUint64(data, mediaHeader.start + 24)
  } else {
    timescale = readUint32(data, mediaHeader.start + 12)
    mediaDurationTicks = readUint32(data, mediaHeader.start + 16)
  }

  const sampleCount = readUint32(data, sampleSizes.start + 8)

  if (timescale <= 0 || sampleCount <= 0) return undefined

  const trackDurationSeconds =
    mediaDurationTicks > 0 ? mediaDurationTicks / timescale : durationSeconds
  const duration =
    trackDurationSeconds > 0 ? trackDurationSeconds : durationSeconds
  if (duration <= 0) return undefined

  const frameRate = sampleCount / duration
  if (frameRate <= 0 || frameRate > MAX_FRAME_RATE) return undefined

  return frameRate
}

export function parseMp4AverageFrameRate(
  data: Uint8Array,
  durationSeconds: number
): number | undefined {
  if (durationSeconds <= 0) return undefined

  const movie = findBox(data, 0, data.length, 'moov')
  if (!movie) return undefined

  for (const track of iterateBoxes(data, movie.start, movie.end)) {
    if (track.type !== 'trak' || !isVideoTrack(data, track)) continue

    const frameRate = frameRateFromTrack(data, track, durationSeconds)
    if (frameRate != null) return frameRate
  }

  return undefined
}

async function fetchRange(
  url: string,
  start: number,
  end: number
): Promise<ArrayBuffer | undefined> {
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=${start}-${end}` }
    })
    if (response.status !== 206) return undefined
    return await response.arrayBuffer()
  } catch {
    return undefined
  }
}

export async function probeVideoFrameRate(
  url: string,
  durationSeconds: number,
  byteSize?: number
): Promise<number | undefined> {
  if (durationSeconds <= 0) return undefined

  const resolvedByteSize = byteSize ?? (await fetchHttpResourceByteSize(url))
  const chunks: Uint8Array[] = []

  const leading = await fetchRange(url, 0, PROBE_CHUNK_BYTES - 1)
  if (leading) chunks.push(new Uint8Array(leading))

  if (resolvedByteSize != null && resolvedByteSize > PROBE_CHUNK_BYTES) {
    const trailingStart = Math.max(0, resolvedByteSize - PROBE_CHUNK_BYTES)
    const trailing = await fetchRange(
      url,
      trailingStart,
      Math.max(trailingStart, resolvedByteSize - 1)
    )
    if (trailing) chunks.push(new Uint8Array(trailing))
  }

  for (const chunk of chunks) {
    const frameRate = parseMp4AverageFrameRate(chunk, durationSeconds)
    if (frameRate != null) return frameRate
  }

  return undefined
}
