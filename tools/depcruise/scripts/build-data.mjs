// Turns the output of cruise.mjs (and open-prs.mjs, when present) into the
// page's data files:
//   data/timeline.json  per-commit stats, knots and module deltas, plus the
//                       same for every open pull request
//   data/graph.json     module positions and knot membership per state
//   data/data.js        both of the above as window.GORDIAN, for file:// use
//
//   node scripts/build-data.mjs <workDir>
//
// Needs Graphviz (`sfdp`) on PATH for the layout.
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const work = resolve(process.argv[2] ?? '.')
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')
const log = (...parts) => process.stdout.write(`${parts.join(' ')}\n`)
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const architectureOf = (sha) => {
  const file = join(work, 'architecture', `${sha}.json`)
  if (!existsSync(file)) return null
  const measured = readJson(file)
  delete measured.sha
  return measured
}

const stepsDir = join(work, 'steps')
const steps = readdirSync(stepsDir)
  .filter((f) => f.endsWith('.json'))
  .sort(byText)
  .map((f) => readJson(join(stepsDir, f)))
const LAST = steps.length - 1

const NOT_IN_KNOT = -1
const NO_SUCH_FILE = -2

const strip = (f) => f.replace(/^src\//, '')
const commonDir = (files) => {
  const parts = files.map((f) => f.split('/').slice(0, -1))
  const out = []
  for (let i = 0; i < parts[0].length; i++) {
    if (!parts.every((p) => p[i] === parts[0][i])) break
    out.push(parts[0][i])
  }
  return out.join('/')
}
const area = (f) => {
  const p = f.split('/')
  if (p[1] === 'lib') return `lib/${p[2]}`
  return p.length > 2 ? p[1] : '(root)'
}
const dominantArea = (files) => {
  const tally = {}
  for (const f of files) tally[area(f)] = (tally[area(f)] ?? 0) + 1
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]
}

// Every analysed tree is a state. States 0..LAST are the commits on main;
// later ones are open pull request heads and the main commits they fork from.
// `parent` is the state a state is compared against; `namedAfter`, when it
// differs, is the state its knots take their ids from.
const states = steps.map((step, s) => ({
  ...step,
  kind: 'commit',
  parent: s === 0 ? null : s - 1
}))
const stateOfSha = new Map(states.map((state, s) => [state.sha, s]))

const prFile = join(work, 'open-prs.json')
const open = existsSync(prFile) ? readJson(prFile) : { prs: [] }
const loadState = (sha) => readJson(join(work, 'states', `${sha}.json`))
const addState = (sha, extra) => {
  if (stateOfSha.has(sha)) return stateOfSha.get(sha)
  states.push({ ...loadState(sha), ...extra })
  stateOfSha.set(sha, states.length - 1)
  return states.length - 1
}

const prByHeadRef = new Map(open.prs.map((pr) => [pr.headRefName, pr]))
const placed = new Set()
function placePr(pr) {
  if (placed.has(pr.number)) return
  placed.add(pr.number)
  const parentPr = prByHeadRef.get(pr.baseRefName)
  if (parentPr) placePr(parentPr)
  pr.parentPr = parentPr?.number ?? null
  pr.depth = parentPr ? parentPr.depth + 1 : 0
  pr.baseState = addState(pr.mergeBase, { kind: 'base', parent: LAST })
  pr.state = addState(pr.headRefOid, {
    kind: 'pr',
    pr: pr.number,
    subject: pr.title,
    parent: parentPr && pr.containsParentHead ? parentPr.state : pr.baseState,
    namedAfter: parentPr && pr.containsParentHead ? parentPr.state : LAST
  })
}
open.prs.sort((a, b) => a.number - b.number).forEach(placePr)

// Knot identity across states: a knot keeps the id of the knot in the parent
// state it shares the most modules with; when a knot splits, the largest
// piece keeps the id and the others get new ids that record their parent.
const lineage = []
const memberships = []
states.forEach((state, s) => {
  const namedAfter = state.namedAfter ?? state.parent
  const prev = namedAfter === null ? null : memberships[namedAfter]
  const claims = state.knots.map((knot) => {
    const overlap = new Map()
    if (prev) {
      for (const f of knot) {
        const id = prev.get(f)
        if (id !== undefined) overlap.set(id, (overlap.get(id) ?? 0) + 1)
      }
    }
    const best = [...overlap].sort((a, b) => b[1] - a[1]).at(0)
    return { from: best?.[0] ?? null, shared: best?.[1] ?? 0 }
  })
  const winner = new Map()
  for (const c of claims) {
    if (c.from === null) continue
    const cur = winner.get(c.from)
    if (!cur || c.shared > cur.shared) winner.set(c.from, c)
  }
  state.knotIds = claims.map((c) => {
    if (c.from !== null && winner.get(c.from) === c) return c.from
    const id = lineage.length
    lineage.push({ id, parent: c.from, bornAt: s, peak: 0, peakFiles: [] })
    return id
  })
  const member = new Map()
  state.knots.forEach((knot, k) => {
    const entry = lineage[state.knotIds[k]]
    if (s <= LAST) entry.lastOnMain = s
    if (knot.length > entry.peak) {
      entry.peak = knot.length
      entry.peakFiles = knot
    }
    for (const f of knot) member.set(f, state.knotIds[k])
  })
  memberships.push(member)
})

