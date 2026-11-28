import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocationQuery, Router } from 'vue-router'

import {
  capturePreservedQuery,
  clearPreservedQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'
import { useToast } from '@/components/ui/toast/toastStore'
import { useAppJobUrlLoader } from './useAppJobUrlLoader'

const state = vi.hoisted(() => {
  const query: LocationQuery = {}
  return {
    route: { query },
    cloud: false,
    workspace: { activeWorkspaceId: 'A' },
    detail: vi.fn(),
    replace: vi.fn()
  }
})

vi.mock(import('vue-router'), () => ({
  useRouter: () =>
    ({
      currentRoute: { value: state.route },
      replace: state.replace
    }) as unknown as Router
}))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return state.cloud
  }
}))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/i18n'), () => ({ t: (key: string) => key }))

const id = 'ff5b7197-bdbb-4070-955c-502f26aeacff'

describe('opening a local app job in the editor', () => {
  beforeEach(() => {
    vi.mocked(api.getJobDetail).mockImplementation(state.detail)
    vi.mocked(useApp().loadApiJson).mockResolvedValue(undefined)
    vi.mocked(useApp().loadGraphData).mockResolvedValue(undefined)
    state.cloud = false
    state.workspace.activeWorkspaceId = 'A'
    vi.spyOn(
      useTeamWorkspaceStore(),
      'activeWorkspaceId',
      'get'
    ).mockImplementation(() => state.workspace.activeWorkspaceId)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.APP_JOB)
    state.route.query = {
      appJob: id,
      appWorkflowName: 'Saved app run',
      keep: 'yes'
    }
  })

  it('imports the original node IDs, connections and inputs and removes account tokens', async () => {
    const input = {
      image: ['load', 0],
      amount: 3,
      auth_token_comfy_org: 'private'
    }
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json({
        [id]: {
          prompt: [7, id, { save: { class_type: 'Save', inputs: input } }]
        }
      })
    )
    await useAppJobUrlLoader()()
    expect(api.fetchApi).toHaveBeenCalledWith('/history/' + id)
    expect(state.replace).toHaveBeenCalledWith({ query: { keep: 'yes' } })
    expect(useApp().loadApiJson).toHaveBeenCalledWith(
      {
        save: { class_type: 'Save', inputs: { image: ['load', 0], amount: 3 } }
      },
      'Saved app run'
    )
  })

  it.for(['../other', 'https://example.com', [id, id]])(
    'rejects an invalid job ID',
    async (invalid) => {
      state.route.query.appJob = invalid
      await useAppJobUrlLoader()()
      expect(api.fetchApi).not.toHaveBeenCalled()
      expect(useToast().error).toHaveBeenCalledOnce()
    }
  )

  it('preserves the active graph for missing jobs', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(Response.json({}))
    await useAppJobUrlLoader()()
    expect(useApp().loadApiJson).not.toHaveBeenCalled()
    expect(useToast().error).toHaveBeenCalledOnce()
  })

  it('restores a Cloud app-job link after login and imports the scoped API prompt', async () => {
    state.cloud = true
    capturePreservedQuery(
      PRESERVED_QUERY_NAMESPACES.APP_JOB,
      { appJob: id, appWorkflowName: 'My app', appJobWorkspace: 'A' },
      ['appJob', 'appWorkflowName', 'appJobWorkspace']
    )
    state.route.query = { keep: 'yes' }
    state.detail.mockResolvedValue({
      id,
      workflow: {
        prompt: {
          output: {
            class_type: 'Save',
            inputs: { seed: 1, api_key_comfy_org: 'private' }
          }
        }
      }
    })
    await useAppJobUrlLoader()()
    expect(api.getJobDetail).toHaveBeenCalledWith(id)
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(useApp().loadApiJson).toHaveBeenCalledWith(
      { output: { class_type: 'Save', inputs: { seed: 1 } } },
      'My app'
    )
    await useAppJobUrlLoader()()
    expect(api.getJobDetail).toHaveBeenCalledTimes(1)
  })

  it('uses a validated embedded editor workflow when the job includes it', async () => {
    state.cloud = true
    state.route.query.appJobWorkspace = 'A'
    const graph = {
      version: 0.4,
      last_node_id: 0,
      last_link_id: 0,
      nodes: [],
      links: [],
      groups: [],
      config: {},
      extra: {}
    }
    state.detail.mockResolvedValue({
      id,
      workflow: { extra_data: { extra_pnginfo: { workflow: graph } } }
    })
    await useAppJobUrlLoader()()
    expect(useApp().loadGraphData).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [], links: [] }),
      true,
      true,
      'Saved app run',
      { isCurrent: expect.any(Function) }
    )
    expect(useApp().loadApiJson).not.toHaveBeenCalled()
  })

  it('rejects another workspace before reading its job', async () => {
    state.cloud = true
    state.route.query.appJobWorkspace = 'B'
    await useAppJobUrlLoader()()
    expect(api.getJobDetail).not.toHaveBeenCalled()
    expect(useApp().loadApiJson).not.toHaveBeenCalled()
    expect(useToast().error).toHaveBeenCalledOnce()
  })

  it('keeps the canvas when the workspace changes while the job is loading', async () => {
    state.cloud = true
    state.route.query.appJobWorkspace = 'A'
    state.detail.mockImplementation(async () => {
      state.workspace.activeWorkspaceId = 'B'
      return {
        id,
        workflow: { prompt: { a: { class_type: 'Save', inputs: {} } } }
      }
    })
    await useAppJobUrlLoader()()
    expect(useApp().loadApiJson).not.toHaveBeenCalled()
    expect(useApp().loadGraphData).not.toHaveBeenCalled()
    expect(useToast().error).toHaveBeenCalledOnce()
  })

  it('skips ordinary editor visits', async () => {
    state.route.query = { keep: 'yes' }
    await useAppJobUrlLoader()()
    expect(state.replace).not.toHaveBeenCalled()
    expect(api.fetchApi).not.toHaveBeenCalled()
  })
})
