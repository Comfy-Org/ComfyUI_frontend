import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { downloadBlob } from '@/base/common/downloadUtil'
import en from '@/locales/en/main.json'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type {
  PlatformTab,
  PlatformTabOpener
} from '@/platform/workflow/deploy/composables/usePlatformBuildHandoff'
import {
  findCloudWorkflowId,
  usePlatformBuildHandoff
} from '@/platform/workflow/deploy/composables/usePlatformBuildHandoff'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'

const distribution = vi.hoisted(() => ({ isCloud: true, isDesktop: false }))
vi.mock(import('@/platform/distribution/types'), () => distribution)

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadBlob: vi.fn()
}))

const prepareWorkflowJson = vi.hoisted(() => vi.fn<() => ComfyWorkflowJSON>())
vi.mock(import('@/platform/workflow/core/services/workflowService'), () => ({
  useWorkflowService: () =>
    fromPartial<ReturnType<typeof useWorkflowService>>({
      prepareWorkflowJson
    })
}))

const PLATFORM = 'https://platform.comfy.org'
const IMPORT_STEP = `${PLATFORM}/profile/builds/new?step=import`
const HANDOFF_LINK = new RegExp(
  `^${IMPORT_STEP.replaceAll('?', '\\?')}&handoff=[A-Za-z0-9_-]{16,64}$`
)

function graph(label: string): ComfyWorkflowJSON {
  return {
    last_node_id: 0,
    last_link_id: 0,
    nodes: [],
    links: [],
    groups: [],
    config: {},
    extra: { label },
    version: 0.4
  }
}

function openWorkflow({
  path = 'workflows/portrait-upscale.json',
  temporary = false,
  modified = false
}: { path?: string; temporary?: boolean; modified?: boolean } = {}) {
  const workflow = new ComfyWorkflow({
    path,
    modified: 0,
    size: temporary ? -1 : 1
  })
  workflow.isModified = modified
  Object.assign(useWorkflowStore(), { activeWorkflow: workflow })
  return workflow
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

interface FakeTabsState {
  blocked: boolean
  closed: boolean
  opened: string[]
  disowned: string[]
  posted: { message: unknown; targetOrigin: string }[]
  navigated: string[]
}

function fakeTabs() {
  const state: FakeTabsState = {
    blocked: false,
    closed: false,
    opened: [],
    disowned: [],
    posted: [],
    navigated: []
  }
  const tab: PlatformTab = {
    get closed() {
      return state.closed
    },
    isSourceOf: (event) => event.source === window,
    postMessage: (message, targetOrigin) => {
      state.posted.push({ message, targetOrigin })
    },
    navigate: (url) => {
      state.navigated.push(url)
    }
  }
  const opener: PlatformTabOpener = {
    open: (url) => {
      state.opened.push(url)
      return state.blocked ? undefined : tab
    },
    openDisowned: (url) => {
      state.disowned.push(url)
    }
  }
  return { opener, state }
}

function wizardSays(
  data: unknown,
  {
    source = window,
    origin = PLATFORM
  }: { source?: Window | null; origin?: string } = {}
) {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source }))
}

function handoffNonce(url: string | undefined): string | null {
  return url ? new URL(url).searchParams.get('handoff') : null
}

