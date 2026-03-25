import { describe, expect, it } from 'vitest'
import {
  verifyCloudMediaCandidates,
  groupCandidatesByName,
  groupCandidatesByMediaType
} from './missingMediaScan'
import type { MissingMediaCandidate } from './types'

describe('groupCandidatesByName', () => {
  it('groups candidates with the same name', () => {
    const candidates: MissingMediaCandidate[] = [
      {
        nodeId: '1',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'photo.png',
        isMissing: true
      },
      {
        nodeId: '2',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'photo.png',
        isMissing: true
      },
      {
        nodeId: '3',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'other.png',
        isMissing: true
      }
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
    const candidates: MissingMediaCandidate[] = [
      {
        nodeId: '1',
        nodeType: 'LoadAudio',
        widgetName: 'audio',
        mediaType: 'audio',
        name: 'sound.mp3',
        isMissing: true
      },
      {
        nodeId: '2',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'photo.png',
        isMissing: true
      },
      {
        nodeId: '3',
        nodeType: 'LoadVideo',
        widgetName: 'file',
        mediaType: 'video',
        name: 'clip.mp4',
        isMissing: true
      }
    ]

    const result = groupCandidatesByMediaType(candidates)
    expect(result).toHaveLength(3)
    expect(result[0].mediaType).toBe('image')
    expect(result[1].mediaType).toBe('video')
    expect(result[2].mediaType).toBe('audio')
  })

  it('omits media types with no candidates', () => {
    const candidates: MissingMediaCandidate[] = [
      {
        nodeId: '1',
        nodeType: 'LoadVideo',
        widgetName: 'file',
        mediaType: 'video',
        name: 'clip.mp4',
        isMissing: true
      }
    ]

    const result = groupCandidatesByMediaType(candidates)
    expect(result).toHaveLength(1)
    expect(result[0].mediaType).toBe('video')
  })
})

describe('verifyCloudMediaCandidates', () => {
  it('marks candidates missing when not in input assets', async () => {
    const candidates: MissingMediaCandidate[] = [
      {
        nodeId: '1',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'abc123.png',
        isMissing: undefined
      },
      {
        nodeId: '2',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'def456.png',
        isMissing: undefined
      }
    ]

    const mockStore = {
      updateInputs: async () => {},
      inputAssets: [{ asset_hash: 'def456.png', name: 'my-photo.png' }]
    }

    await verifyCloudMediaCandidates(candidates, undefined, mockStore)

    expect(candidates[0].isMissing).toBe(true)
    expect(candidates[1].isMissing).toBe(false)
  })

  it('respects abort signal', async () => {
    const controller = new AbortController()
    controller.abort()

    const candidates: MissingMediaCandidate[] = [
      {
        nodeId: '1',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'abc123.png',
        isMissing: undefined
      }
    ]

    await verifyCloudMediaCandidates(candidates, controller.signal)

    // Should not have been modified
    expect(candidates[0].isMissing).toBeUndefined()
  })

  it('skips candidates already resolved', async () => {
    const candidates: MissingMediaCandidate[] = [
      {
        nodeId: '1',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'abc123.png',
        isMissing: true
      }
    ]

    const mockStore = {
      updateInputs: async () => {},
      inputAssets: []
    }

    await verifyCloudMediaCandidates(candidates, undefined, mockStore)

    // Already resolved, should remain unchanged
    expect(candidates[0].isMissing).toBe(true)
  })
})
