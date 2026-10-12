import { isEqual } from 'es-toolkit'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import {
  dynamicComboOptionTypes,
  inputSpecTree
} from '@/schemas/nodeDef/inputSpecTree'

/**
 * Select DynamicCombo options so that `node` exposes a socket of `wantedType`.
 *
 * Node search reports the union of every DynamicCombo option's input types, so
 * a node can be offered for a link type whose socket only exists under an
 * option the node was not created with.
 *
 * Only reports success once the socket actually exists. A combo option's types
 * include types reachable through a *nested* combo, which selecting the outer
 * option alone does not materialize, so the result is verified rather than
 * assumed; any selection made while failing is rolled back so a failed reveal
 * leaves the node exactly as it was.
 *
 * @returns whether the node now exposes `wantedType`
 */
export function revealDynamicInputSlot(
  node: LGraphNode,
  wantedType: string
): boolean {
  if (node.findInputByType(wantedType)) return false

  const defInputs = node.constructor.nodeData?.inputs
  if (!defInputs) return false

  // Each root input is attempted independently so a root that fails cannot
  // leave a combo selected on the way to a different root that succeeds.
  for (const rootSpec of Object.values(defInputs)) {
    if (revealWithin(node, rootSpec, wantedType)) return true
  }

  return false
}

function revealWithin(
  node: LGraphNode,
  rootSpec: InputSpecV2,
  wantedType: string
): boolean {
  const comboSpecs = inputSpecTree(rootSpec).filter(
    (spec) => spec.type === 'COMFY_DYNAMICCOMBO_V3'
  )
  return revealFromCombo(node, comboSpecs, wantedType, 0, new Set())
}

function revealFromCombo(
  node: LGraphNode,
  comboSpecs: InputSpecV2[],
  wantedType: string,
  startIndex: number,
  usedWidgets: Set<IBaseWidget>
): boolean {
  const widgets = node.widgets
  if (!widgets) return false

  for (let index = startIndex; index < comboSpecs.length; index++) {
    const spec = comboSpecs[index]
    const options = dynamicComboOptionTypes(spec)
    const matchingOptions = options.filter(({ types }) =>
      types.includes(wantedType)
    )
    if (!matchingOptions.length) continue

    const candidates = matchingWidgets(
      widgets,
      spec,
      options.map(({ key }) => key),
      usedWidgets
    )

    for (const option of matchingOptions) {
      for (const widget of candidates) {
        if (
          tryOption(
            node,
            comboSpecs,
            wantedType,
            index,
            usedWidgets,
            widget,
            option.key
          )
        )
          return true
      }
    }
  }
  return false
}

function matchingWidgets(
  widgets: IBaseWidget[],
  spec: InputSpecV2,
  keys: string[],
  usedWidgets: Set<IBaseWidget>
): IBaseWidget[] {
  return widgets
    .filter(
      (widget) =>
        !usedWidgets.has(widget) &&
        (widget.name === spec.name || isEqual(widget.options.values, keys))
    )
    .sort((a, b) => Number(b.name === spec.name) - Number(a.name === spec.name))
}

function tryOption(
  node: LGraphNode,
  comboSpecs: InputSpecV2[],
  wantedType: string,
  index: number,
  usedWidgets: Set<IBaseWidget>,
  widget: IBaseWidget,
  optionKey: string
): boolean {
  const previousValue = widget.value
  widget.value = optionKey

  const revealed =
    Boolean(node.findInputByType(wantedType)) ||
    revealFromCombo(
      node,
      comboSpecs,
      wantedType,
      index + 1,
      new Set(usedWidgets).add(widget)
    )

  if (!revealed) widget.value = previousValue
  return revealed
}
