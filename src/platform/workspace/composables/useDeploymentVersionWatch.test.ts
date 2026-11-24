import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import enMessages from '@/locales/en/main.json'
import {
  DEPLOYMENT_VERSION_FOCUS_GAP_MS,
  DEPLOYMENT_VERSION_WATCH_MS
} from '@/platform/workspace/api/deploymentListingTimeouts'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useReleaseNoticeStore } from '@/platform/workspace/stores/releaseNoticeStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useDeploymentVersionWatch } from './useDeploymentVersionWatch'

vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry/reportError'))

type WorkspaceDeploymentList = Awaited<
  ReturnType<typeof workspaceApi.listDeployments>
>

const listDeployments = vi.mocked(workspaceApi.listDeployments)

const D2 = 'dep-a2a2a2a2-0000-4000-8000-000000000002'

const booted: WorkspaceDeploymentList = {
  builds_visible: true,
  picked_deployment_id: D2,
  pick_source: 'browser',
  items: [
    {
      deployment_id: D2,
      deployment_name: 'production',
      release_id: 'r-2',
      build_id: 'b-1',
      build_name: 'Studio Build',
      release_version: 2,
      status: 'ready',
      can_start: false,
      created_at: '2026-10-01T00:00:00Z'
    }
  ]
}

function onRelease(
  releaseId: string,
  version: number | undefined
): WorkspaceDeploymentList {
  return {
    ...booted,
    items: [
      { ...booted.items[0], release_id: releaseId, release_version: version }
    ]
  }
}

const moved = onRelease('r-3', 3)
const NOTICE = 'Studio Build · production now runs v3. Reload to use its nodes.'
const NOTICE_V4 =
  'Studio Build · production now runs v4. Reload to use its nodes.'

let visibility: DocumentVisibilityState = 'visible'

function setVisibility(state: DocumentVisibilityState) {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

async function bootWatch(active = ref(true)) {
  const reload = vi.fn()
  await useDeploymentPickStore().loadOnce()
  const { unmount } = render(
    {
      setup() {
        useDeploymentVersionWatch({ active, reload })
      },
      template: '<div />'
    },
    {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: enMessages }
          })
        ]
      }
    }
  )
  return { reload, active, unmount }
}

function deferListing() {
  let resolve: (listing: WorkspaceDeploymentList) => void = () => {}
  const promise = new Promise<WorkspaceDeploymentList>((settle) => {
    resolve = settle
  })
  return {
    promise,
    resolve: (listing: WorkspaceDeploymentList) => resolve(listing)
  }
}

function titles() {
  return useToast().toasts.map((toast) => toast.title)
}

async function focusWindow() {
  window.dispatchEvent(new Event('focus'))
  await vi.advanceTimersByTimeAsync(0)
}