describe('findCloudWorkflowId', () => {
  function page(
    names: string[],
    { more = false, cursor }: { more?: boolean; cursor?: string } = {}
  ): Response {
    return new Response(
      JSON.stringify({
        data: names.map((name, index) => ({
          id: `${name}#${index}`,
          name,
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
          created_by: 'user-1',
          latest_version: 1
        })),
        pagination: {
          has_more: more,
          next_cursor: cursor,
          limit: 100,
          offset: 0,
          total: names.length
        }
      }),
      { status: 200 }
    )
  }

  function serve(responses: Response[]) {
    const fetchApi = vi.spyOn(api, 'fetchApi')
    for (const response of responses) fetchApi.mockResolvedValueOnce(response)
    return fetchApi
  }

  const name = 'portrait-upscale'
  const others = ['portrait-upscale-v2']

  it.for([
    {
      case: 'the exact name on the first page',
      responses: () => [page([...others, name])],
      id: `${name}#1`,
      requests: 1
    },
    {
      case: 'the exact name on a later page',
      responses: () => [
        page(others, { more: true, cursor: 'c2' }),
        page([name])
      ],
      id: `${name}#0`,
      requests: 2
    },
    {
      case: 'two exact names on one page',
      responses: () => [page([name, name])],
      id: undefined,
      requests: 1
    },
    {
      case: 'two exact names split across pages',
      responses: () => [
        page([name], { more: true, cursor: 'c2' }),
        page([name])
      ],
      id: undefined,
      requests: 2
    },
    {
      case: 'the exact name on the twentieth page',
      responses: () => [
        ...Array.from({ length: 19 }, (_, index) =>
          page(others, { more: true, cursor: `c${index + 2}` })
        ),
        page([name])
      ],
      id: `${name}#0`,
      requests: 20
    },
    {
      case: 'more pages still after the twentieth',
      responses: () => [
        page([name], { more: true, cursor: 'c2' }),
        ...Array.from({ length: 19 }, (_, index) =>
          page(others, { more: true, cursor: `c${index + 3}` })
        )
      ],
      id: undefined,
      requests: 20
    },
    {
      case: 'more pages with no cursor to reach them',
      responses: () => [page([name], { more: true })],
      id: undefined,
      requests: 1
    },
    {
      case: 'a cursor that cycles back',
      responses: () => [
        page([name], { more: true, cursor: 'a' }),
        page(others, { more: true, cursor: 'b' }),
        page(others, { more: true, cursor: 'a' })
      ],
      id: undefined,
      requests: 3
    },
    {
      case: 'a failed request',
      responses: () => [new Response('', { status: 500 })],
      id: undefined,
      requests: 1
    },
    {
      case: 'a body that is not JSON',
      responses: () => [new Response('<html>', { status: 200 })],
      id: undefined,
      requests: 1
    },
    {
      case: 'a body outside the schema',
      responses: () => [
        new Response(JSON.stringify({ data: 'none' }), { status: 200 })
      ],
      id: undefined,
      requests: 1
    }
  ])(
    'answers $id after $requests request(s) for $case',
    async ({ responses, id, requests }) => {
      const fetchApi = serve(responses())

      await expect(findCloudWorkflowId(name)).resolves.toBe(id)

      expect(fetchApi).toHaveBeenCalledTimes(requests)
    }
  )

  it('asks by name, page by page', async () => {
    const fetchApi = serve([
      page(others, { more: true, cursor: 'c2' }),
      page([name])
    ])

    await findCloudWorkflowId(name)

    expect(fetchApi.mock.calls.map(([route]) => route)).toEqual([
      '/workflows?name=portrait-upscale&limit=100',
      '/workflows?name=portrait-upscale&limit=100&after=c2'
    ])
  })
})

