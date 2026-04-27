import type { CmdContext, CmdResult, Command, CommandRegistry } from '../types'
import { collect, emptyIter, lines, stringIter } from '../types'

function ok(stdout: AsyncIterable<string>, exitCode = 0): CmdResult {
  return { stdout, exitCode }
}

function err(message: string, exitCode = 2): CmdResult {
  return { stdout: emptyIter(), exitCode, stderr: message }
}

const echo: Command = async (ctx) => {
  const args = ctx.argv.slice(1)
  let newline = true
  if (args[0] === '-n') {
    newline = false
    args.shift()
  }
  const text = args.join(' ') + (newline ? '\n' : '')
  return ok(stringIter(text))
}

const cat: Command = async (ctx) => {
  const paths = ctx.argv.slice(1)
  if (paths.length === 0) return ok(ctx.stdin)
  async function* gen(): AsyncIterable<string> {
    for (const p of paths) {
      yield await ctx.vfs.read(p)
    }
  }
  return ok(gen())
}

const ls: Command = async (ctx) => {
  const path = ctx.argv[1] ?? ctx.cwd
  const entries = await ctx.vfs.list(path)
  const out =
    entries.map((e) => (e.type === 'dir' ? e.name + '/' : e.name)).join('\n') +
    (entries.length > 0 ? '\n' : '')
  return ok(stringIter(out))
}

const pwd: Command = async (ctx) => ok(stringIter(ctx.cwd + '\n'))

const wc: Command = async (ctx) => {
  const data = await collect(ctx.stdin)
  const bytes = data.length
  const lineCount =
    data === '' ? 0 : data.split('\n').length - (data.endsWith('\n') ? 1 : 0)
  const words = data.split(/\s+/).filter((w) => w.length > 0).length
  return ok(stringIter(`${lineCount} ${words} ${bytes}\n`))
}

function parseNFlag(
  argv: string[],
  defaultN: number
): { n: number; rest: string[] } {
  const rest = argv.slice(1)
  let n = defaultN
  if (rest[0] === '-n') {
    const parsed = Number(rest[1])
    if (!Number.isFinite(parsed)) throw new Error('invalid -n value')
    n = parsed
    rest.splice(0, 2)
  } else if (rest[0]?.startsWith('-n')) {
    const parsed = Number(rest[0].slice(2))
    if (!Number.isFinite(parsed)) throw new Error('invalid -n value')
    n = parsed
    rest.shift()
  }
  return { n, rest }
}

const head: Command = async (ctx) => {
  let n: number
  try {
    ;({ n } = parseNFlag(ctx.argv, 10))
  } catch (e) {
    return err('usage: head [-n N]')
  }
  async function* gen(): AsyncIterable<string> {
    let i = 0
    for await (const line of lines(ctx.stdin)) {
      if (i >= n) break
      yield line + '\n'
      i++
    }
  }
  return ok(gen())
}

const tail: Command = async (ctx) => {
  let n: number
  try {
    ;({ n } = parseNFlag(ctx.argv, 10))
  } catch (e) {
    return err('usage: tail [-n N]')
  }
  const buf: string[] = []
  for await (const line of lines(ctx.stdin)) {
    buf.push(line)
    if (buf.length > n) buf.shift()
  }
  const out = buf.length > 0 ? buf.join('\n') + '\n' : ''
  return ok(stringIter(out))
}

const grep: Command = async (ctx) => {
  const pattern = ctx.argv[1]
  if (!pattern) return err('usage: grep <pattern>')
  const re = new RegExp(pattern)
  // POSIX grep returns 1 when nothing matched. To honour that we have to
  // drain stdin eagerly — exit codes are set on the Command return, but a
  // generator can't change them after the fact. The agent relies on this
  // for `grep ... && ...` / `grep ... || ...` flows; without the right
  // exit code the LLM would conclude evidence existed when stdout was
  // actually empty.
  let matched = false
  let out = ''
  for await (const line of lines(ctx.stdin)) {
    if (re.test(line)) {
      out += line + '\n'
      matched = true
    }
  }
  return ok(stringIter(out), matched ? 0 : 1)
}

const trueCmd: Command = async () => ok(emptyIter(), 0)
const falseCmd: Command = async () => ok(emptyIter(), 1)

const seqCmd: Command = async (ctx) => {
  const args = ctx.argv.slice(1).map(Number)
  if (args.some((n) => !Number.isFinite(n))) {
    return err('usage: seq [start] [step] end')
  }
  let start = 1,
    step = 1,
    end: number
  if (args.length === 1) end = args[0]
  else if (args.length === 2) {
    start = args[0]
    end = args[1]
  } else if (args.length === 3) {
    start = args[0]
    step = args[1]
    end = args[2]
  } else {
    return err('usage: seq [start] [step] end')
  }
  if (step === 0) return err('step must not be zero')
  const out: string[] = []
  if (step > 0) for (let i = start; i <= end; i += step) out.push(String(i))
  else for (let i = start; i >= end; i += step) out.push(String(i))
  return ok(stringIter(out.join('\n') + (out.length ? '\n' : '')))
}

export function registerCoreutils(registry: CommandRegistry): void {
  registry.register('echo', echo)
  registry.register('cat', cat)
  registry.register('ls', ls)
  registry.register('pwd', pwd)
  registry.register('wc', wc)
  registry.register('head', head)
  registry.register('tail', tail)
  registry.register('grep', grep)
  registry.register('true', trueCmd)
  registry.register('false', falseCmd)
  registry.register('seq', seqCmd)
}

export const coreutils = {
  echo,
  cat,
  ls,
  pwd,
  wc,
  head,
  tail,
  grep,
  true: trueCmd,
  false: falseCmd,
  seq: seqCmd
} satisfies Record<string, (ctx: CmdContext) => Promise<CmdResult>>
