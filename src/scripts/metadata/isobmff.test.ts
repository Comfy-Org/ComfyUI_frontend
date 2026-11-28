import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import {
  EXPECTED_PROMPT,
  EXPECTED_PROMPT_NAN_COERCED,
  EXPECTED_WORKFLOW,
  mockFileReaderAbort,
  mockFileReaderError
} from './__fixtures__/helpers'
import { getFromIsobmffFile } from './isobmff'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.mp4')
const nanFixturePath = path.resolve(
  __dirname,
  '__fixtures__/with_nan_metadata.mp4'
)
const legacyCommentFixturePath = path.resolve(
  __dirname,
  '__fixtures__/with_vhs_legacy_comment.mp4'
)

describe('ISOBMFF (MP4) metadata', () => {
  it('extracts workflow and prompt from QuickTime keys/ilst boxes', async () => {
    const bytes = fs.readFileSync(fixturePath)
    const file = new File([bytes], 'test.mp4', { type: 'video/mp4' })

    const result = await getFromIsobmffFile(file)

    expect(result.workflow).toEqual(EXPECTED_WORKFLOW)
    expect(result.prompt).toEqual(EXPECTED_PROMPT)
  })

  it('parses Python generated prompt with bare NaN/Infinity tokens', async () => {
    const bytes = fs.readFileSync(nanFixturePath)
    const file = new File([bytes], 'nan.mp4', { type: 'video/mp4' })

    const result = await getFromIsobmffFile(file)

    expect(result.workflow).toBeUndefined()
    expect(result.prompt).toEqual(EXPECTED_PROMPT_NAN_COERCED)
  })

  it('reads workflow and prompt from a legacy VideoHelperSuite ©cmt comment', async () => {
    const bytes = fs.readFileSync(legacyCommentFixturePath)
    const file = new File([bytes], 'vhs.mp4', { type: 'video/mp4' })

    const result = await getFromIsobmffFile(file)

    expect(result.workflow).toEqual(EXPECTED_WORKFLOW)
    expect(result.prompt).toEqual(EXPECTED_PROMPT)
  })

  describe('when moov sits past the first 64 MiB', () => {
    const PADDING_BYTES = 65 * 1024 * 1024

    const mdatHeader = (payloadBytes: number) => {
      const header = new Uint8Array(8)
      new DataView(header.buffer).setUint32(0, payloadBytes + 8)
      header.set([0x6d, 0x64, 0x61, 0x74], 4)
      return header
    }

    const largeMdatHeader = (payloadBytes: number) => {
      const header = new Uint8Array(16)
      const view = new DataView(header.buffer)
      view.setUint32(0, 1)
      header.set([0x6d, 0x64, 0x61, 0x74], 4)
      view.setBigUint64(8, BigInt(payloadBytes + 16))
      return header
    }

    it('reads metadata from a moov after a large mdat', async () => {
      const bytes = fs.readFileSync(fixturePath)
      const file = new File(
        [mdatHeader(PADDING_BYTES), new Uint8Array(PADDING_BYTES), bytes],
        'long.mp4',
        { type: 'video/mp4' }
      )

      const result = await getFromIsobmffFile(file)

      expect(result.workflow).toEqual(EXPECTED_WORKFLOW)
      expect(result.prompt).toEqual(EXPECTED_PROMPT)
    })

    it('steps over an mdat that uses a 64-bit largesize', async () => {
      const bytes = fs.readFileSync(fixturePath)
      const file = new File(
        [largeMdatHeader(PADDING_BYTES), new Uint8Array(PADDING_BYTES), bytes],
        'long.mp4',
        { type: 'video/mp4' }
      )

      const result = await getFromIsobmffFile(file)

      expect(result.workflow).toEqual(EXPECTED_WORKFLOW)
      expect(result.prompt).toEqual(EXPECTED_PROMPT)
    })

    it('reads metadata from a top-level udta after a large mdat', async () => {
      const bytes = new Uint8Array(fs.readFileSync(fixturePath))
      const udtaStart = Buffer.from(bytes).indexOf('udta') - 4
      const udtaSize = new DataView(bytes.buffer, bytes.byteOffset).getUint32(
        udtaStart
      )
      const file = new File(
        [
          mdatHeader(PADDING_BYTES),
          new Uint8Array(PADDING_BYTES),
          bytes.slice(udtaStart, udtaStart + udtaSize)
        ],
        'long.mp4',
        { type: 'video/mp4' }
      )

      const result = await getFromIsobmffFile(file)

      expect(result.workflow).toEqual(EXPECTED_WORKFLOW)
      expect(result.prompt).toEqual(EXPECTED_PROMPT)
    })

    it('returns empty when a moov declares a size past the end of the file', async () => {
      const moovHeader = new Uint8Array(16)
      new DataView(moovHeader.buffer).setUint32(0, 0x7fffffff)
      moovHeader.set([0x6d, 0x6f, 0x6f, 0x76], 4)
      const file = new File(
        [mdatHeader(PADDING_BYTES), new Uint8Array(PADDING_BYTES), moovHeader],
        'truncated.mp4',
        { type: 'video/mp4' }
      )

      expect(await getFromIsobmffFile(file)).toEqual({})
    })
  })

  it('returns empty for non-ISOBMFF data', async () => {
    const file = new File([new Uint8Array(16)], 'fake.mp4', {
      type: 'video/mp4'
    })

    const result = await getFromIsobmffFile(file)

    expect(result).toEqual({})
  })

  describe('FileReader failure modes', () => {
    const file = new File([new Uint8Array(16)], 'test.mp4')

    it('resolves empty when the FileReader fires error', async () => {
      mockFileReaderError('readAsArrayBuffer')
      expect(await getFromIsobmffFile(file)).toEqual({})
      expect(console.error).not.toHaveBeenCalled()
    })

    it('resolves empty when the FileReader fires abort', async () => {
      mockFileReaderAbort('readAsArrayBuffer')
      expect(await getFromIsobmffFile(file)).toEqual({})
      expect(console.error).not.toHaveBeenCalled()
    })
  })
})
