#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import packData from '../../browser_tests/fixtures/data/nodes2AcceptancePacks.json' with { type: 'json' }

type PinnedPack = (typeof packData.packs)[number]

export type InitStub =
  | { reason: string; source: string[] }
  | { reason: string; replace: { from: string; to: string } }

const USAGE =
  'usage: pnpm exec tsx scripts/nodes2-acceptance/setupPacks.ts --backend <dir> --python <ComfyUI python>'

/** The `__init__.py` a pack runs under test: the stub's source, or the original with the stub's replacement applied. */
export function applyInitStub(original: string, stub: InitStub): string {
  if ('source' in stub) return `${stub.source.join('\n')}\n`
  if (original.includes(stub.replace.from))
    return original.replace(stub.replace.from, stub.replace.to)
  if (original.includes(stub.replace.to)) return original
  throw new Error(
    `__init__.py does not contain ${JSON.stringify(stub.replace.from)}`
  )
}

export const extraPythonModules = (
  packs: readonly { extraPythonModules: readonly string[] }[]
) => [...new Set(packs.flatMap((pack) => pack.extraPythonModules))]

const git = (directory: string, ...args: string[]) =>
  execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim()

function headCommit(directory: string) {
  try {
    return execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return ''
  }
}

function checkoutPinned(pack: PinnedPack, directory: string) {
  if (!existsSync(join(directory, '.git'))) {
    mkdirSync(directory, { recursive: true })
    git(directory, 'init', '-q')
    git(directory, 'remote', 'add', 'origin', pack.repo)
  }
  if (headCommit(directory) === pack.commit) return
  git(directory, 'fetch', '-q', '--depth', '1', 'origin', pack.commit)
  git(directory, 'checkout', '-q', '--force', 'FETCH_HEAD')
}

function writeInitStub(pack: PinnedPack, directory: string) {
  const stub: InitStub | null = pack.initStub
  if (!stub) return
  const init = join(directory, '__init__.py')
  writeFileSync(init, applyInitStub(readFileSync(init, 'utf8'), stub))
}

function installPythonModules(python: string, overlay: string) {
  const modules = extraPythonModules(packData.packs)
  if (modules.length === 0) return
  mkdirSync(overlay, { recursive: true })
  execFileSync(
    python,
    [
      '-m',
      'pip',
      'install',
      '--quiet',
      '--no-deps',
      '--target',
      overlay,
      ...modules
    ],
    { stdio: 'inherit' }
  )
}

function setUp(backend: string, python: string) {
  const customNodes = join(backend, 'custom_nodes')
  for (const pack of packData.packs) {
    const directory = join(customNodes, pack.directory)
    checkoutPinned(pack, directory)
    writeInitStub(pack, directory)
    const pinned = headCommit(directory) === pack.commit
    console.log(
      `${pinned ? 'ok  ' : 'FAIL'} ${pack.directory}@${pack.commit.slice(0, 10)}`
    )
    if (!pinned) process.exitCode = 1
  }
  installPythonModules(python, join(backend, 'python-overlay'))
  writeFileSync(
    join(backend, 'packs.txt'),
    `${packData.packs.map((pack) => pack.directory).join(' ')}\n`
  )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({
    options: { backend: { type: 'string' }, python: { type: 'string' } }
  })
  if (!values.backend || !values.python) {
    console.error(USAGE)
    process.exit(2)
  }
  setUp(resolve(values.backend), values.python)
}
