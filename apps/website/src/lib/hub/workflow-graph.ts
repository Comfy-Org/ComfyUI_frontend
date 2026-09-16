/**
 * A workflow template read as a picture of itself. The reader on the
 * catalogue wants to see the shape of the graph before deciding whether to
 * take it anywhere, so this turns the stored litegraph JSON into laid-out
 * boxes and curves and nothing else: no execution, no editing, no litegraph.
 */

/** Litegraph's link colours, so the preview reads like the editor does. */
const TYPE_COLORS: Record<string, string> = {
  MODEL: '#b39ddb',
  CLIP: '#ffd500',
  CLIP_VISION: '#a5e751',
  VAE: '#ff6e6e',
  CONDITIONING: '#ffa931',
  LATENT: '#ff9cf9',
  IMAGE: '#64b5f6',
  MASK: '#81c784',
  AUDIO: '#ffd54f',
  VIDEO: '#7986cb',
  CONTROL_NET: '#00d78d'
}

const NEUTRAL = '#8b8b8b'

export function colorForType(type: string | undefined): string {
  return (type && TYPE_COLORS[type.toUpperCase()]) || NEUTRAL
}

interface GraphSlot {
  readonly name: string
  readonly color: string
  /** Distance from the node's top edge. */
  readonly y: number
}

export interface GraphNode {
  readonly id: string
  readonly title: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly accent: string
  readonly inputs: readonly GraphSlot[]
  readonly outputs: readonly GraphSlot[]
}

export interface GraphLink {
  readonly id: string
  readonly color: string
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

export interface GraphPicture {
  readonly nodes: readonly GraphNode[]
  readonly links: readonly GraphLink[]
  readonly viewBox: string
}

const TITLE_HEIGHT = 34
const SLOT_HEIGHT = 22
const SLOT_TOP = TITLE_HEIGHT + 16
const MIN_WIDTH = 180
const PADDING = 60

function readPair(value: unknown): readonly [number, number] | undefined {
  if (Array.isArray(value) && value.length >= 2) {
    const [a, b] = value
    if (typeof a === 'number' && typeof b === 'number') return [a, b]
    return undefined
  }
  if (value && typeof value === 'object') {
    const pair = value as Record<string, unknown>
    if (typeof pair[0] === 'number' && typeof pair[1] === 'number')
      return [pair[0], pair[1]]
  }
  return undefined
}

function readSlots(value: unknown): readonly { name: string; type: string }[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((slot) => {
    if (!slot || typeof slot !== 'object') return []
    const record = slot as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name : ''
    const type = typeof record.type === 'string' ? record.type : ''
    return name || type ? [{ name: name || type, type }] : []
  })
}

/**
 * The title a reader recognises: whoever saved the graph may have renamed the
 * node, and the class name is the fallback rather than the other way round.
 */
function readTitle(record: Record<string, unknown>): string {
  if (typeof record.title === 'string' && record.title.trim())
    return record.title.trim()
  if (typeof record.type === 'string' && record.type) return record.type
  return 'Node'
}

function slotY(index: number): number {
  return SLOT_TOP + index * SLOT_HEIGHT
}

function drawnSlots(
  slots: readonly { name: string; type: string }[]
): GraphSlot[] {
  return slots.map((slot, index) => ({
    name: slot.name,
    color: colorForType(slot.type),
    y: slotY(index)
  }))
}

/** Wide enough to read, and tall enough for whichever side has more rows. */
function boxFor(
  size: readonly [number, number] | undefined,
  rows: number
): { width: number; height: number } {
  return {
    width: Math.max(size?.[0] ?? MIN_WIDTH, MIN_WIDTH),
    height: Math.max(size?.[1] ?? 0, slotY(rows) + 8)
  }
}

function identity(record: Record<string, unknown>): string | undefined {
  const { id } = record
  return typeof id === 'number' || typeof id === 'string'
    ? String(id)
    : undefined
}

function nodeFrom(value: unknown): GraphNode | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const id = identity(record)
  const position = readPair(record.pos)
  if (!id || !position) return undefined

  const inputs = readSlots(record.inputs)
  const outputs = readSlots(record.outputs)

