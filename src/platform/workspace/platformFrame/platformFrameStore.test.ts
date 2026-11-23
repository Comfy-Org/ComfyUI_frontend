import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { captureOpenWorkflow } from '@/platform/workspace/platformWorkflowHandoff'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'

import {
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

  it('closes the dialog when the build starts', () => {
    const store = usePlatformFrameStore()
    const { frame } = framedWindow()
    store.open({ step: 'new' })
    store.attach(frame)

    receive(
      {
        type: 'build-started',
        kind: 'new',
        buildId: 'b-1',
        releaseId: 'r-1',
        version: 1,
        deploymentId: 'dep-1',
        deploymentName: 'portrait-upscale'
      },
      frame
    )

    expect(store.session).toBeNull()
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

    it('keeps the page when it signs in before the reload', () => {
      vi.useFakeTimers()
      const store = usePlatformFrameStore()
      const { frame } = framedWindow()
      store.open({ step: 'new' })
      store.attach(frame)
      const first = store.session

      receive({ type: 'ready', signedIn: false }, frame)
      vi.advanceTimersByTime(PLATFORM_FRAME_SIGN_IN_RETRY_MS - 1)
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
