import { describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'

import { useLinkPresentationStore } from './linkPresentationStore'

vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))

const graphA = {
  rootGraphId: toRootGraphId('graph-a'),
  owningGraphId: toOwningGraphId('graph-a')
}
const graphASibling = {
  rootGraphId: graphA.rootGraphId,
  owningGraphId: toOwningGraphId('graph-a-sibling')
}
const graphB = {
  rootGraphId: toRootGraphId('graph-b'),
  owningGraphId: toOwningGraphId('graph-b')
}

const LINK = toLinkId(1)

describe('useLinkPresentationStore', () => {
  it('merges patches per field and clears a field patched to undefined', () => {
    const store = useLinkPresentationStore()
    store.patch(graphA, LINK, { hidden: true })
    store.patch(graphA, LINK, { label: 'Checkpoint' })

    expect(store.getPresentation(graphA, LINK)).toEqual({
      hidden: true,
      label: 'Checkpoint'
    })

    store.patch(graphA, LINK, { hidden: undefined })

    const presentation = store.getPresentation(graphA, LINK)
    expect(presentation?.hidden).toBeUndefined()
    expect(presentation?.label).toBe('Checkpoint')
  })

  it('deletes an entry emptied by a patch', () => {
    const store = useLinkPresentationStore()
    store.patch(graphA, LINK, { hidden: true, label: 'Checkpoint' })

    store.patch(graphA, LINK, { hidden: false, label: undefined })

    expect(store.getPresentation(graphA, LINK)).toBeUndefined()
  })

  it('rejects a patch from a different owning graph', () => {
    const store = useLinkPresentationStore()
    store.patch(graphA, LINK, { label: 'Owned' })

    store.patch(graphASibling, LINK, { label: 'Stolen' })

    expect(store.getPresentation(graphA, LINK)).toEqual({
      label: 'Owned'
    })
    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
      errorType: 'link_presentation_ownership_conflict',
      context: {
        linkId: LINK,
        incumbentGraphId: graphA.owningGraphId,
        requestingGraphId: graphASibling.owningGraphId
      }
    })
  })

  it('take removes and returns only the owning graph entry', () => {
    const store = useLinkPresentationStore()
    store.patch(graphA, LINK, { hidden: true })

    expect(store.take(graphASibling, LINK)).toBeUndefined()
    expect(store.getPresentation(graphA, LINK)).toEqual({
      hidden: true
    })

    expect(store.take(graphA, LINK)).toEqual({ hidden: true })
    expect(store.getPresentation(graphA, LINK)).toBeUndefined()
  })

  it('clearing a previous owner leaves a reassigned link intact', () => {
    const store = useLinkPresentationStore()
    store.patch(graphA, toLinkId(9), { hidden: true })
    store.patch(graphA, toLinkId(1), { hidden: true })
    store.take(graphA, toLinkId(1))

    store.patch(graphASibling, toLinkId(1), { hidden: true })

    store.clearOwner(graphA)

    expect(store.getPresentation(graphA, toLinkId(9))).toBeUndefined()
    expect(store.getPresentation(graphASibling, toLinkId(1))).toEqual({
      hidden: true
    })
  })

  it('clearOwner leaves sibling owners intact and clearGraph wipes one root', () => {
    const store = useLinkPresentationStore()
    store.patch(graphA, toLinkId(1), { hidden: true })
    store.patch(graphASibling, toLinkId(2), { hidden: true })
    store.patch(graphB, toLinkId(3), { hidden: true })

    store.clearOwner(graphASibling)

    expect(store.getPresentation(graphA, toLinkId(1))).toBeDefined()
    expect(store.getPresentation(graphASibling, toLinkId(2))).toBeUndefined()

    store.clearGraph(graphA.rootGraphId)

    expect(store.getPresentation(graphA, toLinkId(1))).toBeUndefined()
    expect(store.getPresentation(graphB, toLinkId(3))).toEqual({
      hidden: true
    })
  })
})
