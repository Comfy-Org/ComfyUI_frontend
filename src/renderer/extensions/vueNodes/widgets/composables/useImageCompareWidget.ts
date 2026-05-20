import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IImageCompareWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  ImageCompareInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export function useImageCompareWidget(): ComfyWidgetConstructorV2 {
  return (node: LGraphNode, inputSpec: InputSpecV2): IImageCompareWidget => {
    const { name, options = {} } = inputSpec as ImageCompareInputSpec

    const widget = node.addWidget('imagecompare', name, ['', ''], () => {}, {
      serialize: true,
      ...options
    }) as IImageCompareWidget

    // widget.serialize controls workflow persistence; widget.options.serialize
    // controls prompt (API) serialization — only disable the former.
    widget.serialize = false

    return widget
  }
}
