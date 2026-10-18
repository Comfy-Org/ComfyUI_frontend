import fs from 'fs'
import path from 'path'
import { describe, expect, it, vi } from 'vitest'

import {
  EXPECTED_PROMPT,
  EXPECTED_PROMPT_NAN_COERCED,
  EXPECTED_WORKFLOW,
  mockFileReaderAbort,
  mockFileReaderError
} from './__fixtures__/helpers'
import { getOggMetadata } from './ogg'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.opus')
const nanFixturePath = path.resolve(
  __dirname,
  '__fixtures__/with_nan_metadata.opus'
)

const OGG_HEADER_SIZE = 27
const OGG_MAX_SEGMENT_SIZE = 255

function buildOpusTagsPacket(comments: { [key: string]: string }): Uint8Array {
  const vendor = 'ComfyUI'
  const vendorBytes = new TextEncoder().encode(vendor)
  const commentKeys = Object.keys(comments)

  // Construct OpusTags Packet
  let totalPacketSize = 8 + 4 + vendorBytes.length + 4
  const commentEntries: Uint8Array[] = []
  for (const key of commentKeys) {
    const entry = `${key}=${comments[key]}`
    const entryBytes = new TextEncoder().encode(entry)
    commentEntries.push(entryBytes)
    totalPacketSize += 4 + entryBytes.length
  }

  const packetData = new Uint8Array(totalPacketSize)
  const packetView = new DataView(packetData.buffer)
  let pos = 0
  packetData.set(new TextEncoder().encode('OpusTags'), pos)
  pos += 8
  packetView.setUint32(pos, vendorBytes.length, true)
  pos += 4
  packetData.set(vendorBytes, pos)
  pos += vendorBytes.length
  packetView.setUint32(pos, commentKeys.length, true)
  pos += 4
  for (const entryBytes of commentEntries) {
    packetView.setUint32(pos, entryBytes.length, true)
    pos += 4
    packetData.set(entryBytes, pos)
    pos += entryBytes.length
  }

  return packetData
}

/** Minimal OpusHead as Page 0 (BOS). */
function createOpusHeadPage(): Uint8Array {
  const headPageSize = OGG_HEADER_SIZE + 1 + 19
  const headPage = new Uint8Array(headPageSize)
  headPage.set(new TextEncoder().encode('OggS'), 0)
  headPage[5] = 0x02 // 0x02 indicates Beginning of Stream (BOS)
  headPage[26] = 1 // 1 segment
  headPage[OGG_HEADER_SIZE] = 19 // segment length
  // 'OpusHead' signature (8 bytes) + version (1) + channels (1) + pre-skip (2) + sample rate (4) + gain (2) + mapping (1)
  headPage.set(new TextEncoder().encode('OpusHead'), OGG_HEADER_SIZE + 1)
  headPage[OGG_HEADER_SIZE + 1 + 8] = 1 // version
  headPage[OGG_HEADER_SIZE + 1 + 9] = 2 // channels
  return headPage
}

/** Construct Ogg pages carrying the given OpusTags packet. */
function packetToOggPages(packetData: Uint8Array): Uint8Array[] {
  const pages: Uint8Array[] = []
  let packetPos = 0
  let packetEnded = false

  while (!packetEnded) {
    const remainingPacketSize = packetData.length - packetPos
    let dataSizeInThisPage = 0
    const lacingValues: number[] = []

    for (let i = 0; i < OGG_MAX_SEGMENT_SIZE; i++) {
      const remainingForThisPacket = remainingPacketSize - dataSizeInThisPage
      if (remainingForThisPacket >= OGG_MAX_SEGMENT_SIZE) {
        lacingValues.push(OGG_MAX_SEGMENT_SIZE)
        dataSizeInThisPage += OGG_MAX_SEGMENT_SIZE
      } else {
        lacingValues.push(remainingForThisPacket)
        dataSizeInThisPage += remainingForThisPacket
        packetEnded = true
        break
      }
    }

    const numSegments = lacingValues.length
    const pageSize = OGG_HEADER_SIZE + numSegments + dataSizeInThisPage
    const page = new Uint8Array(pageSize)

    page.set(new TextEncoder().encode('OggS'), 0)
    page[5] = packetPos > 0 ? 0x01 : 0x00 // 0x01 indicates continued packet
    page[26] = numSegments

    page.set(lacingValues, OGG_HEADER_SIZE)

    if (dataSizeInThisPage > 0) {
      page.set(
        packetData.subarray(packetPos, packetPos + dataSizeInThisPage),
        OGG_HEADER_SIZE + numSegments
      )
    }

    pages.push(page)
    packetPos += dataSizeInThisPage
  }

  return pages
}

