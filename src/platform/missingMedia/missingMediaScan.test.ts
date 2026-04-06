import { describe, expect, it } from 'vitest'
import {
  verifyCloudMediaCandidates,
  groupCandidatesByName,
  groupCandidatesByMediaType
} from './missingMediaScan'
import type { MissingMediaCandidate } from './types'

function makeCandidate(
  nodeId: string,
  name: string,
  overrides: Partial<MissingMediaCandidate> = {}
): MissingMediaCandidate {
  return {
    nodeId,
    nodeType: 'LoadImage',
    widgetName: 'image',
    mediaType: 'image',
    name,
    isMissing: true,
    ...overrides
  }
}

describe('groupCandidatesByName', () => {
  it('groups candidates with the same name', () => {
    const candidates = [
      makeCandidate('1', 'photo.png'),
      makeCandidate('2', 'photo.png'),
      makeCandidate('3', 'other.png')
    ]

    const result = groupCandidatesByName(candidates)
    expect(result).toHaveLength(2)

    const photoGroup = result.find((g) => g.name === 'photo.png')
    expect(photoGroup?.referencingNodes).toHaveLength(2)
    expect(photoGroup?.mediaType).toBe('image')

    const otherGroup = result.find((g) => g.name === 'other.png')
    expect(otherGroup?.referencingNodes).toHaveLength(1)
  })

  it('returns empty array for empty input', () => {
    expect(groupCandidatesByName([])).toEqual([])
  })
})

describe('groupCandidatesByMediaType', () => {
  it('groups by media type in order: image, video, audio', () => {
    const candidates = [
      makeCandidate('1', 'sound.mp3', {
        nodeType: 'LoadAudio',
        widgetName: 'audio',
        mediaType: 'audio'
      }),
      makeCandidate('2', 'photo.png'),
      makeCandidate('3', 'clip.mp4', {
        nodeType: 'LoadVideo',
        widgetName: 'file',
        mediaType: 'video'
      })
    ]

    const result = groupCandidatesByMediaType(candidates)
    expect(result).toHaveLength(3)
    expect(result[0].mediaType).toBe('image')
    expect(result[1].mediaType).toBe('video')
    expect(result[2].mediaType).toBe('audio')
  })

  it('omits media types with no candidates', () => {
    const candidates = [
      makeCandidate('1', 'clip.mp4', {
        nodeType: 'LoadVideo',
        widgetName: 'file',
        mediaType: 'video'
      })
    ]

    const result = groupCandidatesByMediaType(candidates)
    expect(result).toHaveLength(1)
    expect(result[0].mediaType).toBe('video')
  })

  it('groups multiple names within the same media type', () => {
    const candidates = [
      makeCandidate('1', 'a.png'),
      makeCandidate('2', 'b.png'),
      makeCandidate('3', 'a.png')
    ]

    const result = groupCandidatesByMediaType(candidates)
    expect(result).toHaveLength(1)
    expect(result[0].mediaType).toBe('image')
    expect(result[0].items).toHaveLength(2)
    expect(
      result[0].items.find((i) => i.name === 'a.png')?.referencingNodes
    ).toHaveLength(2)
  })
})

describe('verifyCloudMediaCandidates', () => {
  it('marks candidates missing when not in input assets', async () => {
    const candidates = [
      makeCandidate('1', 'abc123.png', { isMissing: undefined }),
      makeCandidate('2', 'def456.png', { isMissing: undefined })
    ]

    const mockStore = {
      updateInputs: async () => {},
      inputAssets: [{ asset_hash: 'def456.png', name: 'my-photo.png' }]
    }

    await verifyCloudMediaCandidates(candidates, undefined, mockStore)

    expect(candidates[0].isMissing).toBe(true)
    expect(candidates[1].isMissing).toBe(false)
  })

  it('calls updateInputs before checking assets', async () => {
    let updateCalled = false
    const candidates = [makeCandidate('1', 'abc.png', { isMissing: undefined })]

    const mockStore = {
      updateInputs: async () => {
        updateCalled = true
      },
      inputAssets: []
    }

    await verifyCloudMediaCandidates(candidates, undefined, mockStore)

    expect(updateCalled).toBe(true)
  })

  it('respects abort signal before execution', async () => {
    const controller = new AbortController()
    controller.abort()

    const candidates = [
      makeCandidate('1', 'abc123.png', { isMissing: undefined })
    ]

    await verifyCloudMediaCandidates(candidates, controller.signal)

    expect(candidates[0].isMissing).toBeUndefined()
  })

  it('respects abort signal after updateInputs', async () => {
    const controller = new AbortController()
    const candidates = [makeCandidate('1', 'abc.png', { isMissing: undefined })]

    const mockStore = {
      updateInputs: async () => {
        controller.abort()
      },
      inputAssets: [{ asset_hash: 'abc.png', name: 'photo.png' }]
    }

    await verifyCloudMediaCandidates(candidates, controller.signal, mockStore)

    expect(candidates[0].isMissing).toBeUndefined()
  })

  it('skips candidates already resolved as true', async () => {
    const candidates = [makeCandidate('1', 'abc.png', { isMissing: true })]

    const mockStore = {
      updateInputs: async () => {},
      inputAssets: []
    }

    await verifyCloudMediaCandidates(candidates, undefined, mockStore)

    expect(candidates[0].isMissing).toBe(true)
  })

  it('skips candidates already resolved as false', async () => {
    const candidates = [makeCandidate('1', 'abc.png', { isMissing: false })]

    const mockStore = {
      updateInputs: async () => {},
      inputAssets: []
    }

    await verifyCloudMediaCandidates(candidates, undefined, mockStore)

    expect(candidates[0].isMissing).toBe(false)
  })

  it('skips entirely when no pending candidates', async () => {
    let updateCalled = false
    const candidates = [makeCandidate('1', 'abc.png', { isMissing: true })]

    const mockStore = {
      updateInputs: async () => {
        updateCalled = true
      },
      inputAssets: []
    }

    await verifyCloudMediaCandidates(candidates, undefined, mockStore)

    expect(updateCalled).toBe(false)
  })
})
