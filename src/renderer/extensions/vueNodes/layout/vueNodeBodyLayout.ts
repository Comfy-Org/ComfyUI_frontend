import type { Point2D } from '@comfyorg/shared-frontend-utils/geometry'
import type { WidgetSizing } from '@comfyorg/graph-model/widgets'
import type { ThemeTokens } from '@comfyorg/theme-core/themePresetSchema'
import { themePx } from '@comfyorg/theme-core/themePresetSchema'

import { layoutNodeBody } from '@/lib/litegraph/src/utils/nodeBodyLayout'
import { minRowHeight } from '@/lib/litegraph/src/utils/widgetLayout'

/** Vue node body constants; the CSS custom properties of the same names are set from these. */
export const VUE_NODE_BODY = {
  paddingTop: 4,
  paddingBottom: 12,
  gap: 4,
  slotRowHeight: 20,
  widgetRowHeight: 24
} as const

interface SlotBlock {
  kind: 'slots'
  inputs: readonly number[]
  outputs: readonly number[]
}

interface SocketRow {
  kind: 'socket'
  key: string
  input?: number
}

interface ControlRow {
  kind: 'control'
  key: string
  input?: number
  growable: boolean
  sizing?: WidgetSizing
  userHeight?: number
  contentHeight?: number
}

interface MediaRow {
  kind: 'media'
  key: string
  userHeight?: number
}

type WidgetRow = SocketRow | ControlRow

export type BodyItem = SlotBlock | WidgetRow | MediaRow

export interface PlacedBodyRow {
  y: number
  height: number
}

export interface VueNodeBodyLayout {
  rows: ReadonlyMap<string, PlacedBodyRow>
  inputs: ReadonlyMap<number, Point2D>
  outputs: ReadonlyMap<number, Point2D>
  /** Least body height that fits every row at its minimum. */
  minBodyHeight: number
  /** Height the pinned widget rows are allocated above their minimums. */
  slack: number
}

function fixedControlHeight(row: ControlRow): number {
  if (row.sizing?.kind === 'fixed') return row.sizing.height
  return row.contentHeight ?? VUE_NODE_BODY.widgetRowHeight
}

function growableControlSizing(row: ControlRow): WidgetSizing {
  const declared = row.sizing?.kind === 'growable' ? row.sizing : undefined
  const declaredMin = row.sizing ? minRowHeight(row.sizing) : 0
  return {
    minWidth: 0,
    ...declared,
    kind: 'growable',
    minHeight: Math.max(declaredMin, row.contentHeight ?? 0)
  }
}

function controlSizing(row: ControlRow): WidgetSizing {
  if (row.userHeight !== undefined)
    return { kind: 'fixed', height: row.userHeight }
  return row.growable
    ? growableControlSizing(row)
    : { kind: 'fixed', height: fixedControlHeight(row) }
}

function itemSizing(item: BodyItem): WidgetSizing {
  switch (item.kind) {
    case 'slots':
      return {
        kind: 'fixed',
        height:
          Math.max(item.inputs.length, item.outputs.length) *
          VUE_NODE_BODY.slotRowHeight
      }
    case 'socket':
      return { kind: 'fixed', height: VUE_NODE_BODY.slotRowHeight }
    case 'control':
      return controlSizing(item)
    case 'media':
      return item.userHeight === undefined
        ? { kind: 'growable', minWidth: 0, minHeight: 0 }
        : { kind: 'fixed', height: item.userHeight }
  }
}

function isWidgetRow(item: BodyItem | undefined): item is WidgetRow {
  return item?.kind === 'socket' || item?.kind === 'control'
}

function overlap(
  item: BodyItem,
  neighbour: BodyItem | undefined,
  tokens: ThemeTokens
) {
  return item.kind === 'socket' && isWidgetRow(neighbour)
    ? themePx(tokens, 'node-socket-row-overlap')
    : 0
}

function gapBetween(above: BodyItem, below: BodyItem, tokens: ThemeTokens) {
  return (
    VUE_NODE_BODY.gap +
    (above.kind === 'slots'
      ? themePx(tokens, 'node-slot-block-margin-bottom')
      : 0) -
    overlap(above, below, tokens) -
    overlap(below, above, tokens)
  )
}

function anchorsOf(
  item: BodyItem,
  row: PlacedBodyRow,
  width: number,
  tokens: ThemeTokens
) {
  const slotInset = themePx(tokens, 'node-slot-inset')
  const inputs: [number, Point2D][] = []
  const outputs: [number, Point2D][] = []
  if (item.kind === 'slots') {
    const centre = (index: number) =>
      row.y + (index + 0.5) * VUE_NODE_BODY.slotRowHeight
    item.inputs.forEach((slot, i) =>
      inputs.push([slot, { x: slotInset, y: centre(i) }])
    )
    item.outputs.forEach((slot, i) =>
      outputs.push([slot, { x: width - slotInset, y: centre(i) }])
    )
  } else if (item.kind !== 'media' && item.input !== undefined) {
    inputs.push([item.input, { x: slotInset, y: row.y + row.height / 2 }])
  }
  return { inputs, outputs }
}

/** Places a Vue node's body rows in a body `width` × `bodyHeight` and anchors every rendered slot, relative to the body's top-left corner, for the resolved theme `tokens`. */
export function layoutVueNodeBody(
  width: number,
  bodyHeight: number,
  items: readonly BodyItem[],
  tokens: ThemeTokens
): VueNodeBodyLayout {
  const sizings: WidgetSizing[] = []
  items.forEach((item, index) => {
    if (index > 0)
      sizings.push({
        kind: 'fixed',
        height: gapBetween(items[index - 1], item, tokens)
      })
    sizings.push(itemSizing(item))
  })
  const { paddingTop, paddingBottom } = VUE_NODE_BODY
  const allocated = layoutNodeBody(
    bodyHeight - paddingBottom,
    paddingTop,
    sizings
  )
  const placed = allocated.rows.filter((_, index) => index % 2 === 0)
  const minimum = layoutNodeBody(0, paddingTop, sizings)

  const rows = new Map<string, PlacedBodyRow>()
  const inputs = new Map<number, Point2D>()
  const outputs = new Map<number, Point2D>()
  let mediaGrowth = 0
  items.forEach((item, index) => {
    const row = placed[index]
    if (item.kind === 'media' && item.userHeight === undefined)
      mediaGrowth += row.height
    if (item.kind !== 'slots') rows.set(item.key, row)
    const anchors = anchorsOf(item, row, width, tokens)
    for (const [slot, point] of anchors.inputs) inputs.set(slot, point)
    for (const [slot, point] of anchors.outputs) outputs.set(slot, point)
  })
  return {
    rows,
    inputs,
    outputs,
    minBodyHeight: minimum.contentHeight + paddingBottom,
    slack: allocated.contentHeight - minimum.contentHeight - mediaGrowth
  }
}
