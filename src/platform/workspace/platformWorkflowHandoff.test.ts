import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import {
  answerWorkflowHandoff,
  openPlatformWithWorkflow
} from './platformWorkflowHandoff'

vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))
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

describe('openPlatformWithWorkflow', () => {
  const WIZARD_URL =
    /^https:\/\/platform\.comfy\.org\/profile\/builds\/new\?step=import&handoff=([A-Za-z0-9_-]{16,64})&utm_source=comfy_cloud&utm_medium=app&utm_content=custom-deployment-card&workspace=ws-123$/

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-123' })
    useWorkflowStore().activeWorkflow = null
  })

  function openWorkflow(prepareForSave?: () => void) {
    const saved = { nodes: [{ id: 1, type: 'BiRefNet' }] }
    const workflow = {
      filename: 'portrait',
      activeState: { nodes: [{ id: 1, type: 'Stale' }] },
      changeTracker: {
        prepareForSave:
          prepareForSave ??
          (() => {
            workflow.activeState = saved
          })
      }
    }
    useWorkflowStore().activeWorkflow = fromPartial(workflow)
    return saved
  }

  it('opens the wizard at its import step with a fresh nonce, the tags and the workspace, and hands it the open workflow as saved at the click', () => {
    const saved = openWorkflow()
    const { wizard, postMessage, close } = openedWindow()
    const open = vi.spyOn(window, 'open').mockReturnValue(wizard)

    expect(openPlatformWithWorkflow('custom-deployment-card')).toBe(true)
    const [url, target] = open.mock.calls[0]
    const nonce = WIZARD_URL.exec(String(url))?.[1]
    saved.nodes[0].type = 'EditedAfterTheClick'
    receive({ ...READY, nonce }, wizard)
    close()
    vi.advanceTimersByTime(1000)

    expect(target).toBe('_blank')
    expect(open.mock.calls[0]).toHaveLength(2)
    expect(postMessage).toHaveBeenCalledExactlyOnceWith(
      {
        type: 'comfy-build-handoff:workflow',
        nonce,
        filename: 'portrait.json',
        workflow: WORKFLOW
      },
      PLATFORM
    )
    expect(vi.getTimerCount()).toBe(0)
  })

  it('makes a new nonce for each click', () => {
    openWorkflow()
    const open = vi.spyOn(window, 'open').mockImplementation(() => {
      const opened = openedWindow()
      closeAll.push(opened.close)
      return opened.wizard
    })
    const closeAll: (() => void)[] = []

    openPlatformWithWorkflow('custom-deployment-card')
    openPlatformWithWorkflow('custom-deployment-card')
    closeAll.forEach((close) => close())
    vi.advanceTimersByTime(1000)

    const [first, second] = open.mock.calls.map(([url]) => String(url))
    expect(first).toMatch(WIZARD_URL)
    expect(second).toMatch(WIZARD_URL)
    expect(first).not.toBe(second)
  })

  it.for([
    {
      when: 'the browser blocks the tab',
      arrange: () => {
        openWorkflow()
        vi.spyOn(window, 'open').mockReturnValue(null)
      },
      opens: 1
    },
    {
      when: 'the tab comes back already closed',
      arrange: () => {
        openWorkflow()
        vi.spyOn(window, 'open').mockReturnValue(
          fromPartial<Window>({ closed: true })
        )
      },
      opens: 1
    },
    {
      when: 'no workflow is open',
      arrange: () => {
        vi.spyOn(window, 'open')
      },
      opens: 0
    },
    {
      when: 'the build is not Cloud, so a new tab must send no referrer',
      arrange: () => {
        openWorkflow()
        vi.stubGlobal('__DISTRIBUTION__', 'localhost')
        vi.spyOn(window, 'open')
      },
      opens: 0
    },
    {
      when: 'Desktop hands new tabs to the system browser',
      arrange: () => {
        openWorkflow()
        vi.stubGlobal('__comfyDesktop2', {})
        vi.spyOn(window, 'open')
      },
      opens: 0
    }
  ])(
    'leaves the opening to the link and listens for nothing when $when',
    ({ arrange, opens }) => {
      arrange()
      const addListener = vi.spyOn(window, 'addEventListener')

      expect(openPlatformWithWorkflow('custom-deployment-card')).toBe(false)
      expect(window.open).toHaveBeenCalledTimes(opens)
      expect(addListener).not.toHaveBeenCalledWith('message', expect.anything())
    }
  )

  it('reports a workflow that cannot be captured and leaves the opening to the link', () => {
    const failure = new Error('A custom node failed to serialize')
    openWorkflow(() => {
      throw failure
    })
    const open = vi.spyOn(window, 'open')

    expect(openPlatformWithWorkflow('custom-deployment-card')).toBe(false)
    expect(open).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
      errorType: 'error_capturing_workflow_for_platform',
      surface: 'platform'
    })
  })
})
