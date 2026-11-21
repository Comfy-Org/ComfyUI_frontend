declare module 'zip-dir' {
  import type { Stats } from 'node:fs'

  interface ZipDirOptions {
    saveTo?: string
    filter?: (path: string, stat: Stats) => boolean
    each?: (path: string) => void
  }

  function zipdir(rootDir: string, options?: ZipDirOptions): Promise<Buffer>

  export = zipdir
}