describe('usePlatformBuildHandoff', () => {
  let tabs: ReturnType<typeof fakeTabs>
  let found: ReturnType<typeof deferred<string | undefined>>
  const lookUpCloudId = vi.fn<(name: string) => Promise<string | undefined>>()

  function handoff() {
    return usePlatformBuildHandoff({ tabs: tabs.opener, lookUpCloudId })
  }

  async function lookupAnswers(id: string | undefined) {
    found.resolve(id)
    await found.promise
  }

  function lastOpened(): string | undefined {
    return tabs.state.opened.at(-1)
  }

  function endHandoffs() {
    tabs.state.closed = true
    vi.advanceTimersByTime(1000)
    expect(vi.getTimerCount()).toBe(0)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    distribution.isCloud = true
    distribution.isDesktop = false
    tabs = fakeTabs()
    found = deferred<string | undefined>()
    lookUpCloudId.mockImplementation(() => found.promise)
    prepareWorkflowJson.mockReturnValue(graph('canvas'))
  })

  describe('on Cloud', () => {
    it('opens the wizard on the saved workflow, looked up while the card was open', async () => {
      openWorkflow()
      const { open } = handoff()
      await lookupAnswers('wf_123')

      await expect(open()).resolves.toBe(true)

      expect(lookUpCloudId).toHaveBeenCalledWith('portrait-upscale')
      expect(tabs.state.opened).toEqual([`${IMPORT_STEP}&workflow=wf_123`])
      expect(prepareWorkflowJson).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
    })

    it('opens the tab before anything is awaited, so the click still counts', () => {
      openWorkflow({ modified: true })

      void handoff().open()

      expect(tabs.state.opened).toHaveLength(1)
      expect(lastOpened()).toMatch(HANDOFF_LINK)
      endHandoffs()
    })

    it('looks an app workflow up under its file-derived name', () => {
      openWorkflow({ path: 'workflows/portrait-upscale.app.json' })

      handoff()

      expect(lookUpCloudId).toHaveBeenCalledWith('portrait-upscale.app')
    })

    it('hands a different workflow of the same name over the tab, not by the first one’s id', async () => {
      openWorkflow()
      const { open } = handoff()
      openWorkflow({ path: 'workflows/elsewhere/portrait-upscale.json' })
      prepareWorkflowJson.mockReturnValue(graph('workflow B'))
      await lookupAnswers('wf_A')

      await open()
      const nonce = handoffNonce(lastOpened())
      wizardSays({ type: 'comfy-build-handoff:ready', nonce })

      expect(lastOpened()).toMatch(HANDOFF_LINK)
      expect(tabs.state.posted).toEqual([
        {
          message: {
            type: 'comfy-build-handoff:workflow',
            nonce,
            filename: 'portrait-upscale.json',
            workflow: graph('workflow B')
          },
          targetOrigin: PLATFORM
        }
      ])
      expect(vi.getTimerCount()).toBe(0)
    })

    it('hands the workflow over the tab when it changed after the card opened', async () => {
      const workflow = openWorkflow()
      const { open } = handoff()
      await lookupAnswers('wf_123')
      workflow.isModified = true

      await expect(open()).resolves.toBe(true)

      expect(lastOpened()).toMatch(HANDOFF_LINK)
      endHandoffs()
    })

    it('hands the workflow over the tab when the lookup has not finished', async () => {
      openWorkflow()

      await expect(handoff().open()).resolves.toBe(true)

      expect(lastOpened()).toMatch(HANDOFF_LINK)
      endHandoffs()
    })

    it('reports a lookup that throws and hands the workflow over the tab', async () => {
      openWorkflow()
      const { open } = handoff()
      found.reject(new Error('offline'))
      await found.promise.catch(() => undefined)

      await open()

      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ errorType: expect.any(String) })
      )
      expect(lastOpened()).toMatch(HANDOFF_LINK)
      endHandoffs()
    })

    it('never looks up an unsaved workflow; it goes over the tab as the canvas shows it', async () => {
      openWorkflow({ temporary: true })

      await handoff().open()

      expect(lookUpCloudId).not.toHaveBeenCalled()
      expect(lastOpened()).toMatch(HANDOFF_LINK)
      endHandoffs()
    })

    it('gives the Cloud link in a toast when the popup was blocked', async () => {
      openWorkflow()
      const { open } = handoff()
      await lookupAnswers('wf_123')
      tabs.state.blocked = true
      const toast = vi.spyOn(useToastStore(), 'add')

      await expect(open()).resolves.toBe(false)

      expect(downloadBlob).not.toHaveBeenCalled()
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: `${IMPORT_STEP}&workflow=wf_123`
        })
      )
    })
  })

  describe('over the opener tab', () => {
    beforeEach(() => {
      distribution.isCloud = false
    })

    it('answers the wizard that carries its nonce, once, at the platform origin only', async () => {
      openWorkflow({ path: 'workflows/portrait-upscale.app.json' })

      await handoff().open()
      const nonce = handoffNonce(lastOpened())
      wizardSays({ type: 'comfy-build-handoff:ready', nonce })
      wizardSays({ type: 'comfy-build-handoff:ready', nonce })

      expect(tabs.state.posted).toEqual([
        {
          message: {
            type: 'comfy-build-handoff:workflow',
            nonce,
            filename: 'portrait-upscale.app.json',
            workflow: graph('canvas')
          },
          targetOrigin: PLATFORM
        }
      ])
      expect(vi.getTimerCount()).toBe(0)
    })

    it('uses a fresh nonce for every click', async () => {
      openWorkflow()
      const { open } = handoff()

      await open()
      await open()

      const [first, second] = tabs.state.opened.map(handoffNonce)
      expect(first).not.toBeNull()
      expect(second).not.toBe(first)
      endHandoffs()
    })

    it.for([
      {
        case: 'a wrong nonce',
        says: () => ({ type: 'comfy-build-handoff:ready', nonce: 'not-ours' })
      },
      {
        case: 'another message type',
        says: (nonce: string | null) => ({ type: 'something-else', nonce })
      },
      {
        case: 'a window we did not open',
        says: (nonce: string | null) => ({
          type: 'comfy-build-handoff:ready',
          nonce
        }),
        source: null
      },
      {
        case: 'a page on another origin in that tab',
        says: (nonce: string | null) => ({
          type: 'comfy-build-handoff:ready',
          nonce
        }),
        origin: 'https://idp.example.com'
      }
    ])(
      'keeps the workflow to itself on $case, and still answers the real wizard after',
      async ({ says, source, origin }) => {
        openWorkflow()

        await handoff().open()
        const nonce = handoffNonce(lastOpened())
        wizardSays(says(nonce), { source, origin })
        expect(tabs.state.posted).toEqual([])
        wizardSays({ type: 'comfy-build-handoff:ready', nonce })

        expect(tabs.state.posted).toHaveLength(1)
        expect(vi.getTimerCount()).toBe(0)
      }
    )

    it('stops listening once the tab is closed', async () => {
      openWorkflow()

      await handoff().open()
      const nonce = handoffNonce(lastOpened())
      tabs.state.closed = true
      vi.advanceTimersByTime(1000)
      wizardSays({ type: 'comfy-build-handoff:ready', nonce })

      expect(tabs.state.posted).toEqual([])
      expect(vi.getTimerCount()).toBe(0)
    })

    it('gives up once the wizard has had long enough to ask', async () => {
      openWorkflow()

      await handoff().open()
      const nonce = handoffNonce(lastOpened())
      vi.advanceTimersByTime(60_000)
      wizardSays({ type: 'comfy-build-handoff:ready', nonce })

      expect(tabs.state.posted).toEqual([])
      expect(vi.getTimerCount()).toBe(0)
    })

    it('sends the tab to the plain import step when the workflow cannot be prepared', async () => {
      openWorkflow()
      prepareWorkflowJson.mockImplementation(() => {
        throw new Error('cannot serialize')
      })

      await expect(handoff().open()).resolves.toBe(true)

      expect(tabs.state.navigated).toEqual([IMPORT_STEP])
      expect(reportError).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    })

    it('when the popup was blocked, starts a download of the workflow file and says so', async () => {
      openWorkflow()
      tabs.state.blocked = true
      const toast = vi.spyOn(useToastStore(), 'add')

      await expect(handoff().open()).resolves.toBe(false)

      expect(downloadBlob).toHaveBeenCalledOnce()
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: en.deployToComfyApi.popupBlockedDownloadStarted,
          detail: IMPORT_STEP
        })
      )
      expect(vi.getTimerCount()).toBe(0)
    })

    it('when the popup was blocked and the download cannot start, reports it and gives only the link', async () => {
      openWorkflow()
      vi.mocked(downloadBlob).mockImplementation(() => {
        throw new Error('downloads disabled')
      })
      tabs.state.blocked = true
      const toast = vi.spyOn(useToastStore(), 'add')

      await expect(handoff().open()).resolves.toBe(false)

      expect(reportError).toHaveBeenCalledOnce()
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: en.deployToComfyApi.popupBlocked,
          detail: IMPORT_STEP
        })
      )
    })

    it('when the popup was blocked and the workflow cannot be prepared, gives only the link', async () => {
      openWorkflow()
      prepareWorkflowJson.mockImplementation(() => {
        throw new Error('cannot serialize')
      })
      tabs.state.blocked = true
      const toast = vi.spyOn(useToastStore(), 'add')

      await expect(handoff().open()).resolves.toBe(false)

      expect(downloadBlob).not.toHaveBeenCalled()
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: en.deployToComfyApi.popupBlocked,
          detail: IMPORT_STEP
        })
      )
    })

    it('sends the tab to the plain import step when the workflow fails the workflow schema', async () => {
      openWorkflow()
      prepareWorkflowJson.mockReturnValue(
        fromPartial<ComfyWorkflowJSON>({ version: 0.4 })
      )

      await handoff().open()

      expect(tabs.state.navigated).toEqual([IMPORT_STEP])
      expect(reportError).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    })

    it('sends as soon as the workflow is ready when the wizard asked first', async () => {
      openWorkflow()
      const { open } = handoff()

      const opening = open()
      const nonce = handoffNonce(lastOpened())
      wizardSays({ type: 'comfy-build-handoff:ready', nonce })
      expect(tabs.state.posted).toEqual([])
      await opening

      expect(tabs.state.posted).toHaveLength(1)
      expect(vi.getTimerCount()).toBe(0)
    })
  })

  describe('on Desktop, where new windows go to the system browser', () => {
    beforeEach(() => {
      distribution.isCloud = false
      distribution.isDesktop = true
    })

    it('downloads the workflow file under its name, then opens the plain import step', async () => {
      openWorkflow()
      const events: string[] = []
      vi.mocked(downloadBlob).mockImplementation(() => {
        events.push('download')
      })
      const openDisowned = tabs.opener.openDisowned
      tabs.opener.openDisowned = (url) => {
        events.push('openDisowned')
        openDisowned(url)
      }

      await expect(handoff().open()).resolves.toBe(true)

      expect(events).toEqual(['download', 'openDisowned'])
      const [filename, blob] = vi.mocked(downloadBlob).mock.calls[0]
      expect(filename).toBe('portrait-upscale.json')
      expect(JSON.parse(await blob.text())).toEqual(graph('canvas'))
      expect(tabs.state.disowned).toEqual([IMPORT_STEP])
      expect(tabs.state.opened).toEqual([])
    })

    it('still opens the import step when the workflow cannot be prepared', async () => {
      openWorkflow()
      prepareWorkflowJson.mockImplementation(() => {
        throw new Error('cannot serialize')
      })

      await expect(handoff().open()).resolves.toBe(true)

      expect(downloadBlob).not.toHaveBeenCalled()
      expect(tabs.state.disowned).toEqual([IMPORT_STEP])
      expect(reportError).toHaveBeenCalledOnce()
    })
  })

  it('opens the plain import step when no workflow is open', async () => {
    distribution.isCloud = false
    useWorkflowStore().activeWorkflow = null

    await expect(handoff().open()).resolves.toBe(true)

    expect(tabs.state.opened).toEqual([IMPORT_STEP])
  })
})

