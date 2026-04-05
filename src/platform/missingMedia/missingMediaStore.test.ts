import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMissingMediaStore } from './missingMediaStore'
import type { MissingMediaCandidate } from './types'

// Mock dependencies
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    currentGraph: null
  })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: null
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getActiveGraphNodeIds: () => new Set<string>()
}))

function makeCandidate(
  nodeId: string,
  name: string,
  mediaType: 'image' | 'video' | 'audio' = 'image'
): MissingMediaCandidate {
  return {
    nodeId,
    nodeType: 'LoadImage',
    widgetName: 'image',
    mediaType,
    name,
    isMissing: true
  }
}

describe('useMissingMediaStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no missing media', () => {
    const store = useMissingMediaStore()
    expect(store.missingMediaCandidates).toBeNull()
    expect(store.hasMissingMedia).toBe(false)
    expect(store.missingMediaCount).toBe(0)
  })

  it('setMissingMedia populates candidates', () => {
    const store = useMissingMediaStore()
    const candidates = [makeCandidate('1', 'photo.png')]

    store.setMissingMedia(candidates)

    expect(store.missingMediaCandidates).toHaveLength(1)
    expect(store.hasMissingMedia).toBe(true)
    expect(store.missingMediaCount).toBe(1)
  })

  it('setMissingMedia with empty array clears state', () => {
    const store = useMissingMediaStore()
    store.setMissingMedia([makeCandidate('1', 'photo.png')])
    store.setMissingMedia([])

    expect(store.missingMediaCandidates).toBeNull()
    expect(store.hasMissingMedia).toBe(false)
  })

  it('clearMissingMedia resets all state including interaction state', () => {
    const store = useMissingMediaStore()
    store.setMissingMedia([
      makeCandidate('1', 'photo.png'),
      makeCandidate('2', 'clip.mp4', 'video')
    ])
    store.expandState['photo.png'] = true
    store.uploadState['photo.png'] = {
      fileName: 'photo.png',
      status: 'uploaded'
    }
    store.pendingSelection['photo.png'] = 'uploaded/photo.png'
    const controller = store.createVerificationAbortController()

    store.clearMissingMedia()

    expect(store.missingMediaCandidates).toBeNull()
    expect(store.hasMissingMedia).toBe(false)
    expect(store.missingMediaCount).toBe(0)
    expect(controller.signal.aborted).toBe(true)
    expect(store.expandState).toEqual({})
    expect(store.uploadState).toEqual({})
    expect(store.pendingSelection).toEqual({})
  })

  it('missingMediaNodeIds tracks unique node IDs', () => {
    const store = useMissingMediaStore()
    store.setMissingMedia([
      makeCandidate('1', 'photo.png'),
      makeCandidate('1', 'other.png'),
      makeCandidate('2', 'clip.mp4', 'video')
    ])

    expect(store.missingMediaNodeIds.size).toBe(2)
    expect(store.missingMediaNodeIds.has('1')).toBe(true)
    expect(store.missingMediaNodeIds.has('2')).toBe(true)
  })

  it('hasMissingMediaOnNode checks node presence', () => {
    const store = useMissingMediaStore()
    store.setMissingMedia([makeCandidate('42', 'photo.png')])

    expect(store.hasMissingMediaOnNode('42')).toBe(true)
    expect(store.hasMissingMediaOnNode('99')).toBe(false)
  })

  it('removeMissingMediaByWidget removes matching node+widget entry', () => {
    const store = useMissingMediaStore()
    store.setMissingMedia([
      makeCandidate('1', 'photo.png'),
      makeCandidate('2', 'clip.mp4', 'video')
    ])

    store.removeMissingMediaByWidget('1', 'image')

    expect(store.missingMediaCandidates).toHaveLength(1)
    expect(store.missingMediaCandidates![0].name).toBe('clip.mp4')
  })

  it('removeMissingMediaByWidget nulls candidates when last entry removed', () => {
    const store = useMissingMediaStore()
    store.setMissingMedia([makeCandidate('1', 'photo.png')])

    store.removeMissingMediaByWidget('1', 'image')

    expect(store.missingMediaCandidates).toBeNull()
    expect(store.hasMissingMedia).toBe(false)
  })

  it('removeMissingMediaByWidget ignores non-matching entries', () => {
    const store = useMissingMediaStore()
    store.setMissingMedia([makeCandidate('1', 'photo.png')])

    store.removeMissingMediaByWidget('99', 'image')

    expect(store.missingMediaCandidates).toHaveLength(1)
  })

  it('removeMissingMediaByName clears interaction state for removed name', () => {
    const store = useMissingMediaStore()
    store.setMissingMedia([makeCandidate('1', 'photo.png')])
    store.expandState['photo.png'] = true
    store.uploadState['photo.png'] = {
      fileName: 'photo.png',
      status: 'uploaded'
    }
    store.pendingSelection['photo.png'] = 'uploaded/photo.png'

    store.removeMissingMediaByName('photo.png')

    expect(store.expandState['photo.png']).toBeUndefined()
    expect(store.uploadState['photo.png']).toBeUndefined()
    expect(store.pendingSelection['photo.png']).toBeUndefined()
  })

  it('removeMissingMediaByWidget clears interaction state for removed name', () => {
    const store = useMissingMediaStore()
    store.setMissingMedia([makeCandidate('1', 'photo.png')])
    store.pendingSelection['photo.png'] = 'library/photo.png'

    store.removeMissingMediaByWidget('1', 'image')

    expect(store.pendingSelection['photo.png']).toBeUndefined()
  })

  it('removeMissingMediaByWidget preserves interaction state when other candidates share the name', () => {
    const store = useMissingMediaStore()
    store.setMissingMedia([
      makeCandidate('1', 'photo.png'),
      makeCandidate('2', 'photo.png')
    ])
    store.pendingSelection['photo.png'] = 'library/photo.png'

    store.removeMissingMediaByWidget('1', 'image')

    expect(store.missingMediaCandidates).toHaveLength(1)
    expect(store.pendingSelection['photo.png']).toBe('library/photo.png')
  })

  it('createVerificationAbortController aborts previous controller', () => {
    const store = useMissingMediaStore()
    const first = store.createVerificationAbortController()
    expect(first.signal.aborted).toBe(false)

    store.createVerificationAbortController()
    expect(first.signal.aborted).toBe(true)
  })

  describe('addMissingMedia', () => {
    it('appends to existing candidates', () => {
      const store = useMissingMediaStore()
      store.setMissingMedia([makeCandidate('1', 'photo.png')])

      store.addMissingMedia([makeCandidate('2', 'clip.mp4', 'video')])

      expect(store.missingMediaCandidates).toHaveLength(2)
      expect(store.missingMediaCandidates![0].name).toBe('photo.png')
      expect(store.missingMediaCandidates![1].name).toBe('clip.mp4')
    })

    it('works when store is empty (candidates are null)', () => {
      const store = useMissingMediaStore()
      expect(store.missingMediaCandidates).toBeNull()

      store.addMissingMedia([makeCandidate('1', 'photo.png')])

      expect(store.missingMediaCandidates).toHaveLength(1)
      expect(store.hasMissingMedia).toBe(true)
    })

    it('does nothing when given empty array', () => {
      const store = useMissingMediaStore()
      store.setMissingMedia([makeCandidate('1', 'photo.png')])

      store.addMissingMedia([])

      expect(store.missingMediaCandidates).toHaveLength(1)
    })
  })

  describe('removeMissingMediaByNodeId', () => {
    it('removes all candidates matching the nodeId', () => {
      const store = useMissingMediaStore()
      store.setMissingMedia([
        makeCandidate('1', 'photo.png'),
        makeCandidate('1', 'other.png'),
        makeCandidate('2', 'clip.mp4', 'video')
      ])

      store.removeMissingMediaByNodeId('1')

      expect(store.missingMediaCandidates).toHaveLength(1)
      expect(store.missingMediaCandidates![0].name).toBe('clip.mp4')
    })

    it('keeps candidates with non-matching nodeId', () => {
      const store = useMissingMediaStore()
      store.setMissingMedia([makeCandidate('1', 'photo.png')])

      store.removeMissingMediaByNodeId('99')

      expect(store.missingMediaCandidates).toHaveLength(1)
    })

    it('sets candidates to null when all are removed', () => {
      const store = useMissingMediaStore()
      store.setMissingMedia([
        makeCandidate('1', 'photo.png'),
        makeCandidate('1', 'other.png')
      ])

      store.removeMissingMediaByNodeId('1')

      expect(store.missingMediaCandidates).toBeNull()
      expect(store.hasMissingMedia).toBe(false)
    })

    it('cleans interaction state for removed names', () => {
      const store = useMissingMediaStore()
      store.setMissingMedia([
        makeCandidate('1', 'photo.png'),
        makeCandidate('2', 'clip.mp4', 'video')
      ])
      store.expandState['photo.png'] = true
      store.uploadState['photo.png'] = {
        fileName: 'photo.png',
        status: 'uploaded'
      }
      store.pendingSelection['photo.png'] = 'uploaded/photo.png'

      store.removeMissingMediaByNodeId('1')

      expect(store.expandState['photo.png']).toBeUndefined()
      expect(store.uploadState['photo.png']).toBeUndefined()
      expect(store.pendingSelection['photo.png']).toBeUndefined()
    })

    it('preserves interaction state when other candidates share the name', () => {
      const store = useMissingMediaStore()
      store.setMissingMedia([
        makeCandidate('1', 'photo.png'),
        makeCandidate('2', 'photo.png')
      ])
      store.pendingSelection['photo.png'] = 'library/photo.png'

      store.removeMissingMediaByNodeId('1')

      expect(store.missingMediaCandidates).toHaveLength(1)
      expect(store.pendingSelection['photo.png']).toBe('library/photo.png')
    })

    it('does nothing when candidates are null', () => {
      const store = useMissingMediaStore()
      store.removeMissingMediaByNodeId('1')
      expect(store.missingMediaCandidates).toBeNull()
    })
  })
})
