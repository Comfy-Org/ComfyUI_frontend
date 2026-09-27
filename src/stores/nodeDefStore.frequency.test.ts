import axios from 'axios'
import { describe, expect, it, vi } from 'vitest'

import nodeFrequencies from '../../public/assets/sorted-custom-node-map.json' with { type: 'json' }
import { useNodeFrequencyStore } from '@/stores/nodeDefStore'

describe('useNodeFrequencyStore', () => {
  it('loads independent rankings for both Save Image node definitions', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({ data: nodeFrequencies })
    const store = useNodeFrequencyStore()

    await store.loadNodeFrequencies()

    expect(store.getNodeFrequencyByName('SaveImage')).toBe(1762)
    expect(store.getNodeFrequencyByName('SaveImageAdvanced')).toBe(4300)
  })
})
