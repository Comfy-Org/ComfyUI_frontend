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

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import * as distributionTypes from '@/platform/distribution/types'
import {
  handleDesktopWorkflowHandoff,
  stageDesktopWorkflowHandoff
} from '@/platform/openOnCloud/desktopWorkflowRelay'
import { api } from '@/scripts/api'
import { defaultGraph } from '@/scripts/defaultGraph'

vi.mock(import('@/scripts/api'))
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

  it.for<{ name: string; arrange: (relay: string) => string | void }>([
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
      arrange: () => {
        vi.setSystemTime(Date.now() + 11 * 60_000)
      }
    },
    {
      name: 'a destination outside Comfy Cloud',
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
      name: 'a transfer that cannot be removed',
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
  ])('refuses $name and says the transfer failed', async ({ arrange }) => {
    const { relay } = await stagedRelay()
    openAt(arrange(relay) ?? relay)
    const replace = relayed()
    const splash = showSplash()

    await expect(handleDesktopWorkflowHandoff()).resolves.toBe(true)

    expect(replace).not.toHaveBeenCalled()
    expect(splash).toHaveTextContent(
      'Your workflow could not be transferred. Click Open on Comfy Cloud in Desktop again.'
    )
  })
})
