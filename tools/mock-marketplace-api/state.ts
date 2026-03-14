import type {
  CreateTemplateRequest,
  MarketplaceTemplate,
  MediaUploadResponse,
  TemplateStatus,
  UpdateTemplateRequest
} from '../../src/platform/marketplace/apiTypes'
import { isValidTransition } from '../../src/platform/marketplace/apiTypes'

import { seed } from './seed'
import type { MockDb } from './types'

let nextId = 100

let db: MockDb = structuredClone(seed)

const mediaBlobs: Record<string, { buffer: ArrayBuffer; mimeType: string }> = {}

export function resetDb(): void {
  db = structuredClone(seed)
  Object.keys(mediaBlobs).forEach((k) => delete mediaBlobs[k])
  nextId = 100
}

export function getDb(): MockDb {
  return db
}

function generateId(): string {
  return `tpl_${nextId++}`
}

export function createTemplate(
  req: CreateTemplateRequest
): MarketplaceTemplate {
  const now = new Date().toISOString()
  const template: MarketplaceTemplate = {
    id: generateId(),
    title: req.title,
    description: req.description,
    shortDescription: req.shortDescription,
    author: {
      id: 'author_1',
      name: 'MockAuthor',
      isVerified: false,
      profileUrl: 'https://example.com/mockauthor'
    },
    categories: req.categories ?? [],
    tags: req.tags ?? [],
    difficulty: req.difficulty ?? 'beginner',
    requiredModels: req.requiredModels ?? [],
    requiredNodes: req.requiredNodes ?? [],
    vramRequirement: req.vramRequirement ?? 0,
    thumbnail: '',
    gallery: [],
    workflowPreview: '',
    license: req.license ?? 'cc-by',
    tutorialUrl: req.tutorialUrl,
    version: '1.0.0',
    status: 'draft',
    updatedAt: now,
    stats: {
      downloads: 0,
      favorites: 0,
      rating: 0,
      reviewCount: 0,
      weeklyTrend: 0
    }
  }

  db.templates.push(template)
  return template
}

export function findTemplate(id: string): MarketplaceTemplate | undefined {
  return db.templates.find((t) => t.id === id)
}

export function updateTemplate(
  id: string,
  updates: UpdateTemplateRequest
): MarketplaceTemplate | undefined {
  const template = findTemplate(id)
  if (!template) return undefined

  Object.assign(template, updates, {
    updatedAt: new Date().toISOString()
  })
  return template
}

interface TransitionResult {
  ok: boolean
  error?: string
}

export function transitionStatus(
  id: string,
  to: TemplateStatus
): TransitionResult {
  const template = findTemplate(id)
  if (!template) {
    return { ok: false, error: 'Template not found' }
  }

  if (!isValidTransition(template.status, to)) {
    return {
      ok: false,
      error: `Cannot transition from '${template.status}' to '${to}'`
    }
  }

  template.status = to
  template.updatedAt = new Date().toISOString()

  if (to === 'published') {
    template.publishedAt = template.updatedAt
  }

  return { ok: true }
}

export async function addMedia(
  templateId: string,
  file: File
): Promise<MediaUploadResponse | undefined> {
  if (!findTemplate(templateId)) return undefined

  const buffer = await file.arrayBuffer()
  const filename = file.name || 'upload'
  const key = `${templateId}/${filename}`
  mediaBlobs[key] = { buffer, mimeType: file.type }

  const url = `/api/marketplace/media/${templateId}/${encodeURIComponent(filename)}`
  const entry: MediaUploadResponse = {
    url,
    type: file.type
  }

  if (!db.mediaByTemplateId[templateId]) {
    db.mediaByTemplateId[templateId] = []
  }
  db.mediaByTemplateId[templateId].push(entry)

  return entry
}

export function getMediaBlob(
  templateId: string,
  filename: string
): { buffer: ArrayBuffer; mimeType: string } | undefined {
  const key = `${templateId}/${filename}`
  return mediaBlobs[key]
}
