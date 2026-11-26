import type { LGraphNode } from '@comfyorg/litegraph/LGraphNode'
import { resolveNodeRootGraphId } from '@comfyorg/litegraph/litegraph'
import WidgetTextPreview from '@/renderer/extensions/vueNodes/widgets/components/WidgetTextPreview.vue'
import type { CustomInputSpec } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import { useApp } from '@/scripts/appInstance'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import { ComfyWidgets } from '@/scripts/widgets'
import { useWidgetValueStore } from '@comfyorg/graph-state/widgetValueStore'
import { widgetId } from '@comfyorg/graph-model/widgetId'

const PREVIEW_WIDGET_NAME = 'preview_text'
const MODE_WIDGET_NAME = 'preview_mode'

const inputSpecTextPreview: CustomInputSpec = {
  name: PREVIEW_WIDGET_NAME,
  type: 'TEXT_PREVIEW',
  isPreview: true
}

export function addTextPreviewWidgets(node: LGraphNode) {
  const widgetStore = useWidgetValueStore()
  let fallbackValue = ''

  const previewWidgetId = () =>
    widgetId(
      resolveNodeRootGraphId(node, useApp().rootGraph.id),
      node.id,
      PREVIEW_WIDGET_NAME
    )

  const preview = new ComponentWidgetImpl<string | object>({
    node,
    name: PREVIEW_WIDGET_NAME,
    component: WidgetTextPreview,
    inputSpec: inputSpecTextPreview,
    type: 'textPreview',
    options: {
      serialize: false,
      hideInPanel: true,
      getMinHeight: () => 60,
      getValue: () => {
        const stored = widgetStore.getWidget(previewWidgetId())?.value
        return typeof stored === 'string' ? stored : fallbackValue
      },
      setValue: (value: string | object) => {
        fallbackValue = typeof value === 'string' ? value : ''
        const state = widgetStore.getWidget(previewWidgetId())
        if (state) state.value = fallbackValue
      }
    }
  })
  preview.serialize = false
  addWidget(node, preview)

  const modeWidget = ComfyWidgets['BOOLEAN'](
    node,
    MODE_WIDGET_NAME,
    [
      'BOOLEAN',
      { label_on: 'Markdown', label_off: 'Plain text', default: false }
    ],
    useApp()
  ).widget

  modeWidget.options.serialize = false
  modeWidget.serialize = false
}

export function toPreviewText(text: unknown): string {
  if (text == null) return ''
  if (Array.isArray(text))
    return text.filter((part) => part != null).join('\n\n')
  return String(text)
}
