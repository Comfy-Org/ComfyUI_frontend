import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { resolveNodeRootGraphId } from '@/lib/litegraph/src/litegraph'
import WidgetTextPreview from '@/renderer/extensions/vueNodes/widgets/components/WidgetTextPreview.vue'
import type { CustomInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { app } from '@/scripts/app'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import { ComfyWidgets } from '@/scripts/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

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
      resolveNodeRootGraphId(node, app.rootGraph.id),
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
    app
  ).widget

  modeWidget.options.serialize = false
  modeWidget.serialize = false
}

export function updateTextPreviewWidgets(
  node: LGraphNode,
  message: { text?: string | string[] }
) {
  const preview = node.widgets?.find((w) => w.name === PREVIEW_WIDGET_NAME)
  if (!preview) return

  const text = message.text ?? ''
  preview.value = Array.isArray(text) ? text.join('\n\n') : text
}
