import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import type { PropType } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useRegistrySearchGateway } from '@/services/gateway/registrySearchGateway'
import type { SearchPacksResult } from '@/types/searchServiceTypes'
import { useInstalledPacks } from '@/workbench/extensions/manager/composables/nodePack/useInstalledPacks'
import { useWorkflowPacks } from '@/workbench/extensions/manager/composables/nodePack/useWorkflowPacks'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import { useComfyManagerService } from '@/workbench/extensions/manager/services/comfyManagerService'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'

type NodePack = SearchPacksResult['nodePacks'][number]

vi.mock(import('@/services/gateway/registrySearchGateway'), () => {
  const gateway = {
    searchPacks:
      vi.fn<ReturnType<typeof useRegistrySearchGateway>['searchPacks']>(),
    clearSearchCache: vi.fn()
  }
  return { useRegistrySearchGateway: () => gateway }
})

vi.mock(import('@/workbench/extensions/manager/composables/useManagerState'))

vi.mock<unknown>(
  import('@/workbench/extensions/manager/services/comfyManagerService'),
  () => {
    const service = {
      listInstalledPacks: vi.fn(async () => ({})),
      isLoading: ref(false),
      error: ref<string | null>(null)
    }
    return { useComfyManagerService: () => service }
  }
)

vi.mock(
  import('@/workbench/extensions/manager/composables/nodePack/useInstalledPacks'),
  () => {
    const installedPacks: ReturnType<typeof useInstalledPacks> = {
      error: ref(null),
      isLoading: ref(false),
      isReady: ref(true),
      installedPacks: ref<NodePack[]>([]),
      installedPacksWithVersions: computed(() => []),
      startFetchInstalled: vi.fn(async () => {}),
      filterInstalledPack: (): NodePack[] => []
    }
    return { useInstalledPacks: () => installedPacks }
  }
)

vi.mock(
  import('@/workbench/extensions/manager/composables/nodePack/useWorkflowPacks'),
  () => {
    const workflowPacks: ReturnType<typeof useWorkflowPacks> = {
      error: ref(null),
      isLoading: ref(false),
      isReady: ref(true),
      workflowPacks: ref<NodePack[]>([]),
      unresolvedNodeNames: ref<string[]>([]),
      startFetchWorkflowPacks: vi.fn(async () => {}),
      filterWorkflowPack: (packs: NodePack[]) => packs
    }
    return { useWorkflowPacks: () => workflowPacks }
  }
)

const { default: ManagerDialog } = await import('./ManagerDialog.vue')

const TIP = enMessages.manager.legacyManagerSearchTip
const SEARCH_DEBOUNCE_MS = 320

const BaseModalLayoutStub = defineComponent({
  setup(_, { slots }) {
    return () =>
      h('div', [slots.header?.(), slots.contentFilter?.(), slots.content?.()])
  }
})

const VirtualGridStub = defineComponent({
  props: { items: { type: Array as PropType<NodePack[]>, required: true } },
  setup(props) {
    return () =>
      h(
        'ul',
        props.items.map((pack) => h('li', pack.name))
      )
  }
})

const result = (
  nodePacks: NodePack[],
  rawResultsEmpty: boolean,
  hasMore = false
): SearchPacksResult => ({
  nodePacks,
  querySuggestions: [],
  hasMore,
  rawResultsEmpty
})

const LORA_MANAGER: NodePack = {
  id: 'comfyui-lora-manager',
  name: 'LoRA Manager'
}

function renderDialog(
  initialTab: ManagerTab = ManagerTab.All,
  initialPackId?: string
) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  render(ManagerDialog, {
    props: { initialTab, initialPackId, onClose: vi.fn() },
    global: {
      plugins: [i18n],
      stubs: {
        BaseModalLayout: BaseModalLayoutStub,
        VirtualGrid: VirtualGridStub,
        LeftSidePanel: true,
        InfoPanel: true,
        InfoPanelMultiItem: true,
        GridSkeleton: true,
        PackInstallButton: true,
        PackUpdateButton: true,
        UnresolvedNodesMessage: true
      }
    }
  })
  return { user, searchBox: screen.getByPlaceholderText('Search') }
}

async function settleSearch() {
  await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
}