describe('the browser tab adapter', () => {
  function openedWindow() {
    const posted: { message: unknown; targetOrigin: string }[] = []
    const location = { href: '' }
    const tab = fromPartial<Window>({
      closed: false,
      location: fromPartial<Location>(location),
      postMessage: (message: unknown, targetOrigin: string) => {
        posted.push({ message, targetOrigin })
      }
    })
    return { tab, posted, location }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    distribution.isCloud = false
    distribution.isDesktop = false
    prepareWorkflowJson.mockReturnValue(graph('canvas'))
  })

  it('opens the handoff with its opener kept and talks only to the window it opened', async () => {
    openWorkflow()
    const { tab, posted } = openedWindow()
    const open = vi.spyOn(window, 'open').mockReturnValue(tab)

    await usePlatformBuildHandoff().open()
    const [url, target, features] = open.mock.calls[0]
    const nonce = handoffNonce(String(url))
    wizardSays({ type: 'comfy-build-handoff:ready', nonce }, { source: window })
    expect(posted).toEqual([])
    wizardSays({ type: 'comfy-build-handoff:ready', nonce }, { source: tab })

    expect(String(url)).toMatch(HANDOFF_LINK)
    expect([target, features]).toEqual(['_blank', undefined])
    expect(posted).toEqual([
      {
        message: expect.objectContaining({
          type: 'comfy-build-handoff:workflow',
          nonce
        }),
        targetOrigin: PLATFORM
      }
    ])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('navigates the window it opened when the workflow cannot be prepared', async () => {
    openWorkflow()
    prepareWorkflowJson.mockImplementation(() => {
      throw new Error('cannot serialize')
    })
    const { tab, location } = openedWindow()
    vi.spyOn(window, 'open').mockReturnValue(tab)

    await usePlatformBuildHandoff().open()

    expect(location.href).toBe(IMPORT_STEP)
  })

  it('reports a refused popup as no tab', async () => {
    openWorkflow()
    vi.spyOn(window, 'open').mockReturnValue(null)

    await expect(usePlatformBuildHandoff().open()).resolves.toBe(false)
  })

  it('opens Desktop disowned, with noopener', async () => {
    distribution.isDesktop = true
    openWorkflow()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)

    await expect(usePlatformBuildHandoff().open()).resolves.toBe(true)

    expect(open).toHaveBeenCalledExactlyOnceWith(
      IMPORT_STEP,
      '_blank',
      'noopener'
    )
  })
})
