import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'

import { readConfig } from './config.js'
import type { QualityConfig } from './config.js'

const require = createRequire(import.meta.url)
const binaries = {
  eslint: 'bin/eslint.js',
  oxlint: 'bin/oxlint',
  oxfmt: 'bin/oxfmt',
  prettier: 'bin/prettier.cjs',
  fallow: 'bin/fallow'
} as const

function run(tool: keyof typeof binaries, args: string[]): number {
  const root = dirname(require.resolve(`${tool}/package.json`))
  const result = spawnSync(
    process.execPath,
    [join(root, binaries[tool]), ...args],
    {
      stdio: 'inherit'
    }
  )
  if (result.error) throw result.error
  return result.status ?? 1
}

function git(args: string[]): string {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'git failed')
  return result.stdout
}

export async function main(args: string[]): Promise<number> {
  const [command = 'help', ...rest] = args
  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      process.stdout
        .write(`Usage: comfy-code-quality <lint|format|audit> [options] [paths...]
  lint   [--fix]                 Run configured Oxlint, then ESLint
  format [--check]               Format with the configured engine
  audit  --base <revision> [--json]  Audit added lines against a Git commit
  exec <tool> [args...]          Run a pinned engine with its native arguments
  -c, --config <file>            Config path (default: code-quality.config.json)
  -h, --help                    Show help
  -V, --version                 Show package version
Paths are appended to configured lint/format arguments. Keep scopes in config.
Audit writes no baselines. Native tool output and failure status are preserved.\n`)
      return 0
    case '--version':
    case '-V':
      process.stdout.write(`${require('../package.json').version}\n`)
      return 0
    case 'exec':
      return native(rest)
    case 'lint':
    case 'format':
    case 'audit':
      return configured(command, rest)
    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

function native(args: string[]): number {
  const [tool = '(missing)', ...rest] = args
  if (!isTool(tool)) throw new Error(`Unknown tool: ${tool}`)
  return run(tool, rest)
}

async function configured(command: string, rest: string[]): Promise<number> {
  const { values, positionals } = parseOptions(command, rest)
  if (values.help) return main(['help'])
  const config = await readConfig(values.config)
  if (command === 'lint') {
    const extra = [...(values.fix ? ['--fix'] : []), ...positionals]
    return lint(config.lint, extra)
  }
  if (command === 'format') {
    return format(config.format, values.check === true, positionals)
  }
  if (typeof values.base !== 'string' || positionals.length)
    throw new Error('audit requires --base <revision> and accepts no paths')
  return audit(config.audit ?? [], values.base, values.json === true)
}

function parseOptions(command: string, args: string[]) {
  return parseArgs({
    args,
    allowPositionals: true,
    options: {
      config: {
        type: 'string',
        short: 'c',
        default: 'code-quality.config.json'
      },
      help: { type: 'boolean', short: 'h' },
      ...(command === 'lint' ? { fix: { type: 'boolean' as const } } : {}),
      ...(command === 'format' ? { check: { type: 'boolean' as const } } : {}),
      ...(command === 'audit'
        ? {
            base: { type: 'string' as const, short: 'b' },
            json: { type: 'boolean' as const }
          }
        : {})
    }
  })
}

async function audit(
  args: string[],
  baseRef: string,
  json: boolean
): Promise<number> {
  const base = git([
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${baseRef}^{commit}`
  ]).trim()
  const directory = await mkdtemp(join(tmpdir(), 'comfy-code-quality-'))
  try {
    const diffFile = join(directory, 'changes.diff')
    await writeFile(
      diffFile,
      git(['diff', '--no-ext-diff', '--unified=0', '--relative', base, '--'])
    )
    return run('fallow', [
      'audit',
      ...args,
      '--changed-since',
      base,
      '--diff-file',
      diffFile,
      ...(json ? ['--format', 'json'] : [])
    ])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function lint(config: QualityConfig['lint'], extra: string[]): number {
  if (config.oxlint) {
    const status = run('oxlint', [...config.oxlint, ...extra])
    if (status !== 0) return status
  }
  return run('eslint', [...config.eslint, ...extra])
}

function isTool(value: string): value is keyof typeof binaries {
  return Object.hasOwn(binaries, value)
}

function format(
  config: QualityConfig['format'],
  check: boolean,
  paths: string[]
): number {
  return run(config.engine, [
    ...(config.args ?? []),
    check ? '--check' : '--write',
    ...paths
  ])
}
