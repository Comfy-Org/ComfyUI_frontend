import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

const BUILDER_URL =
  'https://platform.comfy.org/profile/builds/new?step=import&bundle=b-1&workspace=ws-1'

function respondWith(response: Response) {
  vi.mocked(api.fetchApi).mockResolvedValueOnce(response)
}

function bundleCreated(url = BUILDER_URL) {
  return Response.json({
    url,
    bundle_id: 'b-1',
    workspace_id: 'ws-1',
    expires_at: '2026-10-18T00:00:00Z'
  })
}

function sentHeaders(): HeadersInit | undefined {
  const [route, options] = vi.mocked(api.fetchApi).mock.calls[0] ?? []
  expect(route).toBe('/deploy/bundle')
  return options?.headers
}

function stubWorkspaceToken(token: string | undefined) {
  vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(token)
}

beforeEach(() => {
  distribution.isDesktop = false
  stubWorkspaceToken('workspace-jwt')
  vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue(null)
  vi.spyOn(window, 'open').mockReturnValue(fromPartial<Window>({}))
})

afterEach(() => {
  delete window.__comfyDesktop2
})

describe(useInstallationDeploy, () => {
  it('uploads with the workspace token and opens the pre-filled build wizard', async () => {
    respondWith(bundleCreated())
    const { deploy, state } = useInstallationDeploy()

    await expect(deploy()).resolves.toBe(true)

    expect(sentHeaders()).toMatchObject({
      Authorization: 'Bearer workspace-jwt'
    })
    expect(window.open).toHaveBeenCalledExactlyOnceWith(BUILDER_URL, '_blank')
    expect(state.value).toEqual({ status: 'idle' })
  })

  it('uploads with the stored API key when there is no workspace token', async () => {
    stubWorkspaceToken(undefined)
    vi.mocked(useApiKeyAuthStore().getAuthHeader).mockReturnValue({
      'X-API-KEY': `comfyui-${'a'.repeat(64)}`
    })
    respondWith(bundleCreated())

    await useInstallationDeploy().deploy()

    expect(sentHeaders()).toMatchObject({
      'X-API-KEY': `comfyui-${'a'.repeat(64)}`
    })
  })

  it('refuses the stored API key while another account is signed in', async () => {
    stubWorkspaceToken(undefined)
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
    stubWorkspaceToken(undefined)

    await expect(useInstallationDeploy().deploy()).resolves.toBe(false)

    expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(useToast().error).not.toHaveBeenCalled()
  })

  it('uploads once the user signs in from the prompt', async () => {
    stubWorkspaceToken(undefined)
    vi.mocked(useAuthDialogs().showSignInDialog).mockImplementationOnce(
      async () => {
        stubWorkspaceToken('signed-in-jwt')
        return true
      }
    )
    respondWith(bundleCreated())

    await expect(useInstallationDeploy().deploy()).resolves.toBe(true)

    expect(sentHeaders()).toMatchObject({
      Authorization: 'Bearer signed-in-jwt'
    })
  })

  it('tells the user to sign in again when sign-in yields no credential', async () => {
    stubWorkspaceToken(undefined)
    vi.mocked(useAuthDialogs().showSignInDialog).mockResolvedValueOnce(true)

    await expect(useInstallationDeploy().deploy()).resolves.toBe(false)

    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(useToast().error).toHaveBeenCalledExactlyOnceWith(
      t('deployToComfyApi.bundleUnauthorized')
    )
  })

  it('offers the build wizard as a link when the browser blocks the new tab', async () => {
    vi.mocked(window.open).mockReturnValueOnce(null)
    respondWith(bundleCreated())
    const { deploy, state } = useInstallationDeploy()

    await expect(deploy()).resolves.toBe(false)

    expect(state.value).toEqual({ status: 'tab_blocked', url: BUILDER_URL })
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
        window.__comfyDesktop2 = fromPartial({})
      }
    }
  ])(
    'counts $desktop as opened, because its system browser leaves no tab handle',
    async ({ setUp }) => {
      setUp()
      vi.mocked(window.open).mockReturnValueOnce(null)
      respondWith(bundleCreated())
      const { deploy, state } = useInstallationDeploy()

      await expect(deploy()).resolves.toBe(true)

      expect(state.value).toEqual({ status: 'idle' })
      expect(window.open).toHaveBeenCalledExactlyOnceWith(BUILDER_URL, '_blank')
    }
  )

  it.for([
    {
      when: 'the credential is missing',
      response: () =>
        Response.json({ error: 'missing_credentials' }, { status: 401 }),
      message: 'deployToComfyApi.bundleUnauthorized',
      reported: false
    },
    {
      when: 'the user has too many live bundles',
      response: () =>
        Response.json({ error: 'too_many_bundles' }, { status: 429 }),
      message: 'deployToComfyApi.bundleTooMany',
      reported: false
    },
    {
      when: 'aiohttp refuses the body before the handler runs',
      response: () => new Response('Request Entity Too Large', { status: 413 }),
      message: 'deployToComfyApi.bundleTooLarge',
      reported: false
    },
    {
      when: 'the builder is unavailable',
      response: () =>
        Response.json({ error: 'builder_unavailable' }, { status: 502 }),
      message: 'deployToComfyApi.bundleUnavailable',
      reported: true
    },
    {
      when: 'the request body is invalid',
      response: () =>
        Response.json(
          { error: 'invalid_body', message: 'name too long' },
          { status: 400 }
        ),
      message: 'deployToComfyApi.bundleUnavailable',
      reported: true
    },
    {
      when: 'the returned link is not https',
      response: () => bundleCreated('javascript:alert(1)'),
      message: 'deployToComfyApi.bundleUnavailable',
      reported: true
    }
  ])(
    'shows a message and opens nothing when $when',
    async ({ response, message, reported }) => {
      respondWith(response())

      await expect(useInstallationDeploy().deploy()).resolves.toBe(false)

      expect(useToast().error).toHaveBeenCalledExactlyOnceWith(t(message))
      expect(window.open).not.toHaveBeenCalled()
      expect(vi.mocked(reportError).mock.calls.length > 0).toBe(reported)
    }
  )
})
