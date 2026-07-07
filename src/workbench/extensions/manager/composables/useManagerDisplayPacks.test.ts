import type * as VueUse from '@vueuse/core'
import { fromPartial } from '@total-typescript/shoehorn'
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
    installedLoading: false,
    workflowLoading: false,
    installedReady: true,
    workflowReady: true,
    startFetchInstalled: vi.fn(),
    startFetchWorkflowPacks: vi.fn(),
    installedIds: new Set<string>(),
    installedVersions: {} as Record<string, string>,
    conflicts: [] as { package_id: string }[]
  }
}))

vi.mock('@vueuse/core', async (orig) => ({
  ...(await orig<typeof VueUse>()),
  whenever: (source: unknown, callback?: () => void) => {
    if (typeof source === 'function' && source() && callback) {
      callback()
    }
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
      startFetchInstalled: state.startFetchInstalled,
      filterInstalledPack: (packs: NodePack[]) =>
        packs.filter((p) => state.installedIds.has(p.id ?? '')),
      installedPacks: ref(state.installed),
      isLoading: ref(state.installedLoading),
      isReady: ref(state.installedReady)
    })
  })
)

vi.mock(
  '@/workbench/extensions/manager/composables/nodePack/useWorkflowPacks',
  () => ({
    useWorkflowPacks: () => ({
      startFetchWorkflowPacks: state.startFetchWorkflowPacks,
      filterWorkflowPack: (packs: NodePack[]) => packs,
      workflowPacks: ref(state.workflow),
      isLoading: ref(state.workflowLoading),
      isReady: ref(state.workflowReady)
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
  return fromPartial<NodePack>({
    id,
    name: id,
    latest_version: latestVersion ? { version: latestVersion } : undefined
  })
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
  state.installedLoading = false
  state.workflowLoading = false
  state.installedReady = true
  state.workflowReady = true
  state.startFetchInstalled.mockReset()
  state.startFetchWorkflowPacks.mockReset()
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
      pack('old', '1.2.0'),
      pack('current', '2.0.0'),
      pack('nightly', '9.9.9'),
      pack('uninstalled', '5.0.0')
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
    state.installedLoading = true
    state.workflowLoading = false
    expect(display(ManagerTab.AllInstalled).isLoading.value).toBe(true)
    expect(display(ManagerTab.All).isLoading.value).toBe(false)

    state.installedLoading = false
    state.workflowLoading = true
    expect(display(ManagerTab.Workflow).isLoading.value).toBe(true)
    expect(display(ManagerTab.Missing).isLoading.value).toBe(true)
  })

  it('fetches installed packs when an installed tab is selected and not ready', () => {
    state.installedReady = false
    display(ManagerTab.AllInstalled)

    expect(state.startFetchInstalled).toHaveBeenCalledTimes(1)
    expect(state.startFetchWorkflowPacks).not.toHaveBeenCalled()
  })

  it('fetches workflow and installed packs for missing workflow dependencies', () => {
    state.installedReady = false
    state.workflowReady = false
    display(ManagerTab.Missing)

    expect(state.startFetchInstalled).toHaveBeenCalledTimes(1)
    expect(state.startFetchWorkflowPacks).toHaveBeenCalledTimes(1)
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

  it('filters searched update and conflict tabs before applying tab rules', () => {
    state.installedIds = new Set(['old', 'conflict'])
    state.installedVersions = {
      old: '1.0.0',
      conflict: '1.0.0'
    }
    state.conflicts = [{ package_id: 'conflict' }]
    const results = [
      pack('old', '2.0.0'),
      pack('current', '1.0.0'),
      pack('conflict', '1.0.0')
    ]

    expect(
      display(
        ManagerTab.UpdateAvailable,
        results,
        'query'
      ).displayPacks.value.map((p) => p.id)
    ).toEqual(['old'])
    expect(
      display(ManagerTab.Conflicting, results, 'query').displayPacks.value.map(
        (p) => p.id
      )
    ).toEqual(['conflict'])
  })

  it('filters workflow search results on the Workflow tab while searching', () => {
    const { displayPacks } = display(
      ManagerTab.Workflow,
      [pack('a'), pack('b')],
      'query'
    )
    expect(displayPacks.value.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('filters searched missing workflow packs to not-installed packs', () => {
    state.installedIds = new Set(['a'])
    const { displayPacks } = display(
      ManagerTab.Missing,
      [pack('a'), pack('b')],
      'query'
    )
    expect(displayPacks.value.map((p) => p.id)).toEqual(['b'])
  })

  it('falls back to search results for unknown tabs', () => {
    const results = [pack('a')]
    expect(
      display('unknown' as ManagerTab, results).displayPacks.value
    ).toEqual(results)
  })

  it('sorts installed packs by the configured field', () => {
    state.installed = [pack('b'), pack('a'), pack('c')]
    const { displayPacks } = display(ManagerTab.AllInstalled, [], '', 'name')
    expect(displayPacks.value.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
})
