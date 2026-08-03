import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import {
  createPromotedMediaRuntime,
  seedMediaNodeDefs
} from '@/platform/missingMedia/__fixtures__/promotedMedia'

import {
  scanAllMediaCandidates,
  scanNodeMediaCandidates
} from './missingMediaScan'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  seedMediaNodeDefs()
})

describe('scanNodeMediaCandidates — promoted host widgets', () => {
  it('reports a missing promoted media value through the editable host widget', () => {
    const {
      rootGraph: graph,
      hosts: [host]
    } = createPromotedMediaRuntime()

    const result = scanNodeMediaCandidates(graph, host, false)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      nodeId: '65',
      nodeType: 'LoadImage',
      widgetName: 'outer_image',
      name: 'missing-host.png',
      isMissing: true
    })
  })

  it('does not report a promoted host when its leaf source is bypassed', () => {
    const {
      rootGraph: graph,
      hosts: [host],
      sourceNodes: [sourceNode]
    } = createPromotedMediaRuntime()

    expect.soft(scanNodeMediaCandidates(graph, host, false)).toEqual([
      expect.objectContaining({
        nodeId: '65',
        widgetName: 'outer_image'
      })
    ])
    sourceNode.mode = LGraphEventMode.BYPASS

    expect(scanNodeMediaCandidates(graph, host, false)).toEqual([])
  })

  it('does not report a promoted host when its leaf source never executes', () => {
    const {
      rootGraph: graph,
      hosts: [host],
      sourceNodes: [sourceNode]
    } = createPromotedMediaRuntime()

    expect.soft(scanNodeMediaCandidates(graph, host, false)).toEqual([
      expect.objectContaining({
        nodeId: '65',
        widgetName: 'outer_image'
      })
    ])
    sourceNode.mode = LGraphEventMode.NEVER

    expect(scanNodeMediaCandidates(graph, host, false)).toEqual([])
  })

  it('does not report a linked interior media widget as an editable candidate', () => {
    const {
      rootGraph: graph,
      sourceNodes: [sourceNode]
    } = createPromotedMediaRuntime()

    const result = scanNodeMediaCandidates(graph, sourceNode, false)

    expect(result).toEqual([])
  })
})

