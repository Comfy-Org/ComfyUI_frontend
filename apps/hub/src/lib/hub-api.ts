/**
 * Hub API client for fetching workflow data from the backend.
 *
 * API spec based on cloud PR #3038.
 * Base URL is configurable via PUBLIC_HUB_API_URL env var.
 * Note: PUBLIC_ prefix is required for Astro build-time access in getStaticPaths().
 * This URL is only used server-side (build + ISR), not in client-side Vue components.
 */

const HUB_API_BASE = (
  import.meta.env.PUBLIC_HUB_API_URL || 'https://cloud.comfy.org'
).replace(/\/$/, '')

// ---------------------------------------------------------------------------
// Types — mirrors backend OpenAPI schemas
// ---------------------------------------------------------------------------

export type MediaType = 'image' | 'video' | 'audio' | '3d'
export type ThumbnailVariant =
  | 'compareSlider'
  | 'hoverDissolve'
  | 'zoomHover'
  | 'hoverZoom'
export type WorkflowStatus = 'pending' | 'approved' | 'rejected' | 'deprecated'

export interface LabelRef {
  name: string
  display_name: string
}

export interface HubProfile {
  username: string
  display_name?: string
  description?: string
  avatar_url?: string
  website_urls?: string[]
}

export interface HubWorkflowSummary {
  share_id: string
  name: string
  status: WorkflowStatus
  description?: string
  tags: LabelRef[]
  models: LabelRef[]
  custom_nodes?: LabelRef[]
  thumbnail_type?: 'image' | 'video' | 'image_comparison'
  thumbnail_url?: string
  thumbnail_comparison_url?: string
  publish_time?: string
  usage?: number
  isApp?: boolean
  profile: HubProfile
}

export interface HubWorkflowMetadata {
  media_type?: MediaType
  media_subtype?: string
  open_source?: boolean
  size?: number
  vram?: number
  // AI-generated content (written by backend task worker)
  extended_description?: string
  meta_description?: string
  how_to_use?: string[]
  suggested_use_cases?: string[]
  faq_items?: Array<{ question: string; answer: string }>
  content_template?: string
}

export interface HubWorkflowDetail extends HubWorkflowSummary {
  workflow_id: string
  tutorial_url?: string
  metadata?: HubWorkflowMetadata
  sample_image_urls?: string[]
  workflow_json: Record<string, unknown>
  assets: AssetInfo[]
}

export interface AssetInfo {
  id: string
  filename?: string
  size?: number
  content_type?: string
  url?: string
}

export interface HubWorkflowListResponse {
  workflows: HubWorkflowSummary[]
  next_cursor?: string
}

/**
 * Template index entry — matches HubWorkflowTemplateEntry from the backend.
 * Returned by GET /api/hub/workflows/index in the same shape as index.json.
 */
export interface HubWorkflowTemplateEntry {
  name: string
  title: string
  description?: string
  tags?: string[]
  models?: string[]
  requiresCustomNodes?: string[]
  thumbnailVariant?: ThumbnailVariant
  mediaType?: MediaType
  mediaSubtype?: string
  size?: number
  vram?: number
  usage?: number
  openSource?: boolean | null
  username?: string
  /** Embedded profile from the index endpoint (eliminates N+1 profile calls) */
  profile?: HubProfile
  tutorialUrl?: string
  logos?: Record<string, unknown>[]
  date?: string
  io?: {
    inputs?: Record<string, unknown>[]
    outputs?: Record<string, unknown>[]
  }
  isApp?: boolean
  includeOnDistributions?: string[]
  thumbnailUrl?: string
  thumbnailComparisonUrl?: string
  shareId?: string
  status: WorkflowStatus
  // AI-generated content fields (from backend metadata)
  extendedDescription?: string
  metaDescription?: string
  howToUse?: string[]
  suggestedUseCases?: string[]
  faqItems?: Array<{ question: string; answer: string }>
  contentTemplate?: string
}

// ---------------------------------------------------------------------------
// Serialized types — shared across all pages for Vue islands
// ---------------------------------------------------------------------------

/** Shape passed to WorkflowGrid, HubBrowse, SearchPopover, etc. */
export interface SerializedTemplate {
  name: string
  shareId: string
  title: string
  description: string
  mediaType: MediaType
  tags: string[]
  models: string[]
  logos: { provider: string | string[] }[]
  usage: number
  date: string
  thumbnails: string[]
  username: string
  creatorDisplayName: string
  creatorAvatarUrl: string
  isApp: boolean
  thumbnailVariant?: ThumbnailVariant
  mediaSubtype?: string
}

// ---------------------------------------------------------------------------
// Query parameters
// ---------------------------------------------------------------------------

export interface ListWorkflowsParams {
  cursor?: string
  limit?: number
  search?: string
  tag?: string
  username?: string
  status?: WorkflowStatus[]
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

async function hubFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${HUB_API_BASE}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers
    }
  })

  if (!res.ok) {
    throw new Error(`Hub API error: ${res.status} ${res.statusText} — ${url}`)
  }

  return res.json() as Promise<T>
}

