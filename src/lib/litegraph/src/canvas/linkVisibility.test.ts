import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LLink } from '@/lib/litegraph/src/LLink'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { toLinkId } from '@/types/linkId'

import {
  hideLink,
  promptRenameLinkBadge,
  renameLink,
  showLink
} from './linkVisibility'

function createLink(): LLink {
  return new LLink(toLinkId(1), 'MODEL', 4, 0, 5, 0)
}

function createHost(events: string[] = []) {
  return {
    emitBeforeChange: vi.fn(() => events.push('before')),
    emitAfterChange: vi.fn(() => events.push('after')),
    setDirty: vi.fn((foreground: boolean, background?: boolean) =>
      events.push(`dirty:${foreground}:${background}`)
    ),
    prompt: vi.fn()
  }
}

describe('link visibility mutations', () => {
  it('brackets hide and show mutations and redraws the background', () => {
    const link = createLink()
    const hideEvents: string[] = []
    const hideHost = createHost(hideEvents)

    hideLink(hideHost, link)

    expect(link.hidden).toBe(true)
    expect(hideEvents).toEqual(['before', 'dirty:false:true', 'after'])

    const showEvents: string[] = []
    const showHost = createHost(showEvents)

    showLink(showHost, link)

    expect(link.hidden).toBeFalsy()
    expect(showEvents).toEqual(['before', 'dirty:false:true', 'after'])
  })

  it('trims a renamed label and clears it when blank', () => {
    const link = createLink()
    const host = createHost()

    renameLink(host, link, '  Backbone  ')
    expect(link.label).toBe('Backbone')

    renameLink(host, link, '   ')
    expect(link.label).toBeUndefined()
  })

  it('seeds the rename prompt with the stored label', () => {
    const link = createLink()
    const host = createHost()
    const event = fromPartial<CanvasPointerEvent>({})

    promptRenameLinkBadge(host, link, event)

    expect(host.prompt).toHaveBeenCalledWith(
      'Rename',
      '',
      expect.any(Function),
      event
    )

    const callback = host.prompt.mock.calls[0][2]
    callback('  Checkpoint  ')

    expect(link.label).toBe('Checkpoint')
  })

  it('produces a reversible graph serialization change', () => {
    const graph = new LGraph()
    const link = createLink()
    link.hidden = false
    graph.links.set(link.id, link)
    const host = createHost()
    const before = graph.serialize()

    hideLink(host, link)
    const hidden = graph.serialize()

    expect(hidden).not.toEqual(before)
    expect(hidden.extra).not.toHaveProperty('linkExtensions')
    expect(hidden.extra?.linkPresentation).toEqual({
      [String(link.id)]: { hidden: true }
    })

    showLink(host, link)

    expect(link.hidden).toBeFalsy()
    expect(graph.serialize()).toEqual(before)
  })
})
