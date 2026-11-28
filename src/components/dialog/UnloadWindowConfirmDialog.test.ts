import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  bindCanvasTracker,
  resetCanvasTrackerForTest
} from '@/platform/workflow/core/canvasTrackerOwnership'
import { safeLocalStorage } from '@/base/storage/safeStorage'
import { useSettingStore } from '@/platform/settings/settingStore'
import {
  skipLeavePromptOnce,
  takeLeavePromptSkip
} from '@/platform/workflow/management/leavePrompt'
import type { WorkflowChangeTracker } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { MAX_DRAFTS } from '@/platform/workflow/persistence/base/draftTypes'
import { resetStorageAvailable } from '@/platform/workflow/persistence/base/storageIO'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { useWorkflowDraftStoreV2 } from '@/platform/workflow/persistence/stores/workflowDraftStoreV2'
import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'
import { blankGraph } from '@/scripts/defaultGraph'

import UnloadWindowConfirmDialog from './UnloadWindowConfirmDialog.vue'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/scripts/api'))

const portrait = fromPartial<ComfyWorkflow>({
  path: 'portrait.json',
  isModified: true
})

function leavePage() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event
}

function seedRecoveryDrafts(workflows: ComfyWorkflow[]) {
  const store = useWorkflowDraftStoreV2()
  for (const workflow of workflows)
    store.saveDraft(workflow.path, JSON.stringify(blankGraph), {
      name: workflow.key,
      isTemporary: true
    })
}

