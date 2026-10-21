import type {
  CreateDeployBundleResponse,
  DeployToCloudError
} from '@comfyorg/ingest-types'
import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { t } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { useInstallationDeploy } from '@/platform/workflow/deploy/composables/useInstallationDeploy'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

vi.mock(import('firebase/auth'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/composables/auth/useAuthDialogs'))
vi.mock(import('@/platform/telemetry/reportError'))

const CANVAS_GRAPH = { last_node_id: 1, nodes: [{ id: 1, type: 'KSampler' }] }

const BUNDLE_ID = 'b78dcd79-8aba-4d5f-abd7-d35e4d33cbce'
const BUILDER_URL = `https://platform.comfy.org/profile/builds/new?step=import&bundle=${BUNDLE_ID}&workspace=ws-1`

function bundleCreated(url = BUILDER_URL) {
  return Response.json({
    url,
    bundle_id: BUNDLE_ID,
    workspace_id: 'ws-1',
    expires_at: '2026-10-18T00:00:00Z'
  } satisfies CreateDeployBundleResponse)
}

function openWorkflowOnCanvas(canvasGraph: Record<string, unknown>) {
  let savedGraph: Record<string, unknown> = { nodes: [] }
  useWorkflowStore().activeWorkflow = fromPartial({
    get activeState() {
      return savedGraph
    },
    changeTracker: {
      prepareForSave: () => {
        savedGraph = canvasGraph
      }
    }
  })
}

beforeEach(() => {
  vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(
    'workspace-jwt'
  )
  vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue(null)
})

describe(useInstallationDeploy, () => {
  it('uploads with the workspace token, not a stored API key, and offers the pre-filled build wizard', async () => {
    vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue({
      'X-API-KEY': `comfyui-${'a'.repeat(64)}`
    })
    vi.mocked(api.fetchApi).mockResolvedValueOnce(bundleCreated())
    const { deploy, state } = useInstallationDeploy()

    await deploy()

    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
      '/deploy/bundle',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer workspace-jwt',
          'Content-Type': 'application/json'
        },
        body: '{}'
      })
    )
    expect(state.value).toEqual({ status: 'ready', url: BUILDER_URL })
  })

  it('uploads the open workflow as it stands on the canvas', async () => {
    openWorkflowOnCanvas(CANVAS_GRAPH)
    vi.mocked(api.fetchApi).mockResolvedValueOnce(bundleCreated())

    await useInstallationDeploy().deploy()

    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
      '/deploy/bundle',
      expect.objectContaining({
        body: JSON.stringify({ workflow: CANVAS_GRAPH })
      })
    )
  })

  it('uploads the installation alone when the workflow makes the bundle too large', async () => {
    openWorkflowOnCanvas(CANVAS_GRAPH)
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(
        Response.json({ error: 'too_large' } satisfies DeployToCloudError, {
          status: 413
        })
      )
      .mockResolvedValueOnce(bundleCreated())
    const { deploy, state } = useInstallationDeploy()

    await deploy()

    expect(
      vi.mocked(api.fetchApi).mock.calls.map(([, init]) => init?.body)
    ).toEqual([JSON.stringify({ workflow: CANVAS_GRAPH }), '{}'])
    expect(useToast().error).not.toHaveBeenCalled()
    expect(state.value).toEqual({ status: 'ready', url: BUILDER_URL })
  })

  it('does not retry without the workflow when the builder is busy', async () => {
    openWorkflowOnCanvas(CANVAS_GRAPH)
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(
        Response.json({ error: 'builder_busy' } satisfies DeployToCloudError, {
          status: 503
        })
      )
      .mockResolvedValueOnce(bundleCreated())

    await useInstallationDeploy().deploy()

    expect(api.fetchApi).toHaveBeenCalledOnce()
    expect(useToast().error).toHaveBeenCalledExactlyOnceWith(
      t('deployToComfyApi.bundleBusy')
    )
  })

  it('uploads with the stored API key when there is no workspace token', async () => {
    vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(undefined)
    vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue({
      'X-API-KEY': `comfyui-${'a'.repeat(64)}`
    })
    vi.mocked(api.fetchApi).mockResolvedValueOnce(bundleCreated())

    await useInstallationDeploy().deploy()

    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
      '/deploy/bundle',
      expect.objectContaining({
        headers: {
          'X-API-KEY': `comfyui-${'a'.repeat(64)}`,
          'Content-Type': 'application/json'
        }
      })
    )
  })

  it('refuses the stored API key while another account is signed in', async () => {
    vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(undefined)
    useAuthStore().currentUser = fromPartial<User>({ uid: 'signed-in-user' })
    vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue({
      'X-API-KEY': `comfyui-${'a'.repeat(64)}`
    })

    await useInstallationDeploy().deploy()

    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()
    expect(useToast().error).toHaveBeenCalledExactlyOnceWith(
      t('deployToComfyApi.bundleUnauthorized')
    )
  })

  it('asks the user to sign in, and uploads nothing when they cancel', async () => {
    vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(undefined)
    const { deploy, state } = useInstallationDeploy()

    await deploy()

    expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(useToast().error).not.toHaveBeenCalled()
    expect(state.value).toEqual({ status: 'idle' })
  })

  it('uploads for the account the user signs in with from the prompt', async () => {
    const authStore = useAuthStore()
    vi.mocked(authStore.getWorkspaceAuthToken).mockResolvedValue(undefined)
    vi.mocked(useAuthDialogs().showSignInDialog).mockImplementationOnce(
      async () => {
        authStore.currentUser = fromPartial<User>({ uid: 'signed-in-account' })
        vi.mocked(authStore.getWorkspaceAuthToken).mockResolvedValue(
          'signed-in-jwt'
        )
        return true
      }
    )
    vi.mocked(api.fetchApi).mockResolvedValueOnce(bundleCreated())
    const { deploy, state } = useInstallationDeploy()

    await deploy()

    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
      '/deploy/bundle',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer signed-in-jwt',
          'Content-Type': 'application/json'
        }
      })
    )
    expect(state.value).toEqual({ status: 'ready', url: BUILDER_URL })
  })

  it('reports a sign-in prompt that fails to open, and lets the next deploy try again', async () => {
    vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(undefined)
    vi.mocked(useAuthDialogs().showSignInDialog).mockRejectedValueOnce(
      new TypeError('Failed to fetch dynamically imported module')
    )
    const { deploy, state } = useInstallationDeploy()

    await deploy()

    expect(state.value).toEqual({ status: 'idle' })
    expect(useToast().error).toHaveBeenCalledExactlyOnceWith(
      t('deployToComfyApi.bundleUnavailable')
    )
    expect(reportError).toHaveBeenCalledOnce()
    await deploy()
    expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledTimes(2)
  })

  it('tells the user to sign in again when sign-in yields no credential', async () => {
    vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(undefined)
    vi.mocked(useAuthDialogs().showSignInDialog).mockResolvedValueOnce(true)

    await useInstallationDeploy().deploy()

    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(useToast().error).toHaveBeenCalledExactlyOnceWith(
      t('deployToComfyApi.bundleUnauthorized')
    )
  })

  it.for([
    { when: 'another account signs in', userId: 'account-b' },
    { when: 'the user signs out', userId: null }
  ])('discards an upload that finishes after $when', async ({ userId }) => {
    const authStore = useAuthStore()
    authStore.currentUser = fromPartial<User>({ uid: 'account-a' })
    let finishUpload: (response: Response) => void = () => {}
    vi.mocked(api.fetchApi).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishUpload = resolve
        })
    )
    const { deploy, state } = useInstallationDeploy()
    const pending = deploy()
    await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledOnce())

    authStore.currentUser = userId ? fromPartial<User>({ uid: userId }) : null
    finishUpload(bundleCreated())
    await pending

    expect(state.value).toEqual({ status: 'idle' })
    expect(useToast().error).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('uploads nothing when the token arrives after the account changes', async () => {
    const authStore = useAuthStore()
    authStore.currentUser = fromPartial<User>({ uid: 'account-a' })
    let resolveToken: (token: string) => void = () => {}
    vi.mocked(authStore.getWorkspaceAuthToken).mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveToken = resolve
        })
    )
    const { deploy, state } = useInstallationDeploy()
    const pending = deploy()
    await vi.waitFor(() =>
      expect(authStore.getWorkspaceAuthToken).toHaveBeenCalledOnce()
    )

    authStore.currentUser = fromPartial<User>({ uid: 'account-b' })
    resolveToken('account-a-jwt')
    await pending

    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(state.value).toEqual({ status: 'idle' })
  })

  it.for([
    {
      when: 'the credential is missing',
      response: () =>
        Response.json(
          { error: 'missing_credentials' } satisfies DeployToCloudError,
          { status: 401 }
        ),
      message: 'deployToComfyApi.bundleUnauthorized',
      reports: 0
    },
    {
      when: 'the user has too many live bundles',
      response: () =>
        Response.json(
          { error: 'too_many_bundles' } satisfies DeployToCloudError,
          { status: 429 }
        ),
      message: 'deployToComfyApi.bundleTooMany',
      reports: 0
    },
    {
      when: 'aiohttp refuses the body before the handler runs',
      response: () => new Response('Request Entity Too Large', { status: 413 }),
      message: 'deployToComfyApi.bundleTooLarge',
      reports: 0
    },
    {
      when: 'the local server is offline',
      response: () =>
        Response.json({ error: 'offline' } satisfies DeployToCloudError, {
          status: 403
        }),
      message: 'deployToComfyApi.bundleUnavailable',
      reports: 0
    },
    {
      when: 'the builder is busy',
      response: () =>
        Response.json({ error: 'builder_busy' } satisfies DeployToCloudError, {
          status: 503
        }),
      message: 'deployToComfyApi.bundleBusy',
      reports: 0
    },
    {
      when: 'the builder is unavailable',
      response: () =>
        Response.json(
          { error: 'builder_unavailable' } satisfies DeployToCloudError,
          { status: 502 }
        ),
      message: 'deployToComfyApi.bundleUnavailable',
      reports: 1
    },
    {
      when: 'the builder rejects the uploaded bundle',
      response: () =>
        Response.json(
          {
            error: 'builder_rejected',
            message: 'snapshot is invalid'
          } satisfies DeployToCloudError,
          { status: 502 }
        ),
      message: 'deployToComfyApi.bundleRejected',
      reports: 1
    },
    {
      when: 'the request body is invalid',
      response: () =>
        Response.json(
          {
            error: 'invalid_body',
            message: 'name too long'
          } satisfies DeployToCloudError,
          { status: 400 }
        ),
      message: 'deployToComfyApi.bundleRejected',
      reports: 1
    },
    {
      when: 'the stored API key is malformed',
      response: () =>
        Response.json(
          { error: 'invalid_api_key_format' } satisfies DeployToCloudError,
          { status: 400 }
        ),
      message: 'deployToComfyApi.bundleUnauthorized',
      reports: 0
    },
    {
      when: 'the server answers with an unknown error code',
      response: () =>
        Response.json({ error: 'something_new' }, { status: 400 }),
      message: 'deployToComfyApi.bundleRejected',
      reports: 1
    },
    {
      when: 'the success response omits required bundle metadata',
      response: () => Response.json({ url: BUILDER_URL }),
      message: 'deployToComfyApi.bundleUnavailable',
      reports: 1
    },
    {
      when: 'the returned link is not https',
      response: () => bundleCreated('javascript:alert(1)'),
      message: 'deployToComfyApi.bundleUnavailable',
      reports: 1
    }
  ])(
    'shows a message and offers no wizard link when $when',
    async ({ response, message, reports }) => {
      vi.mocked(api.fetchApi).mockResolvedValueOnce(response())
      const { deploy, state } = useInstallationDeploy()

      await deploy()

      expect(useToast().error).toHaveBeenCalledExactlyOnceWith(t(message))
      expect(state.value).toEqual({ status: 'idle' })
      expect(reportError).toHaveBeenCalledTimes(reports)
    }
  )

  it('reports a request that never reached the server and offers no wizard link', async () => {
    vi.mocked(api.fetchApi).mockRejectedValueOnce(
      new TypeError('Failed to fetch')
    )
    const { deploy, state } = useInstallationDeploy()

    await deploy()

    expect(useToast().error).toHaveBeenCalledExactlyOnceWith(
      t('deployToComfyApi.bundleUnavailable')
    )
    expect(state.value).toEqual({ status: 'idle' })
    expect(reportError).toHaveBeenCalledOnce()
  })
})
