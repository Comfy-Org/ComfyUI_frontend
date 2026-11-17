import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import type { AgentBackend } from './agentBackends'
import type { AgentRequest } from './agentReply'
import { pointConfig } from './config'
import type { PointConfig } from './config'
import { createFakePointHost, settingAddress } from './fakePointHost'
import type { Point } from './geometry'
import type { AgentOutcome } from './modelReply'
import { usePointSession } from './usePointSession'

const SAVE_NODE: Point = { x: 800, y: 480 }
const FRAME_MS = 16

function fakeModel() {
  const calls: {
    request: AgentRequest
    think: (text: string) => void
    answer: (outcome: AgentOutcome) => void
  }[] = []
  const backend: AgentBackend = {
    ask(request, _nodes, { onThinking, onOutcome }) {
      calls.push({ request, think: onThinking, answer: onOutcome })
    }
  }
  return { backend, calls }
}

function startAsked(config: Partial<PointConfig> = {}) {
  const model = fakeModel()
  const host = createFakePointHost()
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const session = scope.run(() =>
    usePointSession(host, {
      config: { ...pointConfig, agent: 'model', ...config },
      model: model.backend,
      elementAt: () => null
    })
  )
  if (!session) throw new Error('The session scope is not active')
  session.toggleAnnotate()
  session.pickAt(SAVE_NODE)
  session.saveDraft('how do I make this wider?')
  const width = settingAddress(host.nodes[1].id, 'width')
  const commentId = session.conversation.value.unsent[0].id
  function answer() {
    model.calls[0].answer({
      kind: 'reply',
      reply: {
        steps: [
          {
            annotationId: commentId,
            text: 'Change width to 1280.',
            target: width,
            waitFor: { for: 'valueChange', of: width, direction: 'increase' },
            offerEdit: { target: width, value: 1280 }
          }
        ]
      }
    })
    vi.advanceTimersByTime(FRAME_MS)
  }
  return { session, model, answer }
}

