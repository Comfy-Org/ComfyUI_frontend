import type { Point2D } from '@comfyorg/shared-frontend-utils/geometry'
import type { WidgetSizing } from '@comfyorg/graph-model/widgets'

import { layoutNodeBody } from '@/lib/litegraph/src/utils/nodeBodyLayout'
import { minRowHeight } from '@/lib/litegraph/src/utils/widgetLayout'
import { VUE_NODE_HEADER_HEIGHT } from '@/renderer/core/layout/slots/derivedSlotAnchors'

/** Vue node body constants; the CSS custom properties of the same names are set from these. */
export const VUE_NODE_BODY = {
  headerHeight: VUE_NODE_HEADER_HEIGHT,
  paddingTop: 4,
  paddingBottom: 12,
  gap: 4,
  slotRowHeight: 20,
  socketRowOverlap: 2,
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

type WidgetRow = SocketRow | ControlRow

export type BodyItem = SlotBlock | WidgetRow

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
  /** Height the rows are allocated above their minimums. */
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
  }
}

function isWidgetRow(item: BodyItem | undefined): item is WidgetRow {
  return item?.kind === 'socket' || item?.kind === 'control'
}

function overlap(item: BodyItem, neighbour: BodyItem | undefined) {
  return item.kind === 'socket' && isWidgetRow(neighbour)
    ? VUE_NODE_BODY.socketRowOverlap
    : 0
}

function gapBetween(above: BodyItem, below: BodyItem) {
  return VUE_NODE_BODY.gap - overlap(above, below) - overlap(below, above)
}

function anchorsOf(item: BodyItem, row: PlacedBodyRow, width: number) {
  const inputs: [number, Point2D][] = []
  const outputs: [number, Point2D][] = []
  if (item.kind === 'slots') {
    const centre = (index: number) =>
      row.y + (index + 0.5) * VUE_NODE_BODY.slotRowHeight
    item.inputs.forEach((slot, i) =>
      inputs.push([slot, { x: 0, y: centre(i) }])
    )
    item.outputs.forEach((slot, i) =>
      outputs.push([slot, { x: width, y: centre(i) }])
    )
  } else if (item.input !== undefined) {
    inputs.push([item.input, { x: 0, y: row.y + row.height / 2 }])
  }
  return { inputs, outputs }
}

/** Places a Vue node's body rows in a body `width` × `bodyHeight` and anchors every rendered slot, relative to the body's top-left corner. */
export function layoutVueNodeBody(
  width: number,
  bodyHeight: number,
  items: readonly BodyItem[]
): VueNodeBodyLayout {
  const sizings: WidgetSizing[] = []
  items.forEach((item, index) => {
    if (index > 0)
      sizings.push({
        kind: 'fixed',
        height: gapBetween(items[index - 1], item)
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
  items.forEach((item, index) => {
    const row = placed[index]
    if (item.kind !== 'slots') rows.set(item.key, row)
    const anchors = anchorsOf(item, row, width)
    for (const [slot, point] of anchors.inputs) inputs.set(slot, point)
    for (const [slot, point] of anchors.outputs) outputs.set(slot, point)
  })
  return {
    rows,
    inputs,
    outputs,
    minBodyHeight: minimum.contentHeight + paddingBottom,
    slack: allocated.contentHeight - minimum.contentHeight
  }
}
