import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { captureOpenWorkflow } from '@/platform/workspace/platformWorkflowHandoff'
import {
  loadedEvent,
  reduceDeploymentPick
} from '@/platform/workspace/deploymentPickState'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useToast } from '@/components/ui/toast/toastStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

import { useReleaseNoticeStore } from '@/platform/workspace/stores/releaseNoticeStore'

import { KEPT_BUILD_KEY } from './platformFrameBuild'
import {
  PLATFORM_FRAME_FINISH_GRACE_MS,
  PLATFORM_FRAME_RESUME_CHECK_MS,
  PLATFORM_FRAME_SIGN_IN_RETRY_MS,
  PLATFORM_FRAME_UNANSWERED_MS,
  usePlatformFrameStore
} from './platformFrameStore'
import type { PlatformFrameRequest } from './platformFrameUrl'

const env = vi.hoisted(() => ({
  cloud: true,
  platformBase: 'https://platform.comfy.org'
}))

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return env.cloud
  }
}))
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => env.platformBase
}))
vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/workspace/platformWorkflowHandoff'), () => ({
  captureOpenWorkflow: vi.fn(() => ({
    filename: 'portrait.json',
    workflow: { nodes: [] }
  }))
}))

const PLATFORM = 'https://platform.comfy.org'

function framedWindow() {
  const postMessage = vi.fn()
  return { frame: fromPartial<Window>({ postMessage }), postMessage }
}

function receive(data: unknown, source: Window) {
  window.dispatchEvent(
    new MessageEvent('message', { data, origin: PLATFORM, source })
  )
}

function query(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams)
}

beforeEach(() => {
  sessionStorage.clear()
  env.cloud = true
  env.platformBase = PLATFORM
  Object.assign(useFeatureFlags().flags, {
    customDeploymentsEditorEnabled: true
  })
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-1' })
  const authStore = useAuthStore()
  authStore.currentUser = fromPartial<User>({ uid: 'uid-ana' })
  vi.spyOn(authStore, 'getIdToken').mockResolvedValue('aaa.bbb.ccc')
})

afterEach(() => {
  usePlatformFrameStore().close()
})

