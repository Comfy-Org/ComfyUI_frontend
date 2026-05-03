import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IComboWidget } from '@/lib/litegraph/src/types/widgets'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  scanAllMediaCandidates,
  scanNodeMediaCandidates,
  verifyCloudMediaCandidates,
  groupCandidatesByName,
  groupCandidatesByMediaType
} from './missingMediaScan'
import type { MissingMediaCandidate } from './types'

const { mockCheckAssetHash, mockGetInputAssetsIncludingPublic } = vi.hoisted(
  () => ({
    mockCheckAssetHash: vi.fn(),
    mockGetInputAssetsIncludingPublic: vi.fn()
  })
)

vi.mock('@/utils/graphTraversalUtil', () => ({
  collectAllNodes: (graph: { _testNodes: LGraphNode[] }) => graph._testNodes,
  getExecutionIdByNode: (
    _graph: unknown,
    node: { _testExecutionId?: string; id: number }
  ) => node._testExecutionId ?? String(node.id)
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    checkAssetHash: mockCheckAssetHash,
    getInputAssetsIncludingPublic: mockGetInputAssetsIncludingPublic
  },
  isBlake3AssetHash: (value: string) => /^blake3:[0-9a-f]{64}$/i.test(value)
}))

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

function makeMediaCombo(
  name: string,
  value: string,
  options: string[] = []
): IComboWidget {
  return fromAny<IComboWidget, unknown>({
    type: 'combo',
    name,
    value,
    options: { values: options }
  })
}

function makeMediaNode(
  id: number,
  type: string,
  widgets: IComboWidget[],
  mode: number = 0,
  executionId?: string
): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id,
    type,
    widgets,
    mode,
    _testExecutionId: executionId ?? String(id)
  })
}

function makeGraph(nodes: LGraphNode[]): LGraph {
  return fromAny<LGraph, unknown>({ _testNodes: nodes })
}

function makeAsset(name: string, assetHash: string | null = name): AssetItem {
  return {
    id: name,
    name,
    asset_hash: assetHash,
    mime_type: null,
    tags: ['input']
  }
}

describe('scanNodeMediaCandidates', () => {
  it('returns candidate for a LoadImage node with missing image', () => {
    const graph = makeGraph([])
    const node = makeMediaNode(
      1,
      'LoadImage',
      [makeMediaCombo('image', 'photo.png', ['other.png'])],
      0
    )

    const result = scanNodeMediaCandidates(graph, node, false)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      nodeId: '1',
      nodeType: 'LoadImage',
      widgetName: 'image',
      mediaType: 'image',
      name: 'photo.png',
      isMissing: true
    })
  })

  it('returns empty for non-media node types', () => {
    const graph = makeGraph([])
    const node = makeMediaNode(
      1,
      'KSampler',
      [makeMediaCombo('sampler', 'euler', ['euler', 'dpm'])],
      0
    )

    const result = scanNodeMediaCandidates(graph, node, false)

    expect(result).toEqual([])
  })

  it('returns empty for node with no widgets', () => {
    const graph = makeGraph([])
    const node = makeMediaNode(1, 'LoadImage', [], 0)

    const result = scanNodeMediaCandidates(graph, node, false)

    expect(result).toEqual([])
  })
})

