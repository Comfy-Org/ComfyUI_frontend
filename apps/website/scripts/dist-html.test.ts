import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'

import { htmlFiles, isFileWithExactCase, routeOf } from './dist-html'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'dist-html-'))
  await mkdir(join(root, 'zh-CN', 'about'), { recursive: true })
  await writeFile(join(root, 'index.html'), '')
  await writeFile(join(root, 'zh-CN', 'about', 'index.html'), '')
  await writeFile(join(root, 'zh-CN', 'cli.md'), '')
})

afterAll(() => rm(root, { recursive: true, force: true }))

describe('htmlFiles and routeOf', () => {
  it('lists every built page as its route', () => {
    expect(
      htmlFiles(root)
        .map((file) => routeOf(root, file))
        .sort()
    ).toEqual(['/', '/zh-CN/about/'])
  })
})

describe('isFileWithExactCase', () => {
  it.for([
    { path: '/zh-CN/cli.md', exists: true },
    { path: '/zh-CN/CLI.md', exists: false },
    { path: '/ZH-cn/cli.md', exists: false },
    { path: '/zh-CN/missing.md', exists: false },
    { path: '/zh-CN', exists: false },
    { path: '/', exists: false }
  ])('$path exists: $exists', ({ path, exists }) => {
    expect(isFileWithExactCase(root, path)).toBe(exists)
  })
})
