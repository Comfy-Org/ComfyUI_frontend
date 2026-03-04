import { describe, expect, it } from 'vitest'

import type { SystemStats } from '@/schemas/apiSchema'

import { extractVramSnapshot } from './vramUtil'

describe('extractVramSnapshot', () => {
  it('returns zero snapshot for empty devices', () => {
    const stats = { system: {}, devices: [] } as unknown as SystemStats
    expect(extractVramSnapshot(stats)).toEqual({
      torchVramTotal: 0,
      torchVramFree: 0
    })
  })

  it('extracts torch VRAM from a single device', () => {
    const stats = {
      system: {},
      devices: [
        {
          name: 'GPU 0',
          type: 'cuda',
          index: 0,
          vram_total: 12_000_000_000,
          vram_free: 8_000_000_000,
          torch_vram_total: 10_000_000_000,
          torch_vram_free: 6_000_000_000
        }
      ]
    } as unknown as SystemStats

    expect(extractVramSnapshot(stats)).toEqual({
      torchVramTotal: 10_000_000_000,
      torchVramFree: 6_000_000_000
    })
  })

  it('sums torch VRAM across multiple devices', () => {
    const stats = {
      system: {},
      devices: [
        {
          name: 'GPU 0',
          type: 'cuda',
          index: 0,
          vram_total: 8e9,
          vram_free: 4e9,
          torch_vram_total: 7e9,
          torch_vram_free: 3e9
        },
        {
          name: 'GPU 1',
          type: 'cuda',
          index: 1,
          vram_total: 8e9,
          vram_free: 6e9,
          torch_vram_total: 7e9,
          torch_vram_free: 5e9
        }
      ]
    } as unknown as SystemStats

    expect(extractVramSnapshot(stats)).toEqual({
      torchVramTotal: 14e9,
      torchVramFree: 8e9
    })
  })
})
