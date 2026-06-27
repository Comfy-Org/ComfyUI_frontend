import type * as VueUse from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { components } from '@/types/comfyRegistryTypes'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import { useManagerDisplayPacks } from '@/workbench/extensions/manager/composables/useManagerDisplayPacks'

type NodePack = components['schemas']['Node']

const { state } = vi.hoisted(() => ({
  state: {
    installed: [] as NodePack[],
    workflow: [] as NodePack[],
    installedIds: new Set<string>(),
    installedVersions: {} as Record<string, string>,
    conflicts: [] as { package_id: string }[]
  }
}))

// Invoke the predicate once so the data-fetch trigger conditions are exercised.
vi.mock('@vueuse/core', async (orig) => ({
  ...(await orig<typeof VueUse>()),
  whenever: (source: unknown) => {
    if (typeof source === 'function') (source as () => unknown)()
  }
}))

vi.mock('@/services/gateway/registrySearchGateway', () => ({
  useRegistrySearchGateway: () => ({
    getSortValue: (pack: NodePack, field: string) =>
      (pack as Record<string, unknown>)[field],
    getSortableFields: () => [{ id: 'name', direction: 'asc' }]
  })
}))

vi.mock(
  '@/workbench/extensions/manager/composables/nodePack/useInstalledPacks',
  () => ({
    useInstalledPacks: () => ({
      startFetchInstalled: () => {},
      filterInstalledPack: (packs: NodePack[]) =>
        packs.filter((p) => state.installedIds.has(p.id ?? '')),
      installedPacks: ref(state.installed),
      isLoading: ref(false),
      isReady: ref(true)
    })
  })
)

vi.mock(
  '@/workbench/extensions/manager/composables/nodePack/useWorkflowPacks',
  () => ({
    useWorkflowPacks: () => ({
      startFetchWorkflowPacks: () => {},
      filterWorkflowPack: (packs: NodePack[]) => packs,
      workflowPacks: ref(state.workflow),
      isLoading: ref(false),
      isReady: ref(true)
    })
  })
)

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: () => ({
    isPackInstalled: (id: string | undefined) =>
      state.installedIds.has(id ?? ''),
    getInstalledPackVersion: (id: string) => state.installedVersions[id]
  })
}))

vi.mock('@/workbench/extensions/manager/stores/conflictDetectionStore', () => ({
  useConflictDetectionStore: () => ({
    get conflictedPackages() {
      return state.conflicts
    }
  })
}))

function pack(id: string, latestVersion?: string): NodePack {
  return {
    id,
    name: id,
    latest_version: latestVersion ? { version: latestVersion } : undefined
  } as NodePack
}

function display(
  tab: ManagerTab,
  searchResults: NodePack[] = [],
  query = '',
  sortField = ''
) {
  return useManagerDisplayPacks(
    ref(tab),
    ref(searchResults),
    ref(query),
    ref(sortField)
  )
}

beforeEach(() => {
  state.installed = []
  state.workflow = []
  state.installedIds = new Set()
  state.installedVersions = {}
  state.conflicts = []
})

describe('useManagerDisplayPacks', () => {
  it('All tab returns the raw search results', () => {
    const results = [pack('a'), pack('b')]
    expect(display(ManagerTab.All, results).displayPacks.value).toEqual(results)
  })

  it('NotInstalled tab excludes installed packs', () => {
    state.installedIds = new Set(['a'])
    const { displayPacks } = display(ManagerTab.NotInstalled, [
      pack('a'),
      pack('b')
    ])
    expect(displayPacks.value.map((p) => p.id)).toEqual(['b'])
  })

  it('AllInstalled tab shows installed packs when not searching', () => {
    state.installed = [pack('x'), pack('y')]
    const { displayPacks } = display(ManagerTab.AllInstalled)
    expect(displayPacks.value.map((p) => p.id)).toEqual(['x', 'y'])
  })

  it('UpdateAvailable tab keeps only installed packs with a newer latest version', () => {
    state.installedIds = new Set(['old', 'current', 'nightly'])
    state.installedVersions = {
      old: '1.0.0',
      current: '2.0.0',
      nightly: 'not-semver'
    }
    state.installed = [
      pack('old', '1.2.0'), // newer -> included
      pack('current', '2.0.0'), // equal -> excluded
      pack('nightly', '9.9.9'), // invalid installed version -> excluded
      pack('uninstalled', '5.0.0') // not installed -> excluded
    ]
    const { displayPacks } = display(ManagerTab.UpdateAvailable)
    expect(displayPacks.value.map((p) => p.id)).toEqual(['old'])
  })

  it('Conflicting tab keeps packs flagged by the conflict store', () => {
    state.installed = [pack('a'), pack('b')]
    state.conflicts = [{ package_id: 'b' }]
    const { displayPacks } = display(ManagerTab.Conflicting)
    expect(displayPacks.value.map((p) => p.id)).toEqual(['b'])
  })

  it('Missing tab returns workflow packs that are not installed', () => {
    state.workflow = [pack('a'), pack('b')]
    state.installedIds = new Set(['a'])
    const { displayPacks, missingNodePacks } = display(ManagerTab.Missing)
    expect(displayPacks.value.map((p) => p.id)).toEqual(['b'])
    expect(missingNodePacks.value.map((p) => p.id)).toEqual(['b'])
  })

  it('Unresolved tab is always empty', () => {
    expect(
      display(ManagerTab.Unresolved, [pack('a')]).displayPacks.value
    ).toEqual([])
  })

  it('reports loading state scoped to the active tab group', () => {
    expect(display(ManagerTab.AllInstalled).isLoading.value).toBe(false)
    expect(display(ManagerTab.Workflow).isLoading.value).toBe(false)
    expect(display(ManagerTab.All).isLoading.value).toBe(false)
  })

  it('filters search results to installed packs on the AllInstalled tab while searching', () => {
    state.installedIds = new Set(['a'])
    const { displayPacks } = display(
      ManagerTab.AllInstalled,
      [pack('a'), pack('b')],
      'query'
    )
    expect(displayPacks.value.map((p) => p.id)).toEqual(['a'])
  })

  it('filters workflow search results on the Workflow tab while searching', () => {
    const { displayPacks } = display(
      ManagerTab.Workflow,
      [pack('a'), pack('b')],
      'query'
    )
    expect(displayPacks.value.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('sorts installed packs by the configured field', () => {
    state.installed = [pack('b'), pack('a'), pack('c')]
    const { displayPacks } = display(ManagerTab.AllInstalled, [], '', 'name')
    expect(displayPacks.value.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
})
