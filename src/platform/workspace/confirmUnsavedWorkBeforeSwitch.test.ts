import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { showUnsavedWorkDialog } from '@/platform/workspace/showUnsavedWorkDialog'

import { confirmUnsavedWorkBeforeSwitch } from './confirmUnsavedWorkBeforeSwitch'

vi.mock(import('@/platform/workspace/showUnsavedWorkDialog'))
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
    expect(showUnsavedWorkDialog).not.toHaveBeenCalled()
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

      expect(showUnsavedWorkDialog).toHaveBeenCalledWith(
        expect.objectContaining({
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

  it('names a reload, not a switch, when it asks before a reload', async () => {
    await confirmUnsavedWorkBeforeSwitch('lora-stack-demo', { reload: true })

    expect(showUnsavedWorkDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Save your workflows before reloading?',
        message:
          "Reloading the tab runs it on lora-stack-demo. These workflows have changes that aren't saved yet.",
        itemList: ['workflows/portrait.json', 'workflows/upscale.json'],
        denyLabel: 'Reload without saving',
        confirmLabel: 'Save and reload'
      })
    )
  })

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
    vi.mocked(showUnsavedWorkDialog).mockResolvedValueOnce(answer)

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
    vi.mocked(showUnsavedWorkDialog).mockResolvedValueOnce(true)
    vi.mocked(useWorkflowService().saveWorkflow).mockImplementationOnce(save)

    expect(await confirmUnsavedWorkBeforeSwitch('Comfy Cloud')).toBe(false)
    expect(savedWorkflows()).toEqual([portrait])
  })

  it('stays put on a second ask while the first is still asking', async () => {
    let answer: (result: boolean) => void = () => {}
    vi.mocked(showUnsavedWorkDialog).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve
      })
    )

    const first = confirmUnsavedWorkBeforeSwitch('Comfy Cloud')
    const second = confirmUnsavedWorkBeforeSwitch('Comfy Cloud')
    answer(true)

    expect(await second).toBe(false)
    expect(await first).toBe(true)
    expect(showUnsavedWorkDialog).toHaveBeenCalledOnce()
    expect(savedWorkflows()).toEqual([portrait, upscale])
  })

  it('stays put on a second ask while the first is still saving', async () => {
    vi.mocked(showUnsavedWorkDialog).mockResolvedValueOnce(true)
    let finishSave: (saved: boolean) => void = () => {}
    vi.mocked(useWorkflowService().saveWorkflow).mockReturnValueOnce(
      new Promise((resolve) => {
        finishSave = resolve
      })
    )

    const first = confirmUnsavedWorkBeforeSwitch('Comfy Cloud')
    await vi.waitFor(() => expect(savedWorkflows()).toEqual([portrait]))

    expect(await confirmUnsavedWorkBeforeSwitch('Comfy Cloud')).toBe(false)
    expect(showUnsavedWorkDialog).toHaveBeenCalledOnce()

    finishSave(true)
    expect(await first).toBe(true)
    expect(savedWorkflows()).toEqual([portrait, upscale])
  })

  it('asks again once the first ask has settled', async () => {
    vi.mocked(showUnsavedWorkDialog).mockResolvedValue(null)

    await confirmUnsavedWorkBeforeSwitch('Comfy Cloud')
    await confirmUnsavedWorkBeforeSwitch('Comfy Cloud')

    expect(showUnsavedWorkDialog).toHaveBeenCalledTimes(2)
  })
})
