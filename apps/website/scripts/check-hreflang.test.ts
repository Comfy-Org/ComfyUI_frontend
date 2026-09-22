import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, onTestFinished } from 'vitest'

const script = join(import.meta.dirname, 'check-hreflang.ts')
const loader = createRequire(import.meta.url).resolve('tsx')
const routes = ['/about/', '/zh-CN/about/', '/ja/about/']
const alternates = [
  ['en', routes[0]],
  ['zh-CN', routes[1]],
  ['ja', routes[2]],
  ['x-default', routes[0]]
]

it.for([
  ['https://comfy.org/ja/about/', 0, 'every cluster is reciprocal'],
  ['https://other.example/ja/about/', 1, '/ja/about/: canonical must be'],
  [
    'https://comfy.org/ja/about/?preview=true',
    1,
    '/ja/about/: canonical must be'
  ],
  ['https://comfy.org/ja/about/#section', 1, '/ja/about/: canonical must be']
] as const)(
  'audits the complete Japanese canonical %s',
  async ([canonical, status, diagnostic]) => {
    const directory = await mkdtemp(join(tmpdir(), 'hreflang-canonical-'))
    onTestFinished(() => rm(directory, { recursive: true, force: true }))
    const links = alternates
      .map(
        ([locale, route]) =>
          `<link rel="alternate" hreflang="${locale}" href="https://comfy.org${route}">`
      )
      .join('')
    await Promise.all(
      routes.map(async (route) => {
        const target = join(directory, 'dist', route)
        await mkdir(target, { recursive: true })
        await writeFile(
          join(target, 'index.html'),
          `<link rel="canonical" href="${route === '/ja/about/' ? canonical : `https://comfy.org${route}`}">${links}`
        )
      })
    )
    await writeFile(
      join(directory, 'dist', 'sitemap-0.xml'),
      `<urlset>${routes
        .map(
          (route) => `<url><loc>https://comfy.org${route}</loc>${links}</url>`
        )
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
