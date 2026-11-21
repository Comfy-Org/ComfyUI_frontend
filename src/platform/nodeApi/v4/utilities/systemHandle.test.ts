import { describe, expect, it, vi } from 'vitest'

import type { DeviceStats, SystemStats } from '@comfyorg/api-client/types'

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

const gpu: DeviceStats = {
  name: 'cuda:0 NVIDIA GeForce RTX 4090 : cudaMallocAsync',
  type: 'cuda',
  index: 0,
  vram_total: 25_386_352_640,
  vram_free: 23_719_903_232,
  torch_vram_total: 1_073_741_824,
  torch_vram_free: 1_006_632_960
}

const backendStats: SystemStats = {
  system: {
    os: 'linux',
    ram_total: 67_108_864_000,
    ram_free: 50_331_648_000,
    comfyui_version: '0.3.68',
    required_frontend_version: '1.30.0',
    installed_templates_version: '0.2.11',
    required_templates_version: '0.2.11',
    python_version: '3.12.7 (main, Oct  1 2024, 08:52:12) [GCC 11.2.0]',
    pytorch_version: '2.8.0+cu128',
    embedded_python: false,
    comfy_package_versions: [
      {
        name: 'comfyui-workflow-templates',
        installed: '0.2.11',
        required: '0.2.11'
      }
    ],
    argv: ['main.py', '--listen']
  },
  devices: [gpu]
}

function stats(overrides: { system?: object; devices?: unknown } = {}) {
  return { ...backendStats, ...overrides }
}

describe('reading the system monitor', () => {
  it('reads the backend RAM and each device from its system stats', async () => {
    answer(Response.json(backendStats))

    const snapshot = await systemApi().monitor()

    expect(snapshot).toStrictEqual({
      memory: { total: 67_108_864_000, available: 50_331_648_000 },
      accelerators: [
        {
          id: gpu.name,
          name: gpu.name,
          memoryTotal: 25_386_352_640,
          memoryAvailable: 23_719_903_232
        }
      ]
    })
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe('/api/system_stats')
  })

  it('is frozen, so a pack cannot replace monitor for another', () => {
    expect(Object.isFrozen(systemApi())).toBe(true)
  })

  it('freezes the reading and each part of it', async () => {
    answer(Response.json(backendStats))

    const snapshot = await systemApi().monitor()

    expect(snapshot).toBeDefined()
    expect(
      [
        snapshot,
        snapshot?.memory,
        snapshot?.accelerators,
        snapshot?.accelerators[0]
      ].every((part) => Object.isFrozen(part))
    ).toBe(true)
  })

  it('takes memory that is all in use', async () => {
    answer(
      Response.json(
        stats({
          system: { ...backendStats.system, ram_free: 0 },
          devices: [{ ...gpu, vram_free: 0 }]
        })
      )
    )

    const snapshot = await systemApi().monitor()

    expect(snapshot?.memory.available).toBe(0)
    expect(snapshot?.accelerators[0].memoryAvailable).toBe(0)
  })

  it('has no accelerators on a machine that runs on its CPU', async () => {
    const cpu = {
      name: 'cpu',
      type: 'cpu',
      index: null,
      vram_total: 67_108_864_000,
      vram_free: 50_331_648_000,
      torch_vram_total: 67_108_864_000,
      torch_vram_free: 50_331_648_000
    }
    answer(Response.json(stats({ devices: [cpu] })))

    const snapshot = await systemApi().monitor()

    expect(snapshot?.memory.total).toBe(67_108_864_000)
    expect(snapshot?.accelerators).toStrictEqual([])
  })

  it('keeps every device other than the CPU, in the backend order', async () => {
    const second: DeviceStats = {
      ...gpu,
      name: 'cuda:1 NVIDIA GeForce RTX 3090 : cudaMallocAsync',
      index: 1
    }
    const cpu = { ...gpu, name: 'cpu', type: 'cpu', index: null }
    answer(Response.json(stats({ devices: [gpu, cpu, second] })))

    const snapshot = await systemApi().monitor()

    expect(snapshot?.accelerators.map(({ id }) => id)).toEqual([
      gpu.name,
      second.name
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
      failure: Response.json({ system: backendStats.system })
    },
    {
      name: 'gives devices that are not a list',
      failure: Response.json(stats({ devices: { 0: gpu, length: 1 } }))
    },
    {
      name: 'gives a RAM total that is not a number',
      failure: Response.json(
        stats({ system: { ram_total: '64', ram_free: 1 } })
      )
    },
    {
      name: 'gives a RAM total too large for a number',
      failure: new Response(
        JSON.stringify(stats()).replace(
          '"ram_total":67108864000',
          '"ram_total":1e999'
        )
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
