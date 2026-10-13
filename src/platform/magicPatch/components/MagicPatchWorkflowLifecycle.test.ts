import type {
  CloudNodeRegistry,
  CloudNodeRegistryRevision
} from '@comfyorg/ingest-types'
import { cleanup, render, waitFor } from '@testing-library/vue'
import type * as VueUseCore from '@vueuse/core'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import {
  notifyWorkflowLoaded,
  resetAppReadyForTest
} from '@/platform/nodeApi/appReady'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useMagicPatchBatchStore } from '../stores/magicPatchBatchStore'
import MagicPatchProgressBar from './MagicPatchProgressBar.vue'

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  show: vi.fn(),
  close: vi.fn(),
  fetch: vi.fn(),
  serialize: vi.fn(),
  surfaceMissingNodes: vi.fn(() => false)
}))
const scope = ref<string | null>('owner')
const catalog = ref<CloudNodeRegistry | null>(null)
const workflow = reactive<{ activeWorkflow: { pendingWarnings: null } | null }>(
  {
    activeWorkflow: { pendingWarnings: null }
  }
)

vi.mock('@/scripts/api', () => ({ api: { fetchApi: mocks.fetch } }))
vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: { serialize: mocks.serialize },
    reloadNodeDefs: vi.fn()
  }
}))
vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))
vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => ({}) }))
vi.mock('@/platform/customNodes/composables/useNodeAccountScope', () => ({
  useNodeAccountScope: () => ({
    scope: computed(() => scope.value),
    capture: () => scope.value,
    current: (owner: string | null) => owner !== null && owner === scope.value
  })
}))
vi.mock('@/platform/customNodes/composables/useCloudNodeRegistry', () => ({
  useCloudNodeRegistry: () => ({
    catalog,
    load: mocks.load,
    setPin: vi.fn()
  })
}))
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => workflow,
  ComfyWorkflow: vi.fn()
}))
vi.mock('@/platform/nodeReplacement/missingNodesErrorStore', () => ({
  useMissingNodesErrorStore: () => ({
    missingNodesError: null,
    surfaceMissingNodes: mocks.surfaceMissingNodes
  })
}))
vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({ nodeDefsByName: { RandomNumber: {} } })
}))
vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog: mocks.show, closeDialog: mocks.close })
}))
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof VueUseCore>()),
  useDocumentVisibility: () => ref('visible'),
  useOnline: () => ref(true),
  useIntervalFn: vi.fn()
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: vi.fn() })
}))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: vi.fn() })
}))
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({})
}))
vi.mock('@/renderer/core/thumbnail/useWorkflowThumbnail', () => ({
  useWorkflowThumbnail: () => ({})
}))
vi.mock('@/stores/domWidgetStore', () => ({ useDomWidgetStore: () => ({}) }))
vi.mock('@/platform/workflow/persistence/stores/workflowDraftStoreV2', () => ({
  useWorkflowDraftStoreV2: () => ({})
}))
vi.mock('@/stores/executionErrorStore', () => ({
  useExecutionErrorStore: () => ({ showErrorOverlay: vi.fn() })
}))
vi.mock('@/stores/nodeOutputStore', () => ({ useNodeOutputStore: () => ({}) }))
vi.mock('@/stores/subgraphNavigationStore', () => ({
  useSubgraphNavigationStore: () => ({})
}))
vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({ workflow })
}))
vi.mock('@/stores/appModeStore', () => ({ useAppModeStore: () => ({}) }))
vi.mock('@/composables/useAppMode', () => ({ useAppMode: () => ({}) }))
vi.mock('@/platform/missingModel/missingModelStore', () => ({
  useMissingModelStore: () => ({})
}))
vi.mock('@/platform/missingMedia/missingMediaStore', () => ({
  useMissingMediaStore: () => ({})
}))

