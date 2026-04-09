import { computed } from 'vue'

import type { ComputedRef } from 'vue'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { isCurveData } from '@/components/curve/curveUtils'
import type { CurveData } from '@/components/curve/types'
import type { GLSLRendererConfig } from '@/renderer/glsl/useGLSLRenderer'

interface AutogrowGroup {
  max: number
  min: number
  prefix?: string
}

interface UniformSource {
  nodeId: NodeId
  widgetName: string
}

interface UniformSources {
  floats: UniformSource[]
  ints: UniformSource[]
  bools: UniformSource[]
  curves: UniformSource[]
}

export function getAutogrowLimits(node: LGraphNode): GLSLRendererConfig {
  const defaults: GLSLRendererConfig = {
    maxInputs: 5,
    maxFloatUniforms: 20,
    maxIntUniforms: 20,
    maxBoolUniforms: 10,
    maxCurves: 4
  }

  if (!('comfyDynamic' in node)) return defaults

  const dynamic = node.comfyDynamic
  if (
    typeof dynamic !== 'object' ||
    dynamic === null ||
    !('autogrow' in dynamic)
  )
    return defaults

  const groups = dynamic.autogrow as Record<string, AutogrowGroup> | undefined
  if (!groups) return defaults

  return {
    maxInputs: groups['images']?.max ?? defaults.maxInputs,
    maxFloatUniforms: groups['floats']?.max ?? defaults.maxFloatUniforms,
    maxIntUniforms: groups['ints']?.max ?? defaults.maxIntUniforms,
    maxBoolUniforms: groups['bools']?.max ?? defaults.maxBoolUniforms,
    maxCurves: groups['curves']?.max ?? defaults.maxCurves
  }
}

export function extractUniformSources(
  glslNode: LGraphNode,
  subgraph: Subgraph
): UniformSources {
  const floats: UniformSource[] = []
  const ints: UniformSource[] = []
  const bools: UniformSource[] = []
  const curves: UniformSource[] = []

  if (!glslNode.inputs) return { floats, ints, bools, curves }

  for (const input of glslNode.inputs) {
    if (input.link == null) continue

    const link = subgraph.getLink(input.link)
    if (!link || link.origin_id === SUBGRAPH_INPUT_ID) continue

    const sourceNode = subgraph.getNodeById(link.origin_id)
    if (!sourceNode?.widgets?.[0]) continue

    const inputName = input.name ?? ''
    const dotIndex = inputName.indexOf('.')
    if (dotIndex === -1) continue

    const prefix = inputName.slice(0, dotIndex)
    const source: UniformSource = {
      nodeId: sourceNode.id as NodeId,
      widgetName: sourceNode.widgets[0].name
    }

    if (prefix === 'floats') floats.push(source)
    else if (prefix === 'ints') ints.push(source)
    else if (prefix === 'bools') bools.push(source)
    else if (prefix === 'curves') curves.push(source)
  }

  return { floats, ints, bools, curves }
}

export function useGLSLUniforms(
  graphId: ComputedRef<UUID | undefined>,
  nodeId: ComputedRef<NodeId | undefined>,
  nodeRef: ComputedRef<LGraphNode | null>,
  uniformSources: ComputedRef<UniformSources | null>,
  rendererConfig: ComputedRef<GLSLRendererConfig>
) {
  const widgetValueStore = useWidgetValueStore()

  function collectValues<T>(
    subgraphSources: UniformSource[] | undefined,
    groupName: string,
    uniformPrefix: string,
    maxCount: number,
    coerce: (value: unknown) => T,
    defaultValue: T
  ): T[] {
    const gId = graphId.value
    if (!gId) return []

    if (subgraphSources) {
      return subgraphSources.map(({ nodeId: nId, widgetName }) => {
        const widget = widgetValueStore.getWidget(gId, nId, widgetName)
        return coerce(widget?.value ?? defaultValue)
      })
    }

    const nId = nodeId.value
    const node = nodeRef.value
    if (nId == null || !node) return []

    const values: T[] = []
    for (let i = 0; i < maxCount; i++) {
      const inputName = `${groupName}.${uniformPrefix}${i}`
      const widget = widgetValueStore.getWidget(gId, nId, inputName)
      if (widget !== undefined) {
        values.push(coerce(widget.value))
        continue
      }

      const slot = node.inputs?.findIndex((inp) => inp.name === inputName)
      if (slot == null || slot < 0) break

      const upstreamNode = node.getInputNode(slot)
      if (!upstreamNode) break
      const upstreamWidgets = widgetValueStore.getNodeWidgets(
        gId,
        upstreamNode.id as NodeId
      )
      if (upstreamWidgets.length === 0) break
      values.push(coerce(upstreamWidgets[0].value))
    }
    return values
  }

  const toNumber = (v: unknown): number => Number(v) || 0
  const toBool = (v: unknown): boolean => Boolean(v)

  const floatValues = computed(() =>
    collectValues(
      uniformSources.value?.floats,
      'floats',
      'u_float',
      rendererConfig.value.maxFloatUniforms,
      toNumber,
      0
    )
  )

  const intValues = computed(() =>
    collectValues(
      uniformSources.value?.ints,
      'ints',
      'u_int',
      rendererConfig.value.maxIntUniforms,
      toNumber,
      0
    )
  )

  const boolValues = computed(() =>
    collectValues(
      uniformSources.value?.bools,
      'bools',
      'u_bool',
      rendererConfig.value.maxBoolUniforms,
      toBool,
      false
    )
  )

  const curveValues = computed((): CurveData[] => {
    const gId = graphId.value
    if (!gId) return []

    const sources = uniformSources.value?.curves
    if (sources && sources.length > 0) {
      return sources
        .map(({ nodeId: nId, widgetName }) => {
          const widget = widgetValueStore.getWidget(gId, nId, widgetName)
          return widget && isCurveData(widget.value)
            ? (widget.value as CurveData)
            : null
        })
        .filter((v): v is CurveData => v !== null)
    }

    const node = nodeRef.value
    const nId = nodeId.value
    if (nId == null || !node?.inputs) return []

    const values: CurveData[] = []
    const max = rendererConfig.value.maxCurves
    for (let i = 0; i < max; i++) {
      const inputName = `curves.u_curve${i}`

      const widget = widgetValueStore.getWidget(gId, nId, inputName)
      if (widget && isCurveData(widget.value)) {
        values.push(widget.value as CurveData)
        continue
      }

      const slot = node.inputs.findIndex((inp) => inp.name === inputName)
      if (slot < 0) break

      const upstreamNode = node.getInputNode(slot)
      if (!upstreamNode) break

      const upstreamWidgets = widgetValueStore.getNodeWidgets(
        gId,
        upstreamNode.id as NodeId
      )
      const curveWidget = upstreamWidgets.find((w) => isCurveData(w.value))
      if (!curveWidget) break
      values.push(curveWidget.value as CurveData)
    }
    return values
  })

  return {
    floatValues,
    intValues,
    boolValues,
    curveValues
  }
}
