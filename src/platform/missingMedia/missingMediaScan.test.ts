import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { IComboWidget } from '@/lib/litegraph/src/types/widgets'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type * as AssetServiceModule from '@/platform/assets/services/assetService'
import {
  createMediaNodeDef,
  seedMediaNodeDefs
} from '@/platform/missingMedia/__fixtures__/promotedMedia'
import type * as FetchJobsModule from '@/platform/remote/comfyui/jobs/fetchJobs'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type * as GraphTraversalUtil from '@/utils/graphTraversalUtil'
import type { MissingMediaAssetResolver } from './missingMediaAssetResolver'
import {
  isMissingMediaCandidateScopeActive,
  scanAllMediaCandidates,
  scanNodeMediaCandidates,
  verifyMediaCandidates,
  groupCandidatesByName,
  groupCandidatesByMediaType
} from './missingMediaScan'
import {
  countMissingMediaReferences,
  getMissingMediaReferences
} from './missingMediaGrouping'
import type { MissingMediaCandidate } from './types'

const { mockGetInputAssetsIncludingPublic, mockGetAssetsPageByTag } =
  vi.hoisted(() => ({
    mockGetInputAssetsIncludingPublic: vi.fn(),
    mockGetAssetsPageByTag: vi.fn()
  }))

const { mockFetchHistoryPage } = vi.hoisted(() => ({
  mockFetchHistoryPage: vi.fn()
}))

vi.mock('@/utils/graphTraversalUtil', async (importActual) => {
  const actual = await importActual<typeof GraphTraversalUtil>()
  type TestNode = LGraphNode & { _testExecutionId?: string }
  type TestGraph = { _testNodes: TestNode[] }
  const isTestGraph = (graph: LGraph | TestGraph): graph is TestGraph =>
    '_testNodes' in graph
  const executionIdForNode = (node: TestNode) =>
    node._testExecutionId ?? String(node.id)
  const findNodeByExecutionId = (graph: TestGraph, executionId: string) =>
    graph._testNodes.find((node) => executionIdForNode(node) === executionId)
  const isInactive = (node: LGraphNode | undefined) =>
    node?.mode === LGraphEventMode.NEVER ||
    node?.mode === LGraphEventMode.BYPASS

  return {
    ...actual,
    collectAllNodes: (graph: LGraph | TestGraph) =>
      isTestGraph(graph) ? graph._testNodes : actual.collectAllNodes(graph),
    getExecutionIdByNode: (graph: LGraph | TestGraph, node: TestNode) =>
      isTestGraph(graph)
        ? executionIdForNode(node)
        : actual.getExecutionIdByNode(graph, node),
    isExecutionPathActive: (graph: LGraph | TestGraph, executionId: string) => {
      if (!isTestGraph(graph)) {
        return actual.isExecutionPathActive(graph, executionId)
      }
      const path = executionId.split(':')
      return path.every((_, index) => {
        const prefix = path.slice(0, index + 1).join(':')
        const node = findNodeByExecutionId(graph, prefix)
        return !!node && !isInactive(node)
      })
    }
  }
})

vi.mock('@/platform/assets/services/assetService', async () => {
  const actual = await vi.importActual<typeof AssetServiceModule>(
    '@/platform/assets/services/assetService'
  )

  return {
    ...actual,
    assetService: {
      ...actual.assetService,
      getInputAssetsIncludingPublic: mockGetInputAssetsIncludingPublic,
      getAssetsPageByTag: mockGetAssetsPageByTag
    }
  }
})

vi.mock('@/platform/remote/comfyui/jobs/fetchJobs', async () => {
  const actual = await vi.importActual<typeof FetchJobsModule>(
    '@/platform/remote/comfyui/jobs/fetchJobs'
  )

  return {
    ...actual,
    fetchHistoryPage: mockFetchHistoryPage
  }
})

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
    isSubgraphNode: () => false,
    getSlotFromWidget: () => undefined,
    _testExecutionId: executionId ?? String(id)
  })
}

