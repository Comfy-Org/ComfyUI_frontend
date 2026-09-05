import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import { getLinkedWidgetFamily } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { resolveWidgetSelectMode } from '@/renderer/extensions/vueNodes/widgets/utils/widgetSelectMode'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { LinkedWidgetDisplay } from '@/types/simplifiedWidget'

interface LinkedWidgetDisplayWidget {
  name: string
  type: string
  spec?: InputSpec
}

interface LinkedWidgetDisplayContext {
  assetApiEnabled: boolean
  coreNodeType?: string
  linked: boolean
  useAssetBrowser: boolean
}

const CORE_MEDIA_SELECTOR_WIDGETS = new Map([
  ['LoadImage', 'image'],
  ['LoadImageMask', 'image'],
  ['LoadImageOutput', 'image'],
  ['LoadVideo', 'file'],
  ['LoadAudio', 'audio']
])

function isCoreMediaSelector(
  widget: LinkedWidgetDisplayWidget,
  context: LinkedWidgetDisplayContext
): boolean {
  return (
    CORE_MEDIA_SELECTOR_WIDGETS.get(context.coreNodeType ?? '') ===
      widget.name &&
    (widget.type === 'asset' || getLinkedWidgetFamily(widget.type) === 'combo')
  )
}

export function resolveLinkedWidgetDisplay(
  widget: LinkedWidgetDisplayWidget,
  options: IWidgetOptions | undefined,
  context: LinkedWidgetDisplayContext
): LinkedWidgetDisplay | undefined {
  if (!context.linked) return undefined

  const family = getLinkedWidgetFamily(widget.type)
  if (isCoreMediaSelector(widget, context)) return 'control'
  if (!family) return undefined

  if (family === 'combo') {
    const mode = resolveWidgetSelectMode(widget, context)
    if (mode.isDropdownUIWidget) return undefined
  }

  if (family === 'textarea') return 'expanding'

  if (family === 'boolean' && options?.on == null && options?.off == null) {
    return 'switch'
  }

  return 'control'
}
