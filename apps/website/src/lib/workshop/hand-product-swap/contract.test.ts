import { describe, expect, it } from 'vitest'

import { outputSize } from './contract'

describe('outputSize', () => {
  it.for([
    { resolution: '1K', width: 1200, height: 900, size: [1024, 768] },
    { resolution: '2K', width: 1200, height: 900, size: [2048, 1536] },
    { resolution: '4K', width: 900, height: 1600, size: [2304, 4096] }
  ] as const)(
    'sets the long edge for $resolution and keeps the photo’s shape',
    ({ resolution, width, height, size }) => {
      const out = outputSize(resolution, width, height)
      expect([out.width, out.height]).toEqual(size)
    }
  )
})
