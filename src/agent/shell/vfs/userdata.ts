import { api } from '@/scripts/api'

import type { VFS, VfsEntry } from '../types'

function stripLead(p: string): string {
  return p.replace(/^\/+/, '')
}

function joinRoot(root: string, rel: string): string {
  const base = root.replace(/^\/+|\/+$/g, '')
  const suffix = stripLead(rel)
  if (!suffix || suffix === '/') return base
  return base ? `${base}/${suffix}` : suffix
}

export class UserdataVFS implements VFS {
  constructor(private root: string = 'workflows') {}

  private toRemote(rel: string): string {
    return joinRoot(this.root, rel)
  }

  async list(path: string): Promise<VfsEntry[]> {
    const prefix = this.toRemote(path)
    const infos = await api.listUserDataFullInfo(prefix || '.')
    const seen = new Map<string, VfsEntry>()
    const prefixSlash = prefix ? prefix + '/' : ''
    for (const info of infos) {
      const rest = info.path.startsWith(prefixSlash)
        ? info.path.slice(prefixSlash.length)
        : info.path
      if (!rest) continue
      const slash = rest.indexOf('/')
      if (slash === -1) {
        seen.set(rest, {
          name: rest,
          path: '/' + info.path,
          type: 'file',
          size: info.size,
          modified: info.modified
        })
      } else {
        const name = rest.slice(0, slash)
        if (!seen.has(name)) {
          seen.set(name, {
            name,
            path: '/' + (prefix ? prefix + '/' : '') + name,
            type: 'dir'
          })
        }
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  async read(path: string): Promise<string> {
    const resp = await api.getUserData(this.toRemote(path))
    if (!resp.ok) throw new Error(`read failed: ${resp.status} ${path}`)
    return resp.text()
  }

  async write(path: string, data: string): Promise<void> {
    const resp = await api.storeUserData(this.toRemote(path), data, {
      overwrite: true,
      stringify: false,
      throwOnError: false
    })
    if (!resp.ok) {
      throw new Error(`write failed: ${resp.status} ${path}`)
    }
  }

  async append(path: string, data: string): Promise<void> {
    let current = ''
    try {
      current = await this.read(path)
    } catch {
      current = ''
    }
    return this.write(path, current + data)
  }

  async delete(path: string): Promise<void> {
    const resp = await api.deleteUserData(this.toRemote(path))
    if (!resp.ok && resp.status !== 404) {
      throw new Error(`delete failed: ${resp.status} ${path}`)
    }
  }

  async move(src: string, dest: string): Promise<void> {
    const resp = await api.moveUserData(
      this.toRemote(src),
      this.toRemote(dest),
      { overwrite: false }
    )
    if (!resp.ok) {
      throw new Error(`move failed: ${resp.status} ${src} -> ${dest}`)
    }
  }

  async exists(path: string): Promise<boolean> {
    const resp = await api.getUserData(this.toRemote(path), { method: 'HEAD' })
    return resp.ok
  }
}
