import { execFileSync, spawnSync } from 'node:child_process'
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, it, onTestFinished } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '../..')
const loader = createRequire(import.meta.url).resolve('tsx')

it.for<{
  previous: string
  value: string
  status: number
  diagnostic: string
  recordedHash?: string
}>([
  {
    previous: 'unavailable recorded source',
    value: '確認済み',
    status: 1,
    diagnostic: 'title: missing {name}',
    recordedHash: '0000000000000000000000000000000000000000'
  },
  {
    previous: 'Hello {name}',
    value: '確認済み',
    status: 1,
    diagnostic: 'title: missing {name}'
  },
  {
    previous: 'Hello',
    value: '確認済み',
    status: 1,
    diagnostic: 'title: missing {name}'
  },
  {
    previous: 'Hello',
    value: '確認済み {name}',
    status: 0,
    diagnostic: 'All locales are up to date'
  },
  {
    previous: 'Hello',
    value: '',
    status: 0,
    diagnostic: 'All locales are up to date'
  }
])(
  'checks and retains $value when English changes from $previous',
  async ({ previous, value, status, diagnostic, recordedHash }) => {
    const directory = await realpath(
      await mkdtemp(join(tmpdir(), 'locale-cli-'))
    )
    onTestFinished(() => rm(directory, { recursive: true, force: true }))
    await cp(import.meta.dirname, join(directory, 'scripts/i18n'), {
      recursive: true,
      filter: (source) => !source.endsWith('.test.ts')
    })
    await cp(
      join(import.meta.dirname, '../isMainModule.ts'),
      join(directory, 'scripts/isMainModule.ts')
    )
    await symlink(
      join(repoRoot, 'node_modules'),
      join(directory, 'node_modules'),
      'dir'
    )
    await writeFile(join(directory, 'package.json'), '{"type":"module"}\n')
    execFileSync('git', ['init', '-q', directory])
    const catalogs = join(directory, 'apps/website/src/locales')
    await Promise.all(
      ['en', 'ja', 'zh-CN'].map((locale) =>
        mkdir(join(catalogs, locale), { recursive: true })
      )
    )
    const english = join(catalogs, 'en/main.json')
    await writeFile(english, JSON.stringify({ title: previous }))
    const hash = execFileSync('git', ['hash-object', '-w', english], {
      cwd: directory,
      encoding: 'utf8'
    }).trim()
    await writeFile(
      english,
      `${JSON.stringify({ title: 'Hello {name}' }, null, 2)}\n`
    )
    await writeFile(
      join(catalogs, '.source-manifest.json'),
      JSON.stringify({
        version: 1,
        files: { 'main.json': recordedHash ?? hash }
      })
    )
    await writeFile(
      join(catalogs, '.machine-translations.json'),
      '{"version":1,"files":{}}\n'
    )
    await Promise.all(
      ['ja', 'zh-CN'].map((locale) =>
        writeFile(
          join(catalogs, locale, 'main.json'),
          `${JSON.stringify({ title: value }, null, 2)}\n`
        )
      )
    )
    const args = [
      '--import',
      loader,
      join(directory, 'scripts/i18n/update-locales.ts'),
      '--target',
      'website'
    ]
    const options = {
      cwd: directory,
      env: { ...process.env, OPENAI_API_KEY: '' },
      encoding: 'utf8'
    } as const

    const check = spawnSync(process.execPath, [...args, '--check'], options)
    const generate = spawnSync(process.execPath, args, options)

    expect([check.status, generate.status]).toEqual([status, status])
    expect(check.stdout).toContain(diagnostic)
    expect(
      JSON.parse(await readFile(join(catalogs, 'ja/main.json'), 'utf8'))
    ).toEqual({ title: value })
    expect(
      JSON.parse(await readFile(join(catalogs, 'zh-CN/main.json'), 'utf8'))
    ).toEqual({ title: value })
  }
)
