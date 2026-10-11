import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { IComboWidget } from '@/lib/litegraph/src/types/widgets'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  createMediaNodeDef,
  seedMediaNodeDefs
} from '@/platform/missingMedia/__fixtures__/promotedMedia'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
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

vi.mock<unknown>(import('@/utils/graphTraversalUtil'), () => {
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
    collectAllNodes: (graph: LGraph | TestGraph) =>
      isTestGraph(graph) ? graph._testNodes : graph.nodes,
    getExecutionIdByNode: (graph: LGraph | TestGraph, node: TestNode) =>
      isTestGraph(graph) ? executionIdForNode(node) : String(node.id),
    getNodeByExecutionId: (graph: LGraph | TestGraph, executionId: string) =>
      isTestGraph(graph)
        ? findNodeByExecutionId(graph, executionId)
        : graph.nodes.find(
            (node) => String(node.id) === executionId.split(':').at(-1)
          ),
    isExecutionPathActive: (graph: LGraph | TestGraph, executionId: string) => {
      const path = executionId.split(':')
      return path.every((_, index) => {
        const prefix = path.slice(0, index + 1).join(':')
        const node = isTestGraph(graph)
          ? findNodeByExecutionId(graph, prefix)
          : graph.nodes.find((node) => String(node.id) === prefix)
        return !!node && !isInactive(node)
      })
    }
  }
})

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock(import('@/scripts/api'))

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

function makeAsset(name: string, assetHash?: string): AssetItem {
  return fromPartial({
    id: name,
    name,
    hash: assetHash,
    tags: ['input'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  })
}

beforeEach(() => {
  vi.mocked(useFeatureFlags().flags).assetsEnabled = true
  seedMediaNodeDefs()
})

function disableAssetApi() {
  vi.mocked(useFeatureFlags().flags).assetsEnabled = false
}

describe('scanNodeMediaCandidates', () => {
  beforeEach(disableAssetApi)

  it('does not report a regular media widget whose input value comes from a link', () => {
    const graph = new LGraph()
    const upstream = new LGraphNode('ImageSource')
    upstream.addOutput('image', 'COMBO')
    graph.add(upstream)

    const node = new LGraphNode('LoadImage', 'LoadImage')
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

    expect(scanNodeMediaCandidates(graph, node)).toEqual([])
  })

  it('returns candidate for a LoadImage node with missing image', () => {
    const node = makeMediaNode(
      1,
      'LoadImage',
      [makeMediaCombo('image', 'photo.png', ['other.png'])],
      0
    )
    const graph = makeGraph([node])

    const result = scanNodeMediaCandidates(graph, node)

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

    const result = scanNodeMediaCandidates(graph, node)

    expect(result).toEqual([])
  })

  it('returns empty for node with no widgets', () => {
    const node = makeMediaNode(1, 'LoadImage', [], 0)
    const graph = makeGraph([node])

    const result = scanNodeMediaCandidates(graph, node)

    expect(result).toEqual([])
  })

  it.for([false, true])(
    'returns empty while a media upload is pending on the node (assetsEnabled: %s)',
    (assetsEnabled) => {
      vi.mocked(useFeatureFlags().flags).assetsEnabled = assetsEnabled
      const node = makeMediaNode(
        1,
        'LoadVideo',
        [makeMediaCombo('file', 'clip.mp4', [])],
        0
      )
      const graph = makeGraph([node])
      node.isUploading = true

      const result = scanNodeMediaCandidates(graph, node)

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
    expect(scanNodeMediaCandidates(graph, node)).toEqual([])

    node.isUploading = false
    expect(scanNodeMediaCandidates(graph, node)).toEqual([
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

      const result = scanNodeMediaCandidates(graph, node)

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
    },
    {
      nodeType: 'LoadImage',
      widgetName: 'image',
      value: 'preview.png [temp]'
    }
  ])(
    'leaves OSS $nodeType $value pending when not in options',
    ({ nodeType, widgetName, value }) => {
      const node = makeMediaNode(
        1,
        nodeType,
        [makeMediaCombo(widgetName, value, ['other-file.png'])],
        0
      )
      const graph = makeGraph([node])

      const result = scanNodeMediaCandidates(graph, node)

      expect(result[0]).toMatchObject({
        nodeType,
        widgetName,
        name: value,
        isMissing: undefined
      })
    }
  )

  it.for([
    { value: 'photo.png', options: ['other.png'] },
    { value: 'photo.png', options: ['photo.png'] },
    { value: 'photo.png [output]', options: ['photo.png [output]'] }
  ])(
    'defers $value to asset verification when the asset API is enabled',
    ({ value, options }) => {
      vi.mocked(useFeatureFlags().flags).assetsEnabled = true
      const node = makeMediaNode(
        1,
        'LoadImage',
        [makeMediaCombo('image', value, options)],
        0
      )

      const result = scanNodeMediaCandidates(makeGraph([node]), node)

      expect(result).toEqual([
        expect.objectContaining({ name: value, isMissing: undefined })
      ])
    }
  )

  it('resolves OSS output annotations present in options', () => {
    const value = 'subfolder/photo.png [output]'
    const node = makeMediaNode(1, 'LoadImage', [
      makeMediaCombo('image', value, [value])
    ])

    expect(scanNodeMediaCandidates(makeGraph([node]), node)).toEqual([
      expect.objectContaining({ name: value, isMissing: false })
    ])
  })

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

    const result = scanNodeMediaCandidates(makeGraph([node]), node)

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

    const result = scanNodeMediaCandidates(graph, node)

    expect(result[0]).toMatchObject({
      name: 'photo.png [input]',
      isMissing: true
    })
  })

  it('matches compact annotations against clean OSS options', () => {
    const node = makeMediaNode(
      1,
      'LoadImage',
      [makeMediaCombo('image', 'photo.png[input]', ['photo.png'])],
      0
    )
    const graph = makeGraph([node])

    const result = scanNodeMediaCandidates(graph, node)

    expect(result[0]).toMatchObject({
      name: 'photo.png[input]',
      isMissing: false
    })
  })
})

