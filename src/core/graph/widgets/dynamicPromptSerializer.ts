import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { processDynamicPrompt } from '@comfyorg/shared-frontend-utils/formatUtil'

export function bindDynamicPromptSerializer(
  widget: Pick<IBaseWidget, 'value' | 'serializeValue'>
) {
  widget.serializeValue = () =>
    typeof widget.value === 'string'
      ? processDynamicPrompt(widget.value)
      : widget.value
}