/** Dummy audio page (approx 65KB per page). */
function createDummyAudioPage(): Uint8Array {
  const numSegments = OGG_MAX_SEGMENT_SIZE
  const segmentDataSize = OGG_MAX_SEGMENT_SIZE
  const dataSize = numSegments * segmentDataSize
  const pageSize = OGG_HEADER_SIZE + numSegments + dataSize
  const audioPage = new Uint8Array(pageSize)

  // Ogg Header for dummy audio
  audioPage.set(new TextEncoder().encode('OggS'), 0)
  audioPage[5] = 0x00 // Normal page
  audioPage[26] = numSegments

  // Segment Table (all max size)
  audioPage.fill(
    segmentDataSize,
    OGG_HEADER_SIZE,
    OGG_HEADER_SIZE + numSegments
  )

  // The rest of the array remains 0x00, acting as valid empty dummy audio data
  return audioPage
}

function createOggWithOpusTags(comments: {
  [key: string]: string
}): ArrayBuffer {
  const packetData = buildOpusTagsPacket(comments)
  const pages: Uint8Array[] = [
    createOpusHeadPage(),
    ...packetToOggPages(packetData)
  ]

  // Append Dummy Audio Ogg Pages
  let currentTotalSize = pages.reduce((sum, p) => sum + p.length, 0)
  const TARGET_SIZE = 65536 // 64KB: ensures the file spans multiple Ogg pages for multi-page parsing tests

  while (currentTotalSize < TARGET_SIZE) {
    const audioPage = createDummyAudioPage()
    pages.push(audioPage)
    currentTotalSize += audioPage.length
  }

  // Combine all pages into one Buffer
  const combined = new Uint8Array(currentTotalSize)
  let offset = 0
  for (const p of pages) {
    combined.set(p, offset)
    offset += p.length
  }

  return combined.buffer
}

/** Minimal single Ogg page helper for parser edge cases. */
function createSinglePageOgg(
  payload: Uint8Array,
  segmentLength = payload.length
): ArrayBuffer {
  const page = new Uint8Array(OGG_HEADER_SIZE + 1 + payload.length)
  page.set(new TextEncoder().encode('OggS'), 0)
  page[26] = 1
  page[27] = segmentLength
  page.set(payload, OGG_HEADER_SIZE + 1)
  return page.buffer
}

