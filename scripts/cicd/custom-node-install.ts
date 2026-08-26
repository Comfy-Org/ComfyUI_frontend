import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface ShardPack {
  pack: string
  ref: string
}

export type DeployRef =
  | { kind: 'git'; repository: string; sha: string }
  | { kind: 'registry'; id: string; version: string }

const PACK_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+_-]*$/
const GITHUB_PATTERN =
  /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/
const SHA_PATTERN = /^[0-9a-f]{40}$/

export function parseShardRows(value: string): ShardPack[] {
  const rows = value
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const separator = line.indexOf('\t')
      if (separator < 1 || separator === line.length - 1)
        throw new Error(`invalid shard row: ${line}`)
      const pack = line.slice(0, separator)
      const ref = line.slice(separator + 1)
      if (!PACK_PATTERN.test(pack))
        throw new Error(`unsafe pack name: '${pack}'`)
      return { pack, ref }
    })
  if (rows.length === 0) throw new Error('shard owns no packs')
  return rows
}

export function parseDeployRef(value: string): DeployRef {
  const separator = value.lastIndexOf('@')
  if (separator < 1 || separator === value.length - 1)
    throw new Error(`deployRef must include an identity and version: ${value}`)
  const identity = value.slice(0, separator)
  const version = value.slice(separator + 1)
  if (identity.startsWith('http://') || identity.startsWith('https://')) {
    if (!GITHUB_PATTERN.test(identity))
      throw new Error(
        `deployRef repo must be an https://github.com/<owner>/<name> URL: ${identity}`
      )
    if (!SHA_PATTERN.test(version))
      throw new Error(`deployRef must pin a full commit SHA: ${version}`)
    return { kind: 'git', repository: identity, sha: version }
  }
  if (!PACK_PATTERN.test(identity) || !VERSION_PATTERN.test(version))
    throw new Error(`deployRef must be <registry-id>@<version>: ${value}`)
  return { kind: 'registry', id: identity, version }
}

export function registryArtifactUrl(value: unknown): string {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !('downloadUrl' in value) ||
    typeof value.downloadUrl !== 'string'
  )
    throw new Error('registry version has no downloadUrl')
  const url = new URL(value.downloadUrl)
  if (url.origin !== 'https://cdn.comfy.org')
    throw new Error(`registry downloadUrl is not on cdn.comfy.org: ${url}`)
  return url.toString()
}

export function torchConstraints(value: string): string {
  return value
    .split('\n')
    .filter((line) => /^(torch|torchvision|torchaudio)==/i.test(line))
    .join('\n')
}

function run(command: string, args: string[], cwd?: string): void {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}`)
}

function succeeds(command: string, args: string[], cwd?: string): boolean {
  return spawnSync(command, args, { cwd, stdio: 'inherit' }).status === 0
}

function output(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}`)
  return result.stdout
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function fetchWithRetries(
  url: string,
  attempts: number,
  delayMs: number,
  timeoutMs: number
): Promise<Response> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs)
      })
      if (response.ok) return response
      lastError = new Error(`${url} returned ${response.status}`)
    } catch (error) {
      lastError = error
    }
    if (attempt < attempts) await pause(delayMs)
  }
  throw lastError
}

async function fetchCommit(target: string, sha: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (succeeds('git', ['fetch', '--depth', '1', 'origin', sha], target))
      return
    if (attempt < 3) await pause(attempt * 2_000)
  }
  throw new Error(`pinned commit ${sha} does not exist upstream`)
}

async function installGitPack(
  target: string,
  ref: Extract<DeployRef, { kind: 'git' }>
): Promise<void> {
  run('git', ['init', '-q', '-b', 'main', target])
  run('git', ['remote', 'add', 'origin', ref.repository], target)
  await fetchCommit(target, ref.sha)
  run('git', ['checkout', '-q', 'FETCH_HEAD'], target)
}

