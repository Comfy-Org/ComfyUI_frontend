import { assert, describe, expect, it } from 'vitest'

import {
  mockFileReaderAbort,
  mockFileReaderError,
  mockFileReaderResult
} from '@/scripts/metadata/__fixtures__/helpers'
import { readFileAsArrayBuffer } from '@/utils/fileUtil'

describe('readFileAsArrayBuffer', () => {
  it('reads the whole file into an ArrayBuffer when no cap is given', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const file = new File([bytes], 'test.bin')

    const buffer = await readFileAsArrayBuffer(file)

    assert(buffer instanceof ArrayBuffer)
    expect(new Uint8Array(buffer)).toEqual(bytes)
  })

  it('reads only the first maxBytes when a cap is given', async () => {
    const bytes = Uint8Array.from({ length: 100 }, (_, i) => i)
    const file = new File([bytes], 'test.bin')

    const buffer = await readFileAsArrayBuffer(file, 10)

    assert(buffer instanceof ArrayBuffer)
    expect(new Uint8Array(buffer)).toEqual(bytes.slice(0, 10))
  })

  it('returns an empty ArrayBuffer (not null) when maxBytes is 0', async () => {
    const file = new File([new Uint8Array(10)], 'test.bin')

    const buffer = await readFileAsArrayBuffer(file, 0)

    assert(buffer instanceof ArrayBuffer)
    expect(buffer.byteLength).toBe(0)
  })

  it('resolves null when the read yields a non-ArrayBuffer result', async () => {
    mockFileReaderResult('readAsArrayBuffer', 'not an array buffer')

    expect(await readFileAsArrayBuffer(new File([], 'test.bin'))).toBeNull()
  })

  it('resolves null when the read fires an error', async () => {
    mockFileReaderError('readAsArrayBuffer')

    expect(await readFileAsArrayBuffer(new File([], 'test.bin'))).toBeNull()
  })

  it('resolves null when the read is aborted', async () => {
    mockFileReaderAbort('readAsArrayBuffer')

    expect(await readFileAsArrayBuffer(new File([], 'test.bin'))).toBeNull()
  })
})
