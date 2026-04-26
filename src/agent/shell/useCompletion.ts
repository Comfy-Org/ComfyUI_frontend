import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

import type { CommandRegistryImpl } from './runtime'

export interface Completion {
  value: string
  description?: string
}

const TOP_LEVEL_CMDS = [
  'echo',
  'cat',
  'ls',
  'pwd',
  'wc',
  'head',
  'tail',
  'grep',
  'seq',
  'true',
  'false',
  'cmd',
  'cmd-list',
  'graph',
  'set-widget',
  'queue-status',
  'history',
  'wait-queue',
  'latest-output',
  'missing-models',
  'workflow-errors',
  'active-workflow',
  'show-errors',
  'show-missing-models',
  'sweep',
  'sweep-help',
  'run-js',
  'help'
]

const GRAPH_SUBCOMMANDS = ['summary', 'nodes', 'node', 'json']

function nodeIds(): Completion[] {
  const canvas = useCanvasStore().canvas
  if (!canvas?.graph) return []
  const nodes =
    (
      canvas.graph as {
        _nodes: { id: number; comfyClass?: string; title?: string }[]
      }
    )._nodes ?? []
  return nodes.map((n) => ({
    value: String(n.id),
    description: n.title || n.comfyClass || ''
  }))
}

function comfyCommandIds(prefix: string): Completion[] {
  const store = useCommandStore()
  return store.commands
    .filter((c) => c.id.toLowerCase().startsWith(prefix.toLowerCase()))
    .slice(0, 20)
    .map((c) => ({ value: c.id, description: c.label ?? '' }))
}

/**
 * Given the full input text and cursor position, return completions.
 * Returns { completions, replaceFrom } where replaceFrom is the index in the
 * current token to replace.
 */
export function getCompletions(
  text: string,
  registry?: CommandRegistryImpl
): { completions: Completion[]; replaceFrom: number; prefix: string } {
  // Tokenize up to cursor — find the last word/token
  const lastLine = text.split('\n').at(-1) ?? text
  const tokens = lastLine.split(/[\s|&;]+/)
  const lastToken = tokens.at(-1) ?? ''
  const replaceFrom = text.length - lastToken.length

  // Position in token sequence
  const nonEmpty = tokens.filter(Boolean)
  const isFirstToken = nonEmpty.length <= 1 || !lastToken

  // 1. First position: command completions (built-ins + Comfy.* command ids)
  if (isFirstToken) {
    const builtins = registry ? registry.list() : TOP_LEVEL_CMDS
    const lower = lastToken.toLowerCase()
    const comfyIds = lastToken
      ? useCommandStore()
          .commands.filter((c) => c.id.toLowerCase().startsWith(lower))
          .map((c) => c.id)
          .slice(0, 30)
      : []
    const builtinMatches = builtins.filter((c) => c.startsWith(lastToken))
    const completions = [
      ...builtinMatches.map((c) => ({ value: c })),
      ...comfyIds.map((id) => ({ value: id }))
    ]
    return {
      completions,
      replaceFrom,
      prefix: lastToken
    }
  }

  const firstCmd = nonEmpty[0]

  // 2. `graph <subcommand>`
  if (firstCmd === 'graph' && nonEmpty.length === 2) {
    return {
      completions: GRAPH_SUBCOMMANDS.filter((s) => s.startsWith(lastToken)).map(
        (s) => ({ value: s })
      ),
      replaceFrom,
      prefix: lastToken
    }
  }

  // 3. `cmd <id>` or `cmd-list <id>`
  if (
    (firstCmd === 'cmd' || firstCmd === 'cmd-list') &&
    nonEmpty.length === 2
  ) {
    return {
      completions: comfyCommandIds(lastToken),
      replaceFrom,
      prefix: lastToken
    }
  }

  // 4. `set-widget <nodeId>` or `sweep <nodeId>`
  if (
    (firstCmd === 'set-widget' || firstCmd === 'sweep') &&
    nonEmpty.length === 2
  ) {
    return {
      completions: nodeIds().filter((n) => n.value.startsWith(lastToken)),
      replaceFrom,
      prefix: lastToken
    }
  }

  // 5. `set-widget <nodeId> <widgetName>`
  if (
    (firstCmd === 'set-widget' || firstCmd === 'sweep') &&
    nonEmpty.length === 3
  ) {
    const nodeId = nonEmpty[1]
    const canvas = useCanvasStore().canvas
    if (canvas?.graph) {
      const nodes =
        (
          canvas.graph as {
            _nodes: { id: number; widgets?: { name?: string }[] }[]
          }
        )._nodes ?? []
      const node = nodes.find((n) => String(n.id) === nodeId)
      const widgets =
        node?.widgets?.map((w) => w.name ?? '').filter(Boolean) ?? []
      return {
        completions: widgets
          .filter((w) => w.startsWith(lastToken))
          .map((w) => ({ value: w })),
        replaceFrom,
        prefix: lastToken
      }
    }
  }

  // 6. Path completion for / paths
  if (lastToken.startsWith('/')) {
    const mountRoots = ['/tmp/', '/workflows/']
    return {
      completions: mountRoots
        .filter((m) => m.startsWith(lastToken))
        .map((m) => ({ value: m })),
      replaceFrom,
      prefix: lastToken
    }
  }

  return { completions: [], replaceFrom, prefix: lastToken }
}
