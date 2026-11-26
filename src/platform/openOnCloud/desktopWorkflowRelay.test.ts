import type { DetachedWindowAPI } from 'happy-dom'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import {
  getBuildTimeComfyCloudBaseUrl,
  getComfyCloudBaseUrl
} from '@/config/comfyApi'
import * as distributionTypes from '@/platform/distribution/types'
import { localOpenOnCloudRollout } from '@/platform/openOnCloud/localOpenOnCloudRollout'
import {
  handleDesktopWorkflowHandoff,
  stageDesktopWorkflowHandoff
} from '@/platform/openOnCloud/desktopWorkflowRelay'
import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'
import { api } from '@/scripts/api'
import { defaultGraph } from '@/scripts/defaultGraph'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/openOnCloud/localOpenOnCloudRollout'), async () => {
  const { shallowRef } = await import('vue')
  return {
    localOpenOnCloudRollout: shallowRef({ open_on_cloud_enabled: true })
  }
})
vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: false,
  isDesktop: true,
  isNightly: false
}))

const { happyDOM } = window as unknown as { happyDOM: DetachedWindowAPI }

function openAt(url: string) {
  const previous = window.location.href
  happyDOM.setURL(url)
  onTestFinished(() => happyDOM.setURL(previous))
}

function showSplash() {
  const splash = document.createElement('div')
  splash.id = 'splash-loader'
  document.body.append(splash)
  onTestFinished(() => splash.remove())
  return splash
}

async function stagedRelay() {
  let record: unknown
  vi.mocked(api.storeUserData).mockImplementation(async (_file, data) => {
    record = data
    return new Response(null, { status: 200 })
  })
  const relay = await stageDesktopWorkflowHandoff('portrait', defaultGraph)
  assert.isDefined(relay)
  vi.mocked(api.getUserData).mockResolvedValue(Response.json(record))
  return { relay, record: record as { destination: string } }
}

function relayed() {
  return vi.spyOn(window.location, 'replace').mockImplementation(() => {})
}

