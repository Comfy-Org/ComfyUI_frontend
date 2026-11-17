import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { CANVAS_IMAGE_PREVIEW_WIDGET } from '@/core/graph/subgraph/preview/mediaPreviewName'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { useGrowableRegions } from '@/renderer/extensions/vueNodes/layout/useGrowableRegions'
import { useWidgetHeightStore } from '@/stores/widgetHeightStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'

const regionId = (name: string) => widgetId('graph', toNodeId('1'), name)

function collapsible(
  element: HTMLElement,
  nodeElement: HTMLElement,
  property: string,
  { height, collapsed }: { height: number; collapsed: number }
) {
  Object.defineProperty(element, 'offsetHeight', {
    get: () =>
      nodeElement.style.getPropertyValue(property) === '0px'
        ? collapsed
        : height
  })
}

function mediaImage(
  nodeElement: HTMLElement,
  [naturalWidth, naturalHeight]: [number, number]
) {
  const image = document.createElement('img')
  Object.defineProperties(image, {
    naturalWidth: { value: naturalWidth },
    naturalHeight: { value: naturalHeight },
    offsetWidth: { value: 280 }
  })
  collapsible(image, nodeElement, '--user-height-probe', {
    height: 150,
    collapsed: 120
  })
  return image
}

function renderNode({
  images = [],
  maxHeight,
  widgetHeights
}: {
  images?: [number, number][]
  maxHeight?: number
  widgetHeights?: Record<string, number>
} = {}) {
  const nodeElement = document.createElement('div')
  nodeElement.dataset.nodeId = '1'
  Object.defineProperty(nodeElement, 'offsetWidth', { value: 300 })
  const region = document.createElement('div')
  const [regionName, otherRegionName] = images.length
    ? [CANVAS_IMAGE_PREVIEW_WIDGET, 'prompt']
    : ['prompt', CANVAS_IMAGE_PREVIEW_WIDGET]
  const handle = document.createElement('div')
  region.append(
    ...images.map((natural) => mediaImage(nodeElement, natural)),
    handle
  )
  nodeElement.append(region)
  document.body.append(nodeElement)

  collapsible(nodeElement, nodeElement, '--node-height', {
    height: 500,
    collapsed: 260
  })
  collapsible(region, nodeElement, '--user-height-probe', {
    height: 100,
    collapsed: 40
  })

  for (const [name, height] of Object.entries(widgetHeights ?? {}))
    useWidgetHeightStore().set(regionId(name), { height })
  const resizeNode = vi.fn()
  const onCommit = vi.fn()
  const growable = useGrowableRegions({ regionId, resizeNode, onCommit })

  function handleEvent(type: string, clientY: number) {
    const event = new PointerEvent(type, { button: 0, clientY, pointerId: 1 })
    Object.defineProperty(event, 'currentTarget', { value: handle })
    return event
  }

  function drag(deltaY: number) {
    growable.handle.start(
      handleEvent('pointerdown', 200),
      regionName,
      maxHeight
    )
    handle.dispatchEvent(
      new PointerEvent('pointermove', { clientY: 200 + deltaY })
    )
  }

  function reset() {
    growable.handle.reset(handleEvent('dblclick', 0), regionName)
  }

  return {
    growable,
    regionName,
    otherRegionName,
    resizeNode,
    onCommit,
    handle,
    drag,
    reset,
    handleEvent
  }
}

describe('useGrowableRegions', () => {
  it.for([
    { name: 'grows', scale: 1, deltaY: 50, height: 150, nodeHeight: 550 },
    {
      name: 'converts screen pixels at the camera scale',
      scale: 2,
      deltaY: 50,
      height: 125,
      nodeHeight: 525
    },
    {
      name: 'stops at its content minimum',
      scale: 1,
      deltaY: -200,
      height: 40,
      nodeHeight: 440
    },
    {
      name: 'stops at its declared maximum',
      scale: 1,
      deltaY: 200,
      maxHeight: 180,
      height: 180,
      nodeHeight: 580
    }
  ])(
    'dragging an edge $name, saving the region height on the node and moving the node by the same amount',
    ({ scale, deltaY, maxHeight, height, nodeHeight }) => {
      useTransformState().syncWithCanvas(
        fromPartial<LGraphCanvas>({ ds: { offset: [0, 0], scale } })
      )
      onTestFinished(() =>
        useTransformState().syncWithCanvas(
          fromPartial<LGraphCanvas>({ ds: { offset: [0, 0], scale: 1 } })
        )
      )
      const { growable, resizeNode, drag } = renderNode({
        maxHeight,
        widgetHeights: { other: 70 }
      })

      drag(deltaY)

      expect(growable.heightOf('prompt')).toBe(height)
      expect(growable.heightOf('other')).toBe(70)
      expect(resizeNode).toHaveBeenLastCalledWith(nodeHeight)
    }
  )

  it('records the drag once and ignores pointer moves after the handle loses pointer capture', () => {
    const { growable, handle, drag, onCommit } = renderNode()
    drag(10)
    expect(onCommit).not.toHaveBeenCalled()

    handle.dispatchEvent(new PointerEvent('lostpointercapture'))
    handle.dispatchEvent(new PointerEvent('pointermove', { clientY: 400 }))
    handle.dispatchEvent(new PointerEvent('lostpointercapture'))

    expect(growable.heightOf('prompt')).toBe(110)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('shrinks the node to its content and records the change', () => {
    const { growable, resizeNode, onCommit, handleEvent } = renderNode()

    growable.fitNode(handleEvent('dblclick', 0))

    expect(resizeNode).toHaveBeenCalledWith(260)
    expect(onCommit).toHaveBeenCalled()
  })

  it.for([
    { name: 'without media', images: [] },
    {
      name: 'holding several images',
      images: [
        [500, 1000],
        [1600, 400]
      ]
    },
    { name: 'whose image has not loaded', images: [[0, 0]] }
  ] satisfies { name: string; images: [number, number][] }[])(
    'double-clicking the edge of a region $name forgets its saved height',
    ({ images }) => {
      const {
        resizeNode,
        onCommit,
        growable,
        reset,
        regionName,
        otherRegionName
      } = renderNode({
        images,
        widgetHeights: { prompt: 90, [CANVAS_IMAGE_PREVIEW_WIDGET]: 90 }
      })

      reset()

      expect(growable.heightOf(regionName)).toBeUndefined()
      expect(growable.heightOf(otherRegionName)).toBe(90)
      expect(resizeNode).not.toHaveBeenCalled()
      expect(onCommit).toHaveBeenCalled()
    }
  )

  it.for([
    {
      name: 'a portrait image grows the region to the height its width allows',
      natural: [500, 1000],
      regionHeight: 510,
      nodeHeight: 910,
      nodeWidth: 300
    },
    {
      name: 'a wide image keeps its minimum height and widens the node',
      natural: [1600, 400],
      regionHeight: 70,
      nodeHeight: 470,
      nodeWidth: 500
    }
  ] satisfies {
    name: string
    natural: [number, number]
    regionHeight: number
    nodeHeight: number
    nodeWidth: number
  }[])(
    'double-clicking the edge of a single-media region fits it to its aspect ratio: $name',
    ({ natural, regionHeight, nodeHeight, nodeWidth }) => {
      const { growable, resizeNode, reset } = renderNode({
        images: [natural]
      })

      reset()

      expect(growable.heightOf(CANVAS_IMAGE_PREVIEW_WIDGET)).toBe(regionHeight)
      expect(resizeNode).toHaveBeenCalledWith(nodeHeight, nodeWidth)
    }
  )
})
