import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IVideoEditWidget,
  IWidgetVideoEditOptions,
  VideoEditValue
} from '@/lib/litegraph/src/types/widgets'
import type {
  InputSpec as InputSpecV2,
  VideoEditInputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useVideoEditWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IVideoEditWidget => {
    const spec = inputSpec as VideoEditInputSpec
    const features = spec.features ?? ['trim', 'crop']

    const defaultValue: VideoEditValue = spec.default ?? {
      ...(features.includes('trim') && {
        trim: { start_time: 0, duration: 0 }
      }),
      ...(features.includes('crop') && {
        crop: { x: 0, y: 0, width: 0, height: 0 }
      })
    }

    const options: IWidgetVideoEditOptions = {
      features,
      serialize: true,
      canvasOnly: false,
      hideInPanel: true
    }

    const rawWidget = node.addWidget(
      'videoedit',
      spec.name,
      structuredClone(defaultValue),
      () => {},
      options
    )

    if (rawWidget.type !== 'videoedit') {
      throw new Error(`Unexpected widget type: ${rawWidget.type}`)
    }

    return rawWidget as IVideoEditWidget
  }
}