/**
 * Browse hub workflows (public, no auth required).
 */
export async function listWorkflows(
  params: ListWorkflowsParams = {}
): Promise<HubWorkflowListResponse> {
  const qs = new URLSearchParams()
  if (params.cursor) qs.set('cursor', params.cursor)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.search) qs.set('search', params.search)
  if (params.tag) qs.set('tag', params.tag)
  if (params.username) qs.set('username', params.username)
  if (params.status?.length) qs.set('status', params.status.join(','))

  const query = qs.toString()
  return hubFetch<HubWorkflowListResponse>(
    `/api/hub/workflows${query ? `?${query}` : ''}`
  )
}

/**
 * Get a single workflow detail by share_id (public, no auth required).
 */
export async function getWorkflow(shareId: string): Promise<HubWorkflowDetail> {
  return hubFetch<HubWorkflowDetail>(
    `/api/hub/workflows/${encodeURIComponent(shareId)}`
  )
}

/**
 * Get a public hub profile by username.
 */
export async function getProfile(username: string): Promise<HubProfile> {
  return hubFetch<HubProfile>(
    `/api/hub/profiles/${encodeURIComponent(username)}`
  )
}

// ---------------------------------------------------------------------------
// Caches — module-level singletons, built once per process
// ---------------------------------------------------------------------------

let indexCache: Promise<HubWorkflowTemplateEntry[]> | null = null

const APPROVED_ONLY = import.meta.env.PUBLIC_APPROVED_ONLY === 'true'

/** All status values — used when preview builds need unfiltered results. */
const ALL_STATUSES: WorkflowStatus[] = [
  'pending',
  'approved',
  'rejected',
  'deprecated'
]

/**
 * Fetch and cache the workflow index. Called many times across pages during
 * a single build; the actual HTTP request fires only once.
 *
 * Status filtering is handled server-side via the `?status=` query parameter.
 * - Production (PUBLIC_APPROVED_ONLY=true): request only approved workflows.
 * - Preview: pass all statuses to show every workflow regardless of status.
 */
export function listWorkflowIndex(): Promise<HubWorkflowTemplateEntry[]> {
  if (!indexCache) {
    const statuses = APPROVED_ONLY ? 'approved' : ALL_STATUSES.join(',')
    indexCache = hubFetch<HubWorkflowTemplateEntry[]>(
      `/api/hub/workflows/index?status=${statuses}`
    )
  }
  return indexCache
}

let profileCache: Map<string, HubProfile> | null = null

/**
 * Build and cache a profile map from the embedded profile data in the index.
 * The index endpoint already includes profile objects, so no extra API calls needed.
 */
export async function getProfileCache(): Promise<Map<string, HubProfile>> {
  if (profileCache) return profileCache

  profileCache = new Map()
  try {
    const entries = await listWorkflowIndex()
    for (const entry of entries) {
      const profile = entry.profile
      if (profile?.username && !profileCache.has(profile.username)) {
        profileCache.set(profile.username, profile)
      }
      // Also index by top-level username if present (legacy/fallback)
      if (entry.username && !profileCache.has(entry.username) && profile) {
        profileCache.set(entry.username, profile)
      }
    }
  } catch {
    // Index fetch failed — return empty cache, pages will use fallback display names
  }
  return profileCache
}

// ---------------------------------------------------------------------------
// Serializers — single source of truth for mapping API data → Vue props
// ---------------------------------------------------------------------------

/**
 * Convert a HubWorkflowTemplateEntry (from index endpoint) to the shared
 * SerializedTemplate shape used by Vue grid/search islands.
 */
export function serializeIndexEntry(
  entry: HubWorkflowTemplateEntry,
  profiles: Map<string, HubProfile>
): SerializedTemplate {
  // Prefer embedded profile, fall back to profile cache by username
  const username = entry.profile?.username || entry.username || ''
  const profile = entry.profile || (username ? profiles.get(username) : null)
  return {
    name: entry.name,
    shareId: entry.shareId || '',
    title: entry.title || entry.name,
    description: entry.description || '',
    mediaType: entry.mediaType || 'image',
    tags: entry.tags || [],
    models: entry.models || [],
    logos: (entry.logos || []) as { provider: string | string[] }[],
    usage: entry.usage || 0,
    date: entry.date || '',
    thumbnails: [entry.thumbnailUrl, entry.thumbnailComparisonUrl].filter(
      Boolean
    ) as string[],
    username,
    creatorDisplayName: profile?.display_name || username || 'ComfyUI',
    creatorAvatarUrl: profile?.avatar_url || '',
    isApp: entry.isApp ?? entry.name.endsWith('.app'),
    thumbnailVariant: entry.thumbnailVariant,
    mediaSubtype: entry.mediaSubtype
  }
}

/**
 * Convert a content collection entry to SerializedTemplate (fallback path).
 */
