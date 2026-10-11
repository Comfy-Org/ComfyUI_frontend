import { describe, expect, it } from 'vitest'

import type { RunRecord } from './workshop-run'
import { retainRunHistory } from './workshop-run-history'

const run = (name: string, bytes = 0, attachmentBytes = 0): RunRecord => ({
  output: {
    kind: 'image',
    url: `blob:${name}`,
    fileName: `${name}.png`,
    byteLength: bytes
  },
  attachments: [
    {
      kind: 'text',
      url: `blob:${name}-metadata`,
      fileName: `${name}.json`,
      byteLength: attachmentBytes
    }
  ]
})

describe('run history retention', () => {
  it('keeps five recent requests and returns every older request for disposal', () => {
    const records = Array.from({ length: 7 }, (_, index) => run(String(index)))
    expect(retainRunHistory(records)).toEqual({
      retained: records.slice(0, 5),
      discarded: records.slice(5)
    })
    expect(records).toHaveLength(7)
  })

  it('counts attachments against the byte budget without dropping the current output', () => {
    const megabyte = 1024 * 1024
    const records = [
      run('current', 25 * megabyte, 10 * megabyte),
      run('previous', 30 * megabyte),
      run('older', megabyte)
    ]
    expect(retainRunHistory(records)).toEqual({
      retained: [records[0]],
      discarded: records.slice(1)
    })
    const large = [run('large', 80 * megabyte), ...records]
    expect(retainRunHistory(large)).toEqual({
      retained: [large[0]],
      discarded: records
    })
    expect(retainRunHistory([])).toEqual({ retained: [], discarded: [] })
  })
})
