/**
 * Points a Comfy Desktop local install at a frontend PR's CI build, so QA can
 * test a fix as soon as its PR builds. Needs the GitHub CLI (`gh auth login`).
 *
 *   pnpm qa:desktop-frontend use <pr-number|branch> [--install <id|name>] [--dev]
 *   pnpm qa:desktop-frontend reset [--install <id|name>] [--dev]
 *   pnpm qa:desktop-frontend list [--dev]
 *   pnpm qa:desktop-frontend id [--dev]   (installation id for the ops-flag allowlist)
 *
 * Quit the install in Desktop before `use`/`reset`; launch it again afterwards.
 * `--dev` targets a Desktop dev build (`comfyui-desktop-2`) instead of the app.
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'

import type { Installation } from './qa-desktop-frontend-args'
import {
  installationsPath,
  pickBuildRun,
  pickInstall,
  withFrontendRoot,
  withoutFrontendOverride
} from './qa-desktop-frontend-args'

const REPO = 'Comfy-Org/ComfyUI_frontend'
const WORKFLOW = 'ci-tests-e2e.yaml'
// Desktop 2.0 local installs run the localhost build; `frontend-dist-desktop`
// is the legacy Desktop v1 distribution.
const ARTIFACT = 'frontend-dist'

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

function hasLiveArtifact(runId: number): boolean {
  const artifacts: { expired: boolean }[] = JSON.parse(
    gh([
      'api',
      `repos/${REPO}/actions/runs/${runId}/artifacts?name=${ARTIFACT}`,
      '-q',
      '.artifacts'
    ])
  )
  return artifacts.some((a) => !a.expired)
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
  return pickBuildRun(
    runs.map((r) => ({ ...r, hasArtifact: hasLiveArtifact(r.databaseId) })),
    sha,
    (runId) => `gh run rerun ${runId} --repo ${REPO}`
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
      `No Desktop installations found at ${file}. Is Comfy Desktop installed?`
    )
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** Backs the file up, then replaces it atomically so Desktop never reads half of it. */
function save(file: string, installs: Installation[]): void {
  writeFileSync(`${file}.qa-backup`, readFileSync(file))
  const tmp = `${file}.qa-tmp`
  writeFileSync(tmp, `${JSON.stringify(installs, null, 2)}\n`)
  renameSync(tmp, file)
}

function updateInstall(
  file: string,
  wanted: string | undefined,
  change: (launchArgs: string) => string
): Installation {
  const installs = readInstallations(file)
  const install = pickInstall(installs, wanted)
  install.launchArgs = change(install.launchArgs ?? '')
  save(file, installs)
  return install
}

interface Context {
  file: string
  ref?: string
  install?: string
}

const COMMANDS: Partial<Record<string, (ctx: Context) => void>> = {
  list: ({ file }) => {
    for (const i of readInstallations(file)) {
      console.log(`${i.id}  ${i.name}  [${i.sourceId}]  ${i.launchArgs ?? ''}`)
    }
  },
  id: ({ file }) => {
    const idFile = join(dirname(file), 'device-id.txt')
    if (!existsSync(idFile)) {
      throw new Error(
        `No installation id at ${idFile}. Launch Comfy Desktop once first.`
      )
    }
    console.log(readFileSync(idFile, 'utf8').trim())
  },
  use: ({ file, ref, install }) => {
    if (!ref) throw new Error('Pass a frontend PR number or branch.')
    const { sha, label } = resolveCommit(ref)
    const dir = download(findBuild(sha), sha, label)
    const changed = updateInstall(file, install, (args) =>
      withFrontendRoot(args, dir)
    )
    console.log(
      `"${changed.name}" now loads ${label} (${sha.slice(0, 7)}) from ${dir}.\nLaunch it in Comfy Desktop to test.`
    )
  },
  reset: ({ file, install }) => {
    const changed = updateInstall(file, install, withoutFrontendOverride)
    console.log(`"${changed.name}" is back on its bundled frontend.`)
  }
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
  const run = COMMANDS[command]
  if (!run) {
    console.log(
      'Usage: pnpm qa:desktop-frontend use <pr|branch> | reset | list | id  [--install <id|name>] [--dev]'
    )
    process.exitCode = 1
    return
  }
  run({
    file: installationsPath(process.platform, process.env, values.dev),
    ref,
    install: values.install
  })
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
