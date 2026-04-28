import { useCommandStore } from '@/stores/commandStore'

import type { Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

const cmd: Command = async (ctx) => {
  const id = ctx.argv[1]
  if (!id) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: cmd <command-id> [args...]'
    }
  }
  const store = useCommandStore()
  const target = store.getCommand(id)
  if (!target) {
    return {
      stdout: emptyIter(),
      exitCode: 127,
      stderr: `cmd: unknown command id: ${id}`
    }
  }
  try {
    await store.execute(id)
    return { stdout: stringIter(`ok: ${id}\n`), exitCode: 0 }
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

const cmdList: Command = async (ctx) => {
  const store = useCommandStore()
  const patterns = ctx.argv.slice(1).filter(Boolean)
  const ids = store.commands
    .map((c) => c.id)
    .filter((id) => {
      if (patterns.length === 0) return true
      const lc = id.toLowerCase()
      return patterns.some((p) => {
        try {
          return new RegExp(p, 'i').test(id)
        } catch {
          return lc.includes(p.toLowerCase())
        }
      })
    })
    .sort()
  const out = ids.length === 0 ? '(no matches)\n' : ids.join('\n') + '\n'
  return { stdout: stringIter(out), exitCode: 0 }
}

export function registerComfyCommands(registry: CommandRegistry): void {
  registry.register('cmd', cmd)
  registry.register('cmd-list', cmdList)
}