function makeGraph(nodes: LGraphNode[]): LGraph {
  return fromAny<LGraph, unknown>({ _testNodes: nodes })
}

function makeAsset(name: string, assetHash: string | null = null): AssetItem {
  return {
    id: name,
    name,
    hash: assetHash,
    mime_type: null,
    tags: ['input']
  }
}

function makeAssetResolver(
  inputAssets: AssetItem[],
  generatedAssets: AssetItem[] = []
): MissingMediaAssetResolver {
  return vi.fn(async () => ({ inputAssets, generatedAssets }))
}

function makeAssetPage(
  assets: AssetItem[],
  options: { hasMore?: boolean; total?: number } = {}
) {
  return {
    assets,
    total: options.total ?? assets.length,
    has_more: options.hasMore ?? false
  }
}

function makeHistoryJob(
  filename: string,
  options: { id?: string; subfolder?: string } = {}
): JobListItem {
  return fromAny<JobListItem, unknown>({
    id: options.id ?? filename,
    status: 'completed',
    create_time: 0,
    priority: 0,
    preview_output: {
      filename,
      subfolder: options.subfolder ?? '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    }
  })
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  seedMediaNodeDefs()
})

describe('scanNodeMediaCandidates', () => {
  it('does not report a regular media widget whose input value comes from a link', () => {
    const graph = new LGraph()
    const upstream = new LGraphNode('ImageSource')
    upstream.addOutput('image', 'COMBO')
    graph.add(upstream)

    const node = new LGraphNode('LoadImage')
    node.type = 'LoadImage'
    const input = node.addInput('image', 'COMBO')
    const widget = node.addWidget(
      'combo',
      'image',
      'stale-local.png',
      () => undefined,
      { values: [] }
    )
    input.widget = { name: widget.name }
    graph.add(node)
    const link = upstream.connect(0, node, 0)
    if (!link) throw new Error('Expected regular media input link')

    expect(scanNodeMediaCandidates(graph, node, false)).toEqual([])
  })

  it('returns candidate for a LoadImage node with missing image', () => {
    const node = makeMediaNode(
      1,
      'LoadImage',
      [makeMediaCombo('image', 'photo.png', ['other.png'])],
      0
    )
    const graph = makeGraph([node])

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
    const node = makeMediaNode(
      1,
      'KSampler',
      [makeMediaCombo('sampler', 'euler', ['euler', 'dpm'])],
      0
    )
    const graph = makeGraph([node])

    const result = scanNodeMediaCandidates(graph, node, false)

    expect(result).toEqual([])
  })

  it('returns empty for node with no widgets', () => {
    const node = makeMediaNode(1, 'LoadImage', [], 0)
    const graph = makeGraph([node])

    const result = scanNodeMediaCandidates(graph, node, false)

    expect(result).toEqual([])
  })

  it.for([false, true])(
    'returns empty while a media upload is pending on the node (isCloud: %s)',
    (isCloud) => {
      const node = makeMediaNode(
        1,
        'LoadVideo',
        [makeMediaCombo('file', 'clip.mp4', [])],
        0
      )
      const graph = makeGraph([node])
      node.isUploading = true

      const result = scanNodeMediaCandidates(graph, node, isCloud)

      expect(result).toEqual([])
    }
  )

  it('detects missing media again after upload state clears', () => {
    const node = makeMediaNode(
      1,
      'LoadVideo',
      [makeMediaCombo('file', 'clip.mp4', [])],
      0
    )
    const graph = makeGraph([node])

    node.isUploading = true
    expect(scanNodeMediaCandidates(graph, node, false)).toEqual([])

    node.isUploading = false
    expect(scanNodeMediaCandidates(graph, node, false)).toEqual([
      expect.objectContaining({
        nodeType: 'LoadVideo',
        widgetName: 'file',
        mediaType: 'video',
        name: 'clip.mp4',
        isMissing: true
      })
    ])
  })

  it.for([
    {
      nodeType: 'LoadImage',
      widgetName: 'image',
      mediaType: 'image',
      value: 'photo.png [input]',
      option: 'photo.png'
    },
    {
      nodeType: 'LoadImageMask',
      widgetName: 'image',
      mediaType: 'image',
      value: 'mask.png [input]',
      option: 'mask.png'
    },
    {
      nodeType: 'LoadVideo',
      widgetName: 'file',
      mediaType: 'video',
      value: 'clip.mp4 [input]',
      option: 'clip.mp4'
    },
    {
      nodeType: 'LoadAudio',
      widgetName: 'audio',
      mediaType: 'audio',
      value: 'sound.wav [input]',
      option: 'sound.wav'
    }
  ])(
    'matches annotated $nodeType values against clean OSS options',
    ({ nodeType, widgetName, mediaType, value, option }) => {
      const node = makeMediaNode(
        1,
        nodeType,
        [makeMediaCombo(widgetName, value, [option])],
        0
      )
      const graph = makeGraph([node])

      const result = scanNodeMediaCandidates(graph, node, false)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        nodeType,
        widgetName,
        mediaType,
        name: value,
        isMissing: false
      })
    }
  )

  it.for([
    {
      nodeType: 'LoadImage',
      widgetName: 'image',
      value: 'photo.png [output]'
    },
    {
      nodeType: 'LoadVideo',
      widgetName: 'file',
      value: 'clip.mp4 [output]'
    },
    {
      nodeType: 'LoadAudio',
      widgetName: 'audio',
      value: 'sound.wav [output]'
    }
  ])(
    'leaves OSS $nodeType output annotations pending when not in options',
    ({ nodeType, widgetName, value }) => {
      const node = makeMediaNode(
        1,
        nodeType,
        [makeMediaCombo(widgetName, value, ['other-file.png', value])],
        0
      )
      const graph = makeGraph([node])

      const result = scanNodeMediaCandidates(graph, node, false)

      expect(result[0]).toMatchObject({
        nodeType,
        widgetName,
        name: value,
        isMissing: undefined
      })
    }
  )

  it('reports a custom node whose input spec declares a media upload', () => {
    useNodeDefStore().addNodeDef(
      createMediaNodeDef('ThirdPartyVideoLoader', 'clip', 'video_upload')
    )
    const node = makeMediaNode(
      1,
      'ThirdPartyVideoLoader',
      [makeMediaCombo('clip', 'gone.mp4', ['other.mp4'])],
      0
    )

    const result = scanNodeMediaCandidates(makeGraph([node]), node, false)

    expect(result).toEqual([
      expect.objectContaining({
        nodeType: 'ThirdPartyVideoLoader',
        widgetName: 'clip',
        mediaType: 'video',
        name: 'gone.mp4',
        isMissing: true
      })
    ])
  })

  it('marks OSS input annotations missing when the clean option is absent', () => {
    const node = makeMediaNode(
      1,
      'LoadImage',
      [makeMediaCombo('image', 'photo.png [input]', ['other.png'])],
      0
    )
    const graph = makeGraph([node])

    const result = scanNodeMediaCandidates(graph, node, false)

    expect(result[0]).toMatchObject({
      name: 'photo.png [input]',
      isMissing: true
    })
  })

  it('does not treat compact Cloud annotations as valid OSS options', () => {
    const node = makeMediaNode(
      1,
      'LoadImage',
      [makeMediaCombo('image', 'photo.png[input]', ['photo.png'])],
      0
    )
    const graph = makeGraph([node])

    const result = scanNodeMediaCandidates(graph, node, false)

    expect(result[0]).toMatchObject({
      name: 'photo.png[input]',
      isMissing: true
    })
  })
})