describe('UnloadWindowConfirmDialog', () => {
  beforeEach(() => {
    takeLeavePromptSkip()
    useSettingStore().$patch({
      settingValues: { 'Comfy.Window.UnloadConfirmation': true }
    })
    Object.assign(useWorkflowStore(), { modifiedWorkflows: [portrait] })
  })

  it.for([
    {
      when: 'with unsaved work',
      unsaved: [portrait],
      setting: true,
      asks: true
    },
    { when: 'with nothing unsaved', unsaved: [], setting: true, asks: false },
    {
      when: 'with the setting off',
      unsaved: [portrait],
      setting: false,
      asks: false
    }
  ])('asks before leaving $when: $asks', ({ unsaved, setting, asks }) => {
    useSettingStore().$patch({
      settingValues: { 'Comfy.Window.UnloadConfirmation': setting }
    })
    Object.assign(useWorkflowStore(), { modifiedWorkflows: unsaved })
    render(UnloadWindowConfirmDialog)

    expect(leavePage().defaultPrevented).toBe(asks)
  })

  it('lets exactly one unload go without asking after a skip', () => {
    render(UnloadWindowConfirmDialog)
    skipLeavePromptOnce()

    expect(leavePage().defaultPrevented).toBe(false)
    expect(leavePage().defaultPrevented).toBe(true)
  })

  it('asks again once a skip is taken back', () => {
    render(UnloadWindowConfirmDialog)
    const keepLeavePrompt = skipLeavePromptOnce()
    keepLeavePrompt()

    expect(leavePage().defaultPrevented).toBe(true)
  })

  describe('workflow recovery', () => {
    beforeEach(() => {
      resetStorageAvailable()
      resetCanvasTrackerForTest()
      useSettingStore().settingValues['Comfy.Workflow.Persist'] = true
      api.clientId = 'recovery-client'
      api.initialClientId = 'recovery-client'
      const active = fromPartial<ComfyWorkflow>({
        path: 'workflows/active.json',
        key: 'active.json',
        isModified: true,
        isTemporary: true,
        lastModified: 0,
        changeTracker: fromPartial<WorkflowChangeTracker>({
          hasPreview: false
        }),
        activeState: structuredClone(blankGraph)
      })
      Object.assign(useWorkflowStore(), {
        activeWorkflow: active,
        openWorkflows: [active],
        modifiedWorkflows: [active]
      })
      const graph = useApp().rootGraph.serialize()
      vi.spyOn(useApp().rootGraph, 'serialize').mockReturnValue({
        ...graph,
        extra: { marker: 'latest edit, not the tracker snapshot' }
      })
    })

    it.for([false, true])(
      'checkpoints recovery with preview active: %s',
      (hasPreview) => {
        const active = useWorkflowStore().activeWorkflow
        expect(active).toBeDefined()
        if (active)
          active.changeTracker = fromPartial<WorkflowChangeTracker>({
            hasPreview
          })
        render(UnloadWindowConfirmDialog)

        expect(leavePage().defaultPrevented).toBe(false)

        const draft = useWorkflowDraftStoreV2().getDraft(
          'workflows/active.json'
        )
        expect(JSON.parse(draft?.data ?? 'null')?.extra).toEqual(
          hasPreview
            ? blankGraph.extra
            : { marker: 'latest edit, not the tracker snapshot' }
        )
        expect(useWorkflowStore().activeWorkflow?.isModified).toBe(true)
        expect(
          JSON.parse(
            localStorage.getItem(StorageKeys.lastOpenPaths('personal')) ??
              'null'
          )
        ).toEqual({
          workspaceId: 'personal',
          paths: ['workflows/active.json'],
          activeIndex: 0
        })
      }
    )

    it.for([
      { damage: 'none', lastModified: 0, asks: false },
      { damage: 'stored viewport', lastModified: 0, asks: false },
      { damage: 'missing payload', lastModified: 0, asks: true },
      { damage: 'missing index', lastModified: 0, asks: true },
      { damage: 'stale content', lastModified: 0, asks: true },
      { damage: 'marked clean', lastModified: 0, asks: true },
      {
        damage: 'older than saved file',
        lastModified: Number.MAX_SAFE_INTEGER,
        asks: true
      }
    ] as const)(
      'checks inactive edits against persisted recovery data: $damage',
      ({ damage, lastModified, asks }) => {
        const viewport: { scale: number; offset: [number, number] } = {
          scale: 0.7,
          offset: [10, -20]
        }
        const inactive = fromPartial<ComfyWorkflow>({
          path: 'workflows/inactive.json',
          key: 'inactive.json',
          isModified: true,
          isTemporary: false,
          lastModified,
          activeState: structuredClone(blankGraph),
          changeTracker: fromPartial<WorkflowChangeTracker>({ ds: structuredClone(viewport) })
        })
        const active = useWorkflowStore().activeWorkflow
        Object.assign(useWorkflowStore(), {
          openWorkflows: [inactive, active],
          modifiedWorkflows: [inactive, active]
        })
        const draftStore = useWorkflowDraftStoreV2()
        draftStore.saveDraft(inactive.path, JSON.stringify(blankGraph), {
          name: inactive.key,
          isTemporary: false
        })
        const payloadKey = StorageKeys.draftPayload(inactive.path, 'personal')
        const damageDraft = {
          none: () => undefined,
          'stored viewport': () => {
            useSettingStore().settingValues['Comfy.EnableWorkflowViewRestore'] =
              true
            draftStore.saveDraft(
              inactive.path,
              JSON.stringify({
                ...blankGraph,
                extra: { ...blankGraph.extra, ds: viewport }
              }),
              { name: inactive.key, isTemporary: false }
            )
          },

          'missing payload': () => localStorage.removeItem(payloadKey),
          'missing index': () => {
            const getItem = localStorage.getItem.bind(localStorage)
            vi.spyOn(localStorage, 'getItem').mockImplementation((key) =>
              key === StorageKeys.draftIndex('personal') ? null : getItem(key)
            )
          },
          'stale content': () =>
            localStorage.setItem(
              payloadKey,
              JSON.stringify({
                data: JSON.stringify({
                  ...blankGraph,
                  extra: { marker: 'older edit' }
                }),
                updatedAt: Date.now()
              })
            ),
          'marked clean': () => {
            draftStore.saveDraft(inactive.path, JSON.stringify(blankGraph), {
              name: inactive.key,
              isTemporary: false,
              isModified: false
            })
          },
          'older than saved file': () => undefined
        }
        damageDraft[damage]()
        render(UnloadWindowConfirmDialog)

        expect(leavePage().defaultPrevented).toBe(asks)
      }
    )

    it.for([
      {
        storage: 'localStorage',
        prefix: StorageKeys.prefixes.draftPayload,
        asks: true
      },
      {
        storage: 'localStorage',
        prefix: StorageKeys.prefixes.draftIndex,
        asks: true
      },
      {
        storage: 'localStorage',
        prefix: StorageKeys.prefixes.lastOpenPaths,
        asks: true
      },
      {
        storage: 'sessionStorage',
        prefix: StorageKeys.prefixes.openPaths,
        asks: false
      }
    ] as const)(
      'checks recovery when $storage cannot write $prefix: $asks',
      ({ storage, prefix, asks }) => {
        const target = window[storage]
        const setItem = target.setItem.bind(target)
        vi.spyOn(target, 'setItem').mockImplementation((key, value) => {
          if (key.startsWith(prefix))
            throw new DOMException('Blocked', 'SecurityError')
          setItem(key, value)
        })
        render(UnloadWindowConfirmDialog)

        expect(leavePage().defaultPrevented).toBe(asks)
      }
    )

    it.for(['QuotaExceededError', 'SecurityError'])(
      'keeps the previous active draft when its checkpoint index write fails with %s',
      (errorName) => {
        const store = useWorkflowDraftStoreV2()
        const path = 'workflows/active.json'
        store.saveDraft(path, JSON.stringify(blankGraph), {
          name: 'active.json',
          isTemporary: true
        })
        const payloadKey = StorageKeys.draftPayload(path, 'personal')
        const previousPayload = localStorage.getItem(payloadKey)
        const setItem = localStorage.setItem.bind(localStorage)
        vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
          if (key === StorageKeys.draftIndex('personal'))
            throw new DOMException('Blocked', errorName)
          setItem(key, value)
        })
        render(UnloadWindowConfirmDialog)

        expect(leavePage().defaultPrevented).toBe(true)
        expect(localStorage.getItem(payloadKey)).toBe(previousPayload)
      }
    )

    it('keeps inactive recovery drafts when checkpointing fails at quota', () => {
      const count = 2
      const inactive = Array.from({ length: count }, (_, index) =>
        fromPartial<ComfyWorkflow>({
          path: `workflows/inactive${index}.json`,
          key: `inactive${index}.json`,
          isModified: true,
          isTemporary: true,
          lastModified: 0,
          activeState: structuredClone(blankGraph)
        })
      )
      seedRecoveryDrafts(inactive)
      const active = useWorkflowStore().activeWorkflow
      Object.assign(useWorkflowStore(), {
        openWorkflows: [...inactive, active],
        modifiedWorkflows: [...inactive, active]
      })
      const indexKey = StorageKeys.draftIndex('personal')
      const previousIndex = localStorage.getItem(indexKey)
      const previousPayloads = inactive.map((workflow) =>
        localStorage.getItem(
          StorageKeys.draftPayload(workflow.path, 'personal')
        )
      )
      const setItem = localStorage.setItem.bind(localStorage)
      vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
        if (
          key === StorageKeys.draftPayload('workflows/active.json', 'personal')
        )
          throw new DOMException('Full', 'QuotaExceededError')
        setItem(key, value)
      })
      render(UnloadWindowConfirmDialog)

      expect(leavePage().defaultPrevented).toBe(true)
      expect(localStorage.getItem(indexKey)).toBe(previousIndex)
      expect(
        inactive.map((workflow) =>
          localStorage.getItem(
            StorageKeys.draftPayload(workflow.path, 'personal')
          )
        )
      ).toEqual(previousPayloads)
    })

    it('checkpoints a new active draft beyond the legacy capacity', () => {
      const inactive = Array.from({ length: MAX_DRAFTS }, (_, index) =>
        fromPartial<ComfyWorkflow>({
          path: `workflows/inactive${index}.json`,
          key: `inactive${index}.json`,
          isModified: true,
          isTemporary: true,
          lastModified: 0,
          activeState: structuredClone(blankGraph)
        })
      )
      seedRecoveryDrafts(inactive)
      const active = useWorkflowStore().activeWorkflow
      Object.assign(useWorkflowStore(), {
        openWorkflows: [...inactive, active],
        modifiedWorkflows: [...inactive, active]
      })
      render(UnloadWindowConfirmDialog)

      expect(leavePage().defaultPrevented).toBe(false)
      expect(
        useWorkflowDraftStoreV2().getDraft('workflows/active.json')
      ).not.toBeNull()
    })

    it('warns without replacing a draft when another workflow owns the canvas', () => {
      const store = useWorkflowDraftStoreV2()
      store.saveDraft('workflows/active.json', JSON.stringify(blankGraph), {
        name: 'active.json',
        isTemporary: true
      })
      bindCanvasTracker({})
      render(UnloadWindowConfirmDialog)

      expect(leavePage().defaultPrevented).toBe(true)
      expect(
        store.getDraft('workflows/active.json', { fresh: true })?.data
      ).toBe(JSON.stringify(blankGraph))
    })

    it('warns when drafts can only survive within the browser session', () => {
      const backend = vi
        .spyOn(safeLocalStorage, 'backend', 'get')
        .mockReturnValue('sessionStorage')
      try {
        render(UnloadWindowConfirmDialog)
        expect(leavePage().defaultPrevented).toBe(true)
      } finally {
        backend.mockRestore()
      }
    })

    it('warns when draft persistence is disabled', () => {
      useSettingStore().settingValues['Comfy.Workflow.Persist'] = false
      render(UnloadWindowConfirmDialog)

      expect(leavePage().defaultPrevented).toBe(true)
    })

    it('warns when the active graph cannot be serialized', () => {
      vi.mocked(useApp().rootGraph.serialize).mockImplementation(() => {
        throw new Error('Extension serializer failed')
      })
      render(UnloadWindowConfirmDialog)

      expect(leavePage().defaultPrevented).toBe(true)
    })
  })
})
