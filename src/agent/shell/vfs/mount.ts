import type { VFS, VfsEntry } from '../types'

interface Mount {
  prefix: string
  fs: VFS
}

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

export class MountedVFS implements VFS {
  private mounts: Mount[]

  constructor(mounts: Record<string, VFS>) {
    this.mounts = Object.entries(mounts)
      .map(([prefix, fs]) => ({
        prefix: prefix === '/' ? '' : prefix.replace(/\/$/, ''),
        fs
      }))
      .sort((a, b) => b.prefix.length - a.prefix.length)
  }

  private resolve(path: string): { mount: Mount; relative: string } {
    const abs = normalize(path)
    for (const mount of this.mounts) {
      if (mount.prefix === '') {
        return { mount, relative: abs }
      }
      if (abs === mount.prefix) {
        return { mount, relative: '/' }
      }
      if (abs.startsWith(mount.prefix + '/')) {
        return { mount, relative: abs.slice(mount.prefix.length) || '/' }
      }
    }
    throw new Error(`no mount for path: ${abs}`)
  }

  private decorate(mount: Mount, entries: VfsEntry[]): VfsEntry[] {
    if (mount.prefix === '') return entries
    return entries.map((e) => ({
      ...e,
      path: mount.prefix + (e.path.startsWith('/') ? e.path : '/' + e.path)
    }))
  }

  async list(path: string): Promise<VfsEntry[]> {
    const abs = normalize(path)
    if (abs === '/') {
      const topMounts = this.mounts
        .filter((m) => m.prefix !== '')
        .map((m) => m.prefix)
      const roots = new Set<string>()
      for (const p of topMounts) {
        const name = p.split('/').filter(Boolean)[0]
        if (name) roots.add(name)
      }
      const hasRoot = this.mounts.some((m) => m.prefix === '')
      if (hasRoot) {
        const { mount } = this.resolve('/')
        const rootEntries = await mount.fs.list('/')
        for (const e of rootEntries) roots.add(e.name.replace(/\/$/, ''))
      }
      return [...roots].sort().map((name) => ({
        name,
        path: '/' + name,
        type: 'dir'
      }))
    }
    const { mount, relative } = this.resolve(abs)
    const entries = await mount.fs.list(relative)
    return this.decorate(mount, entries)
  }

  async read(path: string): Promise<string> {
    const { mount, relative } = this.resolve(path)
    return mount.fs.read(relative)
  }

  async write(path: string, data: string): Promise<void> {
    const { mount, relative } = this.resolve(path)
    return mount.fs.write(relative, data)
  }

  async append(path: string, data: string): Promise<void> {
    const { mount, relative } = this.resolve(path)
    return mount.fs.append(relative, data)
  }

  async delete(path: string): Promise<void> {
    const { mount, relative } = this.resolve(path)
    return mount.fs.delete(relative)
  }

  async move(src: string, dest: string): Promise<void> {
    const s = this.resolve(src)
    const d = this.resolve(dest)
    if (s.mount !== d.mount) {
      const data = await s.mount.fs.read(s.relative)
      await d.mount.fs.write(d.relative, data)
      await s.mount.fs.delete(s.relative)
      return
    }
    return s.mount.fs.move(s.relative, d.relative)
  }

  async exists(path: string): Promise<boolean> {
    try {
      const { mount, relative } = this.resolve(path)
      return mount.fs.exists(relative)
    } catch {
      return false
    }
  }
}
