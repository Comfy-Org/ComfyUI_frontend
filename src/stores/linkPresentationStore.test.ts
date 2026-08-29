import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'

import { useLinkPresentationStore } from './linkPresentationStore'

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
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('merges patches per field and clears a field patched to undefined', () => {
    const store = useLinkPresentationStore()
    store.patch(graphA, LINK, { hidden: true })
    store.patch(graphA, LINK, { label: 'Checkpoint' })

    expect(store.getPresentation(graphA, LINK)).toMatchObject({
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
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = useLinkPresentationStore()
    store.patch(graphA, LINK, { label: 'Owned' })

    store.patch(graphASibling, LINK, { label: 'Stolen' })

    expect(store.getPresentation(graphA, LINK)).toMatchObject({
      label: 'Owned'
    })
    expect(error).toHaveBeenCalledOnce()
    error.mockRestore()
  })

  it('take removes and returns only the owning graph entry', () => {
    const store = useLinkPresentationStore()
    store.patch(graphA, LINK, { hidden: true })

    expect(store.take(graphASibling, LINK)).toBeUndefined()
    expect(store.getPresentation(graphA, LINK)).toMatchObject({
      hidden: true
    })

    expect(store.take(graphA, LINK)).toEqual({ hidden: true })
    expect(store.getPresentation(graphA, LINK)).toBeUndefined()
  })

  it('clearOwner leaves sibling owners intact and clearGraph wipes one root', () => {
    const store = useLinkPresentationStore()
    store.patch(graphA, toLinkId(1), { hidden: true })
    store.patch(graphASibling, toLinkId(2), { hidden: true })
    store.patch(graphB, toLinkId(3), { hidden: true })

    store.clearOwner(graphASibling)

    expect(store.getPresentation(graphA, toLinkId(1))).toBeDefined()
    expect(store.getPresentation(graphA, toLinkId(2))).toBeUndefined()

    store.clearGraph(graphA.rootGraphId)

    expect(store.getPresentation(graphA, toLinkId(1))).toBeUndefined()
    expect(store.getPresentation(graphB, toLinkId(3))).toMatchObject({
      hidden: true
    })
  })
})
