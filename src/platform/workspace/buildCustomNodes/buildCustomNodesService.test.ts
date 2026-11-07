import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { buildCustomNodesService as Service } from '@/platform/workspace/buildCustomNodes/buildCustomNodesService'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import type { components } from '@/types/comfyRegistryTypes'

vi.mock(import('@/services/comfyRegistryService'))

type RegistryNode = components['schemas']['Node']
type Registry = ReturnType<typeof useComfyRegistryService>

function registryNode(id: string, overrides: Partial<RegistryNode> = {}) {
  return {
    id,
    name: id,
    publisher: { id: 'drltdata', name: 'Dr.Lt.Data' },
    downloads: 10,
    github_stars: 1,
    repository: `https://github.com/example/${id}`,
    latest_version: { version: '1.0.0' },
    ...overrides
  }
}

async function freshService(): Promise<typeof Service> {
  vi.resetModules()
  const module =
    await import('@/platform/workspace/buildCustomNodes/buildCustomNodesService')
  return module.buildCustomNodesService
}

function mockRegistry(registry: Partial<Registry>) {
  vi.mocked(useComfyRegistryService).mockReturnValue(
    fromPartial<Registry>(registry)
  )
}

describe('buildCustomNodesService', () => {
  it('reads every page of the registry index once, with readable licenses', async () => {
    const listAllPacks = vi.fn(async (params?: { page?: number }) => {
      const page = params?.page ?? 1
      const nodes =
        page === 1
          ? [
              registryNode('impact', { license: '{"text": "MIT"}' }),
              registryNode('no-license', { license: '{"file": "LICENSE"}' })
            ]
          : [
              registryNode('subpack', {
                name: undefined,
                publisher: { id: 'ltdr' }
              })
            ]
      return { nodes, total: 150 }
    })
    mockRegistry({ listAllPacks })
    const service = await freshService()

    const outcome = await service.listNodePacks()
    await service.listNodePacks()

    expect(listAllPacks).toHaveBeenCalledTimes(2)
    expect(outcome).toMatchObject({
      ok: true,
      value: [
        { id: 'impact', license: 'MIT', publisher: 'Dr.Lt.Data' },
        { id: 'no-license', license: '' },
        { id: 'subpack', name: 'subpack', publisher: 'ltdr' }
      ]
    })
  })

  it('reports an index it could not finish as a refusal, and reads it again next time', async () => {
    const listAllPacks = vi
      .fn()
      .mockResolvedValueOnce({ nodes: [registryNode('a')], total: 200 })
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ nodes: [registryNode('a')], total: 100 })
    mockRegistry({ listAllPacks })
    const service = await freshService()

    expect(await service.listNodePacks()).toMatchObject({
      ok: false,
      code: 'registry_unreachable'
    })
    expect(await service.listNodePacks()).toMatchObject({ ok: true })
  })

  it('lists the versions a Build may pin, newest first, without deprecated ones', async () => {
    mockRegistry({
      getPackVersions: vi
        .fn()
        .mockResolvedValue([
          { version: '1.3.5' },
          { version: '1.3.4', deprecated: true },
          { version: '1.3.3' },
          {}
        ])
    })
    const service = await freshService()

    expect(await service.getNodePackVersions('comfyui-impact-subpack')).toEqual(
      { ok: true, value: ['1.3.5', '1.3.3'] }
    )
  })
})
