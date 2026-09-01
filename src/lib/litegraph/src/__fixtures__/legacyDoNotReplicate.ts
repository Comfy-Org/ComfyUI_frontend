import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

/**
 * Legacy custom-node patterns that first-party code must never replicate, but
 * that litegraph has to keep working. Each fixture mirrors code shipped by a
 * widely installed node pack, so a change that breaks one of these tests breaks
 * that pack's workflows.
 */

export interface ComparerImage {
  url: string
  name: string
  selected: boolean
}

/**
 * The rgthree-comfy image comparer widget: a `custom` widget that owns its
 * value behind an accessor pair. Assignment accepts either the serialised list
 * or the `{ images }` object; reads always return `{ images }`.
 * @see https://github.com/rgthree/rgthree-comfy/blob/main/web/comfyui/image_comparer.js
 */
export class ComparerWidget implements IBaseWidget {
  [symbol: symbol]: boolean
  name = 'rgthree_comparer'
  type = 'custom'
  options = {}
  y = 0
  _value: { images: ComparerImage[] } = { images: [] }

  get value(): { images: ComparerImage[] } {
    return this._value
  }

  set value(v: { images: ComparerImage[] } | ComparerImage[]) {
    this._value.images = Array.isArray(v) ? v : (v?.images ?? [])
  }
}

/**
 * The comparer node's `onSerialize`, which reads the widget value back through
 * `node.widgets` and rewrites `widgets_values` with the image list alone.
 */
export function serialiseComparerWidgetValues(
  node: LGraphNode,
  data: ISerialisedNode
): void {
  for (const [index] of (data.widgets_values ?? []).entries()) {
    if (node.widgets?.[index]?.name !== 'rgthree_comparer') continue
    const { value } = node.widgets[index] as unknown as ComparerWidget
    data.widgets_values![index] = value.images.map((image) => ({ ...image }))
  }
}
