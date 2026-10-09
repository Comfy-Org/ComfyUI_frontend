// Measures domain architecture progress for every state cruise.mjs and
// open-prs.mjs analysed, using the census in tools/architecture (#19768).
// Writes <work>/architecture/<sha>.json per commit.
//
//   node scripts/census.mjs <workDir> [toolRef]
//
// Every tree is measured with one pinned copy of the tool so the history is
// comparable: toolRef when given, otherwise the main or open pull request head
// whose tools/architecture changed most recently. A tree the pinned tool
// cannot load falls back to its own copy. Trees without domain records are
// recorded as such without running the tool. Finished commits are skipped on
// re-run.
import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const TOOL = 'tools/architecture/src/check.ts'
const RECORDS = 'docs/architecture/domains/records'
const ARCHIVE_PATHS = [
  'src',
  'docs/architecture',
  'packages',
  'tools/architecture',
  'CODEOWNERS',
  'tsconfig.json',
  'package.json'
]
const ROLES = [
  'domain',
  'application',
  'infrastructure',
  'presentation',
  'integration'
]
const UNCLASSIFIED = null

if (process.argv[2] === '--measure') {
  const [, , , tree, tool] = process.argv
  process.stdout.write(JSON.stringify(await measure(tree, tool)))
  process.exit(0)
}

const [, , workArg, toolArg] = process.argv
if (!workArg) {
  console.error('usage: census.mjs <workDir> [toolRef]')
  process.exit(1)
}
const repo = process.cwd()
const work = resolve(workArg)
const outDir = join(work, 'architecture')
const tsx = join(repo, 'node_modules/.bin/tsx')
const self = fileURLToPath(import.meta.url)
const log = (...parts) => process.stdout.write(`${parts.join(' ')}\n`)
const git = (...args) =>
  execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 1 << 28
  }).trim()
