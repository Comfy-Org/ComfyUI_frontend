import { createPinia, setActivePinia } from 'pinia'
import { computed } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import type { CurveData } from '@/components/curve/types'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { GLSLRendererConfig } from '@/renderer/glsl/useGLSLRenderer'
import type { extractUniformSources } from '@/renderer/glsl/useGLSLUniforms'
import { useGLSLUniforms } from '@/renderer/glsl/useGLSLUniforms'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import type { UUID } from '@/utils/uuid'

/**
 * Regression guard for the GLSL live preview breaking on *promoted* subgraph
 * widget edits (QA 2026-07-20, Terry Jia; fixed by #13875).
 *
 * Under ADR 0009 link-only promotion, a promoted proxy widget's live value is
 * stored at the host widget key (`hostWidgetId`), while the uniform source is
 * still discovered from the interior source node. `useGLSLUniforms` must read
 * the host key so edits to the promoted curve/range proxy reach the renderer.
 *
 * #13875's own tests only prove `extractUniformSources` populates
 * `hostWidgetId`; nothing pins the *read* side (`collectValues` / `curveValues`
 * preferring `hostWidgetId`). This test closes that seam: without the read-side
 * fix the composable returns the stale interior value.
 */

const GRAPH_ID: UUID = '3f8e2a1c-0b47-4d96-8a5e-1c2d3e4f5a6b'
const INTERIOR_NODE_ID = toNodeId('10')
const HOST_NODE_ID = toNodeId('99')

type UniformSources = ReturnType<typeof extractUniformSources>

const emptySources: UniformSources = {
  floats: [],
  ints: [],
  bools: [],
  curves: []
}

const rendererConfig: GLSLRendererConfig = {
  maxInputs: 5,
  maxFloatUniforms: 20,
  maxIntUniforms: 20,
  maxBoolUniforms: 10,
  maxCurves: 4
}

function runUniforms(sources: UniformSources) {
  return useGLSLUniforms(
    computed<UUID | undefined>(() => GRAPH_ID),
    computed<NodeId | undefined>(() => HOST_NODE_ID),
    computed<LGraphNode | null>(() => null),
    computed<UniformSources | null>(() => sources),
    computed(() => rendererConfig)
  )
}

describe('useGLSLUniforms reads promoted widget values from the host key', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('curveValues reflects the edited host curve, not the stale interior curve', () => {
    const staleCurve: CurveData = {
      points: [
        [0, 0],
        [1, 0]
      ],
      interpolation: 'linear'
    }
    const editedCurve: CurveData = {
      points: [
        [0, 0],
        [1, 1]
      ],
      interpolation: 'linear'
    }

    const hostCurveId = widgetId(GRAPH_ID, HOST_NODE_ID, 'curve0')
    const store = useWidgetValueStore()
    store.registerWidget(widgetId(GRAPH_ID, INTERIOR_NODE_ID, 'curve'), {
      type: 'curve',
      value: staleCurve,
      options: {}
    })
    store.registerWidget(hostCurveId, {
      type: 'curve',
      value: editedCurve,
      options: {}
    })

    const { curveValues } = runUniforms({
      ...emptySources,
      curves: [
        {
          nodeId: INTERIOR_NODE_ID,
          widgetName: 'curve',
          hostWidgetId: hostCurveId,
          directValue: () => staleCurve
        }
      ]
    })

    expect(curveValues.value).toEqual([editedCurve])
  })

  it('floatValues reflects the edited host range, not the stale interior range', () => {
    const hostRangeId = widgetId(GRAPH_ID, HOST_NODE_ID, 'float0')
    const store = useWidgetValueStore()
    store.registerWidget(widgetId(GRAPH_ID, INTERIOR_NODE_ID, 'range'), {
      type: 'number',
      value: 7,
      options: {}
    })
    store.registerWidget(hostRangeId, {
      type: 'number',
      value: 42,
      options: {}
    })

    const { floatValues } = runUniforms({
      ...emptySources,
      floats: [
        {
          nodeId: INTERIOR_NODE_ID,
          widgetName: 'range',
          hostWidgetId: hostRangeId,
          directValue: () => 7
        }
      ]
    })

    expect(floatValues.value).toEqual([42])
  })
})