describe('OGG/Opus metadata', () => {
  it('extracts workflow and prompt from an Opus file', async () => {
    const bytes = fs.readFileSync(fixturePath)
    const file = new File([bytes], 'test.opus', { type: 'audio/ogg' })

    const result = await getOggMetadata(file)

    expect(result.workflow).toEqual(EXPECTED_WORKFLOW)
    expect(result.prompt).toEqual(EXPECTED_PROMPT)
  })

  it('parses Python generated prompt with bare NaN/Infinity tokens', async () => {
    const bytes = fs.readFileSync(nanFixturePath)
    const file = new File([bytes], 'nan.opus', { type: 'audio/ogg' })

    const result = await getOggMetadata(file)

    expect(result.workflow).toBeUndefined()
    expect(result.prompt).toEqual(EXPECTED_PROMPT_NAN_COERCED)
  })

  it('returns undefined fields for non-OGG data', async () => {
    const file = new File([new Uint8Array(16)], 'fake.ogg', {
      type: 'audio/ogg'
    })

    const result = await getOggMetadata(file)

    expect(result.workflow).toBeUndefined()
    expect(result.prompt).toBeUndefined()
    expect(console.warn).toHaveBeenCalledWith(
      'Ogg metadata parsing failed: No OpusTags found or invalid Ogg file'
    )
  })

  it('handles files larger than 4096 bytes without RangeError', async () => {
    const size = 5000
    const buf = new Uint8Array(size)
    const oggs = new TextEncoder().encode('OggS\0')
    buf.set(oggs, 0)
    buf.set(oggs, 4500)
    const file = new File([buf], 'large.ogg', { type: 'audio/ogg' })

    const result = await getOggMetadata(file)

    expect(result.workflow).toBeUndefined()
    expect(result.prompt).toBeUndefined()
  })

  it('logs and skips when embedded JSON is malformed', async () => {
    const buffer = createOggWithOpusTags({
      prompt: '{not json}',
      workflow: '{also bad}'
    })
    const file = new File([buffer], 'malformed.opus', { type: 'audio/ogg' })

    const result = await getOggMetadata(file)

    expect(result.prompt).toBeUndefined()
    expect(result.workflow).toBeUndefined()
    expect(console.error).toHaveBeenCalledWith(
      'Failed to parse Ogg prompt metadata',
      expect.any(SyntaxError)
    )
    expect(console.error).toHaveBeenCalledWith(
      'Failed to parse Ogg workflow metadata',
      expect.any(SyntaxError)
    )
  })

  describe('FileReader failure modes', () => {
    const file = new File([new Uint8Array(16)], 'test.ogg')

    it.for([
      { mode: 'error', mock: mockFileReaderError },
      { mode: 'abort', mock: mockFileReaderAbort }
    ])(
      'resolves undefined fields when the FileReader fires $mode',
      async ({ mock }) => {
        mock('readAsArrayBuffer')
        const result = await getOggMetadata(file)
        expect(result).toEqual({ prompt: undefined, workflow: undefined })
      }
    )
  })

  describe('progressive read window', () => {
    const INITIAL_READ_BYTES = 64 * 1024
    const MAX_READ_BYTES = 16 * 1024 * 1024

    it('reads only the initial window when the metadata fits in it', async () => {
      const prompt = { '1': { class_type: 'KSampler' } }
      const buffer = createOggWithOpusTags({ prompt: JSON.stringify(prompt) })
      const file = new File([buffer], 'small_tags.ogg', { type: 'audio/ogg' })
      const sliceSpy = vi.spyOn(file, 'slice')

      const result = await getOggMetadata(file)

      expect(result.prompt).toEqual(prompt)
      expect(sliceSpy).toHaveBeenCalledTimes(1)
      expect(sliceSpy).toHaveBeenCalledWith(0, INITIAL_READ_BYTES)
    })

    it('expands the read window based on page boundaries while OpusTags packet is incomplete', async () => {
      // ~200 KB packet: expands across multiple pages until the full packet is enclosed
      const prompt = { data: 'c'.repeat(200_000) }
      const buffer = createOggWithOpusTags({ prompt: JSON.stringify(prompt) })
      const file = new File([buffer], 'medium_tags.ogg', { type: 'audio/ogg' })
      const sliceSpy = vi.spyOn(file, 'slice')

      const result = await getOggMetadata(file)

      expect(result.prompt).toEqual(prompt)
      const callLimits = sliceSpy.mock.calls
        .map(([, end]) => end)
        .filter((end): end is number => typeof end === 'number')
      expect(callLimits.length).toBeGreaterThan(1)
      expect(callLimits[0]).toBe(INITIAL_READ_BYTES)
      // Every subsequent limit should strictly grow
      for (let i = 1; i < callLimits.length; i++) {
        expect(callLimits[i]).toBeGreaterThan(callLimits[i - 1])
      }
    })

    it('stops growing at end of file when the OpusTags packet is cut off', async () => {
      const full = createOggWithOpusTags({
        prompt: JSON.stringify({ data: 'd'.repeat(200_000) })
      })
      // The file ends in the middle of the OpusTags packet (not at the read cap).
      const cutOff = full.slice(0, INITIAL_READ_BYTES + 36 * 1024)
      const file = new File([cutOff], 'cut_off.ogg', { type: 'audio/ogg' })
      const sliceSpy = vi.spyOn(file, 'slice')

      const result = await getOggMetadata(file)

      expect(result).toEqual({ prompt: undefined, workflow: undefined })
      const callLimits = sliceSpy.mock.calls.map(([, end]) => end)
      expect(callLimits[0]).toBe(INITIAL_READ_BYTES)
      expect(callLimits.length).toBeGreaterThanOrEqual(2)
      expect(console.warn).toHaveBeenCalledWith(
        'Ogg metadata parsing failed: OpusTags packet is truncated or corrupted'
      )
    })

    it('does not grow the window for data that is not an Ogg stream', async () => {
      const file = new File(
        [new Uint8Array(INITIAL_READ_BYTES * 4)],
        'junk.ogg',
        {
          type: 'audio/ogg'
        }
      )
      const sliceSpy = vi.spyOn(file, 'slice')

      const result = await getOggMetadata(file)

      expect(result).toEqual({ prompt: undefined, workflow: undefined })
      expect(sliceSpy).toHaveBeenCalledTimes(1)
      expect(console.warn).toHaveBeenCalledWith(
        'Ogg metadata parsing failed: No OpusTags found or invalid Ogg file'
      )
    })

    it('aborts scanning immediately when audio data begins without OpusTags', async () => {
      // Stream with OpusHead followed immediately by dummy audio pages (no OpusTags)
      const headPage = createOpusHeadPage()
      const audioPage1 = createDummyAudioPage()
      const audioPage2 = createDummyAudioPage()
      const combined = new Uint8Array(
        headPage.length + audioPage1.length + audioPage2.length
      )
      combined.set(headPage, 0)
      combined.set(audioPage1, headPage.length)
      combined.set(audioPage2, headPage.length + audioPage1.length)

      const file = new File([combined.buffer], 'no_tags_with_audio.opus', {
        type: 'audio/ogg'
      })
      const sliceSpy = vi.spyOn(file, 'slice')

      const result = await getOggMetadata(file)

      expect(result).toEqual({ prompt: undefined, workflow: undefined })
      // Since OpusTags must precede audio frames, scanning should stop on the first window
      expect(sliceSpy).toHaveBeenCalledTimes(1)
      expect(console.warn).toHaveBeenCalledWith(
        'Ogg metadata parsing failed: No OpusTags found or invalid Ogg file'
      )
    })

    it('resolves undefined when a very large OpusTags packet is truncated at the 16 MB read cap', async () => {
      // A file whose OpusTags packet runs beyond the 16 MB cap.
      const buffer = createOggWithOpusTags({
        prompt: 'x'.repeat(MAX_READ_BYTES + 1024 * 1024)
      })
      const file = new File([buffer], 'huge.opus', { type: 'audio/ogg' })
      const sliceSpy = vi.spyOn(file, 'slice')

      const result = await getOggMetadata(file)

      // The packet was never closed, so no complete metadata could be extracted
      expect(result.prompt).toBeUndefined()
      expect(result.workflow).toBeUndefined()
      // The window grew up to, but never beyond, the cap
      expect(sliceSpy.mock.calls.at(-1)?.[1]).toBe(MAX_READ_BYTES)
      // A descriptive warning must be emitted so the truncation is not silent
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'OpusTags packet extends beyond the 16 MB read cap'
        )
      )
    })

    describe('exact 64KB boundary cases (+-1 byte)', () => {
      it.for([
        { name: 'exactly 64KB (65,536 bytes)', delta: 0 },
        { name: '64KB - 1 byte (65,535 bytes)', delta: -1 },
        { name: '64KB + 1 byte (65,537 bytes)', delta: 1 }
      ])('correctly handles a file sized $name', async ({ delta }) => {
        const prompt = { test: `boundary-${delta}` }
        const buffer = createOggWithOpusTags({ prompt: JSON.stringify(prompt) })
        const size = INITIAL_READ_BYTES + delta
        const sliced = new Uint8Array(buffer).subarray(0, size)
        const file = new File([sliced.buffer], 'boundary.ogg', {
          type: 'audio/ogg'
        })
        const result = await getOggMetadata(file)
        expect(result.prompt).toEqual(prompt)
      })
    })

    it('handles buffer boundary where page completes exactly at window end with continued packet', async () => {
      // Page 0 (OpusHead): 229 bytes (27 header + 1 segment + 201 payload)
      const headPage = new Uint8Array(229)
      headPage.set(new TextEncoder().encode('OggS'), 0)
      headPage[5] = 0x02 // BOS
      headPage[26] = 1
      headPage[27] = 201
      headPage.set(new TextEncoder().encode('OpusHead'), 28)

      // OpusTags packet larger than 65,025 bytes so page 1 is exactly 65,307 bytes.
      // Total: 229 (head) + 65,307 (tags page 1) = 65,536 bytes (INITIAL_READ_BYTES).
      const prompt = { test: 'exact-window-boundary' }
      const tagsPacket = buildOpusTagsPacket({
        prompt: JSON.stringify(prompt),
        pad: 'x'.repeat(65000)
      })
      const tagPages = packetToOggPages(tagsPacket)

      const fullFile = new Uint8Array(
        headPage.length + tagPages[0].length + tagPages[1].length
      )
      fullFile.set(headPage, 0)
      fullFile.set(tagPages[0], headPage.length)
      fullFile.set(tagPages[1], headPage.length + tagPages[0].length)

      const file = new File([fullFile.buffer], 'exact_window_boundary.ogg', {
        type: 'audio/ogg'
      })
      const result = await getOggMetadata(file)
      expect(result.prompt).toEqual(prompt)
    })

    it('handles multi-segment OpusHead packet (segmentLength === 255)', async () => {
      // Construct an OpusHead page with 2 segments: [255, 10]
      const headPage = new Uint8Array(27 + 2 + 265)
      headPage.set(new TextEncoder().encode('OggS'), 0)
      headPage[5] = 0x02 // BOS
      headPage[26] = 2 // 2 segments
      headPage[27] = 255
      headPage[28] = 10
      headPage.set(new TextEncoder().encode('OpusHead'), 29)

      // Next page has OpusTags
      const tagsPacket = buildOpusTagsPacket({ prompt: '{"head":"multi"}' })
      const tagPages = packetToOggPages(tagsPacket)

      const combined = new Uint8Array(headPage.length + tagPages[0].length)
      combined.set(headPage, 0)
      combined.set(tagPages[0], headPage.length)

      const file = new File([combined.buffer], 'multi_head.opus', {
        type: 'audio/ogg'
      })
      const result = await getOggMetadata(file)
      expect(result.prompt).toEqual({ head: 'multi' })
    })

    it('breaks comment loop early when both prompt and workflow are already found', async () => {
      // Put prompt, workflow, and an extra trailing comment
      const buffer = createOggWithOpusTags({
        prompt: '{"a":1}',
        workflow: '{"b":2}',
        extra_comment_that_should_be_skipped: 'ignore_me'
      })
      const file = new File([buffer], 'extra_comment.opus', {
        type: 'audio/ogg'
      })
      const result = await getOggMetadata(file)
      expect(result.prompt).toEqual({ a: 1 })
      expect(result.workflow).toEqual({ b: 2 })
    })
  })

  it('should extract prompt and workflow from a valid Ogg file', async () => {
    const prompt = { '1': { class_type: 'KSampler' } }
    const workflow = { nodes: [{ id: 1 }] }

    const buffer = createOggWithOpusTags({
      prompt: JSON.stringify(prompt),
      workflow: JSON.stringify(workflow)
    })

    const file = new File([buffer], 'test.ogg', { type: 'audio/ogg' })
    const result = await getOggMetadata(file)

    expect(result.prompt).toEqual(prompt)
    expect(result.workflow).toEqual(workflow)
  })

  it('should handle large metadata spanning multiple Ogg pages (over 64KB)', async () => {
    // Generate a 70,000 character string (exceeds 255 * 255 = 65,025 bytes to ensure it spans multiple pages)
    const hugeString = 'b'.repeat(70000)
    const prompt = { data: hugeString }
    const workflow = { nodes: [{ id: 'large-node', type: 'AnyType' }] }

    const buffer = createOggWithOpusTags({
      prompt: JSON.stringify(prompt),
      workflow: JSON.stringify(workflow)
    })

    // Verify: Check if the helper function actually generated a file with multiple pages (2 or more 'OggS' headers)
    const view = new Uint8Array(buffer)
    const oggMagic = new TextEncoder().encode('OggS')
    let oggSCount = 0
    for (let i = 0; i < view.length - 4; i++) {
      if (
        view[i] === oggMagic[0] &&
        view[i + 1] === oggMagic[1] &&
        view[i + 2] === oggMagic[2] &&
        view[i + 3] === oggMagic[3]
      ) {
        oggSCount++
      }
    }
    expect(oggSCount).toBeGreaterThan(1)

    // Execute and Assert: Verify that data spanning multiple pages is correctly reconstructed into a single JSON
    const file = new File([buffer], 'huge_multi_page.ogg', {
      type: 'audio/ogg'
    })
    const result = await getOggMetadata(file)

    expect(result.prompt).toEqual(prompt)
    expect(result.workflow).toEqual(workflow)
  })

  describe('structural corruptions and truncations', () => {
    it.for([
      {
        name: 'empty file (0 bytes)',
        buffer: () => new ArrayBuffer(0)
      },
      {
        name: 'file smaller than the Ogg magic number',
        buffer: () => new Uint8Array([1, 2]).buffer
      },
      {
        name: 'abruptly truncated segment table',
        buffer: () => {
          const buffer = new Uint8Array(28)
          buffer.set(new TextEncoder().encode('OggS'), 0)
          buffer[26] = 50
          return buffer.buffer
        }
      },
      {
        name: 'segment data exceeds buffer boundary',
        buffer: () => createSinglePageOgg(new Uint8Array(10), 200)
      },
      {
        name: 'truncated user comment in OpusTags',
        buffer: () => {
          const packet = new Uint8Array(20)
          packet.set(new TextEncoder().encode('OpusTags'), 0)
          new DataView(packet.buffer).setUint32(12, 1, true)
          new DataView(packet.buffer).setUint32(16, 500, true)
          return createSinglePageOgg(packet)
        }
      },
      {
        name: 'page has an invalid magic number (stop parsing)',
        buffer: () => {
          const page1 = new Uint8Array(createSinglePageOgg(new Uint8Array(1)))
          const page2 = new Uint8Array(30)
          page2.set(new TextEncoder().encode('FAIL'), 0)
          const combined = new Uint8Array(page1.length + page2.length)
          combined.set(page1, 0)
          combined.set(page2, page1.length)
          return combined.buffer
        }
      },
      {
        name: 'OpusTags packet truncated before vendorLength field',
        buffer: () =>
          createSinglePageOgg(new TextEncoder().encode('OpusTags\0\0'))
      },
      {
        name: 'OpusTags packet with oversized vendorLength',
        buffer: () => {
          const packet = new Uint8Array(12)
          packet.set(new TextEncoder().encode('OpusTags'), 0)
          new DataView(packet.buffer).setUint32(8, 9999, true)
          return createSinglePageOgg(packet)
        }
      },
      {
        name: 'OpusTags packet truncated before userCommentListLength',
        buffer: () => {
          const packet = new Uint8Array(12)
          packet.set(new TextEncoder().encode('OpusTags'), 0)
          return createSinglePageOgg(packet)
        }
      },
      {
        name: 'OpusTags packet truncated mid-comment-list (missing comment length field)',
        buffer: () => {
          const commentBytes = new TextEncoder().encode('key=value')
          const packet = new Uint8Array(8 + 4 + 4 + 4 + commentBytes.length)
          const view = new DataView(packet.buffer)
          packet.set(new TextEncoder().encode('OpusTags'), 0)
          view.setUint32(12, 2, true)
          view.setUint32(16, commentBytes.length, true)
          packet.set(commentBytes, 20)
          return createSinglePageOgg(packet)
        }
      },
      {
        name: 'page starting with 0-length segment before audio/tags',
        buffer: () => {
          const page = new Uint8Array(27 + 2 + 10)
          page.set(new TextEncoder().encode('OggS'), 0)
          page[26] = 2
          page[27] = 0
          page[28] = 10
          return page.buffer
        }
      }
    ])('should safely handle: $name', async ({ name, buffer }) => {
      const file = new File([buffer()], `test_${name.replace(/\s+/g, '_')}.ogg`)
      const result = await getOggMetadata(file)
      expect(result.prompt).toBeUndefined()
      expect(result.workflow).toBeUndefined()
    })
  })

  describe('invalid or unrelated comment contents', () => {
    it.for([
      {
        name: 'unrelated Vorbis comments',
        buffer: () =>
          createOggWithOpusTags({
            unrelated_key: 'unrelated_value',
            prompt: '{"valid": true}'
          }),
        expectedPrompt: { valid: true }
      },
      {
        name: 'user comments without an equal sign',
        buffer: () => {
          const commentBytes = new TextEncoder().encode(
            'invalid_comment_no_equal_sign'
          )
          const packet = new Uint8Array(16 + 4 + commentBytes.length)
          packet.set(new TextEncoder().encode('OpusTags'), 0)
          const view = new DataView(packet.buffer)
          view.setUint32(12, 1, true)
          view.setUint32(16, commentBytes.length, true)
          packet.set(commentBytes, 20)
          return createSinglePageOgg(packet)
        },
        expectedPrompt: undefined
      }
    ])(
      'should appropriately handle: $name',
      async ({ name, buffer, expectedPrompt }) => {
        const file = new File(
          [buffer()],
          `test_${name.replace(/\s+/g, '_')}.ogg`
        )
        const result = await getOggMetadata(file)
        if (expectedPrompt !== undefined) {
          expect(result.prompt).toEqual(expectedPrompt)
        } else {
          expect(result.prompt).toBeUndefined()
        }
        expect(result.workflow).toBeUndefined()
      }
    )
  })
})
