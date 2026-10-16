import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { DiscardedWork } from '@/platform/workspace/deploymentSwitchReload'
import {
  NOTHING_DISCARDED,
  reloadForDeploymentSwitch,
  takeDeploymentSwitchDiscard
} from '@/platform/workspace/deploymentSwitchReload'

import UnloadWindowConfirmDialog from './UnloadWindowConfirmDialog.vue'

const DROPPED_STATE = fromPartial<ComfyWorkflowJSON>({ nodes: [] })
const LATER_STATE = fromPartial<ComfyWorkflowJSON>({
  nodes: [],
  extra: { edited: true }
})
const DROPPED = JSON.stringify(DROPPED_STATE)

const portrait = fromPartial<ComfyWorkflow>({
  path: 'portrait.json',
  isLoaded: true,
  isModified: true,
  activeState: DROPPED_STATE
})

const closedWithoutSaving = fromPartial<ComfyWorkflow>({
  path: 'closed.json',
  isLoaded: false,
  isModified: true,
  activeState: null
})

function leavePage() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe('UnloadWindowConfirmDialog', () => {
  beforeEach(() => {
    sessionStorage.clear()
    takeDeploymentSwitchDiscard()
    vi.stubGlobal('location', { reload: vi.fn() })
    useSettingStore().$patch({
      settingValues: { 'Comfy.Window.UnloadConfirmation': true }
    })
    Object.assign(portrait, { activeState: DROPPED_STATE })
    Object.assign(useWorkflowStore(), { modifiedWorkflows: [portrait] })
  })

  it.for([
    {
      leaving: 'a page with unsaved work',
      switching: false,
      discarded: NOTHING_DISCARDED,
      editedSince: false,
      prompts: true
    },
    {
      leaving: 'for a switch that settled nothing, such as a link pick',
      switching: true,
      discarded: NOTHING_DISCARDED,
      editedSince: false,
      prompts: true
    },
    {
      leaving: 'for a switch whose unsaved work the user chose to drop',
      switching: true,
      discarded: new Map([[portrait, DROPPED]]),
      editedSince: false,
      prompts: false
    },
    {
      leaving: 'for a switch after an equal copy of that work replaced it',
      switching: true,
      discarded: new Map([[portrait, DROPPED]]),
      editedSince: fromPartial<ComfyWorkflowJSON>({ nodes: [] }),
      prompts: false
    },
    {
      leaving: 'for a switch after edits made since the user chose to drop it',
      switching: true,
      discarded: new Map([[portrait, DROPPED]]),
      editedSince: LATER_STATE,
      prompts: true
    }
  ] satisfies {
    leaving: string
    switching: boolean
    discarded: DiscardedWork
    editedSince: false | ComfyWorkflowJSON
    prompts: boolean
  }[])(
    'asks before leaving $leaving: $prompts',
    ({ switching, discarded, editedSince, prompts }) => {
      render(UnloadWindowConfirmDialog)
      if (switching) reloadForDeploymentSwitch(discarded, () => {})
      if (editedSince) Object.assign(portrait, { activeState: editedSince })

      expect(leavePage().defaultPrevented).toBe(prompts)
    }
  )

  it.for([
    { leaving: 'for a switch reload', switching: true, prompts: false },
    { leaving: 'any other way', switching: false, prompts: true }
  ])(
    'treats a workflow closed without saving as nothing to lose when leaving $leaving: $prompts',
    ({ switching, prompts }) => {
      Object.assign(useWorkflowStore(), {
        modifiedWorkflows: [closedWithoutSaving]
      })
      render(UnloadWindowConfirmDialog)
      if (switching) reloadForDeploymentSwitch(NOTHING_DISCARDED, () => {})

      expect(leavePage().defaultPrevented).toBe(prompts)
    }
  )

  it('asks again on a later unload when the switch reload did not happen', () => {
    render(UnloadWindowConfirmDialog)
    reloadForDeploymentSwitch(new Map([[portrait, DROPPED]]), () => {})

    expect(leavePage().defaultPrevented).toBe(false)
    expect(leavePage().defaultPrevented).toBe(true)
  })
})