describe('useDeploymentVersionWatch', () => {
  beforeEach(() => {
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    vi.mocked(workspaceApi.getReleaseUnsupportedPacks).mockResolvedValue({
      release_id: 'r-2',
      packs: []
    })
    visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility
    })
    onTestFinished(() => {
      Reflect.deleteProperty(document, 'visibilityState')
    })
  })

  it('re-reads the listing every 30 s and says once that the version changed', async () => {
    listDeployments.mockResolvedValueOnce(booted).mockResolvedValue(moved)
    await bootWatch()
    expect(listDeployments).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
    expect(listDeployments).toHaveBeenCalledTimes(2)
    expect(titles()).toEqual([NOTICE])

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS * 2)
    expect(listDeployments).toHaveBeenCalledTimes(4)
    expect(titles()).toEqual([NOTICE])
  })

  it('says nothing while the deployment runs the version it booted on', async () => {
    listDeployments.mockResolvedValue(booted)
    await bootWatch()

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS * 2)

    expect(listDeployments).toHaveBeenCalledTimes(3)
    expect(titles()).toEqual([])
  })

  it('names a new version it cannot number', async () => {
    listDeployments
      .mockResolvedValueOnce(booted)
      .mockResolvedValue(onRelease('r-3', undefined))
    await bootWatch()

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)

    expect(titles()).toEqual([
      'Studio Build · production now runs a different version. Reload to use its nodes.'
    ])
  })

  it('reads nothing while the tab is hidden, and once when it shows again', async () => {
    listDeployments.mockResolvedValue(booted)
    await bootWatch()

    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS * 3)
    expect(listDeployments).toHaveBeenCalledOnce()

    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(listDeployments).toHaveBeenCalledTimes(2)
  })

  it('reads on focus, at most once in 10 s', async () => {
    listDeployments.mockResolvedValue(booted)
    await bootWatch()

    await focusWindow()
    expect(listDeployments).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_FOCUS_GAP_MS / 2)
    await focusWindow()
    expect(listDeployments).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_FOCUS_GAP_MS / 2)
    await focusWindow()
    expect(listDeployments).toHaveBeenCalledTimes(3)
  })

  it('reads nothing and says nothing while it is off', async () => {
    listDeployments.mockResolvedValueOnce(booted).mockResolvedValue(moved)
    await bootWatch(ref(false))

    await focusWindow()
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS * 3)

    expect(listDeployments).toHaveBeenCalledOnce()
    expect(titles()).toEqual([])
  })

  it('reloads from Reload, and Later closes the notice for good', async () => {
    listDeployments.mockResolvedValueOnce(booted).mockResolvedValue(moved)
    const { reload } = await bootWatch()
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)

    const [notice] = useToast().toasts
    expect(notice.actions.map((action) => action.label)).toEqual([
      'Reload',
      'Later'
    ])
    notice.actions[0].onClick()
    expect(reload).toHaveBeenCalledOnce()

    notice.actions[1].onClick()
    expect(titles()).toEqual([])
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS * 2)
    expect(titles()).toEqual([])
  })

  it('takes the notice away when the deployment goes back to its boot version', async () => {
    listDeployments
      .mockResolvedValueOnce(booted)
      .mockResolvedValueOnce(moved)
      .mockResolvedValue(booted)
    await bootWatch()

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
    expect(titles()).toEqual([NOTICE])

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
    expect(titles()).toEqual([])
  })

  it('says the browser moved when it now runs another deployment', async () => {
    listDeployments.mockResolvedValueOnce(booted).mockResolvedValue({
      ...booted,
      picked_deployment_id: undefined,
      pick_source: 'workspace_default'
    })
    await bootWatch()

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)

    expect(titles()).toEqual([
      'This browser now runs on Comfy Cloud. Reload to get its nodes.'
    ])
  })

  it('says nothing of a version the editor already told of', async () => {
    listDeployments.mockResolvedValueOnce(booted).mockResolvedValue(moved)
    await bootWatch()
    expect(useReleaseNoticeStore().claim('r-3')).toBe(true)

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)

    expect(titles()).toEqual([])
  })

  it('tells of the new version first, so no other notice repeats it', async () => {
    listDeployments.mockResolvedValueOnce(booted).mockResolvedValue(moved)
    await bootWatch()

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)

    expect(titles()).toEqual([NOTICE])
    expect(useReleaseNoticeStore().claim('r-3')).toBe(false)
  })

  it('tells again of a version it told of before, once the deployment comes back to it', async () => {
    listDeployments
      .mockResolvedValueOnce(booted)
      .mockResolvedValueOnce(moved)
      .mockResolvedValueOnce(booted)
      .mockResolvedValue(moved)
    await bootWatch()

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS * 2)
    expect(titles()).toEqual([])

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
    expect(titles()).toEqual([NOTICE])
  })

  it.for([
    {
      change: 'a later version',
      answer: onRelease('r-4', 4),
      shown: [NOTICE_V4]
    },
    { change: 'the boot version', answer: booted, shown: [] }
  ])(
    'keeps one notice, settled on $change, when the toolbar mounts again',
    async ({ answer, shown }) => {
      listDeployments
        .mockResolvedValueOnce(booted)
        .mockResolvedValueOnce(moved)
        .mockResolvedValue(answer)
      const { unmount } = await bootWatch()
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
      expect(titles()).toEqual([NOTICE])

      unmount()
      await bootWatch()
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)

      expect(titles()).toEqual(shown)
    }
  )

  it.for([
    {
      change: 'a later version',
      answer: onRelease('r-4', 4),
      shown: [NOTICE_V4]
    },
    { change: 'the boot version', answer: booted, shown: [] }
  ])(
    'settles the notice on $change that arrives while the toolbar is away',
    async ({ answer, shown }) => {
      const listing = deferListing()
      listDeployments
        .mockResolvedValueOnce(booted)
        .mockResolvedValueOnce(moved)
        .mockImplementationOnce(() => listing.promise)
        .mockResolvedValue(answer)
      const { unmount } = await bootWatch()
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
      expect(titles()).toEqual([NOTICE])
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
      expect(listDeployments).toHaveBeenCalledTimes(3)

      unmount()
      listing.resolve(answer)
      await vi.advanceTimersByTimeAsync(0)
      expect(titles()).toEqual(shown)

      await bootWatch()
      expect(titles()).toEqual(shown)
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
      expect(titles()).toEqual(shown)
    }
  )

  it.for([
    {
      change: 'a later version',
      answer: onRelease('r-4', 4),
      shown: [NOTICE_V4]
    },
    { change: 'the boot version', answer: booted, shown: [] }
  ])(
    'settles the notice on $change from a listing another caller asks for while the toolbar is away',
    async ({ answer, shown }) => {
      listDeployments
        .mockResolvedValueOnce(booted)
        .mockResolvedValueOnce(moved)
        .mockResolvedValue(answer)
      const { unmount } = await bootWatch()
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
      expect(titles()).toEqual([NOTICE])

      unmount()
      await useDeploymentPickStore().load()
      await nextTick()

      expect(listDeployments).toHaveBeenCalledTimes(3)
      expect(titles()).toEqual(shown)
    }
  )

  it('tells of v3 again when v4 came while the toolbar was away and v3 comes back', async () => {
    const listing = deferListing()
    listDeployments
      .mockResolvedValueOnce(booted)
      .mockResolvedValueOnce(moved)
      .mockImplementationOnce(() => listing.promise)
      .mockResolvedValue(moved)
    const { unmount } = await bootWatch()
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS * 2)

    unmount()
    listing.resolve(onRelease('r-4', 4))
    await vi.advanceTimersByTimeAsync(0)
    await bootWatch()
    expect(titles()).toEqual([NOTICE_V4])

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
    expect(titles()).toEqual([NOTICE])
  })

  it('keeps a notice closed with Later closed when the toolbar mounts again', async () => {
    listDeployments.mockResolvedValueOnce(booted).mockResolvedValue(moved)
    const { unmount } = await bootWatch()
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
    useToast().toasts[0].actions[1].onClick()

    unmount()
    await bootWatch()
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)

    expect(titles()).toEqual([])
  })

  it.for([
    { closed: 'closed with Later', later: true, shown: [] },
    { closed: 'left open', later: false, shown: [NOTICE] }
  ])(
    'keeps a notice $closed after the toolbar hides and shows again',
    async ({ later, shown }) => {
      listDeployments.mockResolvedValueOnce(booted).mockResolvedValue(moved)
      const { active } = await bootWatch()
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
      if (later) useToast().toasts[0].actions[1].onClick()

      active.value = false
      await nextTick()
      expect(titles()).toEqual([])
      active.value = true
      await nextTick()
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)

      expect(titles()).toEqual(shown)
    }
  )

  it('tells of a later version that came while the toolbar was hidden after Later', async () => {
    listDeployments
      .mockResolvedValueOnce(booted)
      .mockResolvedValueOnce(moved)
      .mockResolvedValue(onRelease('r-4', 4))
    const { active } = await bootWatch()
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
    useToast().toasts[0].actions[1].onClick()

    active.value = false
    await nextTick()
    await useDeploymentPickStore().load()
    active.value = true
    await nextTick()

    expect(titles()).toEqual([NOTICE_V4])
  })

  it('tells again of an earlier version it told of, after telling of a later one', async () => {
    listDeployments
      .mockResolvedValueOnce(booted)
      .mockResolvedValueOnce(moved)
      .mockResolvedValueOnce(onRelease('r-4', 4))
      .mockResolvedValue(moved)
    await bootWatch()

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
    expect(titles()).toEqual([NOTICE])

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
    expect(titles()).toEqual([NOTICE_V4])

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)
    expect(titles()).toEqual([NOTICE])
  })
})
