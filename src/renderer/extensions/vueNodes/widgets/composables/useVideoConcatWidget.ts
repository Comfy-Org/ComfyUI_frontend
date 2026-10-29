import { syncConcatOrderWithLinks } from '@/composables/videoConcat/syncConcatOrderWithLinks'
import type { LGraphNode } from '@comfyorg/litegraph/litegraph'
import type {
  IVideoConcatWidget,
  IWidgetVideoConcatOptions
} from '@comfyorg/graph-model/widgets'
import { isVideoConcatInputSpec } from '@comfyorg/graph-model/nodeDefSchemaV2'
import type { InputSpec as InputSpecV2 } from '@comfyorg/graph-model/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/types/widgetConstructor'

export const useVideoConcatWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IVideoConcatWidget => {
    const spec = isVideoConcatInputSpec(inputSpec) ? inputSpec : undefined
    const options: IWidgetVideoConcatOptions = {
      source: spec?.source ?? '',
      serialize: true,
      hideInPanel: true
    }

    const rawWidget = node.addWidget(
      'videoconcat',
      inputSpec.name,
      { order: [...(spec?.default?.order ?? [])] },
      () => {},
      options
    )

    const widget = rawWidget as IVideoConcatWidget
    syncConcatOrderWithLinks(node, widget, options.source)
    return widget
  }
}