describe('scanAllMediaCandidates — promoted host widgets', () => {
  it('treats a promoted value seeded from leaf options as present on its host', () => {
    const { rootGraph: graph } = createPromotedMediaRuntime({
      hostValue: 'leaf-option.png',
      sourceValue: 'leaf-option.png',
      sourceOptions: ['leaf-option.png']
    })

    expect(scanAllMediaCandidates(graph, false)).toEqual([
      expect.objectContaining({
        nodeId: '65',
        widgetName: 'outer_image',
        name: 'leaf-option.png',
        isMissing: false
      })
    ])
  })

  it('uses a valid host value even when the linked interior value is stale', () => {
    const { rootGraph: graph } = createPromotedMediaRuntime({
      hostValue: 'valid.png'
    })

    const result = scanAllMediaCandidates(graph, false)

    expect(result).toEqual([
      expect.objectContaining({
        nodeId: '65',
        widgetName: 'outer_image',
        name: 'valid.png',
        isMissing: false
      })
    ])
  })

  it('reports a promoted candidate with its editable host identity', () => {
    const { rootGraph: graph } = createPromotedMediaRuntime()

    const result = scanAllMediaCandidates(graph, false)

    expect(result).toEqual([
      {
        nodeId: '65',
        nodeType: 'LoadImage',
        widgetName: 'outer_image',
        mediaType: 'image',
        name: 'missing-host.png',
        isMissing: true
      }
    ])
  })

  it('reports only the outer editable host for a nested promoted media chain', () => {
    const { rootGraph } = createPromotedMediaRuntime({ depth: 2 })

    const result = scanAllMediaCandidates(rootGraph, false)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      nodeId: '65',
      nodeType: 'LoadImage',
      widgetName: 'outer_image'
    })
  })

  it('reports independent host candidates for shared subgraph instances', () => {
    const { rootGraph } = createPromotedMediaRuntime({ hostIds: [65, 66] })

    const result = scanAllMediaCandidates(rootGraph, false)

    expect(result).toHaveLength(2)
    expect(result).toMatchObject([
      { nodeId: '65', widgetName: 'outer_image' },
      { nodeId: '66', widgetName: 'outer_image' }
    ])
  })

  it('reports one host candidate for three active promoted consumers', () => {
    const { rootGraph: graph } = createPromotedMediaRuntime({
      sourceIds: [42, 43, 44]
    })

    const result = scanAllMediaCandidates(graph, false)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      nodeId: '65',
      widgetName: 'outer_image',
      nodeType: 'LoadImage'
    })
  })

  it.for([
    {
      caseName: 'first consumer bypassed keeps host',
      consumerIndexes: [0],
      mode: LGraphEventMode.BYPASS,
      keepsHost: true
    },
    {
      caseName: 'middle consumer bypassed keeps host',
      consumerIndexes: [1],
      mode: LGraphEventMode.BYPASS,
      keepsHost: true
    },
    {
      caseName: 'all consumers bypassed removes host',
      consumerIndexes: [0, 1, 2],
      mode: LGraphEventMode.BYPASS,
      keepsHost: false
    },
    {
      caseName: 'all consumers never removes host',
      consumerIndexes: [0, 1, 2],
      mode: LGraphEventMode.NEVER,
      keepsHost: false
    }
  ] as const)('$caseName', ({ caseName, consumerIndexes, mode, keepsHost }) => {
    const { rootGraph: graph, sourceNodes } = createPromotedMediaRuntime({
      sourceIds: [42, 43, 44]
    })
    const hostCandidate = [
      expect.objectContaining({ nodeId: '65', widgetName: 'outer_image' })
    ]
    if (!keepsHost) {
      expect
        .soft(
          scanAllMediaCandidates(graph, false),
          `${caseName}: active baseline`
        )
        .toEqual(hostCandidate)
    }
    for (const index of consumerIndexes) {
      sourceNodes[index].mode = mode
    }

    const result = scanAllMediaCandidates(graph, false)

    expect(result).toEqual(keepsHost ? hostCandidate : [])
  })

  it('keeps one outer host candidate when the last nested branch is bypassed', () => {
    const {
      rootGraph: graph,
      intermediateHosts: [, lastInnerHost]
    } = createPromotedMediaRuntime({
      sourceIds: [42, 43],
      depth: 2
    })
    if (!lastInnerHost) throw new Error('Expected nested fanout branch')
    lastInnerHost.mode = LGraphEventMode.BYPASS

    const result = scanAllMediaCandidates(graph, false)

    expect(result).toEqual([
      expect.objectContaining({
        nodeId: '65',
        widgetName: 'outer_image',
        nodeType: 'LoadImage'
      })
    ])
  })

  it('does not report a promoted host when its leaf source is bypassed', () => {
    const {
      rootGraph: graph,
      sourceNodes: [sourceNode]
    } = createPromotedMediaRuntime()

    expect.soft(scanAllMediaCandidates(graph, false)).toHaveLength(1)
    sourceNode.mode = LGraphEventMode.BYPASS

    expect(scanAllMediaCandidates(graph, false)).toEqual([])
  })

  it('does not report a promoted host when its leaf source never executes', () => {
    const {
      rootGraph: graph,
      sourceNodes: [sourceNode]
    } = createPromotedMediaRuntime()

    expect.soft(scanAllMediaCandidates(graph, false)).toHaveLength(1)
    sourceNode.mode = LGraphEventMode.NEVER

    expect(scanAllMediaCandidates(graph, false)).toEqual([])
  })

  it('accepts a value found only in the promoted host options', () => {
    const { rootGraph: graph } = createPromotedMediaRuntime({
      hostValue: 'host-only.png',
      hostOptions: ['host-only.png'],
      sourceValue: 'host-only.png',
      sourceOptions: ['leaf-option.png']
    })

    expect(scanAllMediaCandidates(graph, false)).toEqual([
      expect.objectContaining({
        nodeId: '65',
        widgetName: 'outer_image',
        name: 'host-only.png',
        isMissing: false
      })
    ])
  })

  it('reports a value found only in the interior leaf options as missing', () => {
    const { rootGraph: graph } = createPromotedMediaRuntime({
      hostValue: 'leaf-only.png',
      hostOptions: ['host-option.png'],
      sourceValue: 'leaf-only.png',
      sourceOptions: ['leaf-only.png']
    })

    expect(scanAllMediaCandidates(graph, false)).toEqual([
      expect.objectContaining({
        nodeId: '65',
        widgetName: 'outer_image',
        name: 'leaf-only.png',
        isMissing: true
      })
    ])
  })
})