const mainId = states[0].knotIds[0]
const secondId = lineage
  .filter((k) => k.id !== mainId)
  .sort((a, b) => b.peak - a.peak)[0]?.id
const rootOf = (id) => {
  let cur = lineage[id]
  while (cur.parent !== null) cur = lineage[cur.parent]
  return cur.id
}
for (const k of lineage) {
  k.role = k.id === mainId ? 'main' : k.id === secondId ? 'second' : 'other'
  k.fromMain = rootOf(k.id) === mainId
  const dir = strip(commonDir(k.peakFiles))
  k.label = dir && dir !== 'src' ? dir : strip(dominantArea(k.peakFiles))
  if (k.lastOnMain !== undefined && k.lastOnMain < LAST)
    k.untangledAt = k.lastOnMain + 1
  delete k.peakFiles
  delete k.lastOnMain
}

const existing = states.map((state) => new Set(state.modules))
const sizeOf = (s, id) => {
  const k = states[s].knotIds.indexOf(id)
  return k < 0 ? 0 : states[s].knots[k].length
}

const described = states.map((state, s) => {
  const member = memberships[s]
  const delta = { freed: [], entangled: [], splits: [] }
  if (state.parent !== null) {
    const prevMember = memberships[state.parent]
    for (const f of prevMember.keys()) {
      if (!member.has(f) && existing[s].has(f)) delta.freed.push(strip(f))
    }
    for (const f of member.keys()) {
      if (!prevMember.has(f)) delta.entangled.push(strip(f))
    }
    const born = state.knotIds.filter(
      (id) => lineage[id].bornAt === s && lineage[id].parent !== null
    )
    for (const parent of new Set(born.map((id) => lineage[id].parent))) {
      delta.splits.push({
        from: parent,
        into: born.filter((id) => lineage[id].parent === parent)
      })
    }
    delta.freed.sort(byText)
    delta.entangled.sort(byText)
  }
  return {
    index: s,
    kind: state.kind,
    parent: state.parent,
    sha: state.sha,
    short: state.short,
    date: state.date,
    subject: state.subject,
    pr: state.pr,
    ...(state.kind === 'commit' ? { fe3037: state.fe3037 } : {}),
    stats: {
      modules: state.modules.length,
      imports: state.edges,
      modulesInKnots: member.size,
      largestKnot: state.knots[0]?.length ?? 0,
      mainKnot: sizeOf(s, mainId),
      secondKnot: secondId === undefined ? 0 : sizeOf(s, secondId),
      knotCount: state.knots.length,
      importsInKnots: state.knotEdges.length,
      noCircularWarnings: state.warnings
    },
    knots: state.knots.map((knot, k) => ({
      id: state.knotIds[k],
      size: knot.length
    })),
    delta,
    architecture: architectureOf(state.sha)
  }
})

const timeline = {
  repo: 'Comfy-Org/ComfyUI_frontend',
  issue: 'FE-3037',
  tool: 'dependency-cruiser, repo .dependency-cruiser.json, `depcruise src`',
  base: steps[0].sha,
  head: steps[LAST].sha,
  notes: [
    'A knot is a strongly connected component of the src/ module graph with more than one module.',
    'Step 0 is the parent of the first FE-3037 commit; every later step is one commit on main.',
    'Knot ids are stable across states. When a knot splits, the largest piece keeps the id.',
    'Paths in delta lists are relative to src/.',
    'openPrs.states continue the step indexes: each is the tree at a pull request head (kind "pr") or at the main commit a stack forks from (kind "base"). Their delta is against `parent`, the state of the pull request below them in the stack.',
    'A pull request head is analysed as pushed, not merged into current main; behindMain says how stale its base is.',
    'containsParentHead false means the pull request below was rebased without this one; its delta is then its whole branch against the main commit it forks from.',
    'architecture is the domain census from tools/architecture (scripts/census.mjs), null when not measured. status "no-records" means the tree has no domain records yet. A domain is ready to extract when every entry in its checks is true; see DOMAINS.md.'
  ],
  knots: lineage,
  steps: described.slice(0, steps.length),
  openPrs: {
    label: open.label ?? null,
    fetchedAt: open.fetchedAt ?? null,
    main: open.main ?? null,
    states: described.slice(steps.length),
    prs: open.prs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      url: pr.url,
      author: pr.author,
      isDraft: pr.isDraft,
      mergeable: pr.mergeable,
      reviewDecision: pr.reviewDecision || null,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
      baseRefName: pr.baseRefName,
      headRefName: pr.headRefName,
      head: pr.headRefOid,
      mergeBase: pr.mergeBase,
      behindMain: pr.behindMain,
      parentPr: pr.parentPr,
      containsParentHead: pr.containsParentHead,
      depth: pr.depth,
      state: pr.state,
      baseState: pr.baseState
    }))
  }
}

