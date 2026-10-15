import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { reloadForDeploymentSwitch } from '@/platform/workspace/deploymentSwitchReload'

import UnloadWindowConfirmDialog from './UnloadWindowConfirmDialog.vue'

function leavePage() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe('UnloadWindowConfirmDialog', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal('location', { reload: vi.fn() })
    const unsaved = fromPartial<ComfyWorkflow>({
      path: 'a.json',
      isModified: true
    })
    Object.assign(useWorkflowStore(), { modifiedWorkflows: [unsaved] })
  })

  it.for([
    {
      leaving: 'a page with unsaved work',
      persist: true,
      switching: false,
      prompts: true
    },
    {
      leaving: 'for a deployment switch without drafts',
      persist: false,
      switching: true,
      prompts: true
    },
    {
      leaving: 'for a deployment switch while drafts keep the work',
      persist: true,
      switching: true,
      prompts: false
    }
  ])(
    'asks before leaving $leaving: $prompts',
    ({ persist, switching, prompts }) => {
      useSettingStore().$patch({
        settingValues: {
          'Comfy.Window.UnloadConfirmation': true,
          'Comfy.Workflow.Persist': persist
        }
      })
      render(UnloadWindowConfirmDialog)
      if (switching) reloadForDeploymentSwitch()

      expect(leavePage().defaultPrevented).toBe(prompts)
    }
  )
})
