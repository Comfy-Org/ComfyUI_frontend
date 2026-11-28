import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'

import { signedInOnWebSession } from '@comfyorg/api-client/webSessionFetch'

import { clearPreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'
import { useToast } from '@/components/ui/toast/toastStore'
import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import type { assetService } from '@/platform/assets/services/assetService'
import { useAuthStore } from '@/stores/authStore'
import { useAssetWorkflowUrlLoader } from './useAssetWorkflowUrlLoader'

const state = vi.hoisted(() => {
  const query: Record<string, string> = {}
  return {
    route: { query },
    cloud: true,
    workspace: { activeWorkspaceId: 'A' },
    detail: vi.fn(),
    parse: vi.fn(),
    replace: vi.fn()
  }
})
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return state.cloud
  }
}))
vi.mock(import('@/platform/auth/firebaseIdentity'), () => ({
  firebaseIdentity: { onUserChanged: vi.fn() } as unknown as FirebaseIdentity
}))
vi.mock(import('@comfyorg/api-client/webSessionFetch'), { spy: true })
vi.mock(import('vue-router'), () => ({
  useRouter: () =>
    ({
      currentRoute: { value: state.route },
      replace: state.replace
    }) as unknown as Router
}))
vi.mock(import('@/platform/assets/services/assetService'), () => ({
  assetService: {
    getAssetDetails: state.detail
  } as unknown as typeof assetService
}))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/metadata/parser'), () => ({
  getWorkflowDataFromFile: state.parse
}))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/i18n'), () => ({ t: (key: string) => key }))

describe('embedded Cloud asset workflow link', () => {
  beforeEach(() => {
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.ASSET_WORKFLOW)
    vi.mocked(api.apiURL).mockImplementation((path) => '/api' + path)
    vi.mocked(useApp().loadApiJson).mockResolvedValue(undefined)
    state.cloud = true
    state.workspace.activeWorkspaceId = 'A'
    vi.spyOn(
      useTeamWorkspaceStore(),
      'activeWorkspaceId',
      'get'
    ).mockImplementation(() => state.workspace.activeWorkspaceId)
    vi.mocked(signedInOnWebSession).mockResolvedValue(false)
    vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue('fixture')
    state.route.query = {
      assetWorkflow: 'output-1',
      assetWorkspace: 'A',
      keep: 'yes'
    }
    state.detail.mockResolvedValue({
      id: 'output-1',
      name: 'folder/output.png',
      mime_type: 'image/png',
      tags: ['output']
    })
    vi.mocked(fetch).mockResolvedValue(new Response('image'))
    state.parse.mockResolvedValue({
      prompt: JSON.stringify({
        a: {
          class_type: 'Save',
          inputs: { seed: 9, auth_token_comfy_org: 'private' }
        }
      })
    })
  })
  it('opens the embedded prompt without fetching a job', async () => {
    await useAssetWorkflowUrlLoader()()
    expect(state.replace).toHaveBeenCalledWith({ query: { keep: 'yes' } })
    expect(fetch).toHaveBeenCalledWith(
      '/api/assets/output-1/content?disposition=inline',
      {
        credentials: 'same-origin',
        headers: new Headers({ Authorization: 'Bearer fixture' })
      }
    )
    expect(useApp().loadApiJson).toHaveBeenCalledWith(
      { a: { class_type: 'Save', inputs: { seed: 9 } } },
      'output'
    )
  })
  it('opens a local output through the selected ComfyUI server', async () => {
    state.cloud = false
    delete state.route.query.assetWorkspace
    vi.mocked(api.fetchApi).mockResolvedValue(new Response('local image'))
    await useAssetWorkflowUrlLoader()()
    expect(api.fetchApi).toHaveBeenCalledWith(
      '/assets/output-1/content?disposition=inline',
      { headers: new Headers() }
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(useApp().loadApiJson).toHaveBeenCalledOnce()
  })

  it('ignores a Cloud asset link on a local build', async () => {
    state.cloud = false
    await useAssetWorkflowUrlLoader()()
    expect(state.detail).not.toHaveBeenCalled()
    expect(useApp().loadApiJson).not.toHaveBeenCalled()
  })

  it.for(['../file', 'a/b', 'https://other.invalid'])(
    'ignores invalid asset ID %s',
    async (id) => {
      state.route.query.assetWorkflow = id
      await useAssetWorkflowUrlLoader()()
      expect(state.detail).not.toHaveBeenCalled()
      expect(useApp().loadApiJson).not.toHaveBeenCalled()
    }
  )
  it('refuses a link for a different workspace', async () => {
    state.route.query.assetWorkspace = 'B'
    await useAssetWorkflowUrlLoader()()
    expect(state.detail).not.toHaveBeenCalled()
    expect(useToast().error).toHaveBeenCalledOnce()
  })
  it('requires an output with the requested ID', async () => {
    state.detail.mockResolvedValue({ id: 'different', tags: ['output'] })
    await useAssetWorkflowUrlLoader()()
    expect(fetch).not.toHaveBeenCalled()
    expect(useApp().loadApiJson).not.toHaveBeenCalled()
  })
  it('keeps the active graph if the workspace changes during metadata parsing', async () => {
    state.parse.mockImplementation(() => {
      state.workspace.activeWorkspaceId = 'B'
      return { prompt: { a: { class_type: 'Save', inputs: {} } } }
    })
    await useAssetWorkflowUrlLoader()()
    expect(useApp().loadApiJson).not.toHaveBeenCalled()
    expect(useToast().error).toHaveBeenCalledOnce()
  })
})
