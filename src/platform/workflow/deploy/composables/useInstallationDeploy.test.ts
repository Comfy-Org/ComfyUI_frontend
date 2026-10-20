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
import { api } from '@/scripts/api'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

const distribution = vi.hoisted(() => ({ isDesktop: false }))

vi.mock(import('firebase/auth'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/composables/auth/useAuthDialogs'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isDesktop() {
    return distribution.isDesktop
  },
  isCloud: false,
  isNightly: false
}))

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

beforeEach(() => {
  distribution.isDesktop = false
  vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(
    'workspace-jwt'
  )
  vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue(null)
  vi.spyOn(window, 'open').mockReturnValue(fromPartial<Window>({}))
})

describe(useInstallationDeploy, () => {
  it('uploads with the workspace token, not a stored API key, and opens the pre-filled build wizard', async () => {
    vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue({
      'X-API-KEY': `comfyui-${'a'.repeat(64)}`
    })
    vi.mocked(api.fetchApi).mockResolvedValueOnce(bundleCreated())
    const { deploy, state } = useInstallationDeploy()

    await expect(deploy()).resolves.toBe(true)

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
    expect(window.open).toHaveBeenCalledExactlyOnceWith(BUILDER_URL, '_blank')
    expect(state.value).toEqual({ status: 'opened' })
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

    await expect(useInstallationDeploy().deploy()).resolves.toBe(false)

    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()
    expect(useToast().error).toHaveBeenCalledExactlyOnceWith(
      t('deployToComfyApi.bundleUnauthorized')
    )
  })

  it('asks the user to sign in, and uploads nothing when they cancel', async () => {
    vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(undefined)

    await expect(useInstallationDeploy().deploy()).resolves.toBe(false)

    expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(useToast().error).not.toHaveBeenCalled()
  })

  it('uploads once the user signs in from the prompt', async () => {
    vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(undefined)
    vi.mocked(useAuthDialogs().showSignInDialog).mockImplementationOnce(
      async () => {
        vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(
          'signed-in-jwt'
        )
        return true
      }
    )
    vi.mocked(api.fetchApi).mockResolvedValueOnce(bundleCreated())

    await expect(useInstallationDeploy().deploy()).resolves.toBe(true)

    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
      '/deploy/bundle',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer signed-in-jwt',
          'Content-Type': 'application/json'
        }
      })
    )
  })

  it('tells the user to sign in again when sign-in yields no credential', async () => {
    vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(undefined)
    vi.mocked(useAuthDialogs().showSignInDialog).mockResolvedValueOnce(true)

    await expect(useInstallationDeploy().deploy()).resolves.toBe(false)

    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(useToast().error).toHaveBeenCalledExactlyOnceWith(
      t('deployToComfyApi.bundleUnauthorized')
    )
  })

  it('offers the build wizard as a link when the browser blocks the new tab', async () => {
    vi.mocked(window.open).mockReturnValueOnce(null)
    vi.mocked(api.fetchApi).mockResolvedValueOnce(bundleCreated())
    const { deploy, state } = useInstallationDeploy()

    await expect(deploy()).resolves.toBe(false)

    expect(state.value).toEqual({ status: 'tab_blocked', url: BUILDER_URL })
  })

  it('keeps one upload across dialogs, so reopening neither uploads again nor loses the link', async () => {
    let finishUpload: (response: Response) => void = () => {}
    vi.mocked(api.fetchApi).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishUpload = resolve
        })
    )
    vi.mocked(window.open).mockReturnValueOnce(null)
    const upload = useInstallationDeploy().deploy()
    const reopened = useInstallationDeploy()

    await expect(reopened.deploy()).resolves.toBe(false)
    expect(reopened.state.value).toEqual({ status: 'uploading' })
    await vi.waitFor(() => expect(api.fetchApi).toHaveBeenCalledOnce())
    finishUpload(bundleCreated())
    await upload

    expect(reopened.state.value).toEqual({
      status: 'tab_blocked',
      url: BUILDER_URL
    })
  })

  it('offers a fresh upload once the blocked-tab link has been followed', async () => {
    vi.mocked(window.open).mockReturnValueOnce(null)
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(bundleCreated())
      .mockResolvedValueOnce(bundleCreated())
    const { deploy, markOpened, state } = useInstallationDeploy()
    await deploy()

    markOpened()

    expect(state.value).toEqual({ status: 'opened' })
    await expect(deploy()).resolves.toBe(true)
    expect(api.fetchApi).toHaveBeenCalledTimes(2)
  })

  it.for([
    {
      desktop: 'the Desktop build',
      setUp: () => {
        distribution.isDesktop = true
      }
    },
    {
      desktop: 'Comfy-Desktop v2',
      setUp: () => {
        vi.stubGlobal('__comfyDesktop2', fromPartial({}))
      }
    }
  ])(
    'counts $desktop as opened, because its system browser leaves no tab handle',
    async ({ setUp }) => {
      setUp()
      vi.mocked(window.open).mockReturnValueOnce(null)
      vi.mocked(api.fetchApi).mockResolvedValueOnce(bundleCreated())
      const { deploy, state } = useInstallationDeploy()

      await expect(deploy()).resolves.toBe(true)

      expect(state.value).toEqual({ status: 'opened' })
      expect(window.open).toHaveBeenCalledExactlyOnceWith(BUILDER_URL, '_blank')
    }
  )

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
    'shows a message and opens nothing when $when',
    async ({ response, message, reports }) => {
      vi.mocked(api.fetchApi).mockResolvedValueOnce(response())

      await expect(useInstallationDeploy().deploy()).resolves.toBe(false)

      expect(useToast().error).toHaveBeenCalledExactlyOnceWith(t(message))
      expect(window.open).not.toHaveBeenCalled()
      expect(reportError).toHaveBeenCalledTimes(reports)
    }
  )

  it('reports a request that never reached the server and opens nothing', async () => {
    vi.mocked(api.fetchApi).mockRejectedValueOnce(
      new TypeError('Failed to fetch')
    )

    await expect(useInstallationDeploy().deploy()).resolves.toBe(false)

    expect(useToast().error).toHaveBeenCalledExactlyOnceWith(
      t('deployToComfyApi.bundleUnavailable')
    )
    expect(window.open).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledOnce()
  })
})
