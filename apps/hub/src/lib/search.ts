/**
 * Client-side search provider backed by a pre-built MiniSearch index.
 * The index is lazy-loaded from /search-index.json on first query.
 */
import MiniSearch from 'minisearch'
import type { SearchResult } from 'minisearch'

export interface WorkflowHit {
  id: string
  title: string
  mediaType: string
  mediaTypeLabel: string
  thumbnail: string
  username: string
  creatorName: string
  usage: number
  tags: string[]
  score: number
}

export interface CreatorHit {
  username: string
  displayName: string
  workflowCount: number
}

export interface SearchResults {
  workflows: WorkflowHit[]
  creators: CreatorHit[]
}

// Module-level cache — shared across all consumers
let indexPromise: Promise<MiniSearch> | null = null

// Must match the tokenizer used at index build time (build-index.ts)
function tokenize(text: string): string[] {
  const tokens: string[] = []
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  for (const word of words) {
    tokens.push(word)
    if (word.includes('-')) {
      for (const part of word.split('-')) {
        if (part) tokens.push(part)
      }
    }
  }
  return tokens
}

async function loadIndex(): Promise<MiniSearch> {
  const response = await fetch('/workflows/search-index.json')
  if (!response.ok) {
    throw new Error(`Failed to load search index: ${response.status}`)
  }
  const json = await response.text()
  return MiniSearch.loadJSON(json, {
    fields: [
      'title',
      'description',
      'tags',
      'models',
      'mediaType',
      'creatorName'
    ],
    storeFields: [
      'title',
      'mediaType',
      'mediaTypeLabel',
      'thumbnail',
      'username',
      'creatorName',
      'usage',
      'tagsArray'
    ],
    tokenize
  })
}

function ensureIndex(): Promise<MiniSearch> {
  if (!indexPromise) {
    indexPromise = loadIndex()
  }
  return indexPromise
}

function mapResult(result: SearchResult): WorkflowHit {
  return {
    id: result.id as string,
    title: (result.title as string) || (result.id as string),
    mediaType: (result.mediaType as string) || 'image',
    mediaTypeLabel: (result.mediaTypeLabel as string) || 'Image',
    thumbnail: (result.thumbnail as string) || '',
    username: (result.username as string) || 'ComfyUI',
    creatorName: (result.creatorName as string) || 'ComfyUI',
    usage: (result.usage as number) || 0,
    tags: (result.tagsArray as string[]) || [],
    score: result.score
  }
}

function deriveCreators(workflows: WorkflowHit[], query: string): CreatorHit[] {
  const byCreator = new Map<string, { displayName: string; count: number }>()
  for (const wf of workflows) {
    const existing = byCreator.get(wf.username)
    if (existing) {
      existing.count++
    } else {
      byCreator.set(wf.username, { displayName: wf.creatorName, count: 1 })
    }
  }

  const queryLower = query.toLowerCase()

  return (
    Array.from(byCreator.entries())
      .map(([username, { displayName, count }]) => ({
        username,
        displayName,
        workflowCount: count
      }))
      // Only show creators whose name matches the query, or who have 2+ matching workflows
      .filter(
        (c) =>
          c.displayName.toLowerCase().includes(queryLower) ||
          c.username.toLowerCase().includes(queryLower) ||
          c.workflowCount >= 2
      )
      .sort((a, b) => b.workflowCount - a.workflowCount)
  )
}

export async function search(
  query: string,
  options?: { allowedIds?: Set<string> }
): Promise<SearchResults> {
  const trimmed = query.trim()
  if (!trimmed) {
    return { workflows: [], creators: [] }
  }

  const index = await ensureIndex()
  let results = index.search(trimmed, {
    prefix: true,
    fuzzy: 0.2,
    tokenize
  })

  // Scope results to allowed IDs when badge filters are active
  if (options?.allowedIds) {
    results = results.filter((r) => options.allowedIds!.has(r.id as string))
  }

  const workflows = results.map(mapResult)
  const creators = deriveCreators(workflows, trimmed)

  return { workflows, creators }
}
