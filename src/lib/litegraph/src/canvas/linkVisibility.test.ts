import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { i18n, loadLocale } from '@/i18n'
import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LLink } from '@/lib/litegraph/src/LLink'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { createMockLLink } from '@/utils/__tests__/litegraphTestUtils'

import {
  hideLink,
  promptRenameLinkBadge,
  renameLink,
  showLink
} from './linkVisibility'

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
    const link = createMockLLink({ type: 'MODEL' })
    const scope = graphScopeOf(new LGraph())
    const hideEvents: string[] = []
    const hideHost = createHost(hideEvents)

    hideLink(hideHost, scope, link.id)

    expect(
      useLinkPresentationStore().getPresentation(scope, link.id)?.hidden
    ).toBe(true)
    expect(hideEvents).toEqual(['before', 'dirty:false:true', 'after'])

    const showEvents: string[] = []
    const showHost = createHost(showEvents)

    showLink(showHost, scope, link.id)

    expect(
      useLinkPresentationStore().getPresentation(scope, link.id)?.hidden
    ).toBeFalsy()
    expect(showEvents).toEqual(['before', 'dirty:false:true', 'after'])
  })

  it('trims a renamed label and clears it when blank', () => {
    const link = createMockLLink({ type: 'MODEL' })
    const scope = graphScopeOf(new LGraph())
    const host = createHost()

    renameLink(host, scope, link.id, '  Backbone  ')
    expect(
      useLinkPresentationStore().getPresentation(scope, link.id)?.label
    ).toBe('Backbone')

    renameLink(host, scope, link.id, '   ')
    expect(
      useLinkPresentationStore().getPresentation(scope, link.id)?.label
    ).toBeUndefined()
  })

  it('localizes and seeds the rename prompt', async () => {
    const link = createMockLLink({ type: 'MODEL' })
    const scope = graphScopeOf(new LGraph())
    const host = createHost()
    const event = fromPartial<CanvasPointerEvent>({})
    const originalLocale = i18n.global.locale.value

    await loadLocale('fr')
    i18n.global.locale.value = 'fr'
    try {
      useLinkPresentationStore().patch(scope, link.id, {
        label: 'Existing name'
      })
      promptRenameLinkBadge(host, scope, link.id, event)

      expect(host.prompt).toHaveBeenCalledWith(
        'Renommer',
        'Existing name',
        expect.any(Function),
        event
      )

      const callback = host.prompt.mock.calls[0][2]
      callback('  Checkpoint  ')

      expect(
        useLinkPresentationStore().getPresentation(scope, link.id)?.label
      ).toBe('Checkpoint')

      useLinkPresentationStore().patch(scope, link.id, { label: undefined })
      host.prompt.mockClear()
      promptRenameLinkBadge(host, scope, link.id, event)

      expect(host.prompt).toHaveBeenCalledWith(
        'Renommer',
        '',
        expect.any(Function),
        event
      )
    } finally {
      i18n.global.locale.value = originalLocale
    }
  })

  it('produces a reversible graph serialization change', () => {
    const graph = new LGraph()
    const link = new LLink(toLinkId(1), 'MODEL', 4, 0, 5, 0)
    graph.links.set(link.id, link)
    const scope = graphScopeOf(graph)
    const host = createHost()
    const before = graph.serialize()

    hideLink(host, scope, link.id)
    const hidden = graph.serialize()

    expect(hidden).not.toEqual(before)
    expect(hidden.extra).not.toHaveProperty('linkExtensions')
    expect(hidden.extra?.linkPresentation).toEqual({
      [String(link.id)]: { hidden: true }
    })

    showLink(host, scope, link.id)

    expect(
      useLinkPresentationStore().getPresentation(scope, link.id)?.hidden
    ).toBeFalsy()
    expect(graph.serialize()).toEqual(before)
  })
})
