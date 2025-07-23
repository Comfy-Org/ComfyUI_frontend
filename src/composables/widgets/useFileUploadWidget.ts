import type { LGraphNode } from '@comfyorg/litegraph'
import type { IFileUploadWidget } from '@comfyorg/litegraph/dist/types/widgets'

import type {
  FileUploadInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useFileUploadWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IFileUploadWidget => {
    const { name, options = {} } = inputSpec as FileUploadInputSpec

    const widget = node.addWidget('fileupload', name, '', () => {}, {
      serialize: true,
      ...(options as Record<string, unknown>)
    }) as IFileUploadWidget

    return widget
  }
}
