import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useDialogService } from '@/services/dialogService'

import { confirmUnsavedWorkBeforeSwitch } from './confirmUnsavedWorkBeforeSwitch'

vi.mock(import('@/services/dialogService'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))

function unsaved(filename: string, isLoaded = true) {
  return fromPartial<ComfyWorkflow>({
    path: `workflows/${filename}.json`,
    isLoaded,
    isModified: true
  })
}

const portrait = unsaved('portrait')
const upscale = unsaved('upscale')
const closedWithoutSaving = unsaved('closed', false)

function savedWorkflows() {
  return vi
    .mocked(useWorkflowService().saveWorkflow)
    .mock.calls.map(([workflow]) => workflow)
}

describe('confirmUnsavedWorkBeforeSwitch', () => {
  beforeEach(() => {
    Object.assign(useWorkflowStore(), {
      modifiedWorkflows: [portrait, closedWithoutSaving, upscale]
    })
    vi.mocked(useWorkflowService().saveWorkflow).mockResolvedValue(true)
  })

  it('goes on without asking when nothing is unsaved', async () => {
    Object.assign(useWorkflowStore(), { modifiedWorkflows: [] })

    expect(await confirmUnsavedWorkBeforeSwitch('Comfy Cloud')).toBe(true)
    expect(useDialogService().confirm).not.toHaveBeenCalled()
  })

  it.for([
    {
      persist: true,
      hint: 'Your open tabs come back after the reload either way.'
    },
    { persist: false, hint: undefined }
  ])(
    'names where it switches to and each open unsaved workflow; keeps drafts: $persist',
    async ({ persist, hint }) => {
      useSettingStore().$patch({
        settingValues: { 'Comfy.Workflow.Persist': persist }
      })

      await confirmUnsavedWorkBeforeSwitch("Studio's Build · R&D")

      expect(useDialogService().confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dirtyClose',
          title: 'Save your workflows before switching?',
          message:
            "Switching to Studio's Build · R&D reloads the tab. These workflows have changes that aren't saved yet.",
          itemList: ['workflows/portrait.json', 'workflows/upscale.json'],
          hint,
          denyLabel: 'Switch without saving',
          confirmLabel: 'Save and switch'
        })
      )
    }
  )

  it.for([
    { choice: 'Cancel', answer: null, goesOn: false, saved: [] },
    {
      choice: 'Switch without saving',
      answer: false,
      goesOn: true,
      saved: []
    },
    {
      choice: 'Save and switch',
      answer: true,
      goesOn: true,
      saved: [portrait, upscale]
    }
  ] satisfies {
    choice: string
    answer: boolean | null
    goesOn: boolean
    saved: ComfyWorkflow[]
  }[])('on $choice goes on: $goesOn', async ({ answer, goesOn, saved }) => {
    vi.mocked(useDialogService().confirm).mockResolvedValueOnce(answer)

    expect(await confirmUnsavedWorkBeforeSwitch('Comfy Cloud')).toBe(goesOn)
    expect(savedWorkflows()).toEqual(saved)
  })

  it.for([
    { failure: 'is cancelled', save: () => Promise.resolve(false) },
    {
      failure: 'throws',
      save: () => Promise.reject(new Error('Disk full'))
    }
  ])('stays put and stops saving when a save $failure', async ({ save }) => {
    vi.mocked(useDialogService().confirm).mockResolvedValueOnce(true)
    vi.mocked(useWorkflowService().saveWorkflow).mockImplementationOnce(save)

    expect(await confirmUnsavedWorkBeforeSwitch('Comfy Cloud')).toBe(false)
    expect(savedWorkflows()).toEqual([portrait])
  })
})
