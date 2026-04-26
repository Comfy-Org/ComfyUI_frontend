import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import type { Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

/**
 * Snapshot current canvas state to ComfyUI's undo stack. Call AFTER a
 * bulk mutation so Ctrl/Cmd+Z restores the pre-change layout in one step.
 */
function captureUndo(): void {
  try {
    useWorkflowStore().activeWorkflow?.changeTracker?.checkState()
  } catch {
    /* no-op: no workflow or tracker available */
  }
}

/**
 * Low-level primitives for managing node geometry on the active canvas.
 *
 *   node-list [--filter <regex>] [--json]
 *     List nodes with: id, type, posX, posY, sizeW, sizeH, title.
 *     Tab-separated for easy piping; --json emits machine-readable form.
 *
 *   node-pos <id>                 → prints 'x y'
 *   node-pos <id> <x> <y>         → sets position
 *
 *   node-size <id>                → prints 'w h'
 *   node-size <id> <w> <h>        → sets size
 *
 *   graph-links [--filter <id>]
 *     List links: id, from-node:from-slot, to-node:to-slot, type.
 *     Useful for the LLM to compute its own topological / tree layouts.
 *
 *   canvas-redraw
 *     Trigger a repaint after bulk geometry changes.
 *
 * With these primitives the agent can implement any layout algorithm
 * (tree, dagre, spring, grid, …) entirely in the shell or via run-js.
 */
interface LNode {
  id: number
  type?: string
  comfyClass?: string
  title?: string
  pos: [number, number]
  size: [number, number]
}

interface LLink {
  id: number
  origin_id: number
  origin_slot: number
  target_id: number
  target_slot: number
  type?: string
}

interface LGraphLike {
  _nodes: LNode[]
  links: Record<number, LLink> | LLink[] | Map<number, LLink>
  setDirtyCanvas?: (fg: boolean, bg: boolean) => void
}

function getGraph(): LGraphLike | null {
  const g = useCanvasStore().canvas?.graph as LGraphLike | undefined
  return g ?? null
}

function iterateLinks(links: LGraphLike['links']): LLink[] {
  if (Array.isArray(links)) return links.filter(Boolean)
  if (links instanceof Map) return [...links.values()]
  return Object.values(links ?? {}).filter((l): l is LLink => !!l)
}

function findNode(g: LGraphLike, id: string): LNode | undefined {
  return g._nodes.find((n) => String(n.id) === id)
}

const nodeList: Command = async (ctx) => {
  const g = getGraph()
  if (!g) return { stdout: emptyIter(), exitCode: 1, stderr: 'no active graph' }
  const filterArg = ctx.argv.find((a) => a.startsWith('--filter='))
  const re = filterArg ? new RegExp(filterArg.slice(9), 'i') : null
  const json = ctx.argv.includes('--json')
  const rows = g._nodes
    .filter((n) => !re || re.test(n.comfyClass ?? n.type ?? ''))
    .map((n) => ({
      id: n.id,
      type: n.comfyClass ?? n.type ?? 'Unknown',
      x: Math.round(n.pos?.[0] ?? 0),
      y: Math.round(n.pos?.[1] ?? 0),
      w: Math.round(n.size?.[0] ?? 0),
      h: Math.round(n.size?.[1] ?? 0),
      title: n.title ?? ''
    }))
  if (json) {
    return {
      stdout: stringIter(JSON.stringify(rows, null, 2) + '\n'),
      exitCode: 0
    }
  }
  const lines = [
    'id\ttype\tx\ty\tw\th\ttitle',
    ...rows.map(
      (r) => `${r.id}\t${r.type}\t${r.x}\t${r.y}\t${r.w}\t${r.h}\t${r.title}`
    )
  ]
  return { stdout: stringIter(lines.join('\n') + '\n'), exitCode: 0 }
}

const nodePos: Command = async (ctx) => {
  const g = getGraph()
  if (!g) return { stdout: emptyIter(), exitCode: 1, stderr: 'no active graph' }
  const [, id, xArg, yArg] = ctx.argv
  if (!id) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: node-pos <id> [<x> <y>]'
    }
  }
  const n = findNode(g, id)
  if (!n) return { stdout: emptyIter(), exitCode: 1, stderr: `no node ${id}` }
  if (xArg === undefined) {
    return {
      stdout: stringIter(`${Math.round(n.pos[0])} ${Math.round(n.pos[1])}\n`),
      exitCode: 0
    }
  }
  const x = Number(xArg)
  const y = Number(yArg)
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'x and y must be numbers'
    }
  }
  n.pos = [x, y]
  g.setDirtyCanvas?.(true, true)
  captureUndo()
  return { stdout: stringIter(`set ${id} pos=${x},${y}\n`), exitCode: 0 }
}

const nodeSize: Command = async (ctx) => {
  const g = getGraph()
  if (!g) return { stdout: emptyIter(), exitCode: 1, stderr: 'no active graph' }
  const [, id, wArg, hArg] = ctx.argv
  if (!id) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: node-size <id> [<w> <h>]'
    }
  }
  const n = findNode(g, id)
  if (!n) return { stdout: emptyIter(), exitCode: 1, stderr: `no node ${id}` }
  if (wArg === undefined) {
    return {
      stdout: stringIter(`${Math.round(n.size[0])} ${Math.round(n.size[1])}\n`),
      exitCode: 0
    }
  }
  const w = Number(wArg)
  const h = Number(hArg)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'w and h must be positive numbers'
    }
  }
  n.size = [w, h]
  g.setDirtyCanvas?.(true, true)
  captureUndo()
  return { stdout: stringIter(`set ${id} size=${w}x${h}\n`), exitCode: 0 }
}