describe('isMissingMediaCandidateScopeActive', () => {
  function createLoadImageGraph() {
    const graph = new LGraph()
    const node = new LGraphNode('LoadImage', 'LoadImage')
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

  it('drops a candidate whose widget value changed while verification was pending', () => {
    const { graph, node, widget } = createLoadImageGraph()
    const candidate = makeCandidate(String(node.id), 'missing.png')

    expect.soft(isMissingMediaCandidateScopeActive(graph, candidate)).toBe(true)

    widget.value = 'valid.png'

    expect(isMissingMediaCandidateScopeActive(graph, candidate)).toBe(false)
  })
})

describe('scanAllMediaCandidates', () => {
  beforeEach(disableAssetApi)

  it('skips muted nodes (mode === NEVER)', () => {
    const node = makeMediaNode(
      1,
      'LoadImage',
      [makeMediaCombo('image', 'photo.png', ['other.png'])],
      2 // NEVER
    )
    const result = scanAllMediaCandidates(makeGraph([node]))
    expect(result).toHaveLength(0)
  })

  it('skips bypassed nodes (mode === BYPASS)', () => {
    const node = makeMediaNode(
      2,
      'LoadImage',
      [makeMediaCombo('image', 'photo.png', ['other.png'])],
      4 // BYPASS
    )
    const result = scanAllMediaCandidates(makeGraph([node]))
    expect(result).toHaveLength(0)
  })

  it('includes active nodes (mode === ALWAYS)', () => {
    const node = makeMediaNode(
      3,
      'LoadImage',
      [makeMediaCombo('image', 'photo.png', ['other.png'])],
      0 // ALWAYS
    )
    const result = scanAllMediaCandidates(makeGraph([node]))
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
  const blakeHash =
    'blake3:1111111111111111111111111111111111111111111111111111111111111111'

  interface AssetSources {
    input?: AssetItem[]
    output?: AssetItem[]
    remote?: AssetItem[]
  }

  function stubAssets({ input = [], output = [], remote = [] }: AssetSources) {
    vi.mocked(api.fetchApi).mockImplementation(async () =>
      Response.json({ assets: remote, total: remote.length, has_more: false })
    )
    const store = useAssetsStore()
    store.inputAssets = fromPartial({ items: input })
    store.outputAssets = fromPartial({ items: output })
  }

  const hashLookups = () =>
    vi.mocked(api.fetchApi).mock.calls.filter(([url]) => url.includes('hash='))

  it.for<
    AssetSources & {
      source: string
      name: string
      assetsEnabled?: boolean
      isMissing: boolean | undefined
      fetched: boolean
    }
  >([
    {
      source: 'input store',
      name: 'photo.png',
      input: [makeAsset('photo.png')],
      isMissing: false,
      fetched: false
    },
    {
      source: 'output store',
      name: 'photo.png [output]',
      output: [makeAsset('photo.png')],
      isMissing: false,
      fetched: false
    },
    {
      source: 'store hash',
      name: blakeHash,
      input: [makeAsset('stored.png', blakeHash)],
      isMissing: false,
      fetched: false
    },
    {
      source: 'remote match',
      name: 'photo.png [input]',
      remote: [makeAsset('photo.png')],
      isMissing: false,
      fetched: true
    },
    {
      source: 'remote miss',
      name: 'photo.png [input]',
      isMissing: true,
      fetched: true
    },
    {
      source: 'store miss without assets',
      name: 'photo.png',
      assetsEnabled: false,
      isMissing: undefined,
      fetched: false
    }
  ])(
    'resolves from $source',
    async ({ name, assetsEnabled = true, isMissing, fetched, ...sources }) => {
      vi.mocked(useFeatureFlags().flags).assetsEnabled = assetsEnabled
      stubAssets(sources)
      const candidates = [makeCandidate('1', name, { isMissing: undefined })]

      await verifyMediaCandidates(candidates)

      expect(candidates[0].isMissing).toBe(isMissing)
      expect(hashLookups().length > 0).toBe(fetched)
    }
  )

  it('queries remote assets once per name by unannotated name', async () => {
    stubAssets({})
    const { signal } = new AbortController()
    const candidates = [
      makeCandidate('1', 'photo.png [input]', { isMissing: undefined }),
      makeCandidate('2', 'photo.png [input]', { isMissing: undefined })
    ]

    await verifyMediaCandidates(candidates, { signal })

    expect(hashLookups()).toEqual([
      ['/assets?hash=photo.png&limit=1', { signal }]
    ])
    expect(candidates.map((c) => c.isMissing)).toEqual([true, true])
  })

  it('leaves resolved candidates untouched', async () => {
    stubAssets({})
    const candidates = [
      makeCandidate('1', 'a.png', { isMissing: true }),
      makeCandidate('2', 'b.png', { isMissing: false })
    ]

    await verifyMediaCandidates(candidates)

    expect(candidates.map((c) => c.isMissing)).toEqual([true, false])
    expect(hashLookups()).toEqual([])
  })

  it('propagates remote failures', async () => {
    stubAssets({})
    vi.mocked(api.fetchApi).mockRejectedValue(new Error('offline'))

    await expect(
      verifyMediaCandidates([
        makeCandidate('1', 'photo.png', { isMissing: undefined })
      ])
    ).rejects.toThrow('offline')
  })

  it('leaves candidates pending when aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    stubAssets({})
    vi.mocked(api.fetchApi).mockRejectedValue(controller.signal.reason)
    const candidates = [
      makeCandidate('1', 'photo.png', { isMissing: undefined })
    ]

    await expect(
      verifyMediaCandidates(candidates, { signal: controller.signal })
    ).resolves.toBeUndefined()
    expect(candidates[0].isMissing).toBeUndefined()
  })
})