async function installRegistryPack(
  target: string,
  ref: Extract<DeployRef, { kind: 'registry' }>
): Promise<void> {
  const metadata = await fetchWithRetries(
    `https://api.comfy.org/nodes/${ref.id}/versions/${ref.version}`,
    3,
    2_000,
    30_000
  )
  const url = registryArtifactUrl(await metadata.json())
  const artifact = await fetchWithRetries(url, 6, 5_000, 60_000)
  const temp = mkdtempSync(join(tmpdir(), 'custom-node-pack-'))
  const zipPath = join(temp, 'pack.zip')
  try {
    writeFileSync(zipPath, Buffer.from(await artifact.arrayBuffer()))
    run('unzip', ['-q', zipPath, '-d', target])
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

function restoreCache(target: string, cache: string, ref: string): boolean {
  const marker = `${cache}.ref`
  if (!existsSync(marker) || readFileSync(marker, 'utf8') !== ref) return false
  cpSync(cache, target, { recursive: true })
  return true
}

export function refreshSourceCache(
  target: string,
  cache: string,
  ref: string
): void {
  rmSync(cache, { recursive: true, force: true })
  rmSync(`${cache}.ref`, { force: true })
  mkdirSync(dirname(cache), { recursive: true })
  cpSync(target, cache, { recursive: true })
  rmSync(join(cache, '.git'), { recursive: true, force: true })
  writeFileSync(`${cache}.ref`, ref)
}

async function preparePack(entry: ShardPack): Promise<void> {
  const target = join('ComfyUI', 'custom_nodes', entry.pack)
  const cache = join(homedir(), '.cache', 'cn-packs', entry.pack)
  process.stdout.write(`::group::prepare ${entry.pack} (${entry.ref})\n`)
  try {
    if (!restoreCache(target, cache, entry.ref)) {
      const ref = parseDeployRef(entry.ref)
      if (ref.kind === 'git') await installGitPack(target, ref)
      else await installRegistryPack(target, ref)
      refreshSourceCache(target, cache, entry.ref)
    }
  } finally {
    process.stdout.write('::endgroup::\n')
  }
}

function installRequirements(entry: ShardPack, constraints: string): void {
  const target = join('ComfyUI', 'custom_nodes', entry.pack)
  process.stdout.write(`::group::requirements ${entry.pack} (${entry.ref})\n`)
  try {
    if (!existsSync(target)) throw new Error('prepared source is missing')
    const requirements = join(target, 'requirements.txt')
    if (
      existsSync(requirements) &&
      !succeeds('pip', ['install', '-r', requirements, '-c', constraints])
    )
      throw new Error('requirements failed to install')
  } finally {
    process.stdout.write('::endgroup::\n')
  }
}

function installPhase(value: string | undefined): 'prepare' | 'requirements' {
  if (value === '--prepare') return 'prepare'
  if (value === '--requirements') return 'requirements'
  throw new Error(
    'expected exactly one install phase: --prepare or --requirements'
  )
}

function pruneCache(entries: ShardPack[]): void {
  const root = join(homedir(), '.cache', 'cn-packs')
  if (!existsSync(root)) return
  const owned = new Set(entries.map(({ pack }) => pack))
  for (const entry of readdirSync(root)) {
    const pack = basename(entry, '.ref')
    if (!owned.has(pack))
      rmSync(join(root, entry), { recursive: true, force: true })
  }
}

export async function main(): Promise<void> {
  const rows = parseShardRows(output('pnpm', ['--silent', 'custom-node-shard']))
  const phase = installPhase(process.argv[2])
  const constraints = join(tmpdir(), 'torch-constraints.txt')
  if (phase === 'requirements')
    writeFileSync(constraints, torchConstraints(output('pip', ['freeze'])))
  process.stdout.write(
    `shard ${process.env.CUSTOM_NODES_SHARD ?? '?'} owns ${rows.length} pack(s)\n`
  )
  const failed: string[] = []
  for (const row of rows) {
    try {
      if (phase === 'prepare') await preparePack(row)
      else installRequirements(row, constraints)
    } catch (error) {
      rmSync(join('ComfyUI', 'custom_nodes', row.pack), {
        recursive: true,
        force: true
      })
      console.error(
        `::error::${row.pack}: ${error instanceof Error ? error.message : String(error)}`
      )
      failed.push(row.pack)
    }
  }
  if (phase === 'prepare') pruneCache(rows)
  if (failed.length > 0)
    throw new Error(
      `${failed.length} pack(s) failed to install: ${failed.join(', ')}`
    )
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly)
  void main().catch((error: unknown) => {
    console.error(
      `::error::${error instanceof Error ? error.message : String(error)}`
    )
    process.exitCode = 1
  })
