import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'
import { useManagerDisplayPacks } from '@/workbench/extensions/manager/composables/useManagerDisplayPacks'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'

type NodePack = components['schemas']['Node']

const identity = (packs: NodePack[]) => packs

vi.mock(
  '@/workbench/extensions/manager/composables/nodePack/useInstalledPacks',
  () => ({
    useInstalledPacks: () => ({
      installedPacks: { value: [] },
      isLoading: { value: false },
      isReady: { value: true },
      startFetchInstalled: vi.fn(),
      filterInstalledPack: identity
    })
  })
)
vi.mock(
  '@/workbench/extensions/manager/composables/nodePack/useWorkflowPacks',
  () => ({
    useWorkflowPacks: () => ({
      workflowPacks: { value: [] },
      isLoading: { value: false },
      isReady: { value: true },
      startFetchWorkflowPacks: vi.fn(),
      filterWorkflowPack: identity
    })
  })
)
vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: () => ({ isPackInstalled: () => false })
}))
vi.mock('@/workbench/extensions/manager/stores/conflictDetectionStore', () => ({
  useConflictDetectionStore: () => ({ conflictedPackages: [] })
}))

const packs = [
  { id: 'a', name: 'a', downloads: 1 },
  { id: 'b', name: 'b', downloads: 9 },
  { id: 'c', name: 'c', downloads: 5 }
] as NodePack[]

describe('useManagerDisplayPacks', () => {
  // Paged search results are returned in the API's native order; a client-side
  // sort would only reorder loaded pages, not the full set. Proper sort needs
  // server support (Algolia replica indices / a registry sort param), which the
  // gateway does not expose. Un-fail this once the API can sort.
  it.fails('sorts search results across pages by the active sort field', () => {
    const { displayPacks } = useManagerDisplayPacks(
      ref(ManagerTab.Missing),
      ref(packs),
      ref('controlnet'),
      ref('downloads')
    )

    expect(displayPacks.value.map((pack) => pack.id)).toEqual(['b', 'c', 'a'])
  })

  it.for([
    [ManagerTab.Missing, '', true],
    [ManagerTab.AllInstalled, '', true],
    [ManagerTab.Missing, 'controlnet', false],
    [ManagerTab.All, '', false],
    [ManagerTab.NotInstalled, '', false]
  ] as const)(
    '%s tab with query %o → isSortable %s',
    ([tab, query, expected]) => {
      const { isSortable } = useManagerDisplayPacks(
        ref(tab),
        ref(packs),
        ref(query),
        ref('downloads')
      )

      expect(isSortable.value).toBe(expected)
    }
  )
})