describe('isMissingMediaCandidateScopeActive', () => {
  function createLoadImageGraph() {
    const graph = new LGraph()
    const node = new LGraphNode('LoadImage')
    node.type = 'LoadImage'
    const widget = node.addWidget(
      'combo',
      'image',
      'missing.png',
      () => undefined,
      { values: [] }
    )
    graph.add(node)
    return { graph, node, widget }
  }

  it('drops a candidate whose widget was removed while verification was pending', () => {
    const { graph, node, widget } = createLoadImageGraph()
    const candidate = makeCandidate(String(node.id), 'missing.png')

    expect.soft(isMissingMediaCandidateScopeActive(graph, candidate)).toBe(true)

    node.widgets = (node.widgets ?? []).filter((entry) => entry !== widget)

    expect(isMissingMediaCandidateScopeActive(graph, candidate)).toBe(false)
  })

  it('drops a candidate whose widget was renamed while verification was pending', () => {
    const { graph, node, widget } = createLoadImageGraph()
    const candidate = makeCandidate(String(node.id), 'missing.png')

    widget.name = 'renamed'

    expect(isMissingMediaCandidateScopeActive(graph, candidate)).toBe(false)
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
    expect(photoGroup?.referencingNodes[0]).toMatchObject({
      nodeId: '1',
      nodeType: 'LoadImage',
      widgetName: 'image'
    })
    expect(photoGroup?.mediaType).toBe('image')
    expect(photoGroup?.representative.nodeType).toBe('LoadImage')

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

describe('missing media references', () => {
  it('flattens references without deduping shared filenames', () => {
    const groups = groupCandidatesByMediaType([
      makeCandidate('1', 'shared.png'),
      makeCandidate('2', 'shared.png'),
      makeCandidate('3', 'other.png')
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(2)
    expect(countMissingMediaReferences(groups)).toBe(3)
    expect(
      getMissingMediaReferences(groups).map(({ nodeRef }) => nodeRef)
    ).toEqual([
      expect.objectContaining({ nodeId: '1' }),
      expect.objectContaining({ nodeId: '2' }),
      expect.objectContaining({ nodeId: '3' })
    ])
  })
})

describe('verifyMediaCandidates', () => {
  const existingHash =
    'blake3:1111111111111111111111111111111111111111111111111111111111111111'
  const missingHash =
    'blake3:2222222222222222222222222222222222222222222222222222222222222222'

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetInputAssetsIncludingPublic.mockResolvedValue([])
    mockGetAssetsPageByTag.mockResolvedValue(makeAssetPage([]))
    mockFetchHistoryPage.mockResolvedValue({
      jobs: [],
      total: 0,
      offset: 0,
      limit: 200,
      hasMore: false
    })
  })

  it('matches candidates by available input asset name or hash', async () => {
    const candidates = [
      makeCandidate('1', 'photo.png', { isMissing: undefined }),
      makeCandidate('2', existingHash, { isMissing: undefined }),
      makeCandidate('3', missingHash, { isMissing: undefined })
    ]
    const resolveAssetSources = makeAssetResolver([
      makeAsset('photo.png', existingHash)
    ])

    await verifyMediaCandidates(candidates, {
      isCloud: true,
      resolveAssetSources
    })

    expect(candidates[0].isMissing).toBe(false)
    expect(candidates[1].isMissing).toBe(false)
    expect(candidates[2].isMissing).toBe(true)
    expect(resolveAssetSources).toHaveBeenCalledWith({
      signal: undefined,
      isCloud: true,
      includeGeneratedAssets: false,
      generatedMatchNames: new Set(),
      generatedHashRequiredNames: new Set(),
      allowCompactSuffix: true
    })
  })

  it('matches asset names when hash is null', async () => {
    const candidates = [
      makeCandidate('1', 'legacy-photo.png', { isMissing: undefined }),
      makeCandidate('2', 'missing-photo.png', { isMissing: undefined })
    ]
    const resolveAssetSources = makeAssetResolver([
      makeAsset('legacy-photo.png', null)
    ])

    await verifyMediaCandidates(candidates, {
      isCloud: true,
      resolveAssetSources
    })

    expect(candidates[0].isMissing).toBe(false)
    expect(candidates[1].isMissing).toBe(true)
  })

  it('matches annotated candidate names against clean asset names', async () => {
    const candidates = [
      makeCandidate('1', 'photo.png [input]', { isMissing: undefined }),
      makeCandidate('2', 'clip.mp4[input]', {
        nodeType: 'LoadVideo',
        widgetName: 'file',
        mediaType: 'video',
        isMissing: undefined
      }),
      makeCandidate('3', 'missing.wav [output]', {
        nodeType: 'LoadAudio',
        widgetName: 'audio',
        mediaType: 'audio',
        isMissing: undefined
      })
    ]
    const resolveAssetSources = makeAssetResolver(
      [makeAsset('photo.png'), makeAsset('clip.mp4')],
      []
    )

    await verifyMediaCandidates(candidates, {
      isCloud: true,
      resolveAssetSources
    })

    expect(candidates[0]).toMatchObject({
      name: 'photo.png [input]',
      isMissing: false
    })
    expect(candidates[1]).toMatchObject({
      name: 'clip.mp4[input]',
      isMissing: false
    })
    expect(candidates[2]).toMatchObject({
      name: 'missing.wav [output]',
      isMissing: true
    })
  })

  it('matches output hash filenames against generated media assets', async () => {
    const candidates = [
      makeCandidate(
        '1',
        '147257c95a3e957e0deee73a077cfec89da2d906dd086ca70a2b0c897a9591d6e.png [output]',
        {
          isMissing: undefined
        }
      )
    ]
    const resolveAssetSources = makeAssetResolver(
      [],
      [
        makeAsset(
          '147257c95a3e957e0deee73a077cfec89da2d906dd086ca70a2b0c897a9591d6e.png'
        )
      ]
    )

    await verifyMediaCandidates(candidates, {
      isCloud: true,
      resolveAssetSources
    })

    expect(resolveAssetSources).toHaveBeenCalledWith({
      signal: undefined,
      isCloud: true,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set([
        '147257c95a3e957e0deee73a077cfec89da2d906dd086ca70a2b0c897a9591d6e.png'
      ]),
      generatedHashRequiredNames: new Set(),
      allowCompactSuffix: true
    })
    expect(candidates[0]).toMatchObject({
      name: '147257c95a3e957e0deee73a077cfec89da2d906dd086ca70a2b0c897a9591d6e.png [output]',
      isMissing: false
    })
  })

  it('matches cloud output videos with history subfolders against flat asset hashes', async () => {
    const outputHash = 'cloud-video-hash.mp4'
    const candidates = [
      makeCandidate('1', `video/${outputHash} [output]`, {
        nodeType: 'LoadVideo',
        widgetName: 'file',
        mediaType: 'video',
        isMissing: undefined
      })
    ]
    const resolveAssetSources = makeAssetResolver(
      [],
      [makeAsset('ComfyUI_00001_.mp4', outputHash)]
    )

    await verifyMediaCandidates(candidates, {
      isCloud: true,
      resolveAssetSources
    })

    expect(resolveAssetSources).toHaveBeenCalledWith({
      signal: undefined,
      isCloud: true,
      includeGeneratedAssets: true,
      generatedMatchNames: new Set([outputHash]),
      generatedHashRequiredNames: new Set([outputHash]),
      allowCompactSuffix: true
    })
    expect(candidates[0]).toMatchObject({
      name: `video/${outputHash} [output]`,
      isMissing: false
    })
  })

  it('does not match subfoldered cloud output media against unrelated flat asset names', async () => {
    const outputHash = 'cloud-video-hash.mp4'
    const candidates = [
      makeCandidate('1', `video/${outputHash} [output]`, {
        nodeType: 'LoadVideo',
        widgetName: 'file',
        mediaType: 'video',
        isMissing: undefined
      })
    ]
    const resolveAssetSources = makeAssetResolver([], [makeAsset(outputHash)])

    await verifyMediaCandidates(candidates, {
      isCloud: true,
      resolveAssetSources
    })

    expect(candidates[0]).toMatchObject({
      name: `video/${outputHash} [output]`,
      isMissing: true
    })
  })

  it('stops cloud output paging after a subfoldered candidate matches a flat asset hash', async () => {
    const outputHash = 'cloud-video-hash.mp4'
    const candidates = [
      makeCandidate('1', `video/${outputHash} [output]`, {
        nodeType: 'LoadVideo',
        widgetName: 'file',
        mediaType: 'video',
        isMissing: undefined
      })
    ]
    mockGetAssetsPageByTag.mockResolvedValueOnce(
      makeAssetPage([makeAsset('ComfyUI_00001_.mp4', outputHash)], {
        hasMore: true
      })
    )

    await verifyMediaCandidates(candidates, { isCloud: true })

    expect(mockGetAssetsPageByTag).toHaveBeenCalledOnce()
    expect(candidates[0]).toMatchObject({
      name: `video/${outputHash} [output]`,
      isMissing: false
    })
  })

  it('does not satisfy output annotations with input assets of the same name', async () => {
    const candidates = [
      makeCandidate('1', 'photo.png [output]', { isMissing: undefined })
    ]
    const resolveAssetSources = makeAssetResolver([makeAsset('photo.png')])

    await verifyMediaCandidates(candidates, {
      isCloud: true,
      resolveAssetSources
    })

    expect(candidates[0].isMissing).toBe(true)
  })

  it('does not satisfy input candidates with output assets of the same name', async () => {
    const candidates = [
      makeCandidate('1', 'photo.png', { isMissing: undefined })
    ]
    const resolveAssetSources = makeAssetResolver([], [makeAsset('photo.png')])

    await verifyMediaCandidates(candidates, {
      isCloud: true,
      resolveAssetSources
    })

    expect(candidates[0].isMissing).toBe(true)
  })

  it('verifies OSS output candidates against generated history without cloud assets', async () => {
    const candidates = [
      makeCandidate('1', 'subfolder/photo.png [output]', {
        isMissing: undefined
      })
    ]

    mockFetchHistoryPage.mockResolvedValueOnce({
      jobs: [makeHistoryJob('photo.png', { subfolder: 'subfolder' })],
      total: 1,
      offset: 0,
      limit: 200,
      hasMore: false
    })

    await verifyMediaCandidates(candidates, { isCloud: false })

    expect(mockGetInputAssetsIncludingPublic).not.toHaveBeenCalled()
    expect(mockFetchHistoryPage).toHaveBeenCalledWith(
      expect.any(Function),
      200,
      0
    )
    expect(candidates[0]).toMatchObject({
      name: 'subfolder/photo.png [output]',
      isMissing: false
    })
  })

  it('does not normalize compact annotations when verifying OSS candidates', async () => {
    const candidates = [
      makeCandidate('1', 'photo.png[output]', { isMissing: undefined })
    ]
    const resolveAssetSources = makeAssetResolver([makeAsset('photo.png')])

    await verifyMediaCandidates(candidates, {
      isCloud: false,
      resolveAssetSources
    })

    expect(resolveAssetSources).toHaveBeenCalledWith({
      signal: undefined,
      isCloud: false,
      includeGeneratedAssets: false,
      generatedMatchNames: new Set(),
      generatedHashRequiredNames: new Set(),
      allowCompactSuffix: false
    })
    expect(candidates[0].isMissing).toBe(true)
  })

  it('matches when the asset identifier itself is annotated', async () => {
    const candidates = [
      makeCandidate('1', 'clip.mp4[output]', { isMissing: undefined })
    ]
    const resolveAssetSources = makeAssetResolver(
      [],
      [makeAsset('clip.mp4 [output]')]
    )

    await verifyMediaCandidates(candidates, {
      isCloud: true,
      resolveAssetSources
    })

    expect(candidates[0].isMissing).toBe(false)
  })

  it('marks pending candidates missing when no input assets are available', async () => {
    const candidates = [
      makeCandidate('1', 'photo.png', { isMissing: undefined })
    ]

    await verifyMediaCandidates(candidates, {
      isCloud: true,
      resolveAssetSources: makeAssetResolver([])
    })

    expect(candidates[0].isMissing).toBe(true)
  })

  it('uses public input assets by default', async () => {
    const candidates = [
      makeCandidate('1', existingHash, { isMissing: undefined })
    ]
    mockGetInputAssetsIncludingPublic.mockResolvedValue([
      makeAsset('stored-photo.png', existingHash)
    ])

    await verifyMediaCandidates(candidates, { isCloud: true })

    expect(candidates[0].isMissing).toBe(false)
    expect(mockGetInputAssetsIncludingPublic).toHaveBeenCalledWith(
      expect.any(AbortSignal)
    )
    expect(mockFetchHistoryPage).not.toHaveBeenCalled()
  })

  it('reads cloud output assets by tag for output candidates', async () => {
    const outputHash =
      '147257c95a3e957e0deee73a077cfec89da2d906dd086ca70a2b0c897a9591d6e.png'
    const candidates = [
      makeCandidate('1', `${outputHash} [output]`, { isMissing: undefined })
    ]
    mockGetAssetsPageByTag.mockResolvedValue(
      makeAssetPage([makeAsset(outputHash)])
    )

    await verifyMediaCandidates(candidates, { isCloud: true })

    expect(mockGetInputAssetsIncludingPublic).toHaveBeenCalledWith(
      expect.any(AbortSignal)
    )
    expect(mockGetAssetsPageByTag).toHaveBeenCalledWith(
      'output',
      true,
      expect.objectContaining({
        limit: 500,
        offset: 0,
        signal: expect.any(AbortSignal)
      })
    )
    expect(mockFetchHistoryPage).not.toHaveBeenCalled()
    expect(candidates[0].isMissing).toBe(false)
  })

  it('walks OSS generated history pages until hasMore is false', async () => {
    const outputHash =
      '147257c95a3e957e0deee73a077cfec89da2d906dd086ca70a2b0c897a9591d6e.png'
    const candidates = [
      makeCandidate('1', `${outputHash} [output]`, { isMissing: undefined })
    ]
    mockFetchHistoryPage
      .mockResolvedValueOnce({
        jobs: Array.from({ length: 200 }, (_, index) =>
          makeHistoryJob(`other-${index}.png`)
        ),
        total: 201,
        offset: 0,
        limit: 200,
        hasMore: true
      })
      .mockResolvedValueOnce({
        jobs: [makeHistoryJob(outputHash)],
        total: 201,
        offset: 200,
        limit: 200,
        hasMore: false
      })

    await verifyMediaCandidates(candidates, { isCloud: false })

    expect(mockFetchHistoryPage).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      200,
      0
    )
    expect(mockFetchHistoryPage).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      200,
      200
    )
    expect(candidates[0].isMissing).toBe(false)
  })

  it('trusts OSS history hasMore instead of page length', async () => {
    const candidates = [
      makeCandidate('1', 'missing-output.png [output]', {
        isMissing: undefined
      })
    ]
    mockFetchHistoryPage.mockResolvedValueOnce({
      jobs: Array.from({ length: 200 }, (_, index) =>
        makeHistoryJob(`other-${index}.png`)
      ),
      total: 200,
      offset: 0,
      limit: 200,
      hasMore: false
    })

    await verifyMediaCandidates(candidates, { isCloud: false })

    expect(mockFetchHistoryPage).toHaveBeenCalledOnce()
    expect(candidates[0].isMissing).toBe(true)
  })

  it('respects abort signal before execution', async () => {
    const controller = new AbortController()
    controller.abort()

    const candidates = [
      makeCandidate('1', missingHash, { isMissing: undefined })
    ]

    await verifyMediaCandidates(candidates, {
      isCloud: true,
      signal: controller.signal
    })

    expect(candidates[0].isMissing).toBeUndefined()
    expect(mockGetInputAssetsIncludingPublic).not.toHaveBeenCalled()
  })

  it('respects abort signal after loading input assets', async () => {
    const controller = new AbortController()
    const candidates = [
      makeCandidate('1', existingHash, { isMissing: undefined })
    ]
    const resolveAssetSources: MissingMediaAssetResolver = vi.fn(async () => {
      controller.abort()
      return {
        inputAssets: [makeAsset('stored-photo.png', existingHash)],
        generatedAssets: []
      }
    })

    await verifyMediaCandidates(candidates, {
      isCloud: true,
      signal: controller.signal,
      resolveAssetSources
    })

    expect(candidates[0].isMissing).toBeUndefined()
  })

  it('skips candidates already resolved as true', async () => {
    const candidates = [makeCandidate('1', missingHash, { isMissing: true })]

    await verifyMediaCandidates(candidates, { isCloud: true })

    expect(candidates[0].isMissing).toBe(true)
    expect(mockGetInputAssetsIncludingPublic).not.toHaveBeenCalled()
  })

  it('skips candidates already resolved as false', async () => {
    const candidates = [makeCandidate('1', existingHash, { isMissing: false })]

    await verifyMediaCandidates(candidates, { isCloud: true })

    expect(candidates[0].isMissing).toBe(false)
    expect(mockGetInputAssetsIncludingPublic).not.toHaveBeenCalled()
  })

  it('skips entirely when no pending candidates', async () => {
    const candidates = [makeCandidate('1', missingHash, { isMissing: true })]

    await verifyMediaCandidates(candidates, { isCloud: true })

    expect(mockGetInputAssetsIncludingPublic).not.toHaveBeenCalled()
  })

  it('loads public input assets for default verification', async () => {
    const candidates = [
      makeCandidate('1', 'public-photo.png', { isMissing: undefined })
    ]
    const inputAssets = Array.from({ length: 500 }, (_, index) =>
      makeAsset(`asset-${index}.png`)
    )
    inputAssets[42] = makeAsset('public-asset-record', 'public-photo.png')
    mockGetInputAssetsIncludingPublic.mockResolvedValue(inputAssets)

    await verifyMediaCandidates(candidates, { isCloud: true })

    expect(mockGetInputAssetsIncludingPublic).toHaveBeenCalledWith(
      expect.any(AbortSignal)
    )
    expect(candidates[0].isMissing).toBe(false)
  })

  it('silences aborts while loading input assets', async () => {
    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    const controller = new AbortController()
    const candidates = [
      makeCandidate('1', 'photo.png', { isMissing: undefined })
    ]
    const resolveAssetSources: MissingMediaAssetResolver = vi.fn(async () => {
      controller.abort()
      throw abortError
    })

    await expect(
      verifyMediaCandidates(candidates, {
        isCloud: true,
        signal: controller.signal,
        resolveAssetSources
      })
    ).resolves.toBeUndefined()

    expect(candidates[0].isMissing).toBeUndefined()
  })

  it('forwards the signal to the default input asset fetcher and silences aborts', async () => {
    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    const controller = new AbortController()
    const candidates = [
      makeCandidate('1', 'photo.png', { isMissing: undefined })
    ]
    let serviceSignal: AbortSignal | undefined
    mockGetInputAssetsIncludingPublic.mockImplementationOnce(
      async (signal?: AbortSignal) => {
        serviceSignal = signal
        controller.abort()
        throw abortError
      }
    )

    await expect(
      verifyMediaCandidates(candidates, {
        isCloud: true,
        signal: controller.signal
      })
    ).resolves.toBeUndefined()

    expect(serviceSignal).toBeInstanceOf(AbortSignal)
    expect(serviceSignal?.aborted).toBe(true)
    expect(candidates[0].isMissing).toBeUndefined()
  })
})
