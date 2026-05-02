import type { VFS, VfsEntry } from '../types'

function normalize(path: string): string {
  if (!path.startsWith('/')) path = '/' + path
  const parts = path.split('/').filter((p) => p.length > 0)
  const stack: string[] = []
  for (const p of parts) {
    if (p === '.') continue
    if (p === '..') stack.pop()
    else stack.push(p)
  }
  return '/' + stack.join('/')
}

export class MemoryVFS implements VFS {
  private files = new Map<string, string>()

  async list(path: string): Promise<VfsEntry[]> {
    const dir = normalize(path)
    const entries = new Map<string, VfsEntry>()
    let found = dir === '/'
    for (const key of this.files.keys()) {
      if (!key.startsWith(dir === '/' ? '/' : dir + '/') && key !== dir)
        continue
      if (key === dir) continue
      const rest = key.slice(dir === '/' ? 1 : dir.length + 1)
      const slash = rest.indexOf('/')
      if (slash === -1) {
        entries.set(rest, {
          name: rest,
          path: key,
          type: 'file',
          size: this.files.get(key)!.length
        })
      } else {
        const name = rest.slice(0, slash)
        entries.set(name, { name, path: dir + '/' + name, type: 'dir' })
      }
      found = true
    }
    if (!found && dir !== '/') {
      throw new Error(`no such file or directory: ${dir}`)
    }
    return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  async read(path: string): Promise<string> {
    const p = normalize(path)
    const data = this.files.get(p)
    if (data === undefined) throw new Error(`no such file or directory: ${p}`)
    return data
  }

  async write(path: string, data: string): Promise<void> {
    this.files.set(normalize(path), data)
  }

  async append(path: string, data: string): Promise<void> {
    const p = normalize(path)
    this.files.set(p, (this.files.get(p) ?? '') + data)
  }

  async delete(path: string): Promise<void> {
    const p = normalize(path)
    if (!this.files.delete(p)) {
      throw new Error(`no such file or directory: ${p}`)
    }
  }

  async move(src: string, dest: string): Promise<void> {
    const s = normalize(src)
    const d = normalize(dest)
    const data = this.files.get(s)
    if (data === undefined) throw new Error(`no such file or directory: ${s}`)
    this.files.delete(s)
    this.files.set(d, data)
  }

  async exists(path: string): Promise<boolean> {
    const p = normalize(path)
    if (this.files.has(p)) return true
    const prefix = p === '/' ? '/' : p + '/'
    for (const k of this.files.keys()) if (k.startsWith(prefix)) return true
    return false
  }
}
