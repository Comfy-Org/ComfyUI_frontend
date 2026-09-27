import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export type Graph = ReadonlyMap<string, ReadonlySet<string>>
export type Baseline = Readonly<Record<string, readonly string[]>>

type CruiseModule = {
  source: string
  dependencies: { resolved: string }[]
}

const BASELINE_PATH = '.import-cycles-baseline.json'
const SOURCE_PREFIX = 'src/'

export function graphFromCruise(modules: CruiseModule[]): Graph {
  const graph = new Map<string, Set<string>>()
  for (const module of modules) {
    if (!module.source.startsWith(SOURCE_PREFIX)) continue
    const targets = new Set<string>()
    for (const dependency of module.dependencies) {
      if (
        dependency.resolved.startsWith(SOURCE_PREFIX) &&
        dependency.resolved !== module.source
      ) {
        targets.add(dependency.resolved)
      }
    }
    graph.set(module.source, targets)
  }
  return graph
}

type TarjanState = {
  graph: Graph
  index: Map<string, number>
  lowLink: Map<string, number>
  onStack: Set<string>
  stack: string[]
  work: { node: string; successors: Iterator<string> }[]
  components: string[][]
}

function enter(state: TarjanState, node: string) {
  const order = state.index.size
  state.index.set(node, order)
  state.lowLink.set(node, order)
  state.stack.push(node)
  state.onStack.add(node)
  state.work.push({
    node,
    successors: (state.graph.get(node) ?? []).values()
  })
}

function lowerLowLink(state: TarjanState, node: string, candidate: number) {
  state.lowLink.set(node, Math.min(state.lowLink.get(node)!, candidate))
}

function leave(state: TarjanState, node: string) {
  const parent = state.work.at(-1)
  if (parent) lowerLowLink(state, parent.node, state.lowLink.get(node)!)
  if (state.lowLink.get(node) !== state.index.get(node)) return

  const component: string[] = []
  let member: string
  do {
    member = state.stack.pop()!
    state.onStack.delete(member)
    component.push(member)
  } while (member !== node)
  state.components.push(component.sort())
}

function exploreFrom(state: TarjanState, root: string) {
  enter(state, root)
  while (state.work.length > 0) {
    const frame = state.work.at(-1)!
    const next = frame.successors.next()
    if (next.done) {
      state.work.pop()
      leave(state, frame.node)
    } else if (!state.index.has(next.value)) {
      enter(state, next.value)
    } else if (state.onStack.has(next.value)) {
      lowerLowLink(state, frame.node, state.index.get(next.value)!)
    }
  }
}

export function stronglyConnectedComponents(graph: Graph): string[][] {
  const state: TarjanState = {
    graph,
    index: new Map(),
    lowLink: new Map(),
    onStack: new Set(),
    stack: [],
    work: [],
    components: []
  }
  for (const root of graph.keys()) {
    if (!state.index.has(root)) exploreFrom(state, root)
  }
  return state.components
}

export function cyclicEdges(graph: Graph): Baseline {
  const componentOf = new Map<string, number>()
  stronglyConnectedComponents(graph).forEach((component, id) => {
    for (const node of component) componentOf.set(node, id)
  })

  const edges: Record<string, string[]> = {}
  for (const from of [...graph.keys()].sort()) {
    const targets = [...(graph.get(from) ?? [])]
      .filter((to) => componentOf.get(to) === componentOf.get(from))
      .sort()
    if (targets.length > 0) edges[from] = targets
  }
  return edges
}

export function diffBaseline(current: Baseline, baseline: Baseline) {
  const added: [string, string][] = []
  const stale: [string, string][] = []
  for (const [from, targets] of Object.entries(current)) {
    const known = new Set(baseline[from] ?? [])
    for (const to of targets) if (!known.has(to)) added.push([from, to])
  }
  for (const [from, targets] of Object.entries(baseline)) {
    const known = new Set(current[from] ?? [])
    for (const to of targets) if (!known.has(to)) stale.push([from, to])
  }
  return { added, stale }
}

export function shortestCyclePath(
  graph: Graph,
  from: string,
  to: string
): string[] {
  const previous = new Map<string, string | undefined>([[to, undefined]])
  const queue = [to]
  while (queue.length > 0 && !previous.has(from)) {
    const node = queue.shift()!
    for (const next of graph.get(node) ?? []) {
      if (previous.has(next)) continue
      previous.set(next, node)
      queue.push(next)
    }
  }
  if (!previous.has(from)) return []

  const backToStart: string[] = []
  for (let cursor: string | undefined = from; cursor;) {
    backToStart.push(cursor)
    cursor = previous.get(cursor)
  }
  return [from, ...backToStart.reverse()]
}

export function componentStats(graph: Graph) {
  const cyclic = stronglyConnectedComponents(graph).filter(
    (component) => component.length > 1
  )
  return {
    modulesInCycles: cyclic.reduce((sum, c) => sum + c.length, 0),
    largestComponent: Math.max(0, ...cyclic.map((c) => c.length)),
    componentCount: cyclic.length
  }
}

function cruiseSource(): Graph {
  const output = execFileSync(
    'pnpm',
    ['exec', 'depcruise', 'src', '--output-type', 'json'],
    { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: 'pipe' }
  )
  const { modules } = JSON.parse(output) as { modules: CruiseModule[] }
  return graphFromCruise(modules)
}

function readBaseline(path: string): Baseline {
  if (!existsSync(path)) return {}
  return JSON.parse(readFileSync(path, 'utf8')) as Baseline
}

export function formatBaseline(baseline: Baseline): string {
  const lines = Object.entries(baseline).map(
    ([from, targets]) => `  ${JSON.stringify(from)}: ${JSON.stringify(targets)}`
  )
  return `{\n${lines.join(',\n')}\n}\n`
}

function formatEdge(graph: Graph, [from, to]: [string, string]): string {
  const path = shortestCyclePath(graph, from, to)
  return path.length > 0 ? path.join('\n    -> ') : `${from}\n    -> ${to}`
}

function main() {
  const update = process.argv.includes('--update')
  const baselinePath = resolve(process.cwd(), BASELINE_PATH)
  const graph = cruiseSource()
  const current = cyclicEdges(graph)
  const stats = componentStats(graph)
  const summary = `${stats.modulesInCycles} modules in ${stats.componentCount} import cycles (largest: ${stats.largestComponent})`

  if (update) {
    writeFileSync(baselinePath, formatBaseline(current))
    process.stdout.write(`Wrote ${BASELINE_PATH}: ${summary}\n`)
    return
  }

  const { added, stale } = diffBaseline(current, readBaseline(baselinePath))
  if (added.length > 0) {
    process.stderr.write(
      `${added.length} new import cycle edge(s) in src:\n\n${added
        .map((edge) => `  ${formatEdge(graph, edge)}`)
        .join(
          '\n\n'
        )}\n\nBreak the cycle, or if it is intentional run: pnpm lint:cycles:update\n`
    )
  }
  if (stale.length > 0) {
    process.stderr.write(
      `${stale.length} baseline entry(ies) no longer cyclic:\n${stale
        .map(([from, to]) => `  ${from} -> ${to}`)
        .join('\n')}\n\nRun: pnpm lint:cycles:update\n`
    )
  }
  if (added.length > 0 || stale.length > 0) process.exit(1)
  process.stdout.write(`Import cycles unchanged: ${summary}\n`)
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main()
}
