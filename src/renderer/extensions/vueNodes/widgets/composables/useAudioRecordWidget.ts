import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IAudioRecordWidget } from '@/lib/litegraph/src/types/widgets'
import type {
  AudioRecordInputSpec,
  InputSpec as InputSpecV2
} from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'

export const useAudioRecordWidget = (): ComfyWidgetConstructorV2 => {
  return (node: LGraphNode, inputSpec: InputSpecV2): IAudioRecordWidget => {
    const {
      name,
      default: defaultValue = '',
      options = {}
    } = inputSpec as AudioRecordInputSpec

    const widget = node.addWidget('audiorecord', name, defaultValue, () => {}, {
      serialize: true,
      ...options
    }) as IAudioRecordWidget

    return widget
  }
}