// Map: every module that was ever part of the main knot or a knot split off it.
const mapFiles = new Set()
memberships.forEach((member) => {
  for (const [f, id] of member) if (lineage[id].fromMain) mapFiles.add(f)
})
const files = [...mapFiles].sort(byText)
const fileIndex = new Map(files.map((f, i) => [f, i]))

const edgeStates = new Map()
states.forEach((state, s) => {
  for (const [a, b] of state.knotEdges) {
    if (!fileIndex.has(a) || !fileIndex.has(b)) continue
    const key = a < b ? `${a}|${b}` : `${b}|${a}`
    let seen = edgeStates.get(key)
    if (!seen) edgeStates.set(key, (seen = []))
    if (seen[seen.length - 1] !== s) seen.push(s)
  }
})
const toRanges = (list) => {
  const out = []
  for (const s of list) {
    const last = out.at(-1)
    if (last && last[1] === s - 1) last[1] = s
    else out.push([s, s])
  }
  return out
}

const dot = ['graph G {', 'node [shape=point];']
for (const f of files) dot.push(`"${f}";`)
for (const key of edgeStates.keys()) {
  const [a, b] = key.split('|')
  dot.push(`"${a}" -- "${b}";`)
}
dot.push('}')
const layout = spawnSync('sfdp', ['-Tplain'], {
  input: dot.join('\n'),
  encoding: 'utf8',
  maxBuffer: 1 << 28
})
if (!layout.stdout) {
  console.error('sfdp produced no layout:', layout.error ?? layout.stderr)
  process.exit(1)
}
const pos = new Map()
for (const line of layout.stdout.split(/\r?\n/)) {
  const n = line.match(/^node "?([^" ]+)"? (\S+) (\S+)/)
  if (n) pos.set(n[1], [Number(n[2]), Number(n[3])])
}
const xs = [...pos.values()].map((p) => p[0])
const ys = [...pos.values()].map((p) => p[1])
const x0 = Math.min(...xs)
const y0 = Math.min(...ys)
const width = Math.max(...xs) - x0
const height = Math.max(...ys) - y0
const round = (n) => Math.round(n * 10000) / 10000

const graph = {
  notes: [
    'x and y are 0..1 layout coordinates, y pointing down.',
    'states is a list of [fromState, knotId] changes over the state indexes of timeline.json; -1 is not in a knot, -2 is file absent.',
    'edges are [nodeIndex, nodeIndex, [[firstState, lastState], ...]] for imports inside one knot.'
  ],
  aspect: round(height / width),
  nodes: files.map((f) => {
    const changes = []
    states.forEach((_, s) => {
      const value =
        memberships[s].get(f) ??
        (existing[s].has(f) ? NOT_IN_KNOT : NO_SUCH_FILE)
      if (changes[changes.length - 1]?.[1] !== value) changes.push([s, value])
    })
    const [x, y] = pos.get(f)
    return {
      path: strip(f),
      x: round((x - x0) / width),
      y: round(1 - (y - y0) / height),
      states: changes
    }
  }),
  edges: [...edgeStates].map(([key, list]) => {
    const [a, b] = key.split('|')
    return [fileIndex.get(a), fileIndex.get(b), toRanges(list)]
  })
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'timeline.json'), JSON.stringify(timeline, null, 2))
writeFileSync(join(outDir, 'graph.json'), JSON.stringify(graph))
writeFileSync(
  join(outDir, 'data.js'),
  `window.GORDIAN = ${JSON.stringify({ timeline, graph })}\n`
)

const row = (s, tag, text) => {
  const d = s.delta
  log(
    String(s.index).padStart(3),
    s.short,
    tag.padEnd(7),
    String(s.stats.modulesInKnots).padStart(5),
    String(s.stats.mainKnot).padStart(4),
    String(s.stats.secondKnot).padStart(4),
    `-${d.freed.length} +${d.entangled.length}`.padEnd(10),
    '|',
    text.slice(0, 60)
  )
}
for (const s of timeline.steps) row(s, s.fe3037 ? 'FE' : '', s.subject)
for (const pr of timeline.openPrs.prs) {
  row(
    described[pr.state],
    `#${pr.number}`,
    `${'  '.repeat(pr.depth)}${pr.title} [base ${described[pr.baseState].short}, behind ${pr.behindMain}]`
  )
}
