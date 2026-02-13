import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { curveMonotoneX, line } from 'd3-shape'

import type { CurvePoint } from '@/lib/litegraph/src/types/widgets'

interface UseCurveEditorOptions {
  svgRef: Ref<SVGSVGElement | null>
  modelValue: Ref<CurvePoint[]>
}

export function useCurveEditor({ svgRef, modelValue }: UseCurveEditorOptions) {
  const dragIndex = ref(-1)

  const sortedPoints = computed(() => {
    const points = modelValue.value
    if (!Array.isArray(points)) return []
    return [...points].sort((a, b) => a[0] - b[0])
  })

  const curvePath = computed(() => {
    const points = sortedPoints.value
    if (points.length < 2) return ''

    const lineGenerator = line<CurvePoint>()
      .x((d) => d[0])
      .y((d) => 1 - d[1])
      .curve(curveMonotoneX)

    return lineGenerator(points) ?? ''
  })

  function svgCoords(e: PointerEvent): [number, number] {
    const svg = svgRef.value
    if (!svg) return [0, 0]

    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY

    const ctm = svg.getScreenCTM()
    if (!ctm) return [0, 0]

    const svgPt = pt.matrixTransform(ctm.inverse())
    return [
      Math.max(0, Math.min(1, svgPt.x)),
      Math.max(0, Math.min(1, 1 - svgPt.y))
    ]
  }

  function handleSvgPointerDown(e: PointerEvent) {
    if (e.button !== 0) return

    const [x, y] = svgCoords(e)
    const newPoints: CurvePoint[] = [...modelValue.value, [x, y]]
    modelValue.value = newPoints

    const newIndex = newPoints.length - 1
    startDrag(newIndex, e)
  }

  function startDrag(index: number, e: PointerEvent) {
    if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
      if (modelValue.value.length > 2) {
        const newPoints = [...modelValue.value]
        newPoints.splice(index, 1)
        modelValue.value = newPoints
      }
      return
    }

    dragIndex.value = index
    const svg = svgRef.value
    if (!svg) return

    svg.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      if (dragIndex.value < 0) return
      const [x, y] = svgCoords(ev)
      const newPoints = [...modelValue.value]
      newPoints[dragIndex.value] = [x, y]
      modelValue.value = newPoints
    }

    const onUp = () => {
      dragIndex.value = -1
      svg.removeEventListener('pointermove', onMove)
      svg.removeEventListener('pointerup', onUp)
    }

    svg.addEventListener('pointermove', onMove)
    svg.addEventListener('pointerup', onUp)
  }

  return {
    curvePath,
    handleSvgPointerDown,
    startDrag
  }
}
