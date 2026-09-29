import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

type Graph = ReadonlyMap<string, ReadonlySet<string>>
export type Baseline = Readonly<Record<string, readonly string[]>>

const cruiseOutputSchema = z.object({
  modules: z.array(
    z.object({
      source: z.string(),
      dependencies: z.array(z.object({ resolved: z.string() }))
    })
  )
})
type CruiseModule = z.infer<typeof cruiseOutputSchema>['modules'][number]

const baselineSchema = z.record(z.string(), z.array(z.string()))

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

type Frame = {
  node: string
  index: number
  lowLink: number
  successors: Iterator<string>
}

export function stronglyConnectedComponents(graph: Graph): string[][] {
  const visited = new Set<string>()
  const stackIndex = new Map<string, number>()
  const stack: string[] = []
  const work: Frame[] = []
  const components: string[][] = []

  const enter = (node: string) => {
    const index = visited.size
    visited.add(node)
    stackIndex.set(node, index)
    stack.push(node)
    work.push({
      node,
      index,
      lowLink: index,
      successors: (graph.get(node) ?? []).values()
    })
  }

  const visit = (frame: Frame, node: string) => {
    if (!visited.has(node)) {
      enter(node)
      return
    }
    const onStackIndex = stackIndex.get(node)
    if (onStackIndex !== undefined)
      frame.lowLink = Math.min(frame.lowLink, onStackIndex)
  }

  const leave = (frame: Frame) => {
    const parent = work.at(-1)
    if (parent) parent.lowLink = Math.min(parent.lowLink, frame.lowLink)
    if (frame.lowLink !== frame.index) return

    const component = stack.splice(stack.lastIndexOf(frame.node))
    for (const member of component) stackIndex.delete(member)
    components.push(component.sort())
  }

  for (const root of graph.keys()) {
    if (visited.has(root)) continue
    enter(root)
    for (let frame = work.at(-1); frame; frame = work.at(-1)) {
      const next = frame.successors.next()
      if (next.done) {
        work.pop()
        leave(frame)
      } else {
        visit(frame, next.value)
      }
    }
  }
  return components
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
  for (const node of queue) {
    if (previous.has(from)) break
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

function componentStats(graph: Graph) {
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
  const { modules } = cruiseOutputSchema.parse(JSON.parse(output))
  return graphFromCruise(modules)
}

function readBaseline(path: string): Baseline {
  if (!existsSync(path)) return {}
  return baselineSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
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

export function baselineViolations(graph: Graph, baseline: Baseline): string[] {
  const { added, stale } = diffBaseline(cyclicEdges(graph), baseline)
  const violations: string[] = []
  if (added.length > 0) {
    violations.push(
      `${added.length} new import cycle edge(s) in src:\n\n${added
        .map((edge) => `  ${formatEdge(graph, edge)}`)
        .join(
          '\n\n'
        )}\n\nBreak the cycle, or if it is intentional run: pnpm lint:cycles:update\n`
    )
  }
  if (stale.length > 0) {
    violations.push(
      `${stale.length} baseline entry(ies) no longer cyclic:\n${stale
        .map(([from, to]) => `  ${from} -> ${to}`)
        .join('\n')}\n\nRun: pnpm lint:cycles:update\n`
    )
  }
  return violations
}

function main() {
  const update = process.argv.includes('--update')
  const baselinePath = resolve(process.cwd(), BASELINE_PATH)
  const graph = cruiseSource()
  const stats = componentStats(graph)
  const summary = `${stats.modulesInCycles} modules in ${stats.componentCount} import cycles (largest: ${stats.largestComponent})`

  if (update) {
    writeFileSync(baselinePath, formatBaseline(cyclicEdges(graph)))
    process.stdout.write(`Wrote ${BASELINE_PATH}: ${summary}\n`)
    return
  }

  const violations = baselineViolations(graph, readBaseline(baselinePath))
  if (violations.length > 0) {
    process.stderr.write(violations.join('\n'))
    process.exitCode = 1
    return
  }
  process.stdout.write(`Import cycles unchanged: ${summary}\n`)
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main()
}
