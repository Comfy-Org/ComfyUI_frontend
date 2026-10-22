import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'
import {
  deriveWidgetVisibility,
  isWidgetVisibleOnSurface
} from '@/types/widgetVisibility'

import { useBoundingBoxWidget } from './useBoundingBoxWidget'
import { useCompositorWidget } from './useCompositorWidget'
import { useCurveWidget } from './useCurveWidget'
import { useImageCompareWidget } from './useImageCompareWidget'
import { usePainterWidget } from './usePainterWidget'

const view = { showAdvanced: true }

describe('rich widget panel visibility', () => {
  it.for<{
    widgetType: string
    construct: ComfyWidgetConstructorV2
    inputSpec: InputSpecV2
  }>([
    {
      widgetType: 'imagecrop',
      construct: useBoundingBoxWidget(),
      inputSpec: { type: 'BOUNDING_BOX', name: 'crop', component: 'ImageCrop' }
    },
    {
      widgetType: 'boundingbox',
      construct: useBoundingBoxWidget(),
      inputSpec: { type: 'BOUNDING_BOX', name: 'bbox' }
    },
    {
      widgetType: 'curve',
      construct: useCurveWidget(),
      inputSpec: { type: 'CURVE', name: 'curve' }
    },
    {
      widgetType: 'painter',
      construct: usePainterWidget(),
      inputSpec: { type: 'PAINTER', name: 'mask' }
    },
    {
      widgetType: 'compositor',
      construct: useCompositorWidget(),
      inputSpec: { type: 'COMPOSITOR', name: 'layers' }
    },
    {
      widgetType: 'imagecompare',
      construct: useImageCompareWidget(),
      inputSpec: { type: 'IMAGECOMPARE', name: 'compare' }
    }
  ])(
    'renders $widgetType on the node body but not in the right side panel',
    ({ widgetType, construct, inputSpec }) => {
      const node = new LGraphNode('RichWidgetNode')

      const widget = construct(node, inputSpec)
      const visibility = widget.visibility ?? deriveWidgetVisibility(widget)

      expect(widget.type).toBe(widgetType)
      expect(isWidgetVisibleOnSurface(visibility, 'vueNode', view)).toBe(true)
      expect(isWidgetVisibleOnSurface(visibility, 'panel', view)).toBe(false)
    }
  )
})
