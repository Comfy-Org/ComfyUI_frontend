import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  compareOutputHashes,
  hashPngPixels,
  hashSinkPayloads
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

test.describe('S15 output hashes', () => {
  test('identical pixels hash identically regardless of embedded metadata', () => {
    const idat = Buffer.from([1, 2, 3, 4, 5])
    const plain = hashPngPixels(pngWith({ idat }))
    const withPrompt = hashPngPixels(
      pngWith({ idat, text: 'prompt{"seed":42,"widgets":[1,2,3]}' })
    )
    expect(plain).toBe(withPrompt)
    expect(plain).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  test('different pixels hash differently', () => {
    const a = hashPngPixels(pngWith({ idat: Buffer.from([1, 2, 3]) }))
    const b = hashPngPixels(pngWith({ idat: Buffer.from([1, 2, 4]) }))
    expect(a).not.toBe(b)
  })

  test('non-PNG bytes and IDAT-less files throw instead of hashing', () => {
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

  test('payload hashing is key-order independent and value sensitive', async () => {
    const a = await hashSinkPayloads({ '5': { text: ['7'], b: 1 } }, never)
    const b = await hashSinkPayloads({ '5': { b: 1, text: ['7'] } }, never)
    const c = await hashSinkPayloads({ '5': { b: 1, text: ['8'] } }, never)
    expect(a['5']).toBe(b['5'])
    expect(a['5']).not.toBe(c['5'])
  })

  test('file refs canonicalize by extension: run-varying names do not churn, pixels do', async () => {
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

  test('compare fails closed on every drift class', () => {
    const committed = { 'pack/wf.json': { '5': 'sha256:aa', '7': 'sha256:bb' } }
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
    ).toContain('hash changed')
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
})