describe('scanAllMediaCandidates', () => {
  it('skips muted nodes (mode === NEVER)', () => {
    const node = makeMediaNode(
      1,
      'LoadImage',
      [makeMediaCombo('image', 'photo.png', ['other.png'])],
      2 // NEVER
    )
    const result = scanAllMediaCandidates(makeGraph([node]), false)
    expect(result).toHaveLength(0)
  })

  it('skips bypassed nodes (mode === BYPASS)', () => {
    const node = makeMediaNode(
      2,
      'LoadImage',
      [makeMediaCombo('image', 'photo.png', ['other.png'])],
      4 // BYPASS
    )
    const result = scanAllMediaCandidates(makeGraph([node]), false)
    expect(result).toHaveLength(0)
  })

  it('includes active nodes (mode === ALWAYS)', () => {
    const node = makeMediaNode(
      3,
      'LoadImage',
      [makeMediaCombo('image', 'photo.png', ['other.png'])],
      0 // ALWAYS
    )
    const result = scanAllMediaCandidates(makeGraph([node]), false)
    expect(result).toHaveLength(1)
    expect(result[0].isMissing).toBe(true)
  })
})

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
  const existingHash =
    'blake3:1111111111111111111111111111111111111111111111111111111111111111'
  const missingHash =
    'blake3:2222222222222222222222222222222222222222222222222222222222222222'

  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckAssetHash.mockResolvedValue('missing')
    mockGetInputAssetsIncludingPublic.mockResolvedValue([])
  })

  it('marks candidates missing when the asset hash is not found', async () => {
    const candidates = [
      makeCandidate('1', missingHash, { isMissing: undefined }),
      makeCandidate('2', existingHash, { isMissing: undefined })
    ]

    const checkAssetHash = vi.fn(async (assetHash: string) =>
      assetHash === existingHash ? ('exists' as const) : ('missing' as const)
    )

    await verifyCloudMediaCandidates(candidates, undefined, checkAssetHash)

    expect(candidates[0].isMissing).toBe(true)
    expect(candidates[1].isMissing).toBe(false)
  })

  it('uses assetService.checkAssetHash by default', async () => {
    const candidates = [
      makeCandidate('1', existingHash, { isMissing: undefined })
    ]
    mockCheckAssetHash.mockResolvedValue('exists')

    await verifyCloudMediaCandidates(candidates)

    expect(candidates[0].isMissing).toBe(false)
    expect(mockCheckAssetHash).toHaveBeenCalledWith(existingHash, undefined)
  })

  it('respects abort signal before execution', async () => {
    const controller = new AbortController()
    controller.abort()

    const candidates = [
      makeCandidate('1', missingHash, { isMissing: undefined })
    ]

    await verifyCloudMediaCandidates(candidates, controller.signal)

    expect(candidates[0].isMissing).toBeUndefined()
    expect(mockCheckAssetHash).not.toHaveBeenCalled()
  })

  it('respects abort signal after hash verification', async () => {
    const controller = new AbortController()
    const candidates = [
      makeCandidate('1', existingHash, { isMissing: undefined })
    ]
    const checkAssetHash = vi.fn(async () => {
      controller.abort()
      return 'exists' as const
    })

    await verifyCloudMediaCandidates(
      candidates,
      controller.signal,
      checkAssetHash
    )

    expect(candidates[0].isMissing).toBeUndefined()
  })

  it('skips candidates already resolved as true', async () => {
    const candidates = [makeCandidate('1', missingHash, { isMissing: true })]

    await verifyCloudMediaCandidates(candidates)

    expect(candidates[0].isMissing).toBe(true)
    expect(mockCheckAssetHash).not.toHaveBeenCalled()
  })

  it('skips candidates already resolved as false', async () => {
    const candidates = [makeCandidate('1', existingHash, { isMissing: false })]

    await verifyCloudMediaCandidates(candidates)

    expect(candidates[0].isMissing).toBe(false)
    expect(mockCheckAssetHash).not.toHaveBeenCalled()
  })

  it('skips entirely when no pending candidates', async () => {
    const candidates = [makeCandidate('1', missingHash, { isMissing: true })]

    await verifyCloudMediaCandidates(candidates)

    expect(mockCheckAssetHash).not.toHaveBeenCalled()
  })

  it('falls back to input assets for non-blake3 candidate names', async () => {
    const candidates = [
      makeCandidate('1', 'photo.png', { isMissing: undefined }),
      makeCandidate('2', 'missing.png', { isMissing: undefined })
    ]
    const fetchInputAssets = vi.fn(async () => [makeAsset('photo.png')])

    await verifyCloudMediaCandidates(
      candidates,
      undefined,
      undefined,
      fetchInputAssets
    )

    expect(mockCheckAssetHash).not.toHaveBeenCalled()
    expect(fetchInputAssets).toHaveBeenCalledOnce()
    expect(candidates[0].isMissing).toBe(false)
    expect(candidates[1].isMissing).toBe(true)
  })

  it('uses public input assets for default legacy fallback', async () => {
    const candidates = [
      makeCandidate('1', 'public-photo.png', { isMissing: undefined })
    ]
    const inputAssets = Array.from({ length: 500 }, (_, index) =>
      makeAsset(`asset-${index}.png`)
    )
    inputAssets[42] = makeAsset('public-photo.png')
    mockGetInputAssetsIncludingPublic.mockResolvedValue(inputAssets)

    await verifyCloudMediaCandidates(candidates)

    expect(mockGetInputAssetsIncludingPublic).toHaveBeenCalledWith(undefined)
    expect(candidates[0].isMissing).toBe(false)
  })

  it('silences aborts while loading legacy fallback input assets', async () => {
    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    const controller = new AbortController()
    const candidates = [
      makeCandidate('1', 'photo.png', { isMissing: undefined })
    ]
    const fetchInputAssets = vi.fn(async () => {
      controller.abort()
      throw abortError
    })

    await expect(
      verifyCloudMediaCandidates(
        candidates,
        controller.signal,
        undefined,
        fetchInputAssets
      )
    ).resolves.toBeUndefined()

    expect(candidates[0].isMissing).toBeUndefined()
  })

  it('silences aborts from the default legacy fallback input asset store path', async () => {
    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    const controller = new AbortController()
    const candidates = [
      makeCandidate('1', 'photo.png', { isMissing: undefined })
    ]
    mockGetInputAssetsIncludingPublic.mockImplementationOnce(async () => {
      controller.abort()
      throw abortError
    })

    await expect(
      verifyCloudMediaCandidates(candidates, controller.signal)
    ).resolves.toBeUndefined()

    expect(mockGetInputAssetsIncludingPublic).toHaveBeenCalledWith(
      controller.signal
    )
    expect(candidates[0].isMissing).toBeUndefined()
  })

  it('falls back to input assets when the hash endpoint returns 400', async () => {
    const candidates = [
      makeCandidate('1', existingHash, { isMissing: undefined })
    ]
    mockCheckAssetHash.mockResolvedValue('invalid')
    const fetchInputAssets = vi.fn(async () => [
      makeAsset('photo.png', existingHash)
    ])

    await verifyCloudMediaCandidates(
      candidates,
      undefined,
      undefined,
      fetchInputAssets
    )

    expect(mockCheckAssetHash).toHaveBeenCalledWith(existingHash, undefined)
    expect(fetchInputAssets).toHaveBeenCalledOnce()
    expect(candidates[0].isMissing).toBe(false)
  })

  it('falls back to input assets when hash verification fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const candidates = [
      makeCandidate('1', existingHash, { isMissing: undefined })
    ]
    const checkAssetHash = vi.fn(async () => {
      throw new Error('network failed')
    })
    const fetchInputAssets = vi.fn(async () => [
      makeAsset('photo.png', existingHash)
    ])

    await verifyCloudMediaCandidates(
      candidates,
      undefined,
      checkAssetHash,
      fetchInputAssets
    )

    expect(fetchInputAssets).toHaveBeenCalledOnce()
    expect(candidates[0].isMissing).toBe(false)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('does not call the hash endpoint for malformed blake3-looking values', async () => {
    const malformedHash = 'blake3:abc'
    const candidates = [
      makeCandidate('1', malformedHash, { isMissing: undefined })
    ]
    const fetchInputAssets = vi.fn(async () => [
      makeAsset('legacy.png', malformedHash)
    ])

    await verifyCloudMediaCandidates(
      candidates,
      undefined,
      undefined,
      fetchInputAssets
    )

    expect(mockCheckAssetHash).not.toHaveBeenCalled()
    expect(fetchInputAssets).toHaveBeenCalledOnce()
    expect(candidates[0].isMissing).toBe(false)
  })

  it('deduplicates checks for repeated candidate names', async () => {
    const candidates = [
      makeCandidate('1', missingHash, { isMissing: undefined }),
      makeCandidate('2', missingHash, { isMissing: undefined })
    ]

    await verifyCloudMediaCandidates(candidates)

    expect(mockCheckAssetHash).toHaveBeenCalledOnce()
    expect(candidates[0].isMissing).toBe(true)
    expect(candidates[1].isMissing).toBe(true)
  })
})
