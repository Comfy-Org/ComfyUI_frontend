import { execFileSync, spawnSync } from 'node:child_process'
import type { SpawnSyncReturns } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, test as baseTest } from 'vitest'

const packageDirectory = resolve(import.meta.dirname, '..')
const binary = fileURLToPath(import.meta.resolve('fallow/bin/fallow'))
const env = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'))
)
const packedDirectory = mkdtempSync(join(tmpdir(), 'fallow-pack-'))

function run(directory: string, command: string, args: string[]) {
  return execFileSync(command, args, {
    cwd: directory,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

beforeAll(() => {
  run(packageDirectory, 'pnpm', [
    'pack',
    '--out',
    join(packedDirectory, 'preset.tgz')
  ])
})

afterAll(() => rmSync(packedDirectory, { recursive: true, force: true }))

const test = baseTest.extend<{
  consumer: {
    write: (path: string, contents: string) => void
    configure: (local?: Record<string, unknown>) => void
    commit: () => string
    audit: (base: string) => SpawnSyncReturns<string>
  }
}>({
  consumer: async ({ task }, use) => {
    const directory = mkdtempSync(join(tmpdir(), `fallow-consumer-${task.id}-`))
    function write(path: string, contents: string) {
      const target = join(directory, path)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, contents)
    }
    function configure(local: Record<string, unknown> = {}) {
      write(
        '.fallowrc.json',
        JSON.stringify({
          extends: 'npm:@comfyorg/tooling-config/fallow',
          entry: ['src/main.ts'],
          ...local
        })
      )
    }
    function commit() {
      run(directory, 'git', ['add', '.'])
      run(directory, 'git', ['commit', '-qm', 'fixture'])
      return run(directory, 'git', ['rev-parse', 'HEAD'])
    }
    function audit(base: string) {
      run(directory, 'git', ['add', '.'])
      return spawnSync(
        binary,
        ['audit', '--changed-since', base, '--format', 'json'],
        { cwd: directory, env, encoding: 'utf8', timeout: 30_000 }
      )
    }
    try {
      write('package.json', JSON.stringify({ name: 'consumer', private: true }))
      run(directory, 'npm', [
        'install',
        '--save-dev',
        '--offline',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--cache',
        join(directory, '.npm-cache'),
        join(packedDirectory, 'preset.tgz')
      ])
      write('.gitignore', 'node_modules/\n.npm-cache/\n.fallow/\n')
      configure()
      write('src/main.ts', 'console.log("ready")\n')
      run(directory, 'git', ['init', '-q'])
      run(directory, 'git', ['config', 'user.name', 'Fixture'])
      run(directory, 'git', ['config', 'user.email', 'fixture@example.invalid'])
      await use({ write, configure, commit, audit })
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})

test.for([
  {
    label: 'new',
    source: 'export const live = 1\n',
    exitCode: 1,
    verdict: 'fail'
  },
  {
    label: 'inherited',
    source: 'export const live = 1\nexport const unused = 1\n',
    exitCode: 0,
    verdict: 'pass'
  }
])(
  'gates $label unused exports',
  ({ source, exitCode, verdict }, { consumer }) => {
    consumer.write(
      'src/main.ts',
      'import { live } from "./lib"\nconsole.log(live)\n'
    )
    consumer.write('src/lib.ts', source)
    const base = consumer.commit()
    consumer.write(
      'src/lib.ts',
      'export const live = 2\nexport const unused = 2\n'
    )
    const result = consumer.audit(base)
    expect(result).toMatchObject({ status: exitCode })
    expect(JSON.parse(result.stdout)).toMatchObject({ verdict })
  }
)

test('retains local support roots and blocks runtime development dependencies', ({
  consumer
}) => {
  consumer.write(
    'package.json',
    JSON.stringify({
      name: 'consumer',
      private: true,
      devDependencies: {
        '@comfyorg/tooling-config': '0.0.1',
        'build-only': '1.0.0'
      }
    })
  )
  consumer.configure({
    framework: [
      {
        name: 'consumer-tooling',
        enablers: ['build-only'],
        entryPointRole: 'support',
        entryPoints: ['scripts/build.ts']
      }
    ]
  })
  const base = consumer.commit()
  consumer.write(
    'scripts/build.ts',
    'import { build } from "build-only"\nconsole.log(build)\n'
  )
  const support = consumer.audit(base)
  expect(support).toMatchObject({ status: 0 })
  expect(JSON.parse(support.stdout)).toMatchObject({
    changed_files_count: 1,
    dead_code: { entry_points: { sources: { plugin: 1 } } },
    complexity: { summary: { files_analyzed: 1 } }
  })
  consumer.write(
    'src/main.ts',
    'import { build } from "build-only"\nconsole.log(build)\n'
  )
  const runtime = consumer.audit(base)
  expect(runtime).toMatchObject({ status: 1 })
  expect(JSON.parse(runtime.stdout)).toMatchObject({ verdict: 'fail' })
})

test('applies a local path override without weakening other paths', ({
  consumer
}) => {
  consumer.configure({
    overrides: [
      {
        files: ['src/legacy/**'],
        rules: { 'unused-exports': 'warn' }
      }
    ]
  })
  const base = consumer.commit()
  consumer.write(
    'src/legacy/lib.ts',
    'export const live = 1\nexport const unused = 2\n'
  )
  consumer.write(
    'src/main.ts',
    'import { live } from "./legacy/lib"\nconsole.log(live)\n'
  )
  const legacy = consumer.audit(base)
  expect(legacy).toMatchObject({ status: 0 })
  consumer.write(
    'src/lib.ts',
    'export const current = 1\nexport const stale = 2\n'
  )
  consumer.write(
    'src/main.ts',
    'import { current } from "./lib"\nimport { live } from "./legacy/lib"\nconsole.log(current, live)\n'
  )
  const current = consumer.audit(base)
  expect(current).toMatchObject({ status: 1 })
})

test.for([
  { copies: 2, groups: 0 },
  { copies: 3, groups: 1 }
])(
  'reports duplication starting at $copies copies',
  ({ copies, groups }, { consumer }) => {
    const base = consumer.commit()
    const names = Array.from({ length: copies }, (_, index) => `copy${index}`)
    const additions = Array.from(
      { length: 25 },
      (_, index) => `total += values[${index}]`
    ).join('\n')
    consumer.write(
      'src/main.ts',
      names
        .map(
          (name) =>
            `function ${name}(values: number[]) {\nlet total = 0\n${additions}\nreturn total\n}\nconsole.log(${name}([1]))`
        )
        .join('\n')
    )
    const result = consumer.audit(base)
    expect(result).toMatchObject({ status: 0 })
    expect(JSON.parse(result.stdout)).toMatchObject({
      summary: { duplication_clone_groups: groups }
    })
  }
)
