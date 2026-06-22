import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PreviewExposure } from '@/core/schemas/previewExposureSchema'
import { asNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

import type { PreviewExposureChainContext } from './previewExposureChain'
import { resolvePreviewExposureChain } from './previewExposureChain'

const rootGraphA = 'root-a' as UUID
const rootGraphB = 'root-b' as UUID

type FixtureExposure = Omit<PreviewExposure, 'sourceNodeId'> & {
  sourceNodeId: NodeId
}

interface NestedHostMapping {
  fromHostLocator: string
  fromSourceNodeId: NodeId
  toRootGraphId: UUID
  toHostLocator: string
}

function makeContext(
  exposureMap: Map<string, FixtureExposure[]>,
  nested: NestedHostMapping[]
): PreviewExposureChainContext {
  return {
    getExposures(rootGraphId, hostLocator) {
      return exposureMap.get(`${rootGraphId}|${hostLocator}`) ?? []
    },
    resolveNestedHost(_rootGraphId, hostLocator, sourceNodeId) {
      const match = nested.find(
        (n) =>
          n.fromHostLocator === hostLocator &&
          n.fromSourceNodeId === sourceNodeId
      )
      if (!match) return undefined
      return {
        rootGraphId: match.toRootGraphId,
        hostNodeLocator: match.toHostLocator
      }
    }
  }
}

describe(resolvePreviewExposureChain, () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('returns undefined when the named exposure is not on the starting host', () => {
    const ctx = makeContext(new Map(), [])
    expect(
      resolvePreviewExposureChain(rootGraphA, 'host-a', 'absent', ctx)
    ).toBeUndefined()
  })

  it('returns a single-step chain when the source is a leaf (no nested host)', () => {
    const exposureMap = new Map<string, FixtureExposure[]>([
      [
        `${rootGraphA}|host-a`,
        [
          {
            name: 'preview',
            sourceNodeId: asNodeId(42),
            sourcePreviewName: '$$canvas-image-preview'
          }
        ]
      ]
    ])
    const ctx = makeContext(exposureMap, [])

    const result = resolvePreviewExposureChain(
      rootGraphA,
      'host-a',
      'preview',
      ctx
    )

    expect(result).toEqual({
      steps: [
        {
          rootGraphId: rootGraphA,
          hostNodeLocator: 'host-a',
          exposure: {
            name: 'preview',
            sourceNodeId: asNodeId(42),
            sourcePreviewName: '$$canvas-image-preview'
          }
        }
      ],
      leaf: {
        rootGraphId: rootGraphA,
        sourceNodeId: asNodeId(42),
        sourcePreviewName: '$$canvas-image-preview'
      }
    })
  })

  it('walks one nested host and returns a two-step chain', () => {
    const exposureMap = new Map<string, FixtureExposure[]>([
      [
        `${rootGraphA}|host-outer`,
        [
          {
            name: 'outer-preview',
            sourceNodeId: asNodeId(99),
            sourcePreviewName: 'inner-preview'
          }
        ]
      ],
      [
        `${rootGraphA}|host-inner`,
        [
          {
            name: 'inner-preview',
            sourceNodeId: asNodeId(77),
            sourcePreviewName: '$$canvas-image-preview'
          }
        ]
      ]
    ])
    const ctx = makeContext(exposureMap, [
      {
        fromHostLocator: 'host-outer',
        fromSourceNodeId: asNodeId(99),
        toRootGraphId: rootGraphA,
        toHostLocator: 'host-inner'
      }
    ])

    const result = resolvePreviewExposureChain(
      rootGraphA,
      'host-outer',
      'outer-preview',
      ctx
    )

    expect(result?.steps).toHaveLength(2)
    expect(result?.steps[0].hostNodeLocator).toBe('host-outer')
    expect(result?.steps[1].hostNodeLocator).toBe('host-inner')
    expect(result?.leaf).toEqual({
      rootGraphId: rootGraphA,
      sourceNodeId: asNodeId(77),
      sourcePreviewName: '$$canvas-image-preview'
    })
  })

  it('walks two nested hosts (three-step chain) crossing a root graph boundary', () => {
    const exposureMap = new Map<string, FixtureExposure[]>([
      [
        `${rootGraphA}|host-1`,
        [
          {
            name: 'p1',
            sourceNodeId: asNodeId(10),
            sourcePreviewName: 'p2'
          }
        ]
      ],
      [
        `${rootGraphA}|host-2`,
        [
          {
            name: 'p2',
            sourceNodeId: asNodeId(20),
            sourcePreviewName: 'p3'
          }
        ]
      ],
      [
        `${rootGraphB}|host-3`,
        [
          {
            name: 'p3',
            sourceNodeId: asNodeId(30),
            sourcePreviewName: '$$canvas-image-preview'
          }
        ]
      ]
    ])
    const ctx = makeContext(exposureMap, [
      {
        fromHostLocator: 'host-1',
        fromSourceNodeId: asNodeId(10),
        toRootGraphId: rootGraphA,
        toHostLocator: 'host-2'
      },
      {
        fromHostLocator: 'host-2',
        fromSourceNodeId: asNodeId(20),
        toRootGraphId: rootGraphB,
        toHostLocator: 'host-3'
      }
    ])

    const result = resolvePreviewExposureChain(rootGraphA, 'host-1', 'p1', ctx)

    expect(result?.steps).toHaveLength(3)
    expect(result?.steps.map((s) => s.exposure.name)).toEqual([
      'p1',
      'p2',
      'p3'
    ])
    expect(result?.leaf).toEqual({
      rootGraphId: rootGraphB,
      sourceNodeId: asNodeId(30),
      sourcePreviewName: '$$canvas-image-preview'
    })
  })

  it('terminates at outer step when nested host has no matching exposure', () => {
    const exposureMap = new Map<string, FixtureExposure[]>([
      [
        `${rootGraphA}|host-outer`,
        [
          {
            name: 'outer',
            sourceNodeId: asNodeId(99),
            sourcePreviewName: 'missing-on-inner'
          }
        ]
      ],
      [`${rootGraphA}|host-inner`, []]
    ])
    const ctx = makeContext(exposureMap, [
      {
        fromHostLocator: 'host-outer',
        fromSourceNodeId: asNodeId(99),
        toRootGraphId: rootGraphA,
        toHostLocator: 'host-inner'
      }
    ])

    const result = resolvePreviewExposureChain(
      rootGraphA,
      'host-outer',
      'outer',
      ctx
    )

    expect(result?.steps).toHaveLength(1)
    expect(result?.leaf).toEqual({
      rootGraphId: rootGraphA,
      sourceNodeId: asNodeId(99),
      sourcePreviewName: 'missing-on-inner'
    })
  })

  it('detects cycles, warns, and stops walking', () => {
    const exposureMap = new Map<string, FixtureExposure[]>([
      [
        `${rootGraphA}|host-a`,
        [
          {
            name: 'cyclic',
            sourceNodeId: asNodeId(40),
            sourcePreviewName: 'cyclic'
          }
        ]
      ]
    ])
    const ctx = makeContext(exposureMap, [
      {
        fromHostLocator: 'host-a',
        fromSourceNodeId: asNodeId(40),
        toRootGraphId: rootGraphA,
        toHostLocator: 'host-a'
      }
    ])

    const result = resolvePreviewExposureChain(
      rootGraphA,
      'host-a',
      'cyclic',
      ctx
    )

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('cycle detected')
    )
    expect(result?.steps).toHaveLength(1)
    expect(result?.leaf.sourceNodeId).toBe(asNodeId(40))
  })
})
