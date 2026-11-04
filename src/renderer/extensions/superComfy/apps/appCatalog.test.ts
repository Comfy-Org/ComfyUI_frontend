import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppCatalog } from '@/renderer/extensions/superComfy/apps/appCatalog'

vi.mock(import('firebase/auth'))

function savedWorkflow(path: string, modified: number): ComfyWorkflow {
  return new ComfyWorkflow({ path, modified, size: 1 })
}

beforeEach(() => {
  vi.mocked(useWorkflowStore().loadWorkflows).mockResolvedValue()
  vi.mocked(useWorkflowStore().syncWorkflows).mockResolvedValue()
})

describe('useAppCatalog', () => {
  it('lists the saved apps by name', () => {
    Object.assign(useWorkflowStore(), {
      persistedWorkflows: [
        savedWorkflow('workflows/Zebra.app.json', 3),
        savedWorkflow('workflows/plain.json', 2),
        savedWorkflow('workflows/team/Avatar.app.json', 1)
      ]
    })

    expect(useAppCatalog().apps.value).toEqual([
      {
        path: 'workflows/team/Avatar.app.json',
        title: 'Avatar',
        lastModified: 1
      },
      { path: 'workflows/Zebra.app.json', title: 'Zebra', lastModified: 3 }
    ])
  })

  it('refreshes the workflow list at most every thirty seconds', async () => {
    const catalog = useAppCatalog()

    await catalog.refresh()
    await catalog.refresh()
    vi.advanceTimersByTime(30_000)
    await catalog.refresh()

    expect(useWorkflowStore().loadWorkflows).toHaveBeenCalledTimes(3)
    expect(useWorkflowStore().syncWorkflows).toHaveBeenCalledTimes(2)
  })
})
