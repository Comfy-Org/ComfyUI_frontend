/**
 * Builds a MiniSearch index from synced template data and writes it to public/.
 * The index is loaded on the client for instant search in the SearchPopover.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import MiniSearch from 'minisearch'
import { CONTENT_DIR, SITE_DIR } from '../paths'
import { logger } from '../logger'
import { tagDisplayName, tagSearchText } from '../../../src/lib/tag-aliases'

interface SearchDocument {
  id: string
  title: string
  description: string
  tags: string
  models: string
  mediaType: string
  mediaTypeLabel: string
  username: string
  creatorName: string
  // Stored fields for display (not searched)
  thumbnail: string
  usage: number
  tagsArray: string[]
}

/** Shape returned by GET /api/hub/workflows/index */
interface IndexEntry {
  name?: string
  title?: string
  description?: string
  tags?: string[]
  models?: string[]
  mediaType?: string
  username?: string
  thumbnailUrl?: string
  shareId?: string
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  '3d': '3D'
}

async function fetchIndexEntries(): Promise<IndexEntry[] | null> {
  const apiUrl = (process.env.PUBLIC_HUB_API_URL || '').replace(/\/$/, '')
  if (!apiUrl) return null
  try {
    // Match hub-api.ts listWorkflowIndex(): preview builds request all statuses
    // so the search index includes pending/rejected/deprecated workflows too.
    // Production builds (PUBLIC_APPROVED_ONLY=true) request only approved.
    const approvedOnly = process.env.PUBLIC_APPROVED_ONLY === 'true'
    const statuses = approvedOnly
      ? 'approved'
      : 'pending,approved,rejected,deprecated'
    const res = await fetch(
      `${apiUrl}/api/hub/workflows/index?status=${statuses}`
    )
    if (!res.ok) return null
    const entries = (await res.json()) as IndexEntry[]
    // Return null on empty array so the caller falls back to content collection
    return entries.length > 0 ? entries : null
  } catch {
    return null
  }
}

async function fetchProfileDisplayName(username: string): Promise<string> {
  const apiUrl = (process.env.PUBLIC_HUB_API_URL || '').replace(/\/$/, '')
  if (!apiUrl) return username
  try {
    const res = await fetch(
      `${apiUrl}/api/hub/profiles/${encodeURIComponent(username)}`
    )
    if (!res.ok) return username
    const profile = (await res.json()) as { display_name?: string }
    return profile.display_name || username
  } catch {
    return username
  }
}

export async function buildSearchIndex(): Promise<void> {
  const startTime = Date.now()

  const documents: SearchDocument[] = []

  // Try hub API first, fall back to content collection files
  const hubEntries = await fetchIndexEntries()
  if (hubEntries) {
    logger.info(
      `Building search index from hub API (${hubEntries.length} entries)`
    )

    // Resolve display names from profile API
    const usernames = [
      ...new Set(hubEntries.map((e) => e.username).filter(Boolean) as string[])
    ]
    const displayNames = new Map<string, string>()
    const results = await Promise.allSettled(
      usernames.map(async (u) => ({
        username: u,
        displayName: await fetchProfileDisplayName(u)
      }))
    )
    for (const r of results) {
      if (r.status === 'fulfilled') {
        displayNames.set(r.value.username, r.value.displayName)
      }
    }

    for (const data of hubEntries) {
      const username = data.username || 'ComfyUI'
      const creatorName = displayNames.get(username) || username
      const tags = data.tags || []
      const models = data.models || []
      const name = data.name || data.shareId || ''

      documents.push({
        id: name,
        title: data.title || name,
        description: data.description || '',
        tags: tags.map(tagSearchText).join(' '),
        models: models.join(' '),
        mediaType: data.mediaType || 'image',
        mediaTypeLabel:
          MEDIA_TYPE_LABELS[data.mediaType || ''] || data.mediaType || 'image',
        username,
        creatorName,
        thumbnail: data.thumbnailUrl || '',
        usage: 0,
        tagsArray: tags.map(tagDisplayName)
      })
    }
  } else {
    // Fallback: read from synced content collection files
    const files = fs
      .readdirSync(CONTENT_DIR)
      .filter((f) => f.endsWith('.json') && !f.includes('/'))
    logger.info(
      `Building search index from content collection (${files.length} files)`
    )

    for (const file of files) {
      const filePath = path.join(CONTENT_DIR, file)
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

      const username = data.username || 'ComfyUI'
      const tags: string[] = data.tags || []
      const models: string[] = data.models || []
      const thumbnails: string[] = data.thumbnails || []

      documents.push({
        id: data.name,
        title: data.title || data.name,
        description: data.description || '',
        tags: tags.map(tagSearchText).join(' '),
        models: models.join(' '),
        mediaType: data.mediaType || 'image',
        mediaTypeLabel: MEDIA_TYPE_LABELS[data.mediaType] || data.mediaType,
        username,
        creatorName: username,
        thumbnail: thumbnails[0] || '',
        usage: data.usage || 0,
        tagsArray: tags.map(tagDisplayName)
      })
    }
  }

  logger.info(`Indexing ${documents.length} templates...`)

  // Custom tokenizer: keep hyphenated terms as single tokens AND emit sub-parts.
  // e.g. "flux-image-to-video" → ["flux-image-to-video", "flux", "image", "to", "video"]
  // This lets "z-image" match as a prefix against "z-image-to-video" style titles.
  const tokenize = (text: string): string[] => {
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

  const miniSearch = new MiniSearch<SearchDocument>({
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
    tokenize,
    searchOptions: {
      boost: {
        title: 3,
        models: 2,
        tags: 2,
        creatorName: 1.5,
        mediaType: 1,
        description: 0.5
      },
      prefix: true,
      fuzzy: 0.2,
      tokenize
    }
  })

  miniSearch.addAll(documents)

  // Write to public/
  const outputDir = path.join(SITE_DIR, 'public', 'workflows')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  const outputPath = path.join(outputDir, 'search-index.json')
  const serialized = JSON.stringify(miniSearch)
  fs.writeFileSync(outputPath, serialized)

  const sizeKB = (Buffer.byteLength(serialized) / 1024).toFixed(1)
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  logger.info(
    `Search index written to public/workflows/search-index.json (${sizeKB} KB, ${duration}s)`
  )
}
