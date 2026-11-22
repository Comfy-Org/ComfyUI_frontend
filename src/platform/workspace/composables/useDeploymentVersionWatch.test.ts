import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import enMessages from '@/locales/en/main.json'
import {
  DEPLOYMENT_VERSION_FOCUS_GAP_MS,
  DEPLOYMENT_VERSION_WATCH_MS
} from '@/platform/workspace/api/deploymentListingTimeouts'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useDeploymentVersionWatch } from './useDeploymentVersionWatch'

const listDeployments = vi.hoisted(() => vi.fn())

vi.mock<unknown>(import('@/platform/workspace/api/workspaceApi'), () => ({
  workspaceApi: {
    listDeployments,
    getReleaseUnsupportedPacks: async () => ({ release_id: 'r-2', packs: [] })
  }
}))
vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry/reportError'))

type WorkspaceDeploymentList = Awaited<
  ReturnType<typeof workspaceApi.listDeployments>
>

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

let visibility: DocumentVisibilityState = 'visible'

function setVisibility(state: DocumentVisibilityState) {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

async function bootWatch(active = ref(true)) {
  const reload = vi.fn()
  await useDeploymentPickStore().loadOnce()
  render(
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
  return { reload, active }
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
    listDeployments
      .mockResolvedValueOnce(booted)
      .mockResolvedValue({
        ...booted,
        picked_deployment_id: null,
        pick_source: 'workspace_default'
      })
    await bootWatch()

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_VERSION_WATCH_MS)

    expect(titles()).toEqual([
      'This browser now runs on Comfy Cloud. Reload to get its nodes.'
    ])
  })
})
