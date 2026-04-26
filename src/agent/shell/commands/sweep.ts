import { api } from '@/scripts/api'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

import type { Command, CmdContext, CommandRegistry } from '../types'
import { stringIter } from '../types'

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
  return raw
}

async function pollUntilIdle(timeoutMs: number, signal: AbortSignal) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (signal.aborted) throw new Error('aborted')
    const { Running, Pending } = await api.getQueue()
    if (Running.length === 0 && Pending.length === 0) return
    await new Promise((r) => setTimeout(r, 1200))
  }
  throw new Error('timed out waiting for queue')
}

async function* runSweep(ctx: CmdContext): AsyncIterable<string> {
  const [, idArg, name, ...vals] = ctx.argv
  if (!idArg || !name || vals.length === 0) {
    yield 'usage: sweep <nodeId> <widgetName> <val1> [<val2> ...]\n'
    return
  }
  const canvas = useCanvasStore().canvas
  if (!canvas?.graph) {
    yield 'error: no active graph\n'
    return
  }
  const nodes = (canvas.graph as { _nodes: LiteNode[] })._nodes ?? []
  const node = nodes.find((n) => String(n.id) === idArg)
  if (!node) {
    yield `error: no node ${idArg}\n`
    return
  }
  const widget = node.widgets?.find((w) => w.name === name)
  if (!widget) {
    yield `error: node ${idArg} has no widget "${name}"\n`
    return
  }
  const cmdStore = useCommandStore()
  const results: string[] = []

  for (const raw of vals) {
    if (ctx.signal.aborted) {
      yield 'aborted\n'
      return
    }
    const value = coerce(widget.type, raw)
    widget.value = value
    widget.callback?.(value)
    yield `[${raw}] set ${name}=${JSON.stringify(value)} — queuing...\n`
    await cmdStore.execute('Comfy.QueuePrompt')
    yield `[${raw}] queued. waiting for idle...\n`
    await pollUntilIdle(300_000, ctx.signal)
    results.push(String(value))
    yield `[${raw}] done.\n`
  }
  yield `sweep complete: ${name} over ${results.join(', ')}\n`
}

const sweepCmd: Command = async (ctx) => ({
  stdout: runSweep(ctx),
  exitCode: 0
})

const sweepHelpStr = `sweep <nodeId> <widgetName> <val1> [<val2> ...]

Sets the named widget on the given node to each value in turn,
queues a prompt after each set, and waits for the queue to drain
before moving to the next value.

Example — try CFG 5, 6, 7, 8 on node 3:
  sweep 3 cfg 5 6 7 8

Combine with seq for ranges:
  graph nodes KSampler | head -1 | ...
  (seq output is line-based; use set-widget for single values)
`

export function registerSweepCommands(registry: CommandRegistry): void {
  registry.register('sweep', sweepCmd)
  registry.register('sweep-help', async () => ({
    stdout: stringIter(sweepHelpStr),
    exitCode: 0
  }))
}
