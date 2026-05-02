export interface Redirect {
  op: '>' | '>>'
  path: string
}

export interface Cmd {
  argv: string[]
  redirect?: Redirect
}

export type Node =
  | { type: 'pipe'; cmds: Cmd[]; redirect?: Redirect }
  | { type: 'and' | 'or' | 'seq'; left: Node; right: Node }
  | { type: 'simple'; cmd: Cmd }

export interface VFS {
  list(path: string): Promise<VfsEntry[]>
  read(path: string): Promise<string>
  write(path: string, data: string): Promise<void>
  append(path: string, data: string): Promise<void>
  delete(path: string): Promise<void>
  move(src: string, dest: string): Promise<void>
  exists(path: string): Promise<boolean>
}

export interface VfsEntry {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  modified?: number
}

export interface CmdContext {
  argv: string[]
  stdin: AsyncIterable<string>
  env: Map<string, string>
  cwd: string
  vfs: VFS
  signal: AbortSignal
}

export interface CmdResult {
  stdout: AsyncIterable<string>
  exitCode: number
  stderr?: string
}

export type Command = (ctx: CmdContext) => Promise<CmdResult>

export interface CommandRegistry {
  get(name: string): Command | undefined
  register(name: string, cmd: Command): void
  list(): string[]
}

export async function* emptyIter(): AsyncIterable<string> {
  // no-op
}

export async function* stringIter(s: string): AsyncIterable<string> {
  if (s.length > 0) yield s
}

export async function collect(iter: AsyncIterable<string>): Promise<string> {
  const parts: string[] = []
  for await (const chunk of iter) parts.push(chunk)
  return parts.join('')
}

export async function* lines(
  iter: AsyncIterable<string>
): AsyncIterable<string> {
  let buf = ''
  for await (const chunk of iter) {
    buf += chunk
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      yield buf.slice(0, nl)
      buf = buf.slice(nl + 1)
    }
  }
  if (buf.length > 0) yield buf
}