  return {
    id,
    title: readTitle(record),
    x: position[0],
    y: position[1],
    ...boxFor(readPair(record.size), Math.max(inputs.length, outputs.length)),
    accent: colorForType(outputs.at(0)?.type),
    inputs: drawnSlots(inputs),
    outputs: drawnSlots(outputs)
  }
}

interface LinkEnds {
  readonly from: string
  readonly fromSlot: number
  readonly to: string
  readonly toSlot: number
  readonly type: string
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function slot(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

/** Litegraph's positional link: id, origin, slot, target, slot, type. */
function linkEndsFromRow(row: readonly unknown[]): LinkEnds | undefined {
  const [, from, fromSlot, to, toSlot, type] = row
  if (typeof fromSlot !== 'number' || typeof toSlot !== 'number')
    return undefined
  return {
    from: String(from),
    fromSlot,
    to: String(to),
    toSlot,
    type: text(type)
  }
}

/** The same link after the schema rewrite, with its ends named. */
function linkEndsFromRecord(
  record: Record<string, unknown>
): LinkEnds | undefined {
  const from = record.origin_id ?? record.source_id
  const to = record.target_id
  if (from === undefined || to === undefined) return undefined
  return {
    from: String(from),
    fromSlot: slot(record.origin_slot ?? record.source_slot),
    to: String(to),
    toSlot: slot(record.target_slot),
    type: text(record.type)
  }
}

/** A template on disk may hold either shape. */
function linkEndsFrom(value: unknown): LinkEnds | undefined {
  if (Array.isArray(value))
    return value.length >= 5 ? linkEndsFromRow(value) : undefined
  return value && typeof value === 'object'
    ? linkEndsFromRecord(value as Record<string, unknown>)
    : undefined
}

function linkBetween(
  ends: LinkEnds,
  from: GraphNode,
  to: GraphNode,
  index: number
): GraphLink {
  const output = from.outputs.at(ends.fromSlot)
  const input = to.inputs.at(ends.toSlot)
  return {
    id: `${ends.from}-${ends.fromSlot}-${ends.to}-${ends.toSlot}-${index}`,
    color: output?.color ?? colorForType(ends.type),
    x1: from.x + from.width,
    y1: from.y + (output?.y ?? slotY(ends.fromSlot)),
    x2: to.x,
    y2: to.y + (input?.y ?? slotY(ends.toSlot))
  }
}

function drawnLinks(
  rows: readonly unknown[],
  byId: ReadonlyMap<string, GraphNode>
): GraphLink[] {
  return rows.flatMap((row, index) => {
    const ends = linkEndsFrom(row)
    const from = ends && byId.get(ends.from)
    const to = ends && byId.get(ends.to)
    return ends && from && to ? [linkBetween(ends, from, to, index)] : []
  })
}

export function readGraphPicture(source: unknown): GraphPicture {
  const record =
    source && typeof source === 'object'
      ? (source as Record<string, unknown>)
      : {}
  const nodes = Array.isArray(record.nodes)
    ? record.nodes.flatMap((entry) => nodeFrom(entry) ?? [])
    : []

  return {
    nodes,
    links: drawnLinks(
      Array.isArray(record.links) ? record.links : [],
      new Map(nodes.map((node) => [node.id, node]))
    ),
    viewBox: viewBoxFor(nodes)
  }
}

export function viewBoxFor(nodes: readonly GraphNode[]): string {
  if (nodes.length === 0) return '0 0 800 450'
  const left = Math.min(...nodes.map((node) => node.x)) - PADDING
  const top = Math.min(...nodes.map((node) => node.y)) - PADDING
  const right = Math.max(...nodes.map((node) => node.x + node.width)) + PADDING
  const bottom =
    Math.max(...nodes.map((node) => node.y + node.height)) + PADDING
  return `${left} ${top} ${right - left} ${bottom - top}`
}

/** A cubic that leaves an output rightwards and enters an input leftwards. */
export function linkPath(link: GraphLink): string {
  const reach = Math.max(60, Math.abs(link.x2 - link.x1) * 0.5)
  return `M ${link.x1} ${link.y1} C ${link.x1 + reach} ${link.y1}, ${link.x2 - reach} ${link.y2}, ${link.x2} ${link.y2}`
}
