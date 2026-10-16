import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoute, useRouter } from 'vue-router'

import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import '@/scripts/changeTracker'

import { useFolderWorkflowsUrlLoader } from './useFolderWorkflowsUrlLoader'

vi.mock(import('vue-router'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(import('@/platform/telemetry/reportError'))

const distribution = vi.hoisted(() => ({ isCloud: false }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    getUserData: vi.fn(),
    storeUserData: vi.fn(),
    listUserDataFullInfo: vi.fn(),
    apiURL: vi.fn(),
    addEventListener: vi.fn()
  }
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { canvas: {} }
}))

function serveWorkflowFiles(paths: string[]) {
  vi.mocked(api.listUserDataFullInfo).mockResolvedValue(
    paths.map((path) => ({ path, modified: 1, size: 1 }))
  )
}

function openTabPaths() {
  return useWorkflowStore().openWorkflows.map((workflow) => workflow.path)
}

describe('useFolderWorkflowsUrlLoader', () => {
  beforeEach(() => {
    distribution.isCloud = false
  })

  it('opens every workflow in the folder as a tab in name order, the first in front', async () => {
    serveWorkflowFiles([
      'build/b.json',
      'build/a.json',
      'build/notes.txt',
      'build/nested/c.json',
      'other/x.json'
    ])
    Object.assign(useRoute().query, { workflows: 'build', other: 'keep' })

    const opened =
      await useFolderWorkflowsUrlLoader().openFolderWorkflowsFromUrl()

    expect(opened).toBe(true)
    expect(openTabPaths()).toEqual([
      'workflows/build/a.json',
      'workflows/build/b.json'
    ])
    expect(useWorkflowService().openWorkflow).toHaveBeenCalledExactlyOnceWith(
      useWorkflowStore().getWorkflowByPath('workflows/build/a.json')
    )
    expect(useRouter().replace).toHaveBeenCalledWith({
      query: { other: 'keep' }
    })
  })

  it('reuses a tab that is already open instead of opening it twice', async () => {
    serveWorkflowFiles(['mine.json', 'build/a.json', 'build/b.json'])
    const workflowStore = useWorkflowStore()
    await workflowStore.loadWorkflows()
    workflowStore.openWorkflowsInBackground({
      right: ['workflows/mine.json', 'workflows/build/b.json']
    })
    Object.assign(useRoute().query, { workflows: 'build' })

    await useFolderWorkflowsUrlLoader().openFolderWorkflowsFromUrl()

    expect(openTabPaths()).toEqual([
      'workflows/mine.json',
      'workflows/build/b.json',
      'workflows/build/a.json'
    ])
  })

  it.for([
    { condition: 'the folder holds no workflow', folder: 'notes' },
    { condition: 'the folder does not exist', folder: 'missing' },
    { condition: 'the value is empty', folder: '' },
    { condition: 'the value holds a slash', folder: 'build/nested' },
    { condition: 'the value holds a backslash', folder: 'build\\nested' },
    { condition: 'the value climbs out of the folder', folder: '..' },
    { condition: 'the value climbs out mid-path', folder: 'build..' }
  ])(
    'opens nothing and drops the param when $condition',
    async ({ folder }) => {
      serveWorkflowFiles([
        'notes/readme.txt',
        'build/nested/c.json',
        'build../d.json'
      ])
      Object.assign(useRoute().query, { workflows: folder, other: 'keep' })

      const opened =
        await useFolderWorkflowsUrlLoader().openFolderWorkflowsFromUrl()

      expect(opened).toBe(false)
      expect(openTabPaths()).toEqual([])
      expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
      expect(reportError).not.toHaveBeenCalled()
      expect(useRouter().replace).toHaveBeenCalledWith({
        query: { other: 'keep' }
      })
    }
  )

  it('keeps the param while a Cloud deployment link is still to pick, for the boot after its reload', async () => {
    distribution.isCloud = true
    serveWorkflowFiles(['build/a.json'])
    Object.assign(useRoute().query, {
      workspace: 'ws-1',
      deployment: 'dep-1',
      workflows: 'build'
    })

    const opened =
      await useFolderWorkflowsUrlLoader().openFolderWorkflowsFromUrl()

    expect(opened).toBe(true)
    expect(useRouter().replace).not.toHaveBeenCalled()
  })

  it('does nothing when the URL names no folder', async () => {
    Object.assign(useRoute().query, { other: 'keep' })

    const opened =
      await useFolderWorkflowsUrlLoader().openFolderWorkflowsFromUrl()

    expect(opened).toBe(false)
    expect(api.listUserDataFullInfo).not.toHaveBeenCalled()
    expect(useRouter().replace).not.toHaveBeenCalled()
  })

  it('reports a workflow that fails to open and resolves false', async () => {
    serveWorkflowFiles(['build/a.json'])
    vi.mocked(useWorkflowService().openWorkflow).mockRejectedValue(
      new Error('load failed')
    )
    Object.assign(useRoute().query, { workflows: 'build' })

    const opened =
      await useFolderWorkflowsUrlLoader().openFolderWorkflowsFromUrl()

    expect(opened).toBe(false)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'error_opening_link_folder_workflows'
      })
    )
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })
})