const graphLinks: Command = async (ctx) => {
  const g = getGraph()
  if (!g) return { stdout: emptyIter(), exitCode: 1, stderr: 'no active graph' }
  const filterArg = ctx.argv.find((a) => a.startsWith('--filter='))
  const nodeFilter = filterArg ? filterArg.slice(9) : null
  const rows = iterateLinks(g.links)
    .filter((l) =>
      nodeFilter
        ? String(l.origin_id) === nodeFilter ||
          String(l.target_id) === nodeFilter
        : true
    )
    .map(
      (l) =>
        `${l.id}\t${l.origin_id}:${l.origin_slot}\t→\t${l.target_id}:${l.target_slot}\t${l.type ?? ''}`
    )
  const header = 'link\tfrom\t\tto\ttype'
  return {
    stdout: stringIter([header, ...rows].join('\n') + '\n'),
    exitCode: 0
  }
}

const canvasRedraw: Command = async () => {
  const g = getGraph()
  if (!g) return { stdout: emptyIter(), exitCode: 1, stderr: 'no active graph' }
  g.setDirtyCanvas?.(true, true)
  return { stdout: stringIter('canvas redrawn\n'), exitCode: 0 }
}

/**
 * graph-dot — emit a DOT-like text description of the graph. Nodes are
 * labelled by id and type, with size and current position. Directed edges
 * follow slot-to-slot links. This is a compact, human/LLM-readable view
 * the agent can use as input when reasoning about a layout.
 */
const graphDot: Command = async () => {
  const g = getGraph()
  if (!g) return { stdout: emptyIter(), exitCode: 1, stderr: 'no active graph' }
  const lines: string[] = []
  lines.push('digraph graph {')
  lines.push('  rankdir=TB;')
  for (const n of g._nodes) {
    const type = n.comfyClass ?? n.type ?? 'Unknown'
    const x = Math.round(n.pos?.[0] ?? 0)
    const y = Math.round(n.pos?.[1] ?? 0)
    const w = Math.round(n.size?.[0] ?? 0)
    const h = Math.round(n.size?.[1] ?? 0)
    lines.push(`  ${n.id} [label="${type}" pos="${x},${y}" size="${w}x${h}"];`)
  }
  for (const l of iterateLinks(g.links)) {
    lines.push(`  ${l.origin_id} -> ${l.target_id};`)
  }
  lines.push('}')
  return { stdout: stringIter(lines.join('\n') + '\n'), exitCode: 0 }
}

/**
 * apply-layout — accept JSON (from stdin or arg) describing bulk
 * position / size updates. Shape:
 *   [{"id": 3, "pos": [100, 100], "size": [240, 160]}, ...]
 * Unknown ids are skipped. One redraw at the end.
 */
const applyLayout: Command = async (ctx) => {
  const g = getGraph()
  if (!g) return { stdout: emptyIter(), exitCode: 1, stderr: 'no active graph' }
  let input = ''
  const inline = ctx.argv.slice(1).join(' ').trim()
  if (inline) input = inline
  else {
    const chunks: string[] = []
    for await (const c of ctx.stdin) chunks.push(c)
    input = chunks.join('')
  }
  if (!input.trim()) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: apply-layout <json> | echo <json> | apply-layout'
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr:
        'invalid JSON: ' + (err instanceof Error ? err.message : String(err))
    }
  }
  if (!Array.isArray(parsed)) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'expected JSON array of {id, pos?, size?}'
    }
  }
  let updated = 0
  let skipped = 0
  for (const item of parsed as Array<{
    id?: number | string
    pos?: [number, number]
    size?: [number, number]
  }>) {
    if (item?.id === undefined) {
      skipped++
      continue
    }
    const n = findNode(g, String(item.id))
    if (!n) {
      skipped++
      continue
    }
    if (Array.isArray(item.pos) && item.pos.length === 2) {
      const [x, y] = item.pos
      if (Number.isFinite(x) && Number.isFinite(y)) n.pos = [x, y]
    }
    if (Array.isArray(item.size) && item.size.length === 2) {
      const [w, h] = item.size
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0)
        n.size = [w, h]
    }
    updated++
  }
  g.setDirtyCanvas?.(true, true)
  captureUndo()
  return {
    stdout: stringIter(
      `applied: ${updated} nodes, skipped: ${skipped} — Ctrl/Cmd+Z to undo\n`
    ),
    exitCode: 0
  }
}

export function registerLayoutCommands(registry: CommandRegistry): void {
  registry.register('node-list', nodeList)
  registry.register('node-pos', nodePos)
  registry.register('node-size', nodeSize)
  registry.register('graph-links', graphLinks)
  registry.register('graph-dot', graphDot)
  registry.register('apply-layout', applyLayout)
  registry.register('canvas-redraw', canvasRedraw)
}
