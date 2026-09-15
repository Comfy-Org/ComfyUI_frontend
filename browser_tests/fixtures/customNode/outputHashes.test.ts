import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  compareOutputHashes,
  hashPngPixels,
  hashSinkPayloads,
  recordObservedHashes
} from '@e2e/fixtures/customNode/outputHashes'

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  return Buffer.concat([length, Buffer.from(type, 'latin1'), data, crc])
}

function pngWith(input: { idat: Buffer; text?: string }): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const chunks = [signature, pngChunk('IHDR', Buffer.alloc(13))]
  if (input.text !== undefined)
    chunks.push(pngChunk('tEXt', Buffer.from(input.text, 'latin1')))
  chunks.push(pngChunk('IDAT', input.idat))
  chunks.push(pngChunk('IEND', Buffer.alloc(0)))
  return Buffer.concat(chunks)
}

const never = () => Promise.reject(new Error('no file fetch expected'))

describe('S15 output hashes', () => {
  it('identical pixels hash identically regardless of embedded metadata', () => {
    const idat = Buffer.from([1, 2, 3, 4, 5])
    const plain = hashPngPixels(pngWith({ idat }))
    const withPrompt = hashPngPixels(
      pngWith({ idat, text: 'prompt{"seed":42,"widgets":[1,2,3]}' })
    )
    expect(plain).toBe(withPrompt)
    expect(plain).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('different pixels hash differently', () => {
    const a = hashPngPixels(pngWith({ idat: Buffer.from([1, 2, 3]) }))
    const b = hashPngPixels(pngWith({ idat: Buffer.from([1, 2, 4]) }))
    expect(a).not.toBe(b)
  })

  it('non-PNG bytes and IDAT-less files throw instead of hashing', () => {
    expect(() => hashPngPixels(Buffer.from('GIF89a not a png'))).toThrow(
      /not a PNG/
    )
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    const noIdat = Buffer.concat([
      signature,
      pngChunk('IHDR', Buffer.alloc(13)),
      pngChunk('IEND', Buffer.alloc(0))
    ])
    expect(() => hashPngPixels(noIdat)).toThrow(/no IDAT/)
  })

  it('payload hashing is key-order independent and value sensitive', async () => {
    const a = await hashSinkPayloads({ '5': { text: ['7'], b: 1 } }, never)
    const b = await hashSinkPayloads({ '5': { b: 1, text: ['7'] } }, never)
    const c = await hashSinkPayloads({ '5': { b: 1, text: ['8'] } }, never)
    expect(a['5']).toBe(b['5'])
    expect(a['5']).not.toBe(c['5'])
  })

  it('file refs canonicalize by extension: run-varying names do not churn, pixels do', async () => {
    const idat = Buffer.from([9, 9, 9])
    const run1 = await hashSinkPayloads(
      { '3': { images: [{ filename: 'ComfyUI_00001_.png', type: 'temp' }] } },
      async () => pngWith({ idat })
    )
    const run2 = await hashSinkPayloads(
      { '3': { images: [{ filename: 'ComfyUI_00042_.png', type: 'temp' }] } },
      async () => pngWith({ idat, text: 'other-metadata' })
    )
    const changed = await hashSinkPayloads(
      { '3': { images: [{ filename: 'ComfyUI_00001_.png', type: 'temp' }] } },
      async () => pngWith({ idat: Buffer.from([9, 9, 8]) })
    )
    expect(run1['3']).toBe(run2['3'])
    expect(run1['3']).not.toBe(changed['3'])
    // non-PNG refs canonicalize to the extension alone (no content fetch)
    const video = await hashSinkPayloads(
      { '3': { gifs: [{ filename: 'out_00001.mp4', type: 'temp' }] } },
      never
    )
    expect(video['3']).toMatch(/^sha256:/)
  })

  it('compare fails closed on every drift class', () => {
    const committed = {
      recordedAt: { core: 'abc123', run: '42' },
      schema: 1 as const,
      workflows: { 'pack/wf.json': { '5': 'sha256:aa', '7': 'sha256:bb' } }
    }
    expect(
      compareOutputHashes({
        workflowKey: 'pack/other.json',
        observed: {},
        committed
      })[0]
    ).toContain('no committed hashes')
    expect(
      compareOutputHashes({
        workflowKey: 'pack/wf.json',
        observed: { '5': 'sha256:aa', '7': 'sha256:XX' },
        committed
      })[0]
    ).toContain('output hash changed')
    expect(
      compareOutputHashes({
        workflowKey: 'pack/wf.json',
        observed: { '5': 'sha256:aa', '7': 'sha256:XX' },
        committed
      })[0]
    ).toContain('recorded at core abc123')
    expect(
      compareOutputHashes({
        workflowKey: 'pack/wf.json',
        observed: { '5': 'sha256:aa' },
        committed
      })[0]
    ).toContain('output is gone')
    expect(
      compareOutputHashes({
        workflowKey: 'pack/wf.json',
        observed: { '5': 'sha256:aa', '7': 'sha256:bb', '9': 'sha256:cc' },
        committed
      })[0]
    ).toContain('new output')
    expect(
      compareOutputHashes({
        workflowKey: 'pack/wf.json',
        observed: { '5': 'sha256:aa', '7': 'sha256:bb' },
        committed
      })
    ).toEqual([])
  })

  it('record accumulates across calls to the same file (worker-restart survival)', () => {
    const dir = mkdtempSync(join(tmpdir(), 's15-'))
    const file = join(dir, 'recorded.json')
    recordObservedHashes(file, 'a/one.json', { '1': 'sha256:aa' })
    recordObservedHashes(file, 'b/two.json', { '2': 'sha256:bb' })
    const written = JSON.parse(readFileSync(file, 'utf-8'))
    expect(Object.keys(written.workflows).sort()).toEqual([
      'a/one.json',
      'b/two.json'
    ])
    expect(written.schema).toBe(1)
    expect(written.recordedAt.run).toBeTruthy()
  })

  it('an empty committed entry fails because it proves no output content', () => {
    const committed = {
      recordedAt: { core: 'abc', run: '1' },
      schema: 1 as const,
      workflows: { 'was/wf.json': {} }
    }
    expect(
      compareOutputHashes({
        workflowKey: 'was/wf.json',
        observed: {},
        committed
      })
    ).toEqual([
      "S15: 'was/wf.json' has no committed output hashes - add an observable sink before recording its baseline"
    ])
  })

  it('a truncated PNG chunk throws instead of hashing', () => {
    const good = pngWith({ idat: Buffer.from([1, 2, 3]) })
    expect(() => hashPngPixels(good.subarray(0, good.length - 12))).toThrow(
      /no IEND/
    )
    // Cut inside the IDAT chunk (13 = IEND's 12 bytes + 1 byte of IDAT crc)
    // so the chunk header is readable but its declared length overruns.
    expect(() => hashPngPixels(good.subarray(0, good.length - 13))).toThrow(
      /overruns the buffer/
    )
  })

  it('value objects that merely contain a filename keep their sibling keys', async () => {
    const bare = await hashSinkPayloads(
      { '9': { filename: 'display.txt', text: ['A'] } },
      never
    )
    const changed = await hashSinkPayloads(
      { '9': { filename: 'display.txt', text: ['B'] } },
      never
    )
    expect(bare['9']).not.toBe(changed['9'])
    const ref1 = await hashSinkPayloads(
      { '9': { gifs: [{ filename: 'a.mp4', type: 'temp', frame_rate: 8 }] } },
      never
    )
    const ref2 = await hashSinkPayloads(
      { '9': { gifs: [{ filename: 'b.mp4', type: 'temp', frame_rate: 9 }] } },
      never
    )
    expect(ref1['9']).not.toBe(ref2['9'])
  })
})
