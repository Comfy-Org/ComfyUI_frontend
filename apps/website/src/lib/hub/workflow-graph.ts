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

function nodeFrom(value: unknown): GraphNode | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const id = record.id
  if (typeof id !== 'number' && typeof id !== 'string') return undefined
  const position = readPair(record.pos)
  if (!position) return undefined

  const inputs = readSlots(record.inputs)
  const outputs = readSlots(record.outputs)
  const size = readPair(record.size)
  const rows = Math.max(inputs.length, outputs.length)

  return {
    id: String(id),
    title: readTitle(record),
    x: position[0],
    y: position[1],
    width: Math.max(size?.[0] ?? MIN_WIDTH, MIN_WIDTH),
    height: Math.max(size?.[1] ?? 0, slotY(rows) + 8),
    accent: colorForType(outputs.at(0)?.type),
    inputs: inputs.map((slot, index) => ({
      name: slot.name,
      color: colorForType(slot.type),
      y: slotY(index)
    })),
    outputs: outputs.map((slot, index) => ({
      name: slot.name,
      color: colorForType(slot.type),
      y: slotY(index)
    }))
  }
}

interface LinkEnds {
  readonly from: string
  readonly fromSlot: number
  readonly to: string
  readonly toSlot: number
  readonly type: string
}

/**
 * Litegraph has stored a link as a positional array for years and as an object
 * since the schema rewrite; a template on disk may be either.
 */
function linkEndsFrom(value: unknown): LinkEnds | undefined {
  if (Array.isArray(value) && value.length >= 5) {
    const [, from, fromSlot, to, toSlot, type] = value
    if (typeof fromSlot !== 'number' || typeof toSlot !== 'number')
      return undefined
    return {
      from: String(from),
      fromSlot,
      to: String(to),
      toSlot,
      type: typeof type === 'string' ? type : ''
    }
  }
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const from = record.origin_id ?? record.source_id
  const to = record.target_id
  const fromSlot = record.origin_slot ?? record.source_slot
  const toSlot = record.target_slot
  if (from === undefined || to === undefined) return undefined
  return {
    from: String(from),
    fromSlot: typeof fromSlot === 'number' ? fromSlot : 0,
    to: String(to),
    toSlot: typeof toSlot === 'number' ? toSlot : 0,
    type: typeof record.type === 'string' ? record.type : ''
  }
}

export function readGraphPicture(source: unknown): GraphPicture {
  const record =
    source && typeof source === 'object'
      ? (source as Record<string, unknown>)
      : {}
  const nodes = Array.isArray(record.nodes)
    ? record.nodes.flatMap((entry) => nodeFrom(entry) ?? [])
    : []
  const byId = new Map(nodes.map((node) => [node.id, node]))

  const links = (Array.isArray(record.links) ? record.links : []).flatMap(
    (entry, index): GraphLink[] => {
      const ends = linkEndsFrom(entry)
      if (!ends) return []
      const from = byId.get(ends.from)
      const to = byId.get(ends.to)
      if (!from || !to) return []
      const output = from.outputs.at(ends.fromSlot)
      const input = to.inputs.at(ends.toSlot)
      return [
        {
          id: `${ends.from}-${ends.fromSlot}-${ends.to}-${ends.toSlot}-${index}`,
          color: output?.color ?? colorForType(ends.type),
          x1: from.x + from.width,
          y1: from.y + (output?.y ?? slotY(ends.fromSlot)),
          x2: to.x,
          y2: to.y + (input?.y ?? slotY(ends.toSlot))
        }
      ]
    }
  )

  return { nodes, links, viewBox: viewBoxFor(nodes) }
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
