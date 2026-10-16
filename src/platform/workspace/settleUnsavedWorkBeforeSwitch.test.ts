import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { NOTHING_DISCARDED } from '@/platform/workspace/deploymentSwitchReload'
import { useDialogService } from '@/services/dialogService'

import { settleUnsavedWorkBeforeSwitch } from './settleUnsavedWorkBeforeSwitch'

vi.mock(import('@/services/dialogService'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))

const SAVED_STATE = fromPartial<ComfyWorkflowJSON>({ nodes: [] })

function unsaved(filename: string) {
  return fromPartial<ComfyWorkflow>({
    path: `workflows/${filename}.json`,
    key: `${filename}.json`,
    filename,
    isLoaded: true,
    isModified: true,
    activeState: SAVED_STATE,
    content: JSON.stringify(SAVED_STATE),
    changeTracker: { initialState: SAVED_STATE }
  })
}

const closedWithoutSaving = fromPartial<ComfyWorkflow>({
  path: 'workflows/closed.json',
  key: 'closed.json',
  isLoaded: false,
  isModified: true,
  activeState: null,
  content: null
})

const portrait = unsaved('portrait')
const upscale = unsaved('upscale')
const sketch = unsaved('sketch')
const DROPPED = JSON.stringify(SAVED_STATE)

function savedWorkflows() {
  return vi
    .mocked(useWorkflowService().saveWorkflow)
    .mock.calls.map(([workflow]) => workflow)
}

