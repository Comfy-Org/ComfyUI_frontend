import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, it, onTestFinished } from 'vitest'

const script = join(import.meta.dirname, 'check-hreflang.ts')
const loader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href

it.for([
  {
    name: 'valid encoded links',
    canonical: 'https://comfy.org/zh-CN/caf%C3%A9/',
    status: 0,
    diagnostic: 'every cluster is reciprocal'
  },
  {
    name: 'wrong-origin canonical',
    canonical: 'https://other.example/zh-CN/caf%C3%A9/',
    status: 1,
    diagnostic:
      '/zh-CN/café/: canonical must be https://comfy.org/zh-CN/caf%C3%A9/'
  }
])(
  'audits $name from the built site',
  async ({ canonical, status, diagnostic }) => {
    const directory = await mkdtemp(join(tmpdir(), 'hreflang-canonical-'))
    onTestFinished(() => rm(directory, { recursive: true, force: true }))
    const pages = [
      {
        route: '/café/',
        loc: 'https://comfy.org/caf%C3%A9/',
        canonical: 'https://comfy.org/caf%C3%A9/'
      },
      {
        route: '/zh-CN/café/',
        loc: 'https://comfy.org/zh-CN/caf%C3%A9/',
        canonical
      }
    ]
    const links = [
      ['en', 'https://comfy.org/caf%C3%A9/'],
      ['zh-CN', 'https://comfy.org/zh-CN/caf%C3%A9/'],
      ['x-default', 'https://comfy.org/caf%C3%A9/']
    ]
      .map(
        ([locale, href]) =>
          `<link rel="alternate" hreflang="${locale}" href="${href}">`
      )
      .join('')
    await Promise.all(
      pages.map(async ({ route, canonical }) => {
        const target = join(directory, 'dist', route)
        await mkdir(target, { recursive: true })
        await writeFile(
          join(target, 'index.html'),
          `<link  rel="canonical"\n href="${canonical}">${links}`
        )
      })
    )
    await writeFile(
      join(directory, 'dist', 'sitemap-0.xml'),
      `<urlset>${pages
        .map(({ loc }) => `<url><loc>${loc}</loc>${links}</url>`)
        .join('')}</urlset>`
    )

    const result = spawnSync(process.execPath, ['--import', loader, script], {
      cwd: directory,
      encoding: 'utf8'
    })

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(status)
    expect(result.stderr).toContain(diagnostic)
  }
)
