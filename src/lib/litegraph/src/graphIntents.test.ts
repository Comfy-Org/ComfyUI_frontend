import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { toLinkId } from '@/types/linkId'
import type { LinkId } from '@/types/linkId'

import type { LGraph } from './LGraph'
import type { LLink } from './LLink'
import {
  collectingSeveredLinks,
  emitGraphIntent,
  onGraphIntent,
  withGraphIntentSource
} from './graphIntents'
import type { GraphIntent, GraphIntentEvent } from './graphIntents'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const CLEAR: GraphIntent = { type: 'clear', graphId: 'g', nodeIds: [] }

function listen(): { events: GraphIntentEvent[]; detach: () => void } {
  const events: GraphIntentEvent[] = []
  const detach = onGraphIntent((event) => events.push(event))
  return { events, detach }
}

const detachers: (() => void)[] = []
function track(detach: () => void): void {
  detachers.push(detach)
}

afterEach(() => {
  for (const detach of detachers.splice(0)) detach()
  vi.mocked(reportError).mockClear()
})

describe('withGraphIntentSource', () => {
  it('tags intents with the innermost scope and restores the outer one after', () => {
    const { events, detach } = listen()
    track(detach)

    withGraphIntentSource('load', () => {
      emitGraphIntent(CLEAR)
      withGraphIntentSource('agent-remote', () => emitGraphIntent(CLEAR))
      emitGraphIntent(CLEAR)
    })
    emitGraphIntent(CLEAR)

    expect(events.map((event) => event.source)).toEqual([
      'load',
      'agent-remote',
      'load',
      'local'
    ])
  })

  it('restores the outer scope when the scoped function throws', () => {
    const { events, detach } = listen()
    track(detach)
    const failure = new Error('configure failed')

    expect(() =>
      withGraphIntentSource('load', () => {
        throw failure
      })
    ).toThrow(failure)
    emitGraphIntent(CLEAR)

    expect(events.map((event) => event.source)).toEqual(['local'])
  })
})

describe('emitGraphIntent', () => {
  it('delivers to every listener when an earlier one throws, and reports the failure', () => {
    const failure = new Error('extension listener broke')
    track(
      onGraphIntent(() => {
        throw failure
      })
    )
    const { events, detach } = listen()
    track(detach)

    expect(() => emitGraphIntent(CLEAR)).not.toThrow()

    expect(events).toEqual([{ ...CLEAR, source: 'local' }])
    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
      errorType: 'graph_intent_listener_failed',
      context: { intent: 'clear', source: 'local' }
    })
  })

  it('folds disconnects raised inside collectingSeveredLinks into the sink instead of announcing them', () => {
    const { events, detach } = listen()
    track(detach)
    const graph = fromPartial<LGraph>({})
    const link = (id: number) => fromPartial<LLink>({ id: toLinkId(id) })
    const severed: LinkId[] = []

    collectingSeveredLinks(severed, () => {
      emitGraphIntent({ type: 'disconnect', graph, link: link(1) })
      emitGraphIntent({ type: 'connect', graph, link: link(2) })
    })
    emitGraphIntent({ type: 'disconnect', graph, link: link(3) })

    expect(severed).toEqual([toLinkId(1)])
    expect(
      events.map((event) => [event.type, 'link' in event && event.link.id])
    ).toEqual([
      ['connect', toLinkId(2)],
      ['disconnect', toLinkId(3)]
    ])
  })

  it('stops delivering to a detached listener', () => {
    const { events, detach } = listen()

    emitGraphIntent(CLEAR)
    detach()
    emitGraphIntent(CLEAR)

    expect(events).toHaveLength(1)
  })
})