describe('settleUnsavedWorkBeforeSwitch', () => {
  beforeEach(() => {
    for (const workflow of [portrait, upscale, sketch]) {
      Object.assign(workflow, {
        isLoaded: true,
        activeState: SAVED_STATE,
        isModified: workflow !== sketch,
        changeTracker: { initialState: SAVED_STATE }
      })
    }
    Object.assign(useWorkflowStore(), {
      modifiedWorkflows: [portrait, closedWithoutSaving, upscale, sketch],
      activeWorkflow: null,
      getWorkflowByPath: (path: string) =>
        [portrait, upscale, sketch].find((open) => open.path === path) ?? null
    })
    vi.mocked(useWorkflowService().saveWorkflow).mockImplementation(
      async (workflow) => {
        workflow.isModified = false
        return true
      }
    )
  })

  it('goes on without asking when nothing is unsaved', async () => {
    Object.assign(useWorkflowStore(), { modifiedWorkflows: [] })

    expect(await settleUnsavedWorkBeforeSwitch('Comfy Cloud')).toBe(
      NOTHING_DISCARDED
    )
    expect(useDialogService().confirm).not.toHaveBeenCalled()
  })

  it.for([
    {
      persist: true,
      hint: 'Your open tabs come back after the reload either way.'
    },
    { persist: false, hint: undefined }
  ])(
    'names where it switches to and each unsaved workflow; keeps drafts: $persist',
    async ({ persist, hint }) => {
      useSettingStore().$patch({
        settingValues: { 'Comfy.Workflow.Persist': persist }
      })

      await settleUnsavedWorkBeforeSwitch("Studio's Build · R&D")

      expect(useDialogService().confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Save your workflows before switching?',
          message:
            "Switching to Studio's Build · R&D reloads the tab. These workflows have changes that aren't saved yet.",
          itemList: ['portrait.json', 'upscale.json'],
          hint,
          denyLabel: 'Switch without saving',
          confirmLabel: 'Save and switch'
        })
      )
    }
  )

  it('stays put on Cancel', async () => {
    vi.mocked(useDialogService().confirm).mockResolvedValueOnce(null)

    expect(await settleUnsavedWorkBeforeSwitch('Comfy Cloud')).toBeNull()
    expect(savedWorkflows()).toEqual([])
  })

  it('drops each unsaved workflow as it is now on Switch without saving', async () => {
    vi.mocked(useDialogService().confirm).mockResolvedValueOnce(false)

    expect(await settleUnsavedWorkBeforeSwitch('Comfy Cloud')).toEqual(
      new Map([
        [portrait, DROPPED],
        [upscale, DROPPED]
      ])
    )
    expect(savedWorkflows()).toEqual([])
  })

  it('saves every unsaved workflow and drops nothing on Save and switch', async () => {
    vi.mocked(useDialogService().confirm).mockResolvedValueOnce(true)

    expect(await settleUnsavedWorkBeforeSwitch('Comfy Cloud')).toBe(
      NOTHING_DISCARDED
    )
    expect(savedWorkflows()).toEqual([portrait, upscale])
  })

  it('counts edits the open workflow has not captured yet', async () => {
    Object.assign(useWorkflowStore(), {
      activeWorkflow: {
        changeTracker: {
          prepareForSave: () => {
            sketch.isModified = true
          }
        }
      }
    })
    vi.mocked(useDialogService().confirm).mockResolvedValueOnce(null)

    await settleUnsavedWorkBeforeSwitch('Comfy Cloud')

    expect(useDialogService().confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        itemList: ['portrait.json', 'upscale.json', 'sketch.json']
      })
    )
  })

  it('skips a workflow closed while an earlier one saves', async () => {
    vi.mocked(useDialogService().confirm).mockResolvedValueOnce(true)
    vi.mocked(useWorkflowService().saveWorkflow).mockImplementationOnce(
      async (workflow) => {
        workflow.isModified = false
        Object.assign(upscale, { isLoaded: false, activeState: null })
        return true
      }
    )

    expect(await settleUnsavedWorkBeforeSwitch('Comfy Cloud')).toBe(
      NOTHING_DISCARDED
    )
    expect(savedWorkflows()).toEqual([portrait])
  })

  it('asks about a workflow first edited while the saves ran', async () => {
    vi.mocked(useDialogService().confirm)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(null)
    vi.mocked(useWorkflowService().saveWorkflow).mockImplementationOnce(
      async (workflow) => {
        workflow.isModified = false
        sketch.isModified = true
        return true
      }
    )

    expect(await settleUnsavedWorkBeforeSwitch('Comfy Cloud')).toBeNull()
    expect(useDialogService().confirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ itemList: ['sketch.json'] })
    )
  })

  it('asks again about a workflow edited while its save was in flight', async () => {
    const editedDuringSave = fromPartial<ComfyWorkflowJSON>({
      nodes: [],
      extra: { edited: true }
    })
    vi.mocked(useDialogService().confirm)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(null)
    vi.mocked(useWorkflowService().saveWorkflow).mockImplementationOnce(
      async (workflow) => {
        Object.assign(workflow, {
          activeState: editedDuringSave,
          isModified: false,
          changeTracker: { initialState: editedDuringSave }
        })
        return true
      }
    )

    expect(await settleUnsavedWorkBeforeSwitch('Comfy Cloud')).toBeNull()
    expect(useDialogService().confirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ itemList: ['portrait.json'] })
    )
    expect(portrait.isModified).toBe(true)
    expect(portrait.changeTracker?.initialState).toEqual(SAVED_STATE)
  })

  it('keeps an edit made during a save unsaved even when a later save fails', async () => {
    const editedDuringSave = fromPartial<ComfyWorkflowJSON>({
      nodes: [],
      extra: { edited: true }
    })
    vi.mocked(useDialogService().confirm).mockResolvedValueOnce(true)
    vi.mocked(useWorkflowService().saveWorkflow)
      .mockImplementationOnce(async (workflow) => {
        Object.assign(workflow, {
          activeState: editedDuringSave,
          isModified: false,
          changeTracker: { initialState: editedDuringSave }
        })
        return true
      })
      .mockRejectedValueOnce(new Error('Disk full'))

    expect(await settleUnsavedWorkBeforeSwitch('Comfy Cloud')).toBeNull()
    expect(portrait.isModified).toBe(true)
    expect(portrait.changeTracker?.initialState).toEqual(SAVED_STATE)
  })

  it.for([
    { when: 'its save is cancelled', save: () => Promise.resolve(false) },
    {
      when: 'its save fails',
      save: () => Promise.reject(new Error('Disk full'))
    }
  ])('stays put at the first workflow when $when', async ({ save }) => {
    vi.mocked(useDialogService().confirm).mockResolvedValueOnce(true)
    vi.mocked(useWorkflowService().saveWorkflow).mockImplementationOnce(save)

    expect(await settleUnsavedWorkBeforeSwitch('Comfy Cloud')).toBeNull()
    expect(savedWorkflows()).toEqual([portrait])
  })
})
