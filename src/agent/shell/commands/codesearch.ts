import type { Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

const API_BASE = 'https://comfy-codesearch.vercel.app'
const DEFAULT_COUNT = 20

interface LineMatch {
  preview?: string
  lineNumber?: number
}
interface FileMatch {
  __typename?: string
  repository?: { name?: string }
  file?: { path?: string }
  lineMatches?: LineMatch[]
}
interface RepoMatch {
  __typename?: string
  name?: string
}
interface SearchResponse {
  data?: {
    search?: {
      stats?: { approximateResultCount?: string }
      results?: {
        matchCount?: number
        elapsedMilliseconds?: number
        results?: (FileMatch | RepoMatch)[]
      }
    }
  }
}

async function csFetch(
  endpoint: 'code' | 'repo',
  query: string
): Promise<SearchResponse> {
  const url = `${API_BASE}/api/search/${endpoint}?query=${encodeURIComponent(query)}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      `comfy-codesearch ${endpoint}: API error ${res.status} ${res.statusText}`
    )
  }
  return (await res.json()) as SearchResponse
}

function formatCodeResults(json: SearchResponse, query: string): string {
  const r = json.data?.search?.results
  const stats = json.data?.search?.stats
  const hits = (r?.results ?? []) as FileMatch[]
  if (hits.length === 0) {
    return `no matches for "${query}" across the public ComfyUI codebase.\n`
  }
  const repos = new Set<string>()
  for (const h of hits) if (h.repository?.name) repos.add(h.repository.name)
  const header =
    `${r?.matchCount ?? hits.length} match(es) in ${repos.size} repo(s)` +
    (stats?.approximateResultCount
      ? ` (~${stats.approximateResultCount} total)`
      : '') +
    (r?.elapsedMilliseconds !== undefined
      ? `, took ${r.elapsedMilliseconds}ms`
      : '') +
    ':\n'
  const lines: string[] = []
  for (const h of hits) {
    const repo = h.repository?.name ?? '?'
    const path = h.file?.path ?? '?'
    const lms = h.lineMatches ?? []
    if (lms.length === 0) {
      lines.push(`  ${repo}  ${path}`)
      continue
    }
    for (const lm of lms) {
      const ln = lm.lineNumber ?? '?'
      const preview = (lm.preview ?? '').replace(/\s+$/, '')
      lines.push(`  ${repo}  ${path}:${ln}\n    ${preview}`)
    }
  }
  return header + lines.join('\n') + '\n'
}

function formatRepoResults(json: SearchResponse, query: string): string {
  const r = json.data?.search?.results
  const hits = (r?.results ?? []) as RepoMatch[]
  if (hits.length === 0) {
    return `no repos match "${query}" in the public ComfyUI codebase index.\n`
  }
  const lines = hits.map((h) => '  ' + (h.name ?? '?'))
  return `${hits.length} repo(s) match "${query}":\n` + lines.join('\n') + '\n'
}

/**
 * comfy-codesearch <query> [--repo] [--count N]
 *
 * Search source code (or repo names) across the WHOLE public ComfyUI
 * community via cs.comfy.org. Use this to find node-class definitions,
 * extension APIs, or example code in repos that aren't yet published to
 * the registry — `node-search-registry` only sees published packs, but
 * many custom nodes live as plain GitHub repos.
 *
 * Query syntax is Sourcegraph-flavored:
 *   - plain text                     fuzzy substring across all indexed repos
 *   - `repo:Comfy-Org/ComfyUI foo`   scope to a specific repo
 *   - `count:50 foo`                 cap result count (otherwise --count is used)
 *   - `class\\s+Wacom`                regex
 *
 * Examples:
 *   comfy-codesearch "NODE_CLASS_MAPPINGS.*[Ww]acom"
 *   comfy-codesearch --repo wacom
 *   comfy-codesearch "repo:Comfy-Org/ComfyUI last_node_id" --count 5
 */
const comfyCodesearch: Command = async (ctx) => {
  const args = ctx.argv.slice(1)
  let mode: 'code' | 'repo' = 'code'
  let count = DEFAULT_COUNT
  const queryParts: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--repo' || a === '-r') {
      mode = 'repo'
    } else if (a === '--count' || a === '-c') {
      const next = args[i + 1]
      const n = Number(next)
      if (!Number.isFinite(n) || n <= 0) {
        return {
          stdout: emptyIter(),
          exitCode: 2,
          stderr: `comfy-codesearch: --count needs a positive number, got "${next ?? ''}"`
        }
      }
      count = n
      i++
    } else {
      queryParts.push(a)
    }
  }
  const query = queryParts.join(' ').trim()
  if (!query) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr:
        'usage: comfy-codesearch <query> [--repo] [--count N]\n' +
        '       (searches the whole public ComfyUI community via cs.comfy.org)'
    }
  }
  let effectiveQuery = query
  if (mode === 'code' && !/\bcount:\d+/.test(query)) {
    effectiveQuery = `count:${count} ${query}`
  }
  try {
    const json = await csFetch(mode, effectiveQuery)
    const text =
      mode === 'code'
        ? formatCodeResults(json, query)
        : formatRepoResults(json, query)
    return { stdout: stringIter(text), exitCode: 0 }
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

export function registerCodesearchCommands(registry: CommandRegistry): void {
  registry.register('comfy-codesearch', comfyCodesearch)
}