const original: CloudNodeRegistryRevision = {
  pack_id: 'comfyui_randomnumbers/x6370e23',
  revision_id:
    'd7cc20c485feac0a31c6a78af9606b5d0a0001950b62b169245349834c6f834a',
  name: 'RandomNumbers',
  upstream_commit: '6370e235b2fc61a8c8118a6a79d433199d85d243',
  source_sha256: 'a'.repeat(64),
  manifest_sha256: 'b'.repeat(64),
  dependency_profile_sha256: 'c'.repeat(64),
  node_api_version: 1,
  nodes: ['RandomNumber'],
  account_owned: true,
  pinned: false,
  prepared: false
}
const sourceNode = {
  id: 1,
  type: 'RandomNumber',
  properties: { cnr_id: original.pack_id, ver: original.revision_id },
  widgets_values: [7]
}
function registry(revisions: CloudNodeRegistryRevision[]): CloudNodeRegistry {
  return { corpus_commit: 'test', pins: [], revisions }
}
function importCompletedWorkflow() {
  notifyWorkflowLoaded()
  useWorkflowService().showPendingWarnings()
}
let batch: ReturnType<typeof useMagicPatchBatchStore> | undefined
function mountGlobalCoordinator() {
  render(MagicPatchProgressBar, {
    global: {
      plugins: [
        createPinia(),
        createI18n({ legacy: false, locale: 'en', messages: { en } })
      ]
    }
  })
  batch = useMagicPatchBatchStore()
  return batch
}

beforeEach(() => {
  resetAppReadyForTest()
  setActivePinia(createPinia())
  scope.value = 'owner'
  catalog.value = null
  workflow.activeWorkflow = { pendingWarnings: null }
  mocks.load.mockResolvedValue(true)
  mocks.serialize.mockReturnValue({ nodes: [sourceNode] })
})
afterEach(() => {
  cleanup()
  batch?.$dispose()
  batch = undefined
})

describe('globally mounted workflow pack consent', () => {
  it('offers a known V1 pack after a clean import without a missing-node card', async () => {
    catalog.value = registry([original])
    const store = mountGlobalCoordinator()
    expect(mocks.serialize).not.toHaveBeenCalled()
    expect(mocks.show).not.toHaveBeenCalled()

    importCompletedWorkflow()

    await waitFor(() =>
      expect(mocks.show).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'magic-patch-consent',
          title: en.magicPatch.batchTitle
        })
      )
    )
    expect(mocks.surfaceMissingNodes).toHaveBeenCalledWith([])
    expect(workflow.activeWorkflow?.pendingWarnings).toBeNull()
    expect(store.candidates).toEqual([original])
    expect(store.jobs).toEqual([])
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('uses the latest graph when the catalogue arrives and offers only once after dismissal', async () => {
    let finishLoad: ((loaded: boolean) => void) | undefined
    mocks.load.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (finishLoad = resolve))
    )
    const store = mountGlobalCoordinator()
    importCompletedWorkflow()
    expect(mocks.show).not.toHaveBeenCalled()

    const editedGraph = {
      nodes: [{ ...sourceNode, widgets_values: [42] }],
      extra: { editedWhileCatalogueLoaded: true }
    }
    mocks.serialize.mockReturnValue(editedGraph)
    catalog.value = registry([original])
    finishLoad?.(true)
    await waitFor(() => expect(mocks.show).toHaveBeenCalledOnce())
    expect(store.originalGraph).toEqual(editedGraph)

    store.dismissConsent()
    useWorkflowService().showPendingWarnings()
    catalog.value = registry([{ ...original }])
    await nextTick()
    expect(store.consentOpen).toBe(false)
    expect(mocks.show).toHaveBeenCalledOnce()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('refuses a stale import while a replacement document loads and skips its native V2 pack', async () => {
    let finishLoad: ((loaded: boolean) => void) | undefined
    mocks.load.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (finishLoad = resolve))
    )
    const store = mountGlobalCoordinator()
    importCompletedWorkflow()

    const native = {
      ...original,
      node_api_version: 2
    } satisfies CloudNodeRegistryRevision
    workflow.activeWorkflow = { pendingWarnings: null }
    mocks.serialize.mockReturnValue({ nodes: [sourceNode] })
    notifyWorkflowLoaded()
    catalog.value = registry([original])
    finishLoad?.(true)
    await nextTick()
    expect(store.consentOpen).toBe(false)

    catalog.value = registry([native])
    useWorkflowService().showPendingWarnings()
    await nextTick()
    expect(store.candidates).toEqual([])
    expect(mocks.show).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('discards pending catalogue discovery when the account scope changes', async () => {
    let finishLoad: ((loaded: boolean) => void) | undefined
    mocks.load.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (finishLoad = resolve))
    )
    const store = mountGlobalCoordinator()
    importCompletedWorkflow()

    scope.value = 'different-owner'
    catalog.value = registry([original])
    finishLoad?.(true)
    await nextTick()
    expect(store.consentOpen).toBe(false)
    expect(store.candidates).toEqual([])
    expect(mocks.show).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
