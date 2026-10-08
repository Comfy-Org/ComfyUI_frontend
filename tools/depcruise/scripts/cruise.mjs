// Cruises every commit in <base>..<head> (plus <base> itself) with
// dependency-cruiser and writes one reduced JSON per commit to <work>/steps.
//
//   node scripts/cruise.mjs <base> <head> <workDir> [concurrency]
//   node scripts/cruise.mjs --shas <sha,sha,...> <workDir> [concurrency]
//
// The second form writes <work>/states/<sha>.json per listed commit; it is
// used for open pull request heads.
//
// Run from the repo root. Each commit is extracted with `git archive`, so the
// working tree is never touched. Finished steps are skipped on re-run.
import { execFileSync, spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join, resolve } from 'node:path'

const [, , base, head, workArg, concArg] = process.argv
if (!base || !head || !workArg) {
  console.error('usage: cruise.mjs <base> <head> <workDir> [concurrency]')
  process.exit(1)
}
const repo = process.cwd()
const work = resolve(workArg)
const concurrency = Number(concArg ?? 4)
const depcruise = join(
  repo,
  'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs'
)
const config = join(repo, '.dependency-cruiser.json')
const ARCHIVE_PATHS = ['src', 'tsconfig.json', 'packages/shared-frontend-utils']

const log = (...parts) => process.stdout.write(`${parts.join(' ')}\n`)
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

const git = (...args) =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()

const listed = base === '--shas'
const outDir = join(work, listed ? 'states' : 'steps')
const shas = listed
  ? head.split(',').map((sha) => git('rev-parse', sha))
  : [
      git('rev-parse', base),
      ...git('rev-list', '--reverse', `${base}..${head}`).split('\n')
    ]
mkdirSync(outDir, { recursive: true })

function meta(sha, index) {
  const [short, date, subject, body] = git(
    'log',
    '-1',
    '--format=%h%x1f%aI%x1f%s%x1f%b',
    sha
  ).split('\x1f')
  const pr = subject.match(/\(#(\d+)\)\s*$/)
  return {
    index,
    sha,
    short,
    date,
    subject: subject.replace(/\s*\(#\d+\)\s*$/, ''),
    pr: pr ? Number(pr[1]) : null,
    fe3037: /FE-3037/i.test(`${subject}\n${body}`)
  }
}

function run(cmd, args, cwd) {
  return new Promise((ok, fail) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    child.stderr.on('data', (d) => (err += d))
    child.on('error', fail)
    child.on('close', (code) =>
      code === 0 ? ok() : fail(new Error(`${cmd} exited ${code}: ${err}`))
    )
  })
}

// Tarjan's strongly connected components, iterative.
function findKnots(adj) {
  let counter = 0
  const idx = new Map()
  const low = new Map()
  const onStack = new Set()
  const stack = []
  const out = []
  for (const root of adj.keys()) {
    if (idx.has(root)) continue
    const frames = [[root, 0]]
    while (frames.length) {
      const frame = frames[frames.length - 1]
      const [v, i] = frame
      if (i === 0) {
        idx.set(v, counter)
        low.set(v, counter++)
        stack.push(v)
        onStack.add(v)
      }
      const next = adj.get(v)
      if (i < next.length) {
        frame[1]++
        const w = next[i]
        if (!idx.has(w)) frames.push([w, 0])
        else if (onStack.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)))
        continue
      }
      frames.pop()
      if (frames.length) {
        const parent = frames[frames.length - 1][0]
        low.set(parent, Math.min(low.get(parent), low.get(v)))
      }
      if (low.get(v) !== idx.get(v)) continue
      const knot = []
      let w
      do {
        w = stack.pop()
        onStack.delete(w)
        knot.push(w)
      } while (w !== v)
      if (knot.length > 1) out.push(knot.sort(byText))
    }
  }
  return out.sort((a, b) => b.length - a.length)
}

function reduce(cruiseFile) {
  const { modules, summary } = JSON.parse(readFileSync(cruiseFile, 'utf8'))
  const local = modules.filter((m) => m.source.startsWith('src/'))
  const ids = new Set(local.map((m) => m.source))
  const adj = new Map(
    local.map((m) => [
      m.source,
      [
        ...new Set(
          m.dependencies.map((d) => d.resolved).filter((r) => ids.has(r))
        )
      ]
    ])
  )
  const knots = findKnots(adj)
  const knotOf = new Map()
  knots.forEach((k, i) => k.forEach((f) => knotOf.set(f, i)))
  const knotEdges = []
  let edges = 0
  for (const [from, tos] of adj) {
    edges += tos.length
    for (const to of tos) {
      if (knotOf.has(from) && knotOf.get(from) === knotOf.get(to))
        knotEdges.push([from, to])
    }
  }
  return {
    modules: [...ids].sort(byText),
    edges,
    warnings: summary.violations.filter((v) => v.rule.name === 'no-circular')
      .length,
    knots,
    knotEdges
  }
}

async function cruise(sha, index) {
  const out = join(
    outDir,
    listed ? `${sha}.json` : `${String(index).padStart(3, '0')}.json`
  )
  if (existsSync(out)) return
  const tree = join(work, `tree-${index}`)
  rmSync(tree, { recursive: true, force: true })
  mkdirSync(tree, { recursive: true })
  const tar = join(work, `tree-${index}.tar`)
  const paths = ARCHIVE_PATHS.filter((p) => {
    try {
      git('cat-file', '-e', `${sha}:${p}`)
      return true
    } catch {
      return false
    }
  })
  await run('git', ['archive', '--format=tar', '-o', tar, sha, ...paths], repo)
  await run('tar', ['-xf', tar, '-C', tree], repo)
  const cruiseFile = join(work, `cruise-${index}.json`)
  await run(
    process.execPath,
    [depcruise, 'src', '--config', config, '-T', 'json', '-f', cruiseFile],
    tree
  )
  writeFileSync(
    out,
    JSON.stringify({ ...meta(sha, index), ...reduce(cruiseFile) })
  )
  rmSync(tree, { recursive: true, force: true })
  rmSync(tar, { force: true })
  rmSync(cruiseFile, { force: true })
  log(`done ${index + 1}/${shas.length} ${sha.slice(0, 10)}`)
}

const queue = shas.map((sha, index) => () => cruise(sha, index))
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (queue.length) await queue.shift()()
  })
)
log('all written to', outDir)
