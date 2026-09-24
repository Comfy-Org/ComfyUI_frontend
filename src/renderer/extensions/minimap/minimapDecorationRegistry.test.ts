import { describe, expect, it, vi } from 'vitest'

import {
  getMinimapDecorations,
  registerMinimapDecorationLayer
} from '@/platform/canvas/minimapDecorationRegistry'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

const scopeA = {
  rootGraphId: toRootGraphId('workflow-a'),
  owningGraphId: toOwningGraphId('workflow-a')
}
const scopeB = {
  rootGraphId: toRootGraphId('workflow-b'),
  owningGraphId: toOwningGraphId('workflow-b')
}

describe('minimapDecorationRegistry', () => {
  it('atomically replaces graph-scoped rows and preserves entry time', () => {
    const layer = registerMinimapDecorationLayer('test.scope')
    layer.replace([
      {
        target: { ...scopeA, nodeId: toNodeId('7') },
        enter: 'pop'
      }
    ])
    const enteredAt = getMinimapDecorations(scopeA)[0]?.enteredAt

    expect(getMinimapDecorations(scopeB)).toEqual([])
    layer.replace([
      {
        target: { ...scopeA, nodeId: toNodeId('7') },
        enter: 'pop'
      }
    ])
    expect(getMinimapDecorations(scopeA)[0]?.enteredAt).toBe(enteredAt)

    layer.replace([])
    expect(getMinimapDecorations(scopeA)).toEqual([])
    layer.dispose()
  })

  it('cannot resurrect a disposed layer', () => {
    const layer = registerMinimapDecorationLayer('test.dispose')
    layer.dispose()
    layer.replace([
      {
        target: { ...scopeA, nodeId: toNodeId('8') }
      }
    ])
    expect(getMinimapDecorations(scopeA)).toEqual([])
  })

  it('owns target values on both sides of the registry boundary', () => {
    const layer = registerMinimapDecorationLayer('test.ownership')
    const target = { ...scopeA, nodeId: toNodeId('9') }
    layer.replace([{ target }])

    target.nodeId = toNodeId('10')
    const result = getMinimapDecorations(scopeA)
    expect(result[0]?.target.nodeId).toBe('9')

    ;(result[0].target as { nodeId: ReturnType<typeof toNodeId> }).nodeId =
      toNodeId('11')
    expect(getMinimapDecorations(scopeA)[0]?.target.nodeId).toBe('9')
    layer.dispose()
  })

  it('stages new pop decorations while preserving existing entry times', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1_000)
    const layer = registerMinimapDecorationLayer('test.stagger')
    layer.replace(
      ['1', '2', '3'].map((id) => ({
        target: { ...scopeA, nodeId: toNodeId(id) },
        enter: 'pop' as const
      }))
    )

    expect(
      getMinimapDecorations(scopeA).map(({ enteredAt }) => enteredAt)
    ).toEqual([1_000, 1_050, 1_100])

    now.mockReturnValue(2_000)
    layer.replace([
      { target: { ...scopeA, nodeId: toNodeId('2') }, enter: 'pop' },
      { target: { ...scopeA, nodeId: toNodeId('4') }, enter: 'pop' }
    ])
    expect(
      getMinimapDecorations(scopeA).map(({ enteredAt }) => enteredAt)
    ).toEqual([1_050, 2_050])
    layer.dispose()
  })
})