describe('usePlatformFrameStore', () => {
  it.for([
    {
      label: 'the flag is off',
      setUp: () =>
        Object.assign(useFeatureFlags().flags, {
          customDeploymentsEditorEnabled: false
        })
    },
    {
      label: 'the editor is not Comfy Cloud',
      setUp: () => {
        env.cloud = false
      }
    },
    {
      label: 'the Platform address is not a web address',
      setUp: () => {
        env.platformBase = 'javascript:alert(1)'
      }
    }
  ])('opens nothing when $label', ({ setUp }) => {
    setUp()
    const store = usePlatformFrameStore()

    expect(store.isAvailable()).toBe(false)
    expect(store.open({ step: 'new' })).toBe(false)
    expect(store.session).toBeNull()
  })

  it.for<{ request: PlatformFrameRequest; params: Record<string, string> }>([
    {
      request: { step: 'new', startAtNodes: true },
      params: { step: 'new', start: 'nodes' }
    },
    {
      request: { step: 'new', handsOverWorkflow: true },
      params: { step: 'new' }
    },
    {
      request: { step: 'nodes', deploymentId: 'dep-1' },
      params: { step: 'nodes', deployment: 'dep-1' }
    },
    {
      request: { step: 'update', deploymentId: 'dep-1' },
      params: { step: 'update', deployment: 'dep-1' }
    },
    {
      request: { step: 'models', deploymentId: 'dep-1', startAtNodes: true },
      params: { step: 'models', deployment: 'dep-1' }
    }
  ])(
    'frames Platform at step=$request.step with the right address (case %$)',
    ({ request, params }) => {
      const store = usePlatformFrameStore()

      expect(store.open(request)).toBe(true)

      const url = store.session?.url ?? ''
      expect(url.startsWith(`${PLATFORM}/embed/custom-deployment?`)).toBe(true)
      expect(query(url)).toEqual({
        ...params,
        workspace: 'ws-1',
        parent: window.location.origin
      })
      expect(store.session?.platformOrigin).toBe(PLATFORM)
    }
  )

  it('hands over the open workflow only when the way in asks for it', () => {
    const store = usePlatformFrameStore()

    store.open({ step: 'new', startAtNodes: true })
    expect(store.session?.workflow).toBeNull()

    store.open({ step: 'new', handsOverWorkflow: true })
    expect(store.session?.workflow).toEqual({
      filename: 'portrait.json',
      workflow: { nodes: [] }
    })
    expect(captureOpenWorkflow).toHaveBeenCalledOnce()
  })

  it('gives each session a fresh nonce Platform accepts', () => {
    const store = usePlatformFrameStore()

    store.open({ step: 'new' })
    const first = store.session?.nonce
    store.open({ step: 'new' })
    const second = store.session?.nonce

    expect(first).toMatch(/^[A-Za-z0-9_-]{16,64}$/)
    expect(second).toMatch(/^[A-Za-z0-9_-]{16,64}$/)
    expect(second).not.toBe(first)
  })

  it('offers Platform in its own tab when the page does not answer within 10 s', () => {
    vi.useFakeTimers()
    const store = usePlatformFrameStore()
    store.open({ step: 'new' })

    vi.advanceTimersByTime(PLATFORM_FRAME_UNANSWERED_MS - 1)
    expect(store.isUnanswered).toBe(false)

    vi.advanceTimersByTime(1)
    expect(store.isUnanswered).toBe(true)
  })

  it('keeps the frame without the fallback once the page says it is ready', async () => {
    vi.useFakeTimers()
    const store = usePlatformFrameStore()
    const { frame, postMessage } = framedWindow()
    store.open({ step: 'new', handsOverWorkflow: true })
    store.attach(frame)

    receive({ type: 'ready', signedIn: false }, frame)
    await vi.runAllTimersAsync()

    expect(store.isUnanswered).toBe(false)
    expect(postMessage.mock.calls.map(([message]) => message.type)).toEqual([
      'sign-in-token',
      'workflow'
    ])
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'sign-in-token', token: 'aaa.bbb.ccc' },
      PLATFORM
    )
  })

  describe('when the editor is signed in by its web session only', () => {
    beforeEach(() => {
      Object.assign(useAuthStore(), {
        currentUser: null,
        sessionUser: { id: 'user-ana', email: 'ana@example.com' }
      })
    })

    it('loads the page once more after it says signed out', () => {
      vi.useFakeTimers()
      const store = usePlatformFrameStore()
      const { frame } = framedWindow()
      store.open({ step: 'update', deploymentId: 'dep-1' })
      store.attach(frame)
      const first = store.session

      receive({ type: 'ready', signedIn: false }, frame)
      vi.advanceTimersByTime(PLATFORM_FRAME_SIGN_IN_RETRY_MS - 1)
      expect(store.session?.id).toBe(first?.id)

      vi.advanceTimersByTime(1)
      expect(store.session?.id).not.toBe(first?.id)
      expect(store.session?.url).toBe(first?.url)
      expect(store.session?.request).toEqual(first?.request)
    })

    it('does not load it a third time', () => {
      vi.useFakeTimers()
      const store = usePlatformFrameStore()
      const first = framedWindow()
      store.open({ step: 'new' })
      store.attach(first.frame)
      receive({ type: 'ready', signedIn: false }, first.frame)
      vi.advanceTimersByTime(PLATFORM_FRAME_SIGN_IN_RETRY_MS)
      const second = store.session

      const reloaded = framedWindow()
      store.attach(reloaded.frame)
      receive({ type: 'ready', signedIn: false }, reloaded.frame)
      vi.advanceTimersByTime(PLATFORM_FRAME_SIGN_IN_RETRY_MS * 5)

      expect(store.session?.id).toBe(second?.id)
    })

    it('waits for the reloaded page to answer', () => {
      vi.useFakeTimers()
      const store = usePlatformFrameStore()
      const { frame } = framedWindow()
      store.open({ step: 'new' })
      store.attach(frame)
      receive({ type: 'ready', signedIn: false }, frame)
      vi.advanceTimersByTime(PLATFORM_FRAME_SIGN_IN_RETRY_MS)

      vi.advanceTimersByTime(PLATFORM_FRAME_UNANSWERED_MS)
      expect(store.isUnanswered).toBe(true)
    })

    it('reloads nothing once the dialog is closed', () => {
      vi.useFakeTimers()
      const store = usePlatformFrameStore()
      const { frame } = framedWindow()
      store.open({ step: 'new' })
      store.attach(frame)
      receive({ type: 'ready', signedIn: false }, frame)
      store.close()

      vi.advanceTimersByTime(PLATFORM_FRAME_SIGN_IN_RETRY_MS)
      expect(store.session).toBeNull()
    })

    it('reloads nothing when the page is signed in', () => {
      vi.useFakeTimers()
      const store = usePlatformFrameStore()
      const { frame } = framedWindow()
      store.open({ step: 'new' })
      store.attach(frame)
      const first = store.session

      receive({ type: 'ready', signedIn: true, userId: 'uid-ana' }, frame)
      vi.advanceTimersByTime(PLATFORM_FRAME_SIGN_IN_RETRY_MS)
      expect(store.session?.id).toBe(first?.id)
    })
  })

  it('does not reload the page when the editor has a Firebase user', () => {
    vi.useFakeTimers()
    const store = usePlatformFrameStore()
    const { frame } = framedWindow()
    store.open({ step: 'new' })
    store.attach(frame)
    const first = store.session

    receive({ type: 'ready', signedIn: false }, frame)
    vi.advanceTimersByTime(PLATFORM_FRAME_SIGN_IN_RETRY_MS)
    expect(store.session?.id).toBe(first?.id)
  })

  it('stops listening to the old frame once closed', async () => {
    const store = usePlatformFrameStore()
    const { frame, postMessage } = framedWindow()
    store.open({ step: 'new', handsOverWorkflow: true })
    store.attach(frame)
    store.close()

    receive({ type: 'ready', signedIn: false }, frame)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(postMessage).not.toHaveBeenCalled()
  })
})

