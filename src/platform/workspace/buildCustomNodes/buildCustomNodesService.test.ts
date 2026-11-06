import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { buildCustomNodesService } from '@/platform/workspace/buildCustomNodes/buildCustomNodesService'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import type { RegistrySearchGateway } from '@/services/gateway/registrySearchGateway'
import type { components } from '@/types/comfyRegistryTypes'

const { searchPacks } = vi.hoisted(() => ({
  searchPacks: vi.fn<RegistrySearchGateway['searchPacks']>()
}))

vi.mock(import('@/services/gateway/registrySearchGateway'), () => ({
  useRegistrySearchGateway: () =>
    fromPartial<RegistrySearchGateway>({ searchPacks })
}))

vi.mock(import('@/services/comfyRegistryService'))

type RegistryNode = components['schemas']['Node']

function registryNode(overrides: Partial<RegistryNode>): RegistryNode {
  return {
    id: 'comfyui-impact-pack',
    name: 'ComfyUI Impact Pack',
    publisher: { id: 'drltdata', name: 'Dr.Lt.Data' },
    downloads: 3_600_000,
    github_stars: 3300,
    repository: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack',
    latest_version: { version: '8.30.0' },
    ...overrides
  }
}

describe('buildCustomNodesService', () => {
  it('turns registry search hits into node packs with a readable license', async () => {
    searchPacks.mockResolvedValue({
      ok: true,
      result: {
        nodePacks: [
          registryNode({ license: '{"text": "MIT"}' }),
          registryNode({
            id: 'scale-rae',
            name: undefined,
            publisher: { id: 'genelab' },
            license: '{"file": "LICENSE"}',
            latest_version: undefined
          }),
          registryNode({ id: undefined })
        ],
        querySuggestions: [],
        hasMore: true
      }
    })

    const outcome = await buildCustomNodesService.searchNodePacks('impact', 2)

    expect(searchPacks).toHaveBeenCalledWith('impact', {
      pageSize: 25,
      pageNumber: 2
    })
    expect(outcome).toEqual({
      ok: true,
      value: {
        hasMore: true,
        packs: [
          {
            id: 'comfyui-impact-pack',
            name: 'ComfyUI Impact Pack',
            publisher: 'Dr.Lt.Data',
            installs: 3_600_000,
            stars: 3300,
            license: 'MIT',
            repository: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack',
            latestVersion: '8.30.0'
          },
          {
            id: 'scale-rae',
            name: 'scale-rae',
            publisher: 'genelab',
            installs: 3_600_000,
            stars: 3300,
            license: '',
            repository: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack',
            latestVersion: undefined
          }
        ]
      }
    })
  })

  it('reports a failed registry search as a refusal', async () => {
    searchPacks.mockResolvedValue({ ok: false, cause: new Error('offline') })

    expect(await buildCustomNodesService.searchNodePacks('', 0)).toMatchObject({
      ok: false,
      code: 'registry_unreachable'
    })
  })

  it('lists the versions a Build may pin, newest first, without deprecated ones', async () => {
    vi.mocked(useComfyRegistryService).mockReturnValue(
      fromPartial<ReturnType<typeof useComfyRegistryService>>({
        getPackVersions: vi
          .fn()
          .mockResolvedValue([
            { version: '1.3.5' },
            { version: '1.3.4', deprecated: true },
            { version: '1.3.3' },
            {}
          ])
      })
    )

    expect(
      await buildCustomNodesService.getNodePackVersions(
        'comfyui-impact-subpack'
      )
    ).toEqual({ ok: true, value: ['1.3.5', '1.3.3'] })
  })
})
