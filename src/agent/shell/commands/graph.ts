import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import type { Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

interface WidgetSummary {
  name: string
  value: unknown
  type?: string
}

interface NodeSummary {
  id: number | string
  type: string
  title?: string
  pos?: [number, number]
  mode?: number
  widgets?: WidgetSummary[]
  inputs?: { name: string; type: string; linkId?: number | null }[]
  outputs?: { name: string; type: string; linkCount: number }[]
}

function getGraph() {
  const canvas = useCanvasStore().canvas
  return canvas?.graph ?? null
}

function summarizeNode(node: unknown): NodeSummary {
  const n = node as {
    id: number
    type?: string
    comfyClass?: string
    title?: string
    pos?: [number, number]
    mode?: number
    widgets?: { name?: string; value?: unknown; type?: string }[]
    inputs?: { name?: string; type?: string; link?: number | null }[]
    outputs?: {
      name?: string
      type?: string
      links?: (number | null)[] | null
    }[]
  }
  return {
    id: n.id,
    type: n.comfyClass ?? n.type ?? 'Unknown',
    title: n.title,
    pos: n.pos,
    mode: n.mode,
    widgets: n.widgets?.map((w) => ({
      name: w.name ?? '',
      value: w.value,
      type: w.type
    })),
    inputs: n.inputs?.map((i) => ({
      name: i.name ?? '',
      type: i.type ?? '*',
      linkId: i.link ?? null
    })),
    outputs: n.outputs?.map((o) => ({
      name: o.name ?? '',
      type: o.type ?? '*',
      linkCount: Array.isArray(o.links)
        ? o.links.filter((l) => l != null).length
        : 0
    }))
  }
}

const graphCmd: Command = async (ctx) => {
  const graph = getGraph()
  if (!graph) {
    return { stdout: emptyIter(), exitCode: 1, stderr: 'no active graph' }
  }
  const sub = ctx.argv[1] ?? 'summary'
  if (sub === 'summary') {
    const nodes = (graph as { _nodes: unknown[] })._nodes ?? []
    const types = new Map<string, number>()
    for (const n of nodes) {
      const s = summarizeNode(n)
      types.set(s.type, (types.get(s.type) ?? 0) + 1)
    }
    const lines = [`nodes: ${nodes.length}`, 'types:']
    for (const [t, c] of [...types.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${c}\t${t}`)
    }
    return { stdout: stringIter(lines.join('\n') + '\n'), exitCode: 0 }
  }
  if (sub === 'nodes') {
    const nodes = (graph as { _nodes: unknown[] })._nodes ?? []
    const filter = ctx.argv[2]
    const summaries = nodes.map(summarizeNode)
    const filtered = filter
      ? summaries.filter((s) => new RegExp(filter, 'i').test(s.type))
      : summaries
    const out = filtered
      .map((s) => `${s.id}\t${s.type}\t${s.title ?? ''}`)
      .join('\n')
    return { stdout: stringIter(out + (out ? '\n' : '')), exitCode: 0 }
  }
  if (sub === 'node') {
    const id = ctx.argv[2]
    if (!id) {
      return {
        stdout: emptyIter(),
        exitCode: 2,
        stderr: 'usage: graph node <id>'
      }
    }
    const nodes = (graph as { _nodes: unknown[] })._nodes ?? []
    const node = nodes.find((n) => String((n as { id: number }).id) === id)
    if (!node) {
      return { stdout: emptyIter(), exitCode: 1, stderr: `no node ${id}` }
    }
    return {
      stdout: stringIter(JSON.stringify(summarizeNode(node), null, 2) + '\n'),
      exitCode: 0
    }
  }
  if (sub === 'json') {
    const nodes = (graph as { _nodes: unknown[] })._nodes ?? []
    const payload = { nodes: nodes.map(summarizeNode) }
    return {
      stdout: stringIter(JSON.stringify(payload, null, 2) + '\n'),
      exitCode: 0
    }
  }
  return {
    stdout: emptyIter(),
    exitCode: 2,
    stderr: `usage: graph <summary|nodes [regex]|node <id>|json>`
  }
}

interface LiteWidget {
  name?: string
  type?: string
  value?: unknown
  callback?: (v: unknown) => void
}

interface LiteNode {
  id: number | string
  widgets?: LiteWidget[]
}

function coerce(type: string | undefined, raw: string): unknown {
  if (type === 'number' || type === 'INT' || type === 'FLOAT') {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  if (type === 'BOOLEAN' || type === 'toggle') {
    if (raw === 'true') return true
    if (raw === 'false') return false
  }
  return raw
}

const setWidget: Command = async (ctx) => {
  const [, idArg, name, ...rest] = ctx.argv
  if (!idArg || !name || rest.length === 0) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: set-widget <nodeId> <widgetName> <value...>'
    }
  }
  const graph = getGraph()
  if (!graph) {
    return { stdout: emptyIter(), exitCode: 1, stderr: 'no active graph' }
  }
  const nodes = (graph as { _nodes: LiteNode[] })._nodes ?? []
  const node = nodes.find((n) => String(n.id) === idArg)
  if (!node) {
    return { stdout: emptyIter(), exitCode: 1, stderr: `no node ${idArg}` }
  }
  const widget = node.widgets?.find((w) => w.name === name)
  if (!widget) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: `node ${idArg} has no widget "${name}"`
    }
  }
  const value = coerce(widget.type, rest.join(' '))
  widget.value = value
  widget.callback?.(value)
  return {
    stdout: stringIter(`set ${idArg}.${name} = ${JSON.stringify(value)}\n`),
    exitCode: 0
  }
}

export function registerGraphCommands(registry: CommandRegistry): void {
  registry.register('graph', graphCmd)
  registry.register('set-widget', setWidget)
}