const has = (sha, path) => {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}:${path}`], {
      cwd: repo,
      stdio: 'ignore'
    })
    return true
  } catch {
    return false
  }
}
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

const stepShas = readdirSync(join(work, 'steps'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => readJson(join(work, 'steps', f)).sha)
const prFile = join(work, 'open-prs.json')
const open = existsSync(prFile) ? readJson(prFile) : { prs: [] }
const prShas = open.prs.flatMap((pr) => [pr.headRefOid, pr.mergeBase])
const shas = [...new Set([...stepShas, ...prShas])]

function pickTool() {
  if (toolArg) return git('rev-parse', toolArg)
  const candidates = [stepShas.at(-1), ...open.prs.map((pr) => pr.headRefOid)]
    .filter((sha) => has(sha, TOOL))
    .map((sha) => ({
      sha,
      changed: Number(git('log', '-1', '--format=%ct', sha, '--', TOOL))
    }))
    .sort((a, b) => b.changed - a.changed)
  return candidates[0]?.sha ?? null
}

const workspacePackages = (sha) =>
  git('ls-tree', '--name-only', `${sha}:packages`)
    .split('\n')
    .filter((name) => name && has(sha, `packages/${name}/package.json`))

const toolSha = pickTool()
mkdirSync(outDir, { recursive: true })
if (!existsSync(join(work, 'node_modules')))
  symlinkSync(join(repo, 'node_modules'), join(work, 'node_modules'))
let pinnedTool = null
if (toolSha) {
  const dir = join(work, `tool-${toolSha.slice(0, 10)}`)
  pinnedTool = join(dir, 'check.ts')
  if (!existsSync(pinnedTool)) {
    mkdirSync(dir, { recursive: true })
    writeFileSync(pinnedTool, git('show', `${toolSha}:${TOOL}`))
  }
  log('pinned tool', toolSha.slice(0, 10))
} else {
  log('no tools/architecture found on main or any open pull request head')
}

function runMeasure(tree, tool) {
  const result = spawnSync(tsx, [self, '--measure', tree, tool], {
    cwd: tree,
    encoding: 'utf8',
    maxBuffer: 1 << 28
  })
  if (result.status === 0) return { result: JSON.parse(result.stdout) }
  const lines = (result.stderr || result.stdout).trim().split('\n')
  return { error: lines.find((l) => /^\w*Error\b/.test(l)) ?? lines[0] }
}

for (const [index, sha] of shas.entries()) {
  const out = join(outDir, `${sha}.json`)
  if (existsSync(out)) continue
  const base = { sha, workspacePackages: workspacePackages(sha) }
  if (!has(sha, RECORDS) || !pinnedTool) {
    writeFileSync(out, JSON.stringify({ ...base, status: 'no-records' }))
    continue
  }
  const tree = join(work, `arch-tree-${index}`)
  rmSync(tree, { recursive: true, force: true })
  mkdirSync(tree, { recursive: true })
  const paths = ARCHIVE_PATHS.filter((p) => has(sha, p))
  const tar = join(work, `arch-tree-${index}.tar`)
  git('archive', '--format=tar', '-o', tar, sha, ...paths)
  execFileSync('tar', ['-xf', tar, '-C', tree])
  rmSync(tar, { force: true })
  symlinkSync(join(repo, 'node_modules'), join(tree, 'node_modules'))

  let measured = runMeasure(tree, pinnedTool)
  let tool = { sha: toolSha, own: false }
  if (measured.error && has(sha, TOOL)) {
    const fallback = runMeasure(tree, join(tree, TOOL))
    if (!fallback.error) {
      measured = fallback
      tool = { sha, own: true }
    }
  }
  writeFileSync(
    out,
    JSON.stringify(
      measured.error
        ? { ...base, status: 'failed', tool, error: measured.error }
        : { ...base, status: 'measured', tool, ...measured.result }
    )
  )
  rmSync(tree, { recursive: true, force: true })
  log(
    `${measured.error ? 'failed' : 'measured'} ${sha.slice(0, 10)}${measured.error ? `: ${measured.error}` : ''}`
  )
}
log('all written to', outDir)

// Runs inside tsx so the TypeScript tool can be imported directly.
async function measure(tree, tool) {
  const { loadArchitectureConfiguration, censusRepository } = await import(
    pathToFileURL(resolve(tool)).href
  )
  const { records } = loadArchitectureConfiguration(tree)
  const census = censusRepository(tree, records)

  const matches = (file, pattern) =>
    pattern.endsWith('/**')
      ? file.startsWith(pattern.slice(0, -2))
      : file === pattern
  const unclassified = new Set(
    census.violations
      .filter((v) => v.kind === 'unclassified-module')
      .map((v) => v.source)
  )
  const srcFiles = walk(join(tree, 'src'))
    .map((f) => f.slice(tree.length + 1).replaceAll('\\', '/'))
    .filter((f) => /\.(ts|tsx|vue)$/.test(f))
  const count = (list, pick) => {
    const tally = {}
    for (const item of list) {
      const key = pick(item)
      tally[key] = (tally[key] ?? 0) + 1
    }
    return tally
  }

  const domains = records.map((record) => {
    const files = srcFiles.filter((f) =>
      record.modules.some(({ path }) => matches(f, path))
    )
    const roleOf = (f) =>
      record.modules.find(({ path }) => matches(f, path))?.role
    const inside = census.edges.filter(
      (e) => e.sourceDomain === record.id && e.targetDomain === record.id
    )
    const inbound = census.edges.filter(
      (e) => e.targetDomain === record.id && e.sourceDomain !== record.id
    )
    const outbound = census.edges.filter(
      (e) => e.sourceDomain === record.id && e.targetDomain !== record.id
    )
    const deepImports = census.violations.filter(
      (v) =>
        v.kind === 'deep-import' &&
        v.fingerprint.startsWith(`deep-import:${record.id}:`)
    ).length
    const forbidden = census.edges.filter(
      (e) =>
        e.classification === 'forbidden' &&
        (e.sourceDomain === record.id || e.targetDomain === record.id)
    ).length
    const extracted =
      record.modules.length > 0 &&
      record.modules.every(({ path }) => path.startsWith('packages/'))
    const checks = {
      noDeepImports: deepImports === 0,
      noUnclassifiedDependencies: !outbound.some(
        (e) => e.targetDomain === undefined
      ),
      noForbiddenEdges: forbidden === 0,
      publicEntryPoint: record.publicEntryPoints.length > 0,
      enforced:
        record.enforcement.deepImports === 'error' &&
        record.enforcement.dependencies === 'error'
    }
    return {
      id: record.id,
      capability: record.capability,
      owners: record.owners,
      files: files.length,
      paths: files.map((f) => f.replace(/^src\//, '')),
      roles: Object.fromEntries(
        ROLES.map((role) => [
          role,
          files.filter((f) => roleOf(f) === role).length
        ]).filter(([, n]) => n > 0)
      ),
      publicEntryPoints: record.publicEntryPoints.length,
      enforcement: record.enforcement,
      imports: {
        inside: inside.length,
        inbound: inbound.length,
        inboundSources: new Set(inbound.map((e) => e.source)).size,
        outbound: outbound.length,
        outboundToUnclassified: outbound.filter(
          (e) => e.targetDomain === undefined
        ).length
      },
      deepImports,
      forbidden,
      checks,
      ready: Object.values(checks).every(Boolean),
      extracted
    }
  })

  const linkKey = (e) =>
    `${e.sourceDomain ?? UNCLASSIFIED}|${e.targetDomain ?? UNCLASSIFIED}`
  const links = new Map()
  for (const e of census.edges) {
    if (!e.sourceDomain && !e.targetDomain) continue
    if (e.sourceDomain === e.targetDomain) continue
    const key = linkKey(e)
    const link = links.get(key) ?? {
      from: e.sourceDomain ?? UNCLASSIFIED,
      to: e.targetDomain ?? UNCLASSIFIED,
      allowed: 0,
      legacy: 0,
      forbidden: 0
    }
    link[e.classification]++
    links.set(key, link)
  }

  const byClass = count(census.edges, (e) => e.classification)
  const byKind = count(census.violations, (v) => v.kind)
  return {
    totals: {
      sourceFiles: census.sourceFiles,
      classifiedFiles: census.sourceFiles - unclassified.size,
      domains: records.length,
      readyDomains: domains.filter((d) => d.ready).length,
      extractedDomains: domains.filter((d) => d.extracted).length,
      internalImports: census.resolvedInternalDeclarations,
      allowed: byClass.allowed ?? 0,
      legacy: byClass.legacy ?? 0,
      forbidden: byClass.forbidden ?? 0,
      deepImports: byKind['deep-import'] ?? 0,
      suppressions:
        (byKind['anonymous-suppression'] ?? 0) +
        (byKind['named-suppression'] ?? 0)
    },
    domains,
    links: [...links.values()]
  }
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  )
}
