import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import {
  answerWorkflowHandoff,
  createHandoffNonce,
  openPlatformWithWorkflow,
  workflowHandoffUrl
} from './platformWorkflowHandoff'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

const PLATFORM = 'https://platform.comfy.org'
const NONCE = 'b7b6a3a0-9f0e-4c58-8a51-2f4f6f0f6c11'
const READY = { type: 'comfy-build-handoff:ready', nonce: NONCE }
const WORKFLOW = { nodes: [{ id: 1, type: 'BiRefNet' }] }

function openedWindow() {
  const state = { closed: false }
  const postMessage = vi.fn()
  const wizard = fromPartial<Window>({
    postMessage,
    get closed() {
      return state.closed
    }
  })
  return { wizard, postMessage, close: () => (state.closed = true) }
}

function receive(
  data: unknown,
  source: Window,
  origin: string = PLATFORM
): void {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source }))
}

describe('answerWorkflowHandoff', () => {
  const stops: (() => void)[] = []

  function answer(wizard: Window) {
    const stop = answerWorkflowHandoff({
      nonce: NONCE,
      wizard,
      platformOrigin: PLATFORM,
      filename: 'portrait.json',
      workflow: WORKFLOW
    })
    stops.push(stop)
    return stop
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    stops.splice(0).forEach((stop) => stop())
  })

  it('sends the workflow to the wizard at the Platform origin when it says it is ready', () => {
    const { wizard, postMessage } = openedWindow()
    answer(wizard)

    receive(READY, wizard)

    expect(postMessage).toHaveBeenCalledExactlyOnceWith(
      {
        type: 'comfy-build-handoff:workflow',
        nonce: NONCE,
        filename: 'portrait.json',
        workflow: WORKFLOW
      },
      PLATFORM
    )
  })

  it.for([
    {
      message: 'carries another nonce',
      data: { ...READY, nonce: 'a-nonce-from-another-click' },
      origin: PLATFORM,
      fromWizard: true
    },
    {
      message: 'comes from another origin',
      data: READY,
      origin: 'https://platform.comfy.org.evil.example',
      fromWizard: true
    },
    {
      message: 'comes from another window',
      data: READY,
      origin: PLATFORM,
      fromWizard: false
    },
    {
      message: 'is not a ready message',
      data: { ...READY, type: 'comfy-build-handoff:workflow' },
      origin: PLATFORM,
      fromWizard: true
    },
    {
      message: 'is not an object',
      data: 'comfy-build-handoff:ready',
      origin: PLATFORM,
      fromWizard: true
    }
  ])(
    'sends nothing when the message $message',
    ({ data, origin, fromWizard }) => {
      const { wizard, postMessage } = openedWindow()
      const other = openedWindow()
      answer(wizard)

      receive(data, fromWizard ? wizard : other.wizard, origin)

      expect(postMessage).not.toHaveBeenCalled()
      expect(other.postMessage).not.toHaveBeenCalled()
    }
  )

  it('answers again when the wizard asks again after a slow sign-in', () => {
    const { wizard, postMessage } = openedWindow()
    answer(wizard)

    receive(READY, wizard)
    vi.advanceTimersByTime(120_000)
    receive(READY, wizard)

    expect(postMessage).toHaveBeenCalledTimes(2)
  })

  it('stops listening once the wizard has closed', () => {
    const { wizard, postMessage, close } = openedWindow()
    const removeListener = vi.spyOn(window, 'removeEventListener')
    answer(wizard)

    close()
    vi.advanceTimersByTime(1000)
    receive(READY, wizard)

    expect(postMessage).not.toHaveBeenCalled()
    expect(removeListener).toHaveBeenCalledWith('message', expect.anything())
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops listening when stopped', () => {
    const { wizard, postMessage } = openedWindow()
    const stop = answer(wizard)

    stop()
    receive(READY, wizard)

    expect(postMessage).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('workflowHandoffUrl', () => {
  it('opens the wizard at its import step with the nonce, the tags and the active workspace, and nothing else', () => {
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-123' })

    expect(workflowHandoffUrl(NONCE, 'custom-deployment-card')).toBe(
      `${PLATFORM}/profile/builds/new?step=import&handoff=${NONCE}&utm_source=comfyui&utm_medium=app&utm_content=custom-deployment-card&workspace=ws-123`
    )
  })

  it('makes a nonce the wizard accepts', () => {
    expect(createHandoffNonce()).toMatch(/^[A-Za-z0-9_-]{16,64}$/)
  })
})

describe('openPlatformWithWorkflow', () => {
  const URL_WITH_NONCE = `${PLATFORM}/profile/builds/new?step=import&handoff=${NONCE}`

  beforeEach(() => {
    vi.useFakeTimers()
  })

  function openWorkflow() {
    const prepareForSave = vi.fn()
    useWorkflowStore().activeWorkflow = fromPartial({
      filename: 'portrait',
      activeState: WORKFLOW,
      changeTracker: { prepareForSave }
    })
    return prepareForSave
  }

  it('opens the wizard with this tab as its opener and hands it the saved state of the open workflow', () => {
    const prepareForSave = openWorkflow()
    const { wizard, postMessage, close } = openedWindow()
    const open = vi.spyOn(window, 'open').mockReturnValue(wizard)

    expect(openPlatformWithWorkflow(URL_WITH_NONCE, NONCE)).toBe(true)
    receive(READY, wizard)
    close()
    vi.advanceTimersByTime(1000)

    expect(open).toHaveBeenCalledExactlyOnceWith(URL_WITH_NONCE, '_blank')
    expect(prepareForSave).toHaveBeenCalledOnce()
    expect(postMessage).toHaveBeenCalledExactlyOnceWith(
      {
        type: 'comfy-build-handoff:workflow',
        nonce: NONCE,
        filename: 'portrait.json',
        workflow: WORKFLOW
      },
      PLATFORM
    )
  })

  it('reports a blocked tab and listens for nothing', () => {
    openWorkflow()
    vi.spyOn(window, 'open').mockReturnValue(null)
    const addListener = vi.spyOn(window, 'addEventListener')

    expect(openPlatformWithWorkflow(URL_WITH_NONCE, NONCE)).toBe(false)
    expect(addListener).not.toHaveBeenCalledWith('message', expect.anything())
  })

  it('opens nothing on Desktop, which hands new tabs to the system browser', () => {
    openWorkflow()
    vi.stubGlobal('__comfyDesktop2', {})
    const open = vi.spyOn(window, 'open')

    expect(openPlatformWithWorkflow(URL_WITH_NONCE, NONCE)).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })
})
