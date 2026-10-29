import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { provideTranslator } from '#/translate'
import { LGraph } from '#/LGraph'
import { LLink } from '#/LLink'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import { useLinkPresentationStore } from '@comfyorg/graph-state/linkPresentationStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import { createMockLLink } from '#/__fixtures__/litegraphTestUtils'

import { linkHideSnap } from './linkHideTransition'
import {
  hideLink,
  hideLinks,
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

  it('localizes and seeds the rename prompt', () => {
    const link = createMockLLink({ type: 'MODEL' })
    const scope = graphScopeOf(new LGraph())
    const host = createHost()
    const event = fromPartial<CanvasPointerEvent>({})
    provideTranslator((key, fallback) =>
      key === 'contextMenu.Rename' ? 'Renommer' : fallback
    )
    onTestFinished(() => provideTranslator(undefined))

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

  it('starts a hide transition for every hidden link and cancels it on show', () => {
    const scope = graphScopeOf(new LGraph())
    const host = createHost()
    const first = toLinkId(11)
    const second = toLinkId(12)
    const now = performance.now()

    hideLinks(host, scope, [first, second])

    expect(linkHideSnap(scope.rootGraphId, first, now)).toBeDefined()
    expect(linkHideSnap(scope.rootGraphId, second, now)).toBeDefined()

    showLink(host, scope, first)

    expect(linkHideSnap(scope.rootGraphId, first, now)).toBeUndefined()
    expect(linkHideSnap(scope.rootGraphId, second, now)).toBeDefined()
  })

  it('does not restart the transition for a link that was already hidden', () => {
    const scope = graphScopeOf(new LGraph())
    const host = createHost()
    const alreadyHidden = toLinkId(21)
    const visible = toLinkId(22)
    useLinkPresentationStore().patch(scope, alreadyHidden, { hidden: true })
    const now = performance.now()

    hideLinks(host, scope, [alreadyHidden, visible])

    expect(linkHideSnap(scope.rootGraphId, alreadyHidden, now)).toBeUndefined()
    expect(linkHideSnap(scope.rootGraphId, visible, now)).toBeDefined()
  })
})