export function serializeCollectionEntry(
  data: {
    name: string
    title?: string
    description?: string
    mediaType: MediaType
    tags?: string[]
    models?: string[]
    logos?: { provider: string | string[] }[]
    usage?: number
    date?: string
    thumbnails?: string[]
    username?: string
    isApp?: boolean
    thumbnailVariant?: ThumbnailVariant
    mediaSubtype?: string
  },
  profiles: Map<string, HubProfile>
): SerializedTemplate {
  const profile = data.username ? profiles.get(data.username) : null
  return {
    name: data.name,
    shareId: '',
    title: data.title || data.name,
    description: data.description || '',
    mediaType: data.mediaType,
    tags: data.tags || [],
    models: data.models || [],
    logos: data.logos || [],
    usage: data.usage || 0,
    date: data.date || '',
    thumbnails: data.thumbnails || [],
    username: data.username || '',
    creatorDisplayName: profile?.display_name || data.username || 'ComfyUI',
    creatorAvatarUrl: profile?.avatar_url || '',
    isApp: data.isApp || false,
    thumbnailVariant: data.thumbnailVariant,
    mediaSubtype: data.mediaSubtype
  }
}

/**
 * Convert a HubWorkflowSummary to the serialized template shape
 * used by HubBrowse.vue and other Vue islands.
 */
export function toSerializedTemplate(
  workflow: HubWorkflowSummary
): SerializedTemplate {
  return {
    name: workflow.share_id,
    shareId: workflow.share_id,
    title: workflow.name,
    description: workflow.description || '',
    mediaType: inferMediaType(workflow),
    tags: (workflow.tags || []).map((t) => t.name),
    models: (workflow.models || []).map((m) => m.name),
    logos: [],
    usage: workflow.usage || 0,
    date: workflow.publish_time || '',
    thumbnails: buildThumbnailList(workflow),
    username: workflow.profile.username,
    creatorDisplayName:
      workflow.profile.display_name || workflow.profile.username,
    creatorAvatarUrl: workflow.profile.avatar_url || '',
    isApp: workflow.isApp ?? workflow.name.endsWith('.app')
  }
}

/**
 * Convert a HubWorkflowDetail to the template data shape
 * used by [slug].astro and TemplateDetailPage.astro.
 */
export function toTemplateData(workflow: HubWorkflowDetail) {
  const meta = workflow.metadata || {}
  const mediaType = meta.media_type || inferMediaType(workflow)
  const mediaSubtype = meta.media_subtype || undefined

  return {
    name: workflow.share_id,
    shareId: workflow.share_id,
    title: workflow.name,
    description: workflow.description || '',
    extendedDescription: meta.extended_description || '',
    mediaType: mediaType,
    mediaSubtype,
    thumbnailVariant: mapThumbnailVariant(workflow.thumbnail_type),
    thumbnails: buildThumbnailList(workflow),
    tags: (workflow.tags || []).map((t) => t.name),
    models: (workflow.models || []).map((m) => m.name),
    username: workflow.profile.username,
    date: workflow.publish_time || '',
    metaDescription: meta.meta_description || workflow.description || '',
    howToUse: meta.how_to_use || [],
    suggestedUseCases: meta.suggested_use_cases || [],
    faqItems: meta.faq_items || [],
    contentTemplate: meta.content_template || undefined,
    tutorialUrl: workflow.tutorial_url
  }
}

function inferMediaType(workflow: HubWorkflowSummary): MediaType {
  const tags = (workflow.tags || []).map((t) => t.name.toLowerCase())
  if (tags.includes('video') || tags.includes('animation')) return 'video'
  if (tags.includes('audio')) return 'audio'
  if (tags.includes('3d')) return '3d'
  return 'image'
}

function buildThumbnailList(workflow: HubWorkflowSummary): string[] {
  const list: string[] = []
  if (workflow.thumbnail_url) list.push(workflow.thumbnail_url)
  if (workflow.thumbnail_comparison_url)
    list.push(workflow.thumbnail_comparison_url)
  return list
}

// ---------------------------------------------------------------------------
// URL utilities — /workflows/{slug}-{shareId} format
// ---------------------------------------------------------------------------

const SHARE_ID_LENGTH = 12

/**
 * Build a workflow URL path from an index entry.
 * Format: /workflows/{slug}-{shareId}/
 */
export function workflowUrl(entry: HubWorkflowTemplateEntry): string {
  const slug = entry.name || entry.shareId || ''
  const shareId = entry.shareId || ''
  return `/workflows/${slug}-${shareId}/`
}

/**
 * Extract the share_id from a workflow URL segment.
 * The last 12 characters after the final hyphen are the share_id.
 * e.g. "flux-schnell-e90e933d6c5d" → "e90e933d6c5d"
 */
export function extractShareId(urlSegment: string): string | null {
  const lastHyphen = urlSegment.lastIndexOf('-')
  if (lastHyphen === -1) return null
  const candidate = urlSegment.slice(lastHyphen + 1)
  if (
    candidate.length === SHARE_ID_LENGTH &&
    /^[0-9a-fA-F]+$/.test(candidate)
  ) {
    return candidate
  }
  return null
}

function mapThumbnailVariant(type?: string): ThumbnailVariant | undefined {
  if (type === 'image_comparison') return 'compareSlider'
  return undefined
}