describe(handleDesktopWorkflowHandoff, () => {
  beforeEach(() => {
    openAt('http://127.0.0.1:8000/')
    api.user = 'desktop-user'
    vi.mocked(fetch).mockImplementation(async () => Response.json({}))
    useRemoteConfigStore().acceptConfig({ open_on_cloud_enabled: true }, false)
  })

  it('lets the editor boot when the URL carries no relay', async () => {
    await expect(handleDesktopWorkflowHandoff()).resolves.toBe(false)
  })

  it.for([
    { isCloud: false, url: 'http://127.0.0.1:8000/?workflow=a#graph' },
    { isCloud: true, url: 'https://cloud.comfy.org/?workflow=a#graph' }
  ])(
    'leaves an ordinary boot untouched on isCloud=$isCloud',
    async ({ isCloud, url }) => {
      vi.mocked(distributionTypes).isCloud = isCloud
      onTestFinished(() => {
        vi.mocked(distributionTypes).isCloud = false
      })
      openAt(url)
      const splash = showSplash()
      splash.textContent = 'Loading'
      const replace = relayed()
      const replaceState = vi.spyOn(window.history, 'replaceState')
      sessionStorage.clear()

      await expect(handleDesktopWorkflowHandoff()).resolves.toBe(false)

      expect(api.getUserData).not.toHaveBeenCalled()
      expect(api.deleteUserData).not.toHaveBeenCalled()
      expect(api.storeUserData).not.toHaveBeenCalled()
      expect(replace).not.toHaveBeenCalled()
      expect(replaceState).not.toHaveBeenCalled()
      expect(sessionStorage).toHaveLength(0)
      expect(window.location.href).toBe(url)
      expect(splash.textContent).toBe('Loading')
    }
  )

  it('explains why the relay cannot continue while Open on Cloud is off', async () => {
    const { relay } = await stagedRelay()
    openAt(relay)
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ open_on_cloud_enabled: false })
    )
    const replace = relayed()
    const splash = showSplash()
    splash.textContent = 'Loading'

    await expect(handleDesktopWorkflowHandoff()).resolves.toBe(true)

    expect(api.getUserData).not.toHaveBeenCalled()
    expect(api.deleteUserData).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(api.user).toBe('desktop-user')
    expect(splash.textContent).toBe(
      'Open on Comfy Cloud is currently unavailable for this editor.'
    )
    expect(splash.getAttribute('aria-label')).toBe(splash.textContent)
  })

  it('consumes the staged transfer once and forwards to Comfy Cloud', async () => {
    const { relay, record } = await stagedRelay()
    openAt(relay)
    const replace = relayed()

    await expect(handleDesktopWorkflowHandoff()).resolves.toBe(true)

    expect(new URL(record.destination).origin).toBe(
      new URL(getComfyCloudBaseUrl()).origin
    )
    expect(replace).toHaveBeenCalledExactlyOnceWith(record.destination)
    expect(api.deleteUserData).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/^open-on-cloud\/[\da-f-]{36}\.json$/)
    )
    expect(api.storeUserData).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ overwrite: false })
    )
  })

  it('offers a retry without consuming the transfer when rollout verification fails', async () => {
    const { relay, record } = await stagedRelay()
    openAt(relay)
    const splash = showSplash()
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }))
    const replace = relayed()

    await expect(handleDesktopWorkflowHandoff()).resolves.toBe(true)

    expect(api.getUserData).not.toHaveBeenCalled()
    expect(api.deleteUserData).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(splash.textContent).toContain('Reload this tab to try again.')

    vi.mocked(fetch).mockResolvedValue(Response.json({}))
    await expect(handleDesktopWorkflowHandoff()).resolves.toBe(true)

    expect(replace).toHaveBeenCalledExactlyOnceWith(record.destination)
    expect(api.deleteUserData).toHaveBeenCalledOnce()
  })

  it('forwards an already staged transfer from a signed-out browser', async () => {
    const { relay, record } = await stagedRelay()
    useRemoteConfigStore().acceptConfig({}, false)
    openAt(relay)
    const replace = relayed()

    await expect(handleDesktopWorkflowHandoff()).resolves.toBe(true)

    expect(replace).toHaveBeenCalledExactlyOnceWith(record.destination)
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      '/api/features',
      expect.objectContaining({ cache: 'no-store' })
    )
  })

  it('does not stage a transfer when the toolbar is disabled', async () => {
    const rollout = vi
      .spyOn(localOpenOnCloudRollout, 'value', 'get')
      .mockReturnValue({ open_on_cloud_enabled: false })
    onTestFinished(() => rollout.mockRestore())

    await expect(
      stageDesktopWorkflowHandoff('portrait', defaultGraph)
    ).resolves.toBeUndefined()

    expect(api.storeUserData).not.toHaveBeenCalled()
  })

  it('does not stage a transfer when the local server disables the relay', async () => {
    useRemoteConfigStore().acceptConfig({ open_on_cloud_enabled: false }, false)

    await expect(
      stageDesktopWorkflowHandoff('portrait', defaultGraph)
    ).resolves.toBeUndefined()

    expect(api.storeUserData).not.toHaveBeenCalled()
  })

  it('accepts a relay URL on the trusted Cloud origin with a rollout override', async () => {
    const trusted = new URL(getBuildTimeComfyCloudBaseUrl())
    trusted.searchParams.set('ff', 'open_on_cloud_enabled:true')
    const features = {
      comfy_cloud_base_url: trusted.href,
      open_on_cloud_enabled: true
    }
    useRemoteConfigStore().acceptConfig(features, false)
    const { relay, record } = await stagedRelay()
    expect(new URL(record.destination).origin).toBe(trusted.origin)
    useRemoteConfigStore().acceptConfig({}, false)
    openAt(relay)
    vi.mocked(fetch).mockResolvedValue(Response.json(features))
    const replace = relayed()

    await expect(handleDesktopWorkflowHandoff()).resolves.toBe(true)

    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      '/api/features',
      expect.objectContaining({ cache: 'no-store' })
    )
    expect(replace).toHaveBeenCalledExactlyOnceWith(record.destination)
  })

  it('leaves an existing transfer unread if the relay sees a different Cloud origin', async () => {
    const { relay } = await stagedRelay()
    openAt(relay)
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        comfy_cloud_base_url: 'https://custom-cloud.example.com',
        open_on_cloud_enabled: true
      })
    )
    const replace = relayed()

    await expect(handleDesktopWorkflowHandoff()).resolves.toBe(true)

    expect(api.getUserData).not.toHaveBeenCalled()
    expect(api.deleteUserData).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it.for<{
    name: string
    arrange: (relay: string) => string | void
    deleteAttempts?: number
  }>([
    {
      name: 'a nonce that is not a uuid',
      arrange: (relay) => {
        const url = new URL(relay)
        url.searchParams.set('desktop_workflow', 'not-a-uuid')
        return url.href
      }
    },
    {
      name: 'a relay page on a public origin',
      arrange: (relay) => {
        const url = new URL(relay)
        return `https://comfy.example.com/${url.search}`
      }
    },
    {
      name: 'a transfer the server no longer has',
      arrange: () => {
        vi.mocked(api.getUserData).mockResolvedValue(
          new Response(null, { status: 404 })
        )
      }
    },
    {
      name: 'an expired transfer',
      deleteAttempts: 1,
      arrange: () => {
        vi.setSystemTime(Date.now() + 11 * 60_000)
      }
    },
    {
      name: 'a destination outside Comfy Cloud',
      deleteAttempts: 1,
      arrange: () => {
        vi.mocked(api.getUserData).mockResolvedValue(
          Response.json({
            destination: 'https://evil.example/#desktop_workflow=x',
            expiresAt: Date.now() + 60_000
          })
        )
      }
    },
    {
      name: 'a transfer with malformed JSON',
      deleteAttempts: 1,
      arrange: () => {
        vi.mocked(api.getUserData).mockResolvedValue(new Response('{'))
      }
    },
    {
      name: 'a transfer that cannot be removed',
      deleteAttempts: 1,
      arrange: () => {
        vi.mocked(api.deleteUserData).mockResolvedValue(
          new Response(null, { status: 500 })
        )
      }
    },
    {
      name: 'a server that cannot be reached',
      arrange: () => {
        vi.mocked(api.getUserData).mockRejectedValue(new TypeError('offline'))
      }
    }
  ])(
    'refuses $name and says the transfer failed',
    async ({ arrange, deleteAttempts = 0 }) => {
      const { relay } = await stagedRelay()
      openAt(arrange(relay) ?? relay)
      const replace = relayed()
      const splash = showSplash()

      await expect(handleDesktopWorkflowHandoff()).resolves.toBe(true)

      expect(replace).not.toHaveBeenCalled()
      expect(api.deleteUserData).toHaveBeenCalledTimes(deleteAttempts)
      expect(splash.textContent).not.toBe('')
    }
  )
})
