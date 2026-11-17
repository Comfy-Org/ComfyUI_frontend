import { describe, expect, it, vi } from 'vitest'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'

function systemApi() {
  return createComfyApi({ getGraph: () => null }).comfy.system
}

function answer(response: Response | Error) {
  vi.mocked(fetch).mockImplementation(async () => {
    if (response instanceof Error) throw response
    return response
  })
}

const gpu = {
  name: 'cuda:0 NVIDIA GeForce RTX 4090 : cudaMallocAsync',
  type: 'cuda',
  index: 0,
  vram_total: 24_000,
  vram_free: 20_000
}

function stats(overrides: { system?: object; devices?: unknown[] } = {}) {
  return {
    system: { os: 'posix', ram_total: 64_000, ram_free: 48_000 },
    devices: [gpu],
    ...overrides
  }
}

describe('reading the system monitor', () => {
  it('reads the backend RAM and devices from its system stats, with no sensor it lacks', async () => {
    answer(Response.json(stats()))

    const snapshot = await systemApi().monitor()

    expect(snapshot).toEqual({
      cpu: { utilization_percent: null },
      memory: { total: 64_000, available: 48_000 },
      volumes: [],
      accelerators: [
        {
          id: gpu.name,
          name: gpu.name,
          memory_total: 24_000,
          memory_available: 20_000,
          utilization_percent: null,
          temperature_c: null
        }
      ]
    })
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe('/api/system_stats')
  })

  it('freezes the reading and each part of it', async () => {
    answer(Response.json(stats()))

    const snapshot = await systemApi().monitor()

    expect(snapshot).toBeDefined()
    expect(
      [
        snapshot,
        snapshot?.cpu,
        snapshot?.memory,
        snapshot?.volumes,
        snapshot?.accelerators,
        snapshot?.accelerators[0]
      ].every((part) => Object.isFrozen(part))
    ).toBe(true)
  })

  it('takes memory that is all in use', async () => {
    answer(
      Response.json(
        stats({
          system: { ram_total: 64, ram_free: 0 },
          devices: [{ ...gpu, vram_free: 0 }]
        })
      )
    )

    const snapshot = await systemApi().monitor()

    expect(snapshot?.memory.available).toBe(0)
    expect(snapshot?.accelerators[0].memory_available).toBe(0)
  })

  it('leaves the CPU out of the accelerators, and keeps every other device', async () => {
    const cpu = { name: 'cpu', type: 'cpu', vram_total: 1, vram_free: 1 }
    const mps = { ...gpu, name: 'mps', type: 'mps' }
    answer(Response.json(stats({ devices: [cpu, gpu, mps] })))

    const snapshot = await systemApi().monitor()

    expect(snapshot?.accelerators.map(({ name }) => name)).toEqual([
      gpu.name,
      'mps'
    ])
  })

  it.for([
    { name: 'cannot be reached', failure: new TypeError('Failed to fetch') },
    {
      name: 'answers with an error page',
      failure: new Response('<html>', { status: 500 })
    },
    { name: 'answers with null', failure: Response.json(null) },
    { name: 'answers with text', failure: Response.json('stats') },
    { name: 'answers with a list', failure: Response.json([]) },
    {
      name: 'answers without a system',
      failure: Response.json({ devices: [] })
    },
    {
      name: 'answers without devices',
      failure: Response.json({ system: stats().system })
    },
    {
      name: 'gives a RAM total that is not a number',
      failure: Response.json(
        stats({ system: { ram_total: '64', ram_free: 1 } })
      )
    },
    {
      name: 'gives a negative free RAM',
      failure: Response.json(stats({ system: { ram_total: 64, ram_free: -1 } }))
    },
    {
      name: 'gives a device that is not an object',
      failure: Response.json(stats({ devices: ['cuda:0'] }))
    },
    {
      name: 'gives a device without a name',
      failure: Response.json(stats({ devices: [{ ...gpu, name: 3 }] }))
    },
    {
      name: 'gives a device without its total memory',
      failure: Response.json(
        stats({ devices: [{ ...gpu, vram_total: undefined }] })
      )
    },
    {
      name: 'gives a device without its free memory',
      failure: Response.json(stats({ devices: [{ ...gpu, vram_free: null }] }))
    }
  ])('resolves undefined when the server $name', async ({ failure }) => {
    answer(failure)

    expect(await systemApi().monitor()).toBeUndefined()
  })
})
