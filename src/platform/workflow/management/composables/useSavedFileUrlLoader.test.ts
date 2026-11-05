import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoute, useRouter } from 'vue-router'

import { useToast } from '@/components/ui/toast/toastStore'
import {
  capturePreservedQuery,
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { blankGraph } from '@/scripts/defaultGraph'
import '@/scripts/changeTracker'

import { useSavedFileUrlLoader } from './useSavedFileUrlLoader'

vi.mock(import('vue-router'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

const ID = '82b98188-0c8f-41d2-9b91-617b9152b809'
const NAMESPACE = PRESERVED_QUERY_NAMESPACES.SAVED_FILE

function serveFile(path = 'workflows/Car swap/renamed.json') {
  vi.spyOn(api, 'fetchApi').mockResolvedValue(
    Response.json({
      id: ID,
      path,
      size: 12,
      modified: 1
    })
  )
  vi.spyOn(api, 'getUserData').mockImplementation(async () =>
    Response.json(blankGraph)
  )
  vi.spyOn(api, 'listUserDataFullInfo').mockResolvedValue([
    { path: 'Car swap/renamed.json', size: 12, modified: 1 }
  ])
}

describe('saved workflow links', () => {
  beforeEach(() => {
    distribution.isCloud = true
    clearPreservedQuery(NAMESPACE)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOWS)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.DEPLOYMENT)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKSPACE)
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-1' })
    vi.mocked(useRouter().replace).mockImplementation(async (to) => {
      const query = useRoute().query
      Object.keys(query).forEach((key) => {
        delete query[key]
      })
      if (typeof to === 'object' && 'query' in to)
        Object.assign(query, to.query)
    })
  })

  it('resolves the ID to its renamed path and opens that workflow in front', async () => {
    serveFile()
    Object.assign(useRoute().query, {
      savedFile: ID,
      workflows: 'other',
      keep: 'yes'
    })
    const store = useWorkflowStore()
    const existing = store.createTemporary('Existing.json')
    await store.openWorkflow(existing)
    vi.mocked(useWorkflowService().openWorkflow).mockImplementation(
      async (workflow) => {
        await store.openWorkflow(workflow)
        return true
      }
    )

    expect(await useSavedFileUrlLoader().openSavedFileFromUrl()).toBe('opened')

    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
      `/userdata-files/${ID}`
    )
    expect(store.activeWorkflow?.path).toBe('workflows/Car swap/renamed.json')
    expect(store.openWorkflows.map(({ path }) => path)).toEqual([
      existing.path,
      'workflows/Car swap/renamed.json'
    ])
    expect(useRoute().query).toEqual({ keep: 'yes' })
    expect(
      useTelemetry()?.trackSavedFileLinkOpened
    ).toHaveBeenCalledExactlyOnceWith({
      outcome: 'opened',
      workspace_id: 'workspace-1'
    })
    expect(await useSavedFileUrlLoader().openSavedFileFromUrl()).toBe('absent')
    expect(useTelemetry()?.trackSavedFileLinkOpened).toHaveBeenCalledTimes(1)
  })

  it('opens a link preserved through sign-in and onboarding and clears the stash', async () => {
    serveFile()
    sessionStorage.setItem(
      'Comfy.PreservedQuery.savedFile',
      JSON.stringify({ savedFile: ID })
    )
    capturePreservedQuery(
      PRESERVED_QUERY_NAMESPACES.WORKFLOWS,
      { workflows: 'ignored' },
      ['workflows']
    )

    expect(await useSavedFileUrlLoader().openSavedFileFromUrl()).toBe('opened')

    expect(getPreservedQueryParam(NAMESPACE, 'savedFile')).toBeUndefined()
    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOWS, 'workflows')
    ).toBeUndefined()
    expect(sessionStorage.getItem('Comfy.PreservedQuery.savedFile')).toBeNull()
  })

  it('leaves restored tabs and their active workflow unchanged on 404', async () => {
    vi.spyOn(api, 'fetchApi').mockResolvedValue(
      new Response(null, { status: 404 })
    )
    Object.assign(useRoute().query, { savedFile: ID })
    const store = useWorkflowStore()
    const existing = store.createTemporary('Existing.json')
    await store.openWorkflow(existing)

    expect(await useSavedFileUrlLoader().openSavedFileFromUrl()).toBe('failed')

    expect(store.activeWorkflow).toBe(existing)
    expect(store.openWorkflows).toEqual([existing])
    expect(useToast().toasts.map(({ title }) => title)).toEqual([
      "Couldn't find this workflow"
    ])
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(
      useTelemetry()?.trackSavedFileLinkOpened
    ).toHaveBeenCalledExactlyOnceWith({
      outcome: 'not_found',
      workspace_id: 'workspace-1'
    })
  })

  it.for(['invalid', '', null, [ID, ID]])(
    'rejects malformed savedFile %j without a request',
    async (savedFile) => {
      const request = vi.spyOn(api, 'fetchApi')
      Object.assign(useRoute().query, { savedFile })

      expect(await useSavedFileUrlLoader().openSavedFileFromUrl()).toBe(
        'failed'
      )

      expect(request).not.toHaveBeenCalled()
      expect(useToast().toasts[0]?.title).toBe("Couldn't find this workflow")
      expect(useRoute().query).toEqual({})
    }
  )

  it.for(['workspace', 'deployment'])(
    'keeps a stashed link until the %s navigation finishes',
    async (namespace) => {
      const request = vi.spyOn(api, 'fetchApi')
      capturePreservedQuery(NAMESPACE, { savedFile: ID }, ['savedFile'])
      capturePreservedQuery(namespace, { [namespace]: 'destination' }, [
        namespace
      ])
      const loader = useSavedFileUrlLoader()

      expect(await loader.openSavedFileFromUrl()).toBe('pending')

      expect(request).not.toHaveBeenCalled()
      expect(useToast().toasts).toEqual([])
      expect(useTelemetry()?.trackSavedFileLinkOpened).not.toHaveBeenCalled()
      expect(getPreservedQueryParam(NAMESPACE, 'savedFile')).toBe(ID)
      clearPreservedQuery(namespace)
      serveFile()

      expect(await loader.openSavedFileFromUrl(true)).toBe('opened')
      expect(useTelemetry()?.trackSavedFileLinkOpened).toHaveBeenCalledTimes(1)
    }
  )

  it('does nothing outside Cloud', async () => {
    distribution.isCloud = false
    const request = vi.spyOn(api, 'fetchApi')
    Object.assign(useRoute().query, { savedFile: ID })

    expect(await useSavedFileUrlLoader().openSavedFileFromUrl()).toBe('absent')

    expect(request).not.toHaveBeenCalled()
    expect(useRoute().query).toEqual({ savedFile: ID })
    expect(useTelemetry()?.trackSavedFileLinkOpened).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'server error',
      response: () => new Response(null, { status: 500 })
    },
    { name: 'invalid JSON', response: () => new Response('{') },
    {
      name: 'wrong ID',
      response: () =>
        Response.json({
          id: 'other',
          path: 'workflows/a.json',
          size: 1,
          modified: 1
        })
    }
  ])(
    'reports $name as an opening error rather than a missing file',
    async ({ response }) => {
      vi.spyOn(api, 'fetchApi').mockResolvedValue(response())
      Object.assign(useRoute().query, { savedFile: ID })

      expect(await useSavedFileUrlLoader().openSavedFileFromUrl()).toBe(
        'failed'
      )

      expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'error_loading_saved_file_link'
        })
      )
      expect(
        useTelemetry()?.trackSavedFileLinkOpened
      ).toHaveBeenCalledExactlyOnceWith({
        outcome: 'error',
        workspace_id: 'workspace-1'
      })
    }
  )

  it('keeps the intent if the workspace changes during the lookup', async () => {
    vi.spyOn(api, 'fetchApi').mockImplementation(async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-2'
      })
      return new Response(null, { status: 404 })
    })
    Object.assign(useRoute().query, { savedFile: ID })

    expect(await useSavedFileUrlLoader().openSavedFileFromUrl()).toBe('pending')

    expect(useRoute().query.savedFile).toBe(ID)
    expect(useToast().toasts).toEqual([])
    expect(useTelemetry()?.trackSavedFileLinkOpened).not.toHaveBeenCalled()
  })

  it('keeps tabs unchanged when the workflow cannot be opened', async () => {
    serveFile()
    Object.assign(useRoute().query, { savedFile: ID })
    const store = useWorkflowStore()
    const existing = store.createTemporary('Existing.json')
    await store.openWorkflow(existing)
    vi.mocked(useWorkflowService().openWorkflow).mockResolvedValue(false)

    expect(await useSavedFileUrlLoader().openSavedFileFromUrl()).toBe('failed')

    expect(store.activeWorkflow).toBe(existing)
    expect(store.openWorkflows).toEqual([existing])
    const toast = useToast().toasts[0]
    assert.exists(toast)
    expect(toast.title).toBe("Couldn't open this workflow. Please try again.")
  })
})
