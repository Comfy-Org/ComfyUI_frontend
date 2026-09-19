import { describe, expect, it } from 'vitest'

import {
  getMinimapDecorations,
  registerMinimapDecorationLayer
} from './minimapDecorationRegistry'
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
        tone: 'accent',
        treatment: 'fill',
        enter: 'pop'
      }
    ])
    const enteredAt = getMinimapDecorations(scopeA)[0]?.enteredAt

    expect(getMinimapDecorations(scopeB)).toEqual([])
    layer.replace([
      {
        target: { ...scopeA, nodeId: toNodeId('7') },
        tone: 'accent',
        treatment: 'fill',
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
        target: { ...scopeA, nodeId: toNodeId('8') },
        tone: 'accent',
        treatment: 'fill'
      }
    ])
    expect(getMinimapDecorations(scopeA)).toEqual([])
  })
})
