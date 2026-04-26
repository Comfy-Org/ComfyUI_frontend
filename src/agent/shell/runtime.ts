import type {
  Cmd,
  CmdContext,
  CmdResult,
  Command,
  CommandRegistry,
  Node,
  Redirect,
  VFS
} from './types'
import { collect, emptyIter } from './types'
import { parseScript } from './parser'

type Resolver = (name: string) => Command | undefined

export class CommandRegistryImpl implements CommandRegistry {
  private map = new Map<string, Command>()
  private resolvers: Resolver[] = []

  get(name: string): Command | undefined {
    const direct = this.map.get(name)
    if (direct) return direct
    for (const r of this.resolvers) {
      const hit = r(name)
      if (hit) return hit
    }
    return undefined
  }

  register(name: string, cmd: Command): void {
    this.map.set(name, cmd)
  }

  /**
   * Add a lookup fallback used when a name isn't in the main registry.
   * Resolvers are tried in registration order until one returns a handler.
   */
  addResolver(resolver: Resolver): void {
    this.resolvers.push(resolver)
  }

  list(): string[] {
    return [...this.map.keys()].sort()
  }
}

export interface ExecContext {
  registry: CommandRegistry
  vfs: VFS
  env: Map<string, string>
  cwd: string
  signal?: AbortSignal
  stdin?: AsyncIterable<string>
}

function makeCtx(
  ctx: ExecContext,
  argv: string[],
  stdin: AsyncIterable<string>
): CmdContext {
  return {
    argv,
    stdin,
    env: ctx.env,
    cwd: ctx.cwd,
    vfs: ctx.vfs,
    signal: ctx.signal ?? new AbortController().signal
  }
}

async function applyRedirect(
  res: CmdResult,
  redirect: Redirect,
  vfs: VFS
): Promise<CmdResult> {
  const data = await collect(res.stdout)
  if (redirect.op === '>') await vfs.write(redirect.path, data)
  else await vfs.append(redirect.path, data)
  return { stdout: emptyIter(), exitCode: res.exitCode, stderr: res.stderr }
}

async function runSimple(
  cmd: Cmd,
  ctx: ExecContext,
  stdin: AsyncIterable<string>
): Promise<CmdResult> {
  if (ctx.signal?.aborted) {
    return { stdout: emptyIter(), exitCode: 130, stderr: 'aborted' }
  }
  const name = cmd.argv[0]
  const handler = ctx.registry.get(name)
  if (!handler) {
    return {
      stdout: emptyIter(),
      exitCode: 127,
      stderr: `${name}: command not found`
    }
  }
  let res: CmdResult
  try {
    res = await handler(makeCtx(ctx, cmd.argv, stdin))
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
  if (cmd.redirect) res = await applyRedirect(res, cmd.redirect, ctx.vfs)
  return res
}

async function runPipe(
  cmds: Cmd[],
  ctx: ExecContext,
  stdin: AsyncIterable<string>,
  redirect: Redirect | undefined
): Promise<CmdResult> {
  let cur = stdin
  let exit = 0
  let stderr: string | undefined
  for (let i = 0; i < cmds.length; i++) {
    const last = i === cmds.length - 1
    const cmd = cmds[i]
    const inner = last ? cmd : { ...cmd, redirect: undefined }
    const res = await runSimple(inner, ctx, cur)
    cur = res.stdout
    exit = res.exitCode
    if (res.stderr) stderr = res.stderr
    if (ctx.signal?.aborted) {
      return { stdout: emptyIter(), exitCode: 130, stderr: 'aborted' }
    }
  }
  let result: CmdResult = { stdout: cur, exitCode: exit, stderr }
  if (redirect) result = await applyRedirect(result, redirect, ctx.vfs)
  return result
}

async function runNode(node: Node, ctx: ExecContext): Promise<CmdResult> {
  const stdin = ctx.stdin ?? emptyIter()
  if (ctx.signal?.aborted) {
    return { stdout: emptyIter(), exitCode: 130, stderr: 'aborted' }
  }
  if (node.type === 'simple') return runSimple(node.cmd, ctx, stdin)
  if (node.type === 'pipe') return runPipe(node.cmds, ctx, stdin, node.redirect)

  const left = await runNode(node.left, ctx)
  const leftOut = await collect(left.stdout)
  if (node.type === 'and' && left.exitCode !== 0) {
    return {
      stdout: toIter(leftOut),
      exitCode: left.exitCode,
      stderr: left.stderr
    }
  }
  if (node.type === 'or' && left.exitCode === 0) {
    return { stdout: toIter(leftOut), exitCode: 0, stderr: left.stderr }
  }
  const right = await runNode(node.right, ctx)
  const rightOut = await collect(right.stdout)
  const combined = leftOut + rightOut
  return {
    stdout: toIter(combined),
    exitCode: right.exitCode,
    stderr: right.stderr ?? left.stderr
  }
}

async function* toIter(s: string): AsyncIterable<string> {
  if (s.length > 0) yield s
}

/**
 * Commands whose argument list is taken literally (unparsed), so embedded
 * quotes, newlines, semicolons, and pipes pass through to the command.
 * This lets the user (or LLM) write raw JS with no shell escaping.
 */
const RAW_ARG_COMMANDS = ['run-js', 'describe']

/**
 * If the input matches `<cmd> <rest>` where <cmd> is a raw-arg command,
 * bypass shell-quote and build a single simple node by hand. This avoids
 * escaping hell for run-js and describe.
 */
function tryRawArgShortcut(src: string): Node | null {
  const trimmed = src.replace(/^\s+/, '')
  for (const c of RAW_ARG_COMMANDS) {
    if (trimmed.startsWith(c + ' ') || trimmed === c) {
      const rest = trimmed.slice(c.length).replace(/^\s+/, '')
      if (!rest) return null // let normal parser handle usage
      return { type: 'simple', cmd: { argv: [c, rest], redirect: undefined } }
    }
  }
  return null
}

export async function runScript(
  src: string,
  ctx: ExecContext
): Promise<CmdResult> {
  const shortcut = tryRawArgShortcut(src)
  if (shortcut) return runNode(shortcut, ctx)
  let node: Node
  try {
    node = parseScript(src, Object.fromEntries(ctx.env))
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
  return runNode(node, ctx)
}
