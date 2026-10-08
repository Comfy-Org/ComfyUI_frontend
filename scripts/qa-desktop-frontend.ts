/**
 * Points a Comfy Desktop local install at a frontend PR's CI build, so QA can
 * test a fix as soon as its PR builds. Needs the GitHub CLI (`gh auth login`).
 *
 *   pnpm qa:desktop-frontend use <pr-number|branch> [--install <id|name>] [--dev]
 *   pnpm qa:desktop-frontend reset [--install <id|name>] [--dev]
 *   pnpm qa:desktop-frontend list [--dev]
 *
 * Quit the install in Desktop before `use`/`reset`; launch it again afterwards.
 * `--dev` targets a Desktop dev build (`comfyui-desktop-2`) instead of the app.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import {
  installationsPath,
  withFrontendRoot,
  withoutFrontendOverride
} from './qa-desktop-frontend-args'

const REPO = 'Comfy-Org/ComfyUI_frontend'
const WORKFLOW = 'ci-tests-e2e.yaml'
const ARTIFACT = 'frontend-dist'

interface Installation {
  id: string
  name: string
  sourceId?: string
  launchArgs?: string
}

function gh(args: string[]): string {
  return execFileSync('gh', args, { encoding: 'utf8' }).trim()
}

function resolveCommit(ref: string): { sha: string; label: string } {
  if (/^\d+$/.test(ref)) {
    const sha = gh([
      'pr',
      'view',
      ref,
      '--repo',
      REPO,
      '--json',
      'headRefOid',
      '-q',
      '.headRefOid'
    ])
    return { sha, label: `pr-${ref}` }
  }
  const sha = gh(['api', `repos/${REPO}/commits/${ref}`, '-q', '.sha'])
  return { sha, label: ref.replace(/[^\w.-]+/g, '-') }
}

function findBuild(sha: string): number {
  const runs: { databaseId: number; status: string }[] = JSON.parse(
    gh([
      'run',
      'list',
      '--repo',
      REPO,
      '--workflow',
      WORKFLOW,
      '--commit',
      sha,
      '--json',
      'databaseId,status',
      '--limit',
      '10'
    ])
  )
  for (const run of runs) {
    const artifacts: { name: string; expired: boolean }[] = JSON.parse(
      gh([
        'api',
        `repos/${REPO}/actions/runs/${run.databaseId}/artifacts?name=${ARTIFACT}`,
        '-q',
        '.artifacts'
      ])
    )
    if (artifacts.some((a) => a.name === ARTIFACT && !a.expired)) {
      return run.databaseId
    }
  }
  const running = runs.find((r) => r.status !== 'completed')
  if (running) {
    throw new Error(
      `The CI build for ${sha.slice(0, 7)} is still running (run ${running.databaseId}). Try again when it finishes.`
    )
  }
  const last = runs.at(0)
  throw new Error(
    last
      ? `No ${ARTIFACT} artifact for ${sha.slice(0, 7)}; CI keeps it for one day. Rebuild it with: gh run rerun ${last.databaseId} --repo ${REPO}`
      : `No ${WORKFLOW} run found for ${sha.slice(0, 7)}.`
  )
}

function download(runId: number, sha: string, label: string): string {
  const dir = join(
    homedir(),
    '.comfy-qa',
    'frontends',
    `${label}-${sha.slice(0, 7)}`
  )
  if (!existsSync(join(dir, 'index.html'))) {
    mkdirSync(dir, { recursive: true })
    gh([
      'run',
      'download',
      String(runId),
      '--repo',
      REPO,
      '--name',
      ARTIFACT,
      '--dir',
      dir
    ])
  }
  if (!existsSync(join(dir, 'index.html'))) {
    throw new Error(`The downloaded build in ${dir} has no index.html.`)
  }
  return dir
}

function readInstallations(file: string): Installation[] {
  if (!existsSync(file)) {
    throw new Error(
      `No Desktop installations found at ${file}. Is Comfy Desktop installed${file.includes('comfyui-desktop-2') ? ' (dev build)' : ''}?`
    )
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}

function pickInstall(installs: Installation[], wanted?: string): Installation {
  const local = installs.filter(
    (i) => i.sourceId !== 'cloud' && i.sourceId !== 'remote'
  )
  const match = wanted
    ? local.filter((i) => i.id === wanted || i.name === wanted)
    : local
  if (match.length === 1) return match[0]
  const names = local.map((i) => `  ${i.id}  ${i.name}`).join('\n')
  throw new Error(
    `${match.length === 0 ? 'No matching' : 'More than one'} local install; pass --install <id|name>:\n${names}`
  )
}

function save(file: string, installs: Installation[]): void {
  writeFileSync(`${file}.qa-backup`, readFileSync(file))
  writeFileSync(file, `${JSON.stringify(installs, null, 2)}\n`)
}

function main(): void {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      install: { type: 'string' },
      dev: { type: 'boolean', default: false }
    }
  })
  const [command, ref] = positionals
  const file = installationsPath(process.platform, process.env, values.dev)

  if (command === 'list') {
    for (const i of readInstallations(file)) {
      console.log(`${i.id}  ${i.name}  [${i.sourceId}]  ${i.launchArgs ?? ''}`)
    }
    return
  }

  if (command === 'use' && ref) {
    const { sha, label } = resolveCommit(ref)
    const dir = download(findBuild(sha), sha, label)
    const installs = readInstallations(file)
    const install = pickInstall(installs, values.install)
    install.launchArgs = withFrontendRoot(install.launchArgs ?? '', dir)
    save(file, installs)
    console.log(
      `"${install.name}" now loads ${label} (${sha.slice(0, 7)}) from ${dir}.\nLaunch it in Comfy Desktop to test.`
    )
    return
  }

  if (command === 'reset') {
    const installs = readInstallations(file)
    const install = pickInstall(installs, values.install)
    install.launchArgs = withoutFrontendOverride(install.launchArgs ?? '')
    save(file, installs)
    console.log(`"${install.name}" is back on its bundled frontend.`)
    return
  }

  console.log(
    'Usage: pnpm qa:desktop-frontend use <pr|branch> | reset | list  [--install <id|name>] [--dev]'
  )
  process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
