import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import {
  skipLeavePromptOnce,
  takeLeavePromptSkip
} from '@/platform/workflow/management/leavePrompt'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import UnloadWindowConfirmDialog from './UnloadWindowConfirmDialog.vue'

const portrait = fromPartial<ComfyWorkflow>({
  path: 'portrait.json',
  isModified: true
})

function leavePage() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event
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
})
