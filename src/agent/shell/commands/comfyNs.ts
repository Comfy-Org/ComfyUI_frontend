import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'

import type { CmdContext, Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

/**
 * Namespace dispatcher for Comfy.* UI commands.
 *
 * Usage:
 *   comfy                         list top-level namespaces (Canvas, Workflow…)
 *   comfy --help                  same
 *   comfy canvas                  list commands under Canvas
 *   comfy canvas --help           same
 *   comfy canvas fitview          execute Comfy.Canvas.FitView
 *   comfy canvas fitview --help   show description / shortcut / version
 *
 * Names match case-insensitive. Dot form (Comfy.Canvas.FitView) also works —
 * that's routed via the registry resolver, this command just gives the
 * nicer space-separated git-like ergonomics and --help at every level.
 */
interface CommandEntry {
  id: string
  label: string
  tooltip?: string
  versionAdded?: string
}

function allCommands(): CommandEntry[] {
  return useCommandStore().commands.map((c) => ({
    id: c.id,
    label: c.label ?? c.id,
    tooltip: c.tooltip,
    versionAdded: c.versionAdded
  }))
}

function filterByPath(
  cmds: CommandEntry[],
  pathParts: string[]
): {
  exact: CommandEntry | null
  childNamesAtNextLevel: string[]
  descendants: CommandEntry[]
} {
  const lower = pathParts.map((p) => p.toLowerCase())
  const descendants = cmds.filter((c) => {
    const parts = c.id.split('.').map((p) => p.toLowerCase())
    if (parts.length <= lower.length) return false
    for (let i = 0; i < lower.length; i++) {
      if (parts[i + 1] !== lower[i]) return false
    }
    return true
  })
  const exact =
    cmds.find(
      (c) => c.id.toLowerCase() === ['comfy', ...lower].join('.').toLowerCase()
    ) ?? null
  const nextLevelSet = new Set<string>()
  for (const c of descendants) {
    const parts = c.id.split('.')
    const nextPart = parts[lower.length + 1]
    if (nextPart) nextLevelSet.add(nextPart)
  }
  return {
    exact,
    childNamesAtNextLevel: [...nextLevelSet].sort(),
    descendants
  }
}

function formatHelp(
  path: string[],
  entries: CommandEntry[],
  children: string[]
): string {
  const header = path.length === 0 ? 'comfy' : 'comfy ' + path.join(' ')
  const lines: string[] = []
  lines.push(`\x1b[1m${header}\x1b[0m — ComfyUI command namespace`)
  lines.push('')
  if (children.length > 0) {
    lines.push('namespaces / subcommands:')
    for (const name of children) {
      // count how many commands are at or under this child
      const prefix = 'Comfy.' + [...path, name].join('.').toLowerCase()
      const count = entries.filter((c) =>
        c.id.toLowerCase().startsWith(prefix)
      ).length
      const suffix = count > 1 ? `  (${count} commands)` : ''
      lines.push(`  ${name.toLowerCase()}${suffix}`)
    }
    lines.push('')
  }
  lines.push(
    'tip: append --help at any level for details, or run the leaf to execute.'
  )
  return lines.join('\n') + '\n'
}

function formatLeafHelp(entry: CommandEntry): string {
  const lines: string[] = []
  lines.push(`\x1b[1m${entry.id}\x1b[0m`)
  if (entry.label && entry.label !== entry.id)
    lines.push(`  label:    ${entry.label}`)
  if (entry.tooltip) lines.push(`  tooltip:  ${entry.tooltip}`)
  const kb = useKeybindingStore().getKeybindingByCommandId(entry.id)
  if (kb?.combo) {
    const keys = [
      kb.combo.ctrl && 'Ctrl',
      kb.combo.alt && 'Alt',
      kb.combo.shift && 'Shift',
      kb.combo.key
    ]
      .filter(Boolean)
      .join('+')
    lines.push(`  shortcut: ${keys}`)
  }
  if (entry.versionAdded) lines.push(`  added:    v${entry.versionAdded}`)
  lines.push('')
  lines.push(
    'invocation: run without --help to execute, e.g.  comfy ' +
      entry.id
        .replace(/^Comfy\./, '')
        .split('.')
        .join(' ')
        .toLowerCase()
  )
  lines.push('         or: ' + entry.id)
  return lines.join('\n') + '\n'
}

async function executeLeaf(
  id: string,
  args: string[] = []
): Promise<{
  stdout: AsyncIterable<string>
  exitCode: number
  stderr?: string
}> {
  const store = useCommandStore()
  try {
    await store.execute(id, { metadata: { args } })
    const suffix = args.length > 0 ? ` (args: ${args.join(' ')})` : ''
    return { stdout: stringIter(`ok: ${id}${suffix}\n`), exitCode: 0 }
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * Progressive leaf resolution: walk the path from longest to shortest,
 * returning the first prefix that resolves to an exact registered command.
 * The remaining trailing tokens become passthrough args (delivered via
 * `metadata.args` to the command function).
 */
function resolveLongestLeaf(
  cmds: CommandEntry[],
  pathParts: string[]
): { leaf: CommandEntry; args: string[] } | null {
  for (let n = pathParts.length; n >= 1; n--) {
    const prefix = pathParts.slice(0, n)
    const { exact } = filterByPath(cmds, prefix)
    if (exact) return { leaf: exact, args: pathParts.slice(n) }
  }
  return null
}

const comfyCmd: Command = async (ctx: CmdContext) => {
  const rawArgs = ctx.argv.slice(1)
  const wantsHelp =
    rawArgs[rawArgs.length - 1] === '--help' ||
    rawArgs[rawArgs.length - 1] === '-h'
  const pathParts = rawArgs.filter((a) => a !== '--help' && a !== '-h')

  const cmds = allCommands()
  const { exact, childNamesAtNextLevel, descendants } = filterByPath(
    cmds,
    pathParts
  )

  // Leaf command + --help → show that command's detail
  if (exact && wantsHelp) {
    return { stdout: stringIter(formatLeafHelp(exact)), exitCode: 0 }
  }

  // Leaf command (no --help) → execute
  if (exact && childNamesAtNextLevel.length === 0) {
    return executeLeaf(exact.id)
  }

  // If there's an exact match AND children, ambiguous: prefer execute when
  // no more args, else treat as a namespace (shouldn't really happen in
  // the current ComfyUI namespace but guard anyway).
  if (exact && pathParts.length > 0 && !wantsHelp) {
    return executeLeaf(exact.id)
  }

  // Not a leaf — try progressive resolution: maybe the first N tokens
  // name a leaf and the rest are passthrough args (e.g.
  // `comfy saveworkflowas bbb` → Comfy.SaveWorkflowAs with args=['bbb']).
  if (pathParts.length > 0 && descendants.length === 0 && !exact) {
    const resolved = resolveLongestLeaf(cmds, pathParts)
    if (resolved) return executeLeaf(resolved.leaf.id, resolved.args)
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: `comfy: no command or namespace '${pathParts.join(' ')}'`
    }
  }
  return {
    stdout: stringIter(formatHelp(pathParts, cmds, childNamesAtNextLevel)),
    exitCode: 0
  }
}

export function registerComfyNamespace(registry: CommandRegistry): void {
  registry.register('comfy', comfyCmd)
}
