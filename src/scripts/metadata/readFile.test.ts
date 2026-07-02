import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  mockFileReaderAbort,
  mockFileReaderError
} from './__fixtures__/helpers'
import { readFileAsArrayBuffer } from './readFile'

describe('readFileAsArrayBuffer', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reads the whole file into an ArrayBuffer when no cap is given', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const file = new File([bytes], 'test.bin')

    const buffer = await readFileAsArrayBuffer(file)

    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(new Uint8Array(buffer!)).toEqual(bytes)
  })

  it('reads only the first maxBytes when a cap is given', async () => {
    const file = new File([new Uint8Array(100)], 'test.bin')

    const buffer = await readFileAsArrayBuffer(file, 10)

    expect(buffer?.byteLength).toBe(10)
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
