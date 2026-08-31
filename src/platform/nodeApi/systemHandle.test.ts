import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { createSystemApi } from './systemHandle'

vi.mock('@/scripts/api', () => ({
  api: { fetchApi: vi.fn() }
}))

const snapshot = {
  cpu: { utilization_percent: 37.5 },
  memory: { total: 1000, available: 400 },
  volumes: [{ id: 'volume-0', label: 'Root', total: 2000, available: 500 }],
  accelerators: [
    {
      id: 'accelerator-0',
      name: 'Example GPU',
      memory_total: 4000,
      memory_available: 1500,
      utilization_percent: 61,
      temperature_c: 72
    }
  ]
}

describe('system monitor API', () => {
  beforeEach(() => vi.mocked(api.fetchApi).mockReset())

  it('returns the exact bounded host projection', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(JSON.stringify(snapshot), { status: 200 })
    )
    await expect(createSystemApi().monitor()).resolves.toEqual(snapshot)
    expect(api.fetchApi).toHaveBeenCalledWith('/system_monitor', {
      cache: 'no-store'
    })
  })

  it.for([
    { ...snapshot, memory: { total: 1, available: 2 } },
    {
      ...snapshot,
      volumes: Array.from({ length: 65 }, () => snapshot.volumes[0])
    },
    {
      ...snapshot,
      accelerators: [{ ...snapshot.accelerators[0], temperature_c: 1001 }]
    },
    {
      ...snapshot,
      volumes: [{ ...snapshot.volumes[0], label: '/Volumes/Private\0' }]
    }
  ])('rejects malformed or over-broad snapshots', async (value) => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(JSON.stringify(value), { status: 200 })
    )
    await expect(createSystemApi().monitor()).rejects.toThrow(
      /invalid snapshot/
    )
  })

  it('reports a failed host request without parsing it', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(new Response('', { status: 503 }))
    await expect(createSystemApi().monitor()).rejects.toThrow(/status 503/)
  })
})