type Deployment = Parameters<typeof loadedEvent>[0]['items'][number]

const RUNNING: Deployment = {
  deployment_id: 'dep-1',
  release_id: 'r-1',
  build_id: 'b-1',
  build_name: 'portrait-upscale',
  release_version: 1,
  status: 'ready',
  can_start: false,
  created_at: '2026-10-01T00:00:00Z'
}

const VERSION_PAGE = `${PLATFORM}/profile/builds/b-1/releases/r-2?workspace=ws-1`

function listing(items: Deployment[]) {
  return reduceDeploymentPick(
    { phase: 'idle' },
    loadedEvent({ builds_visible: true, items })
  )
}

describe('following a build after the dialog closes', () => {
  const started = {
    type: 'build-started',
    kind: 'update',
    buildId: 'b-1',
    releaseId: 'r-2',
    version: 2,
    deploymentId: 'dep-1',
    deploymentName: 'portrait-upscale'
  }

  function startBuild() {
    const pickStore = useDeploymentPickStore()
    pickStore.state = listing([RUNNING])
    const load = vi.spyOn(pickStore, 'load').mockResolvedValue()
    const store = usePlatformFrameStore()
    const { frame } = framedWindow()
    store.open({ step: 'update', deploymentId: 'dep-1' })
    store.attach(frame)
    receive(started, frame)
    return { store, frame, load }
  }

  function toastTitles(): string[] {
    return useToast().toasts.map((toast) => toast.title)
  }

  it('keeps the same frame loaded and hidden once the build starts', () => {
    const { store } = startBuild()

    expect(store.session).not.toBeNull()
    expect(store.isHidden).toBe(true)
    expect(store.build).toMatchObject({
      deploymentId: 'dep-1',
      releaseId: 'r-2',
      previousReleaseId: 'r-1',
      previousVersion: 1,
      stage: 'building'
    })
    expect(toastTitles()).toEqual(['Building portrait-upscale'])
  })

  it('follows progress, then deploying, for its own release only', () => {
    const { store, frame } = startBuild()

    receive(
      {
        type: 'build-progress',
        releaseId: 'r-2',
        step: 3,
        of: 5,
        label: 'Installing'
      },
      frame
    )
    receive(
      {
        type: 'deploy-sent',
        releaseId: 'r-other',
        deploymentId: 'dep-1'
      },
      frame
    )
    expect(store.build).toMatchObject({
      stage: 'building',
      progress: { step: 3, of: 5 }
    })

    receive(
      { type: 'deploy-sent', releaseId: 'r-2', deploymentId: 'dep-1' },
      frame
    )
    expect(store.build?.stage).toBe('deploying')
  })

  it('says the new version is running once, re-reads the listing and lets the frame go', () => {
    const { store, frame, load } = startBuild()
    load.mockClear()

    receive(
      { type: 'deployment-ready', deploymentId: 'dep-1', releaseId: 'r-2' },
      frame
    )
    receive(
      { type: 'deployment-ready', deploymentId: 'dep-1', releaseId: 'r-2' },
      frame
    )

    expect(toastTitles()).toEqual(['portrait-upscale now runs v2.'])
    expect(load).toHaveBeenCalledOnce()
    expect(store.session).toBeNull()
    expect(store.build).toBeNull()
  })

  it.for([
    {
      failed: 'build-failed',
      page: VERSION_PAGE,
      title: 'Nothing changed: portrait-upscale still runs v1.'
    },
    {
      failed: 'deploy-failed',
      page: `${VERSION_PAGE}#deployments`,
      title: "portrait-upscale didn't finish updating to v2."
    }
  ])(
    'on $failed, says what happened and View details opens the version on Platform',
    ({ failed, page, title }) => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      const { store, frame } = startBuild()

      receive(
        {
          type: failed,
          releaseId: 'r-2',
          deploymentId: 'dep-1',
          reason: 'pip install failed'
        },
        frame
      )

      const [toast] = useToast().toasts
      expect(useToast().toasts).toHaveLength(1)
      expect(toast).toMatchObject({
        kind: 'error',
        title,
        description: 'pip install failed'
      })
      toast.actions[0].onClick()
      expect(open).toHaveBeenCalledWith(page, '_blank', 'noopener,noreferrer')
      expect(store.build?.stage).toBe('failed')
      expect(sessionStorage.getItem(KEPT_BUILD_KEY)).toBeNull()
    }
  )

  it.for([
    {
      failed: 'build-failed',
      errorType: 'error_building_custom_deployment'
    },
    {
      failed: 'deploy-failed',
      errorType: 'error_deploying_custom_deployment'
    }
  ])('reports a $failed once to telemetry', ({ failed, errorType }) => {
    const { frame } = startBuild()
    const failure = {
      type: failed,
      releaseId: 'r-2',
      deploymentId: 'dep-1',
      reason: 'pip install failed'
    }

    receive(failure, frame)
    receive(failure, frame)

    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      new Error('pip install failed'),
      expect.objectContaining({ errorType, surface: 'workspace' })
    )
  })

  it('offers Reload and Later when the editor runs on the updated deployment', () => {
    const { frame } = startBuild()
    Object.assign(useDeploymentPickStore(), { bootDeployment: RUNNING })

    receive(
      { type: 'deployment-ready', deploymentId: 'dep-1', releaseId: 'r-2' },
      frame
    )

    const [toast] = useToast().toasts
    expect(toast.title).toBe(
      'portrait-upscale now runs v2. Reload to use its nodes.'
    )
    expect(toast.actions.map((action) => action.label)).toEqual([
      'Reload',
      'Later'
    ])
  })

  it('says nothing more when the version notice already told of the new version', () => {
    const { store, frame } = startBuild()
    expect(useReleaseNoticeStore().claim('r-2')).toBe(true)

    receive(
      { type: 'deployment-ready', deploymentId: 'dep-1', releaseId: 'r-2' },
      frame
    )

    expect(toastTitles()).toEqual([])
    expect(store.session).toBeNull()
  })

  it('tells of the new version first, so the version notice stays quiet', () => {
    const { frame } = startBuild()

    receive(
      { type: 'deployment-ready', deploymentId: 'dep-1', releaseId: 'r-2' },
      frame
    )

    expect(toastTitles()).toEqual(['portrait-upscale now runs v2.'])
    expect(useReleaseNoticeStore().claim('r-2')).toBe(false)
  })

  it('keeps the build for a reload until it is ready', () => {
    const { frame } = startBuild()
    expect(
      JSON.parse(sessionStorage.getItem(KEPT_BUILD_KEY) ?? '{}')
    ).toMatchObject({
      buildId: 'b-1',
      releaseId: 'r-2',
      workspaceId: 'ws-1',
      stage: 'building'
    })

    receive(
      { type: 'deployment-ready', deploymentId: 'dep-1', releaseId: 'r-2' },
      frame
    )
    expect(sessionStorage.getItem(KEPT_BUILD_KEY)).toBeNull()
  })

  it('hides rather than closes while the build runs, and any way in shows it again', () => {
    const { store } = startBuild()
    store.reveal()

    store.dismiss()
    expect(store.isHidden).toBe(true)
    expect(store.session).not.toBeNull()

    expect(store.open({ step: 'new', startAtNodes: true })).toBe(true)
    expect(store.isHidden).toBe(false)
    expect(query(store.session?.url ?? '')).toMatchObject({ step: 'update' })
  })

  function reloadEditor(store: ReturnType<typeof usePlatformFrameStore>) {
    store.close()
    useToast().dismissAll()
  }

  it('follows a kept build again after the editor reloads, hidden at step=follow', () => {
    const { store } = startBuild()
    reloadEditor(store)

    expect(store.resume()).toBe(true)

    const url = store.session?.url ?? ''
    expect(url.startsWith(`${PLATFORM}/embed/custom-deployment?`)).toBe(true)
    expect(query(url)).toEqual({
      step: 'follow',
      release: 'r-2',
      version: '2',
      workspace: 'ws-1',
      parent: window.location.origin
    })
    expect(store.isHidden).toBe(true)
    expect(store.build).toMatchObject({ releaseId: 'r-2', stage: 'building' })
    expect(toastTitles()).toEqual(['Building portrait-upscale'])
  })

  it.for([
    {
      label: 'nothing is kept',
      setUp: (store: ReturnType<typeof usePlatformFrameStore>) => {
        reloadEditor(store)
        sessionStorage.clear()
      }
    },
    {
      label: 'the flag is off',
      setUp: (store: ReturnType<typeof usePlatformFrameStore>) => {
        reloadEditor(store)
        Object.assign(useFeatureFlags().flags, {
          customDeploymentsEditorEnabled: false
        })
      }
    },
    {
      label: 'the frame is already open',
      setUp: () => {}
    }
  ])('follows nothing again when $label', ({ setUp }) => {
    const { store } = startBuild()
    setUp(store)
    const before = store.session

    expect(store.resume()).toBe(false)
    expect(store.session).toBe(before)
  })

  it.for([
    {
      label: 'another workspace',
      setUp: () =>
        Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-2' })
    },
    {
      label: 'another account',
      setUp: () => {
        useAuthStore().currentUser = fromPartial<User>({ uid: 'uid-ben' })
      }
    }
  ])(
    'forgets a kept build from $label instead of following it',
    ({ setUp }) => {
      const { store } = startBuild()
      reloadEditor(store)
      setUp()

      expect(store.resume()).toBe(false)
      expect(store.session).toBeNull()
      expect(store.build).toBeNull()
      expect(toastTitles()).toEqual([])
      expect(sessionStorage.getItem(KEPT_BUILD_KEY)).toBeNull()
    }
  )

  it('waits for the workspace before following a kept build', () => {
    const { store } = startBuild()
    reloadEditor(store)
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })

    expect(store.resume()).toBe(false)
    expect(sessionStorage.getItem(KEPT_BUILD_KEY)).not.toBeNull()

    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-1' })
    expect(store.resume()).toBe(true)
  })

  it('opens what was asked in the current workspace, not a build followed in another', () => {
    const { store } = startBuild()
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-2' })

    expect(store.open({ step: 'new', startAtNodes: true })).toBe(true)

    expect(query(store.session?.url ?? '')).toMatchObject({
      step: 'new',
      workspace: 'ws-2'
    })
    expect(store.isHidden).toBe(false)
  })

  function replaceAccount() {
    useAuthStore().currentUser = fromPartial<User>({ uid: 'uid-ben' })
  }

  const lateFailure = {
    type: 'deploy-failed',
    releaseId: 'r-2',
    deploymentId: 'dep-1',
    reason: 'no GPU'
  }

  it.for([
    { stage: 'building', news: [] },
    {
      stage: 'deploying',
      news: [{ type: 'deploy-sent', releaseId: 'r-2', deploymentId: 'dep-1' }]
    }
  ])(
    'drops a build while $stage once another account takes over the editor',
    ({ news }) => {
      const { store, frame } = startBuild()
      for (const message of news) receive(message, frame)

      replaceAccount()
      receive(lateFailure, frame)

      expect(store.session).toBeNull()
      expect(store.build).toBeNull()
      expect(toastTitles()).toEqual([])
      expect(reportError).not.toHaveBeenCalled()
      expect(sessionStorage.getItem(KEPT_BUILD_KEY)).toBeNull()
      expect(store.resume()).toBe(false)
    }
  )

  function resumeOntoLanded() {
    vi.useFakeTimers()
    const { store, load } = startBuild()
    reloadEditor(store)
    const pickStore = useDeploymentPickStore()
    load.mockImplementation(async () => {
      pickStore.state = listing([
        { ...RUNNING, release_id: 'r-2', release_version: 2 }
      ])
    })
    store.resume()
    const { frame } = framedWindow()
    store.attach(frame)
    return { store, frame }
  }

  it('says ready from the listing but keeps the quiet page while Platform may still apply settings', async () => {
    const { store, frame } = resumeOntoLanded()
    await vi.advanceTimersByTimeAsync(PLATFORM_FRAME_RESUME_CHECK_MS)

    expect(toastTitles()).toEqual(['portrait-upscale now runs v2.'])
    expect(sessionStorage.getItem(KEPT_BUILD_KEY)).toBeNull()
    expect(store.session).not.toBeNull()
    expect(store.isHidden).toBe(true)

    receive(
      { type: 'deploy-sent', releaseId: 'r-2', deploymentId: 'dep-1' },
      frame
    )
    receive(
      { type: 'deployment-ready', deploymentId: 'dep-1', releaseId: 'r-2' },
      frame
    )

    expect(toastTitles()).toEqual(['portrait-upscale now runs v2.'])
    expect(store.session).toBeNull()
    expect(sessionStorage.getItem(KEPT_BUILD_KEY)).toBeNull()
  })

  it('tells of a settings failure Platform sends after the listing said ready', async () => {
    const { frame } = resumeOntoLanded()
    await vi.advanceTimersByTimeAsync(PLATFORM_FRAME_RESUME_CHECK_MS)

    receive(
      {
        type: 'deploy-failed',
        releaseId: 'r-2',
        deploymentId: 'dep-1',
        reason: 'no GPU'
      },
      frame
    )

    expect(toastTitles()).toEqual([
      "portrait-upscale didn't finish updating to v2."
    ])
  })

  it('tells another account nothing of a quiet page still finishing', async () => {
    const { store, frame } = resumeOntoLanded()
    await vi.advanceTimersByTimeAsync(PLATFORM_FRAME_RESUME_CHECK_MS)

    replaceAccount()
    receive(lateFailure, frame)

    expect(store.session).toBeNull()
    expect(store.build).toBeNull()
    expect(toastTitles()).toEqual([])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('lets the quiet page go once Platform has had time to finish', async () => {
    const { store } = resumeOntoLanded()
    await vi.advanceTimersByTimeAsync(PLATFORM_FRAME_RESUME_CHECK_MS)

    await vi.advanceTimersByTimeAsync(PLATFORM_FRAME_FINISH_GRACE_MS - 1)
    expect(store.session).not.toBeNull()

    await vi.advanceTimersByTimeAsync(1)
    expect(store.session).toBeNull()
    expect(store.build).toBeNull()
  })

  it('opens what was asked while the quiet page finishes', async () => {
    const { store } = resumeOntoLanded()
    await vi.advanceTimersByTimeAsync(PLATFORM_FRAME_RESUME_CHECK_MS)

    expect(store.open({ step: 'new' })).toBe(true)
    expect(query(store.session?.url ?? '')).toMatchObject({ step: 'new' })
  })

  it('stops reading the listing once the resumed page sends news of the build', async () => {
    vi.useFakeTimers()
    const { store, load } = startBuild()
    reloadEditor(store)
    store.resume()
    const { frame } = framedWindow()
    store.attach(frame)
    load.mockClear()

    receive(
      { type: 'deploy-sent', releaseId: 'r-2', deploymentId: 'dep-1' },
      frame
    )
    await vi.advanceTimersByTimeAsync(PLATFORM_FRAME_RESUME_CHECK_MS)

    expect(load).not.toHaveBeenCalled()
    expect(store.build?.stage).toBe('deploying')
    expect(store.session).not.toBeNull()
  })

  describe('when the editor is signed in by an API key only', () => {
    beforeEach(() => {
      useAuthStore().currentUser = null
      const apiKeyStore = useApiKeyAuthStore()
      apiKeyStore.currentUser = fromPartial<
        NonNullable<typeof apiKeyStore.currentUser>
      >({ id: 'user-key' })
    })

    it('shows the build it follows again when Platform is opened', () => {
      const { store } = startBuild()

      expect(store.open({ step: 'new', startAtNodes: true })).toBe(true)

      expect(store.isHidden).toBe(false)
      expect(query(store.session?.url ?? '')).toMatchObject({
        step: 'update'
      })
    })

    it('follows its kept build again after the editor reloads', () => {
      const { store } = startBuild()
      reloadEditor(store)

      expect(store.resume()).toBe(true)
      expect(store.build).toMatchObject({
        accountId: 'user-key',
        releaseId: 'r-2'
      })
    })
  })
})