describe('usePointSession: what the slot is asked to hold', () => {
  it('BA-05: with the dock set to open, Send opens it, and Send again after a failure opens it again', () => {
    const { session, model } = startAsked({ thinkingDockOpensOnSend: true })
    expect(session.panelState.value).toBe('closed')

    session.sendBatch()
    expect(session.panelState.value).toBe('thinking')

    model.calls[0].answer({
      kind: 'failure',
      failure: { kind: 'provider', detail: 'status 429' }
    })
    expect(session.panelState.value).toBe('closed')

    session.retry()
    expect(session.panelState.value).toBe('thinking')
  })

  it('BA-05: with the dock set to wait, Send leaves the slot to the line', () => {
    const { session } = startAsked({ thinkingDockOpensOnSend: false })

    session.sendBatch()

    expect(session.panelState.value).toBe('closed')
  })

  it('BA-08: with thinking off there is no dock to open', () => {
    const { session } = startAsked({
      model: { ...pointConfig.model, showThinking: false }
    })

    session.sendBatch()

    expect(session.panelState.value).toBe('closed')
  })

  it('BA-05: with the dock set to open, Send from the list folds the list', () => {
    const { session } = startAsked({ thinkingDockOpensOnSend: true })
    session.pressCaret()
    expect(session.panelState.value).toBe('questions')

    session.sendBatch()

    expect(session.panelState.value).toBe('thinking')
  })

  it('BA-09, BA-24: the answer folds the dock; with no request in flight Ask is the mode’s again and the finished thinking is kept for the turn', () => {
    const { session, model, answer } = startAsked()
    session.sendBatch()
    model.calls[0].think('Looking at the workflow.')

    answer()

    expect(session.state.value.phase).toBe('guiding')
    expect(session.panelState.value).toBe('closed')
    expect(session.askButton.value).toBe('mode')
    expect(session.thinking.value).toMatchObject({
      text: 'Looking at the workflow.',
      done: true
    })
    expect(session.conversation.value.turns.at(-1)?.thinking).toBe(
      'Looking at the workflow.'
    )

    session.pressTrigger()
    expect(session.state.value.phase).toBe('annotating')
    expect(session.panelState.value).toBe('closed')
  })

  it('BA-24: with the dock set to open, while a request is in flight Ask toggles the dock and leaves the mode alone; Send opens it first', () => {
    const { session, model } = startAsked({ thinkingDockOpensOnSend: true })
    session.sendBatch()
    model.calls[0].think('Looking at the workflow.')
    expect(session.askButton.value).toBe('thinkingOpen')

    session.pressTrigger()
    expect(session.panelState.value).toBe('closed')
    expect(session.askButton.value).toBe('thinkingFolded')
    expect(session.state.value.phase).toBe('waiting')

    session.pressTrigger()
    expect(session.panelState.value).toBe('thinking')
    expect(session.state.value.phase).toBe('waiting')

    session.toggleTaller()
    session.pressTrigger()
    expect(session.panelState.value).toBe('closed')
  })

  it('BA-24: with the dock set to wait, the dock starts folded and Ask opens it', () => {
    const { session, model } = startAsked({ thinkingDockOpensOnSend: false })
    session.sendBatch()
    model.calls[0].think('Looking at the workflow.')
    expect(session.panelState.value).toBe('closed')
    expect(session.askButton.value).toBe('thinkingFolded')

    session.pressTrigger()

    expect(session.panelState.value).toBe('thinking')
    expect(session.askButton.value).toBe('thinkingOpen')
  })

  it('BA-24: a request that ends in failure gives Ask back to the mode', () => {
    const { session, model } = startAsked()
    session.sendBatch()

    model.calls[0].answer({
      kind: 'failure',
      failure: { kind: 'provider', detail: 'status 429' }
    })

    expect(session.askButton.value).toBe('mode')
  })

  it('BA-24, BA-08: with thinking off a request in flight has no dock, so Ask stays the mode’s (and waits like before)', () => {
    const { session } = startAsked({
      model: { ...pointConfig.model, showThinking: false }
    })
    session.sendBatch()

    expect(session.askButton.value).toBe('mode')
  })

  it('BA-24: Ask does not open the dock for a follow-up; that thinking stays in its bubble', () => {
    const { session, answer } = startAsked()
    session.sendBatch()
    answer()

    session.followUp('a bit more than that')

    expect(session.askButton.value).toBe('mode')
  })

  it('BA-18: a list the person opened stays open when the request fails', () => {
    const { session, model } = startAsked()
    session.sendBatch()
    session.pressCaret()
    expect(session.panelState.value).toBe('questions')

    model.calls[0].answer({
      kind: 'failure',
      failure: { kind: 'provider', detail: 'status 429' }
    })

    expect(session.state.value.phase).toBe('failed')
    expect(session.panelState.value).toBe('questions')
  })

  it('BA-06: cancelling a waiting request folds the dock', () => {
    const { session } = startAsked()
    session.sendBatch()

    session.dismiss()

    expect(session.state.value.phase).toBe('idle')
    expect(session.panelState.value).toBe('closed')
  })

  it('BA-12: a follow-up leaves the slot as it was', () => {
    const { session, model, answer } = startAsked()
    session.sendBatch()
    answer()

    session.followUp('a bit more than that')

    expect(model.calls).toHaveLength(2)
    expect(session.panelState.value).toBe('closed')
  })

  it('BA-14: Start over empties the slot', () => {
    const { session, answer } = startAsked()
    session.sendBatch()
    answer()
    session.finish()

    session.startOver()

    expect(session.panelState.value).toBe('closed')
    expect(session.thinking.value).toBeNull()
  })

  it('BA-15: the darker dot of the turn strip opens the list', () => {
    const { session, answer } = startAsked()
    session.sendBatch()
    answer()

    session.openPanel()

    expect(session.panelState.value).toBe('questions')
  })
})
