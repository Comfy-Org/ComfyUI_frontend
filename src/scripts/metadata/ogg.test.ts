import { describe, expect, it } from 'vitest'
import { getOggMetadata } from './ogg'

function createOggWithOpusTags(comments: {
  [key: string]: string
}): ArrayBuffer {
  const OGG_HEADER_SIZE = 27
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

  // Construct Ogg Pages for Metadata
  const pages: Uint8Array[] = []
  let packetPos = 0
  let packetEnded = false

  while (!packetEnded) {
    const remainingPacketSize = packetData.length - packetPos
    let dataSizeInThisPage = 0
    const lacingValues: number[] = []

    for (let i = 0; i < 255; i++) {
      const remainingForThisPacket = remainingPacketSize - dataSizeInThisPage
      if (remainingForThisPacket >= 255) {
        lacingValues.push(255)
        dataSizeInThisPage += 255
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

  // Append Dummy Audio Ogg Pages
  let currentTotalSize = pages.reduce((sum, p) => sum + p.length, 0)
  const TARGET_SIZE = 65536 // 64KB: ensures the file spans multiple Ogg pages for multi-page parsing tests

  while (currentTotalSize < TARGET_SIZE) {
    // Create a dummy audio page (approx 65KB per page)
    const numSegments = 255
    const segmentDataSize = 255
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

describe('getOggMetadata', () => {
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
    // Generate truncated/invalid buffer scenarios
    const scenarios: { name: string; createBuffer: () => ArrayBuffer }[] = [
      {
        name: 'abruptly truncated segment table',
        createBuffer: () => {
          const buffer = new Uint8Array(28)
          buffer.set(new TextEncoder().encode('OggS'), 0)
          buffer[26] = 50 // Declaring 50 segments while only 28 bytes exist
          return buffer.buffer
        }
      },
      {
        name: 'segment data exceeds buffer boundary',
        createBuffer: () => {
          // Page header declares 1 segment of length 200, but only 10 bytes of data follow
          const buffer = new Uint8Array(27 + 1 + 10)
          buffer.set(new TextEncoder().encode('OggS'), 0)
          buffer[26] = 1 // 1 segment
          buffer[27] = 200 // segment length = 200 (exceeds remaining 10 bytes)
          // Only 10 bytes of data follow; segment exceeds boundary
          return buffer.buffer
        }
      },
      {
        name: 'truncated user comment in OpusTags',
        createBuffer: () => {
          const packet = new Uint8Array(20)
          packet.set(new TextEncoder().encode('OpusTags'), 0)
          new DataView(packet.buffer).setUint32(8, 0, true)
          new DataView(packet.buffer).setUint32(12, 1, true)
          new DataView(packet.buffer).setUint32(16, 500, true) // Declared length 500
          const buffer = new Uint8Array(27 + 1 + packet.length)
          buffer.set(new TextEncoder().encode('OggS'), 0)
          buffer[26] = 1
          buffer[27] = packet.length
          buffer.set(packet, 28)
          return buffer.buffer
        }
      },
      {
        name: 'file smaller than the Ogg magic number',
        createBuffer: () => new Uint8Array([1, 2]).buffer
      },
      {
        name: 'page has an invalid magic number (stop parsing)',
        createBuffer: () => {
          const page1 = new Uint8Array(29)
          page1.set(new TextEncoder().encode('OggS'), 0)
          page1[26] = 1
          page1[27] = 1
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
        createBuffer: () => {
          // Packet is only 10 bytes: 'OpusTags'(8) + 2 extra bytes (not enough for 4-byte vendorLength)
          const packet = new Uint8Array(10)
          packet.set(new TextEncoder().encode('OpusTags'), 0)
          const buffer = new Uint8Array(27 + 1 + packet.length)
          buffer.set(new TextEncoder().encode('OggS'), 0)
          buffer[26] = 1
          buffer[27] = packet.length
          buffer.set(packet, 28)
          return buffer.buffer
        }
      },
      {
        name: 'OpusTags packet with oversized vendorLength',
        createBuffer: () => {
          // Packet: 'OpusTags'(8) + vendorLength=9999(4) + no actual vendor bytes
          const packet = new Uint8Array(12)
          packet.set(new TextEncoder().encode('OpusTags'), 0)
          new DataView(packet.buffer).setUint32(8, 9999, true) // vendor string claims 9999 bytes
          const buffer = new Uint8Array(27 + 1 + packet.length)
          buffer.set(new TextEncoder().encode('OggS'), 0)
          buffer[26] = 1
          buffer[27] = packet.length
          buffer.set(packet, 28)
          return buffer.buffer
        }
      },
      {
        name: 'OpusTags packet truncated before userCommentListLength',
        createBuffer: () => {
          // Packet: 'OpusTags'(8) + vendorLength=0(4) + no userCommentListLength
          const packet = new Uint8Array(12) // exactly 8 + 4, no bytes for userCommentListLength
          packet.set(new TextEncoder().encode('OpusTags'), 0)
          new DataView(packet.buffer).setUint32(8, 0, true) // vendorLength=0
          // packet ends here — no room for userCommentListLength (needs 4 more bytes)
          const buffer = new Uint8Array(27 + 1 + packet.length)
          buffer.set(new TextEncoder().encode('OggS'), 0)
          buffer[26] = 1
          buffer[27] = packet.length
          buffer.set(packet, 28)
          return buffer.buffer
        }
      },
      {
        name: 'OpusTags packet truncated mid-comment-list (missing comment length field)',
        createBuffer: () => {
          const commentBytes = new TextEncoder().encode('key=value')
          // Packet: 'OpusTags'(8) + vendorLength=0(4) + userCommentListLength=2(4) +
          //         commentLength=9(4) + commentData(9) — second comment length field is missing
          const packet = new Uint8Array(8 + 4 + 4 + 4 + commentBytes.length)
          const view = new DataView(packet.buffer)
          packet.set(new TextEncoder().encode('OpusTags'), 0)
          view.setUint32(8, 0, true) // vendorLength = 0
          view.setUint32(12, 2, true) // userCommentListLength = 2 (but only 1 follows)
          view.setUint32(16, commentBytes.length, true) // first comment length
          packet.set(commentBytes, 20) // first comment data
          // second comment's length field is absent — packet ends here
          const buffer = new Uint8Array(27 + 1 + packet.length)
          buffer.set(new TextEncoder().encode('OggS'), 0)
          buffer[26] = 1
          buffer[27] = packet.length
          buffer.set(packet, 28)
          return buffer.buffer
        }
      }
    ]

    for (const { name, createBuffer } of scenarios) {
      it(`should safely handle: ${name}`, async () => {
        const file = new File(
          [createBuffer()],
          `test_${name.replace(/\s+/g, '_')}.ogg`
        )
        await expect(
          getOggMetadata(file).then((result) => {
            expect(result.prompt).toBeUndefined()
            expect(result.workflow).toBeUndefined()
          })
        ).resolves.not.toThrow()
      })
    }
  })

  describe('invalid or unrelated comment contents', () => {
    const scenarios: {
      name: string
      createBuffer: () => ArrayBuffer
      expectedPrompt?: Record<string, unknown>
    }[] = [
      {
        name: 'unrelated Vorbis comments',
        createBuffer: () =>
          createOggWithOpusTags({
            unrelated_key: 'unrelated_value',
            prompt: '{"valid": true}'
          }),
        expectedPrompt: { valid: true } // Workflow is undefined, Prompt is valid
      },
      {
        name: 'invalid JSON in prompt/workflow comments (plain text)',
        createBuffer: () =>
          createOggWithOpusTags({
            prompt: 'hello world',
            workflow: 'plain text workflow'
          })
      },
      {
        name: 'user comments without an equal sign',
        createBuffer: () => {
          const commentBytes = new TextEncoder().encode(
            'invalid_comment_no_equal_sign'
          )
          const packet = new Uint8Array(16 + 4 + commentBytes.length)
          packet.set(new TextEncoder().encode('OpusTags'), 0)
          new DataView(packet.buffer).setUint32(8, 0, true)
          new DataView(packet.buffer).setUint32(12, 1, true)
          new DataView(packet.buffer).setUint32(16, commentBytes.length, true)
          packet.set(commentBytes, 20)

          const buffer = new Uint8Array(27 + 1 + packet.length)
          buffer.set(new TextEncoder().encode('OggS'), 0)
          buffer[26] = 1
          buffer[27] = packet.length
          buffer.set(packet, 28)
          return buffer.buffer
        }
      }
    ]

    for (const { name, createBuffer, expectedPrompt } of scenarios) {
      it(`should appropriately handle: ${name}`, async () => {
        const file = new File(
          [createBuffer()],
          `test_${name.replace(/\s+/g, '_')}.ogg`
        )
        await expect(getOggMetadata(file)).resolves.toSatisfy((result) => {
          if (expectedPrompt) {
            expect(result.prompt).toEqual(expectedPrompt)
          } else {
            expect(result.prompt).toBeUndefined()
          }
          expect(result.workflow).toBeUndefined()
          return true
        })
      })
    }
  })
})