describe('ManagerDialog legacy-manager tip', () => {
  function useNewManagerUI() {
    useManagerState().isNewManagerUI = computed(() => true)
  }

  it('shows the tip once, above the results, when a ComfyUI-Manager search finds nothing', async () => {
    useNewManagerUI()
    vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
      result([], true)
    )
    const { user, searchBox } = renderDialog()

    await user.type(searchBox, 'comfyui-manager')
    await settleSearch()

    expect(screen.getByRole('alert')).toHaveTextContent(TIP)
    expect(screen.getAllByText(TIP, { exact: false })).toHaveLength(1)
    expect(
      screen.getByText(enMessages.manager.tryDifferentSearch)
    ).toBeInTheDocument()
  })

  it('hides the tip in the legacy manager UI', async () => {
    vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
      result([], true)
    )
    const { user, searchBox } = renderDialog()

    await user.type(searchBox, 'comfyui-manager')
    await settleSearch()

    expect(screen.queryByText(TIP, { exact: false })).not.toBeInTheDocument()
  })

  it('hides the tip when the search box was cleared before the ComfyUI-Manager search returned', async () => {
    useNewManagerUI()
    let resolveSearch: (value: SearchPacksResult) => void = () => {}
    vi.mocked(useRegistrySearchGateway().searchPacks)
      .mockResolvedValueOnce(result([], false))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSearch = resolve
        })
      )
      .mockResolvedValue(result([], false))
    const { user, searchBox } = renderDialog()
    await settleSearch()

    await user.type(searchBox, 'comfyui-manager')
    await settleSearch()
    await user.clear(searchBox)
    await settleSearch()
    resolveSearch(result([], true))
    await settleSearch()

    expect(screen.queryByText(TIP, { exact: false })).not.toBeInTheDocument()
  })

  it('hides the tip while a ComfyUI-Manager search waits behind results for an earlier query', async () => {
    useNewManagerUI()
    vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
      result([{ id: 'comfyui-kjnodes', name: 'ComfyUI-KJNodes' }], true)
    )
    const { user, searchBox } = renderDialog()
    await user.type(searchBox, 'kijai/comfyui-kjnodes')
    await settleSearch()

    await user.clear(searchBox)
    await user.type(searchBox, 'comfyui-manager')

    expect(screen.getByText('ComfyUI-KJNodes')).toBeInTheDocument()
    expect(screen.queryByText(TIP, { exact: false })).not.toBeInTheDocument()
  })

  it('hides the tip on the unresolved-nodes tab', async () => {
    useNewManagerUI()
    useWorkflowPacks().unresolvedNodeNames.value = ['MysteryNode']
    onTestFinished(() => {
      useWorkflowPacks().unresolvedNodeNames.value = []
    })
    vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
      result([], true)
    )
    const { user, searchBox } = renderDialog(ManagerTab.Unresolved)

    await user.type(searchBox, 'comfyui-manager')
    await settleSearch()

    expect(screen.queryByText(TIP, { exact: false })).not.toBeInTheDocument()
  })

  it.for([
    { tab: ManagerTab.AllInstalled, tipCount: 1 },
    { tab: ManagerTab.All, tipCount: 0 }
  ])(
    'shows the tip $tipCount time(s) on the $tab tab when registry hits for a ComfyUI-Manager search exist',
    async ({ tab, tipCount }) => {
      useNewManagerUI()
      vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
        result([LORA_MANAGER], false)
      )
      const { user, searchBox } = renderDialog(tab)

      await user.type(searchBox, 'comfyui-manager')
      await settleSearch()

      expect(screen.queryAllByText(TIP, { exact: false })).toHaveLength(
        tipCount
      )
    }
  )

  it.for([
    'ltdrdata/ComfyUI-Manager',
    'https://github.com/ltdrdata/ComfyUI-Manager'
  ])(
    'hides the tip when a rewrite of %s shows the ComfyUI-Manager pack',
    async (query) => {
      useNewManagerUI()
      vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
        result([{ id: 'comfyui-manager', name: 'ComfyUI-Manager' }], true)
      )
      const { user, searchBox } = renderDialog()

      await user.type(searchBox, query)
      await settleSearch()

      expect(screen.getByText('ComfyUI-Manager')).toBeInTheDocument()
      expect(screen.queryByText(TIP, { exact: false })).not.toBeInTheDocument()
    }
  )

  it('hides the tip on the installed tab while the installed packs load', async () => {
    useNewManagerUI()
    const { isLoading } = useInstalledPacks()
    isLoading.value = true
    onTestFinished(() => {
      isLoading.value = false
    })
    vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
      result([LORA_MANAGER], false)
    )
    const { user, searchBox } = renderDialog(ManagerTab.AllInstalled)

    await user.type(searchBox, 'comfyui-manager')
    await settleSearch()

    expect(screen.queryByText(TIP, { exact: false })).not.toBeInTheDocument()
  })

  it('hides the tip on the installed tab when the manager API errored', async () => {
    useNewManagerUI()
    const { error } = useComfyManagerService()
    error.value = 'Manager unavailable'
    onTestFinished(() => {
      error.value = null
    })
    vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
      result([LORA_MANAGER], false)
    )
    const { user, searchBox } = renderDialog(ManagerTab.AllInstalled)

    await user.type(searchBox, 'comfyui-manager')
    await settleSearch()

    expect(
      screen.getByText(enMessages.manager.errorConnecting)
    ).toBeInTheDocument()
    expect(screen.queryByText(TIP, { exact: false })).not.toBeInTheDocument()
  })

  it('hides the tip on the installed tab while more result pages can still load', async () => {
    useNewManagerUI()
    vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
      result([LORA_MANAGER], false, true)
    )
    const { user, searchBox } = renderDialog(ManagerTab.AllInstalled)

    await user.type(searchBox, 'comfyui-manager')
    await settleSearch()

    expect(screen.queryByText(TIP, { exact: false })).not.toBeInTheDocument()
  })
})

describe('ManagerDialog search analytics tags', () => {
  const searchedTags = () =>
    vi
      .mocked(useRegistrySearchGateway().searchPacks)
      .mock.calls.map(([query, params]) => [query, params.analyticsTags])

  it('tags only the search the user typed, not the listing shown on open', async () => {
    vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
      result([], false)
    )
    const { user, searchBox } = renderDialog()
    await settleSearch()

    await user.type(searchBox, 'gguf')
    await settleSearch()

    expect(searchedTags()).toEqual([
      ['', undefined],
      ['gguf', ['user']]
    ])
  })

  it('leaves the deep-link pack search untagged until the user edits it', async () => {
    vi.mocked(useRegistrySearchGateway().searchPacks).mockResolvedValue(
      result([], false)
    )
    const { user, searchBox } = renderDialog(ManagerTab.All, 'comfyui-kjnodes')
    await settleSearch()

    await user.type(searchBox, '2')
    await settleSearch()

    expect(searchedTags()).toEqual([
      ['comfyui-kjnodes', undefined],
      ['comfyui-kjnodes2', ['user']]
    ])
  })
})
