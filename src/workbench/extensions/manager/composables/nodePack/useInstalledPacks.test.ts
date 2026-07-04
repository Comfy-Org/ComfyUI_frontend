import { createApp, h, nextTick, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { components } from '@/types/comfyRegistryTypes'
import { useInstalledPacks } from '@/workbench/extensions/manager/composables/nodePack/useInstalledPacks'

type NodePack = components['schemas']['Node']

const {
  managerStore,
  nodePacksState,
  nodePacksError,
  nodePacksLoading,
  nodePacksReady,
  startFetch,
  cleanup,
  useNodePacks
} = vi.hoisted(() => ({
  managerStore: {
    installedPacksIds: new Set<string>(),
    installedPacks: {},
    refreshInstalledList: vi.fn(),
    isPackInstalled: vi.fn()
  },
  nodePacksState: { value: [] as NodePack[] },
  nodePacksError: { value: undefined as unknown },
  nodePacksLoading: { value: false },
  nodePacksReady: { value: false },
  startFetch: vi.fn(),
  cleanup: vi.fn(),
  useNodePacks: vi.fn()
}))

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: () => managerStore
}))

vi.mock(
  '@/workbench/extensions/manager/composables/nodePack/useNodePacks',
  () => ({
    useNodePacks
  })
)

function mountInstalledPacks() {
  let result: ReturnType<typeof useInstalledPacks> | undefined
  const app = createApp({
    setup() {
      result = useInstalledPacks()
      return () => h('div')
    }
  })
  app.mount(document.createElement('div'))
  if (!result) throw new Error('useInstalledPacks did not initialize')
  return {
    result,
    unmount: () => app.unmount()
  }
}

function pack(overrides: Partial<NodePack> = {}): NodePack {
  return { id: 'pack-a', ...overrides } as NodePack
}

beforeEach(() => {
  managerStore.installedPacksIds = reactive(new Set<string>())
  managerStore.installedPacks = reactive({})
  managerStore.refreshInstalledList.mockReset().mockResolvedValue(undefined)
  managerStore.isPackInstalled.mockReset().mockReturnValue(false)
  startFetch.mockReset().mockResolvedValue([])
  cleanup.mockReset()
  useNodePacks.mockReset().mockReturnValue({
    error: nodePacksError,
    isLoading: nodePacksLoading,
    isReady: nodePacksReady,
    nodePacks: nodePacksState,
    startFetch,
    cleanup
  })
})

describe('useInstalledPacks', () => {
  it('refreshes an empty installed list before fetching packs', async () => {
    const { result, unmount } = mountInstalledPacks()

    await result.startFetchInstalled()

    expect(managerStore.refreshInstalledList).toHaveBeenCalledTimes(1)
    expect(startFetch).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('does not refresh when installed pack ids are already present', async () => {
    managerStore.installedPacksIds.add('pack-a')
    const { result, unmount } = mountInstalledPacks()

    await result.startFetchInstalled()

    expect(managerStore.refreshInstalledList).not.toHaveBeenCalled()
    expect(startFetch).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('prevents duplicate initialization fetches', async () => {
    let releaseRefresh: (() => void) | undefined
    managerStore.refreshInstalledList.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseRefresh = resolve
      })
    )
    const { result, unmount } = mountInstalledPacks()

    const firstFetch = result.startFetchInstalled()
    await result.startFetchInstalled()
    releaseRefresh?.()
    await firstFetch

    expect(managerStore.refreshInstalledList).toHaveBeenCalledTimes(1)
    expect(startFetch).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('fetches again when installed ids change', async () => {
    const { unmount } = mountInstalledPacks()

    managerStore.installedPacksIds.add('pack-b')
    await nextTick()

    expect(startFetch).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('filters and exposes installed pack versions', () => {
    managerStore.isPackInstalled.mockImplementation((id?: string) => id === 'x')
    Object.assign(managerStore.installedPacks, {
      a: { cnr_id: 'x', ver: '1.0.0' },
      b: { aux_id: 'y' },
      c: { ver: 'missing-id' }
    })
    const { result, unmount } = mountInstalledPacks()

    expect(
      result.filterInstalledPack([pack({ id: 'x' }), pack({ id: 'z' })])
    ).toEqual([pack({ id: 'x' })])
    expect(result.installedPacksWithVersions.value).toEqual([
      { id: 'x', version: '1.0.0' },
      { id: 'y', version: '' }
    ])

    unmount()
  })

  it('cleans up node pack fetching on unmount', () => {
    const { unmount } = mountInstalledPacks()

    unmount()

    expect(cleanup).toHaveBeenCalled()
  })
})
