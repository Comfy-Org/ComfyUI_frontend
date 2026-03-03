import { useMockKVStore } from '@/utils/mockKVStore'

import type {
  AuthorInfo,
  CreateTemplateRequest,
  MarketplaceTemplate,
  TemplateStatus,
  UpdateTemplateRequest
} from '../types/marketplace'

const store = useMockKVStore('marketplace')
const collection = store.collection<MarketplaceTemplate>('templates')

function now(): string {
  return new Date().toISOString()
}

// Mock: In production, the backend resolves author from the auth session.
function getCurrentAuthor(): AuthorInfo {
  return {
    id: 'mock-user-1',
    name: 'Local User',
    isVerified: false,
    profileUrl: '/users/mock-user-1'
  }
}

const EMPTY_STATS = {
  downloads: 0,
  favorites: 0,
  rating: 0,
  reviewCount: 0,
  weeklyTrend: 0
} as const

// POST /api/marketplace/templates
export async function createTemplate(
  body: CreateTemplateRequest
): Promise<{ id: string; status: TemplateStatus }> {
  const timestamp = now()
  const record = collection.create({
    ...body,
    author: getCurrentAuthor(),
    status: 'draft',
    stats: EMPTY_STATS,
    createdAt: timestamp,
    updatedAt: timestamp
  })
  return { id: record.id, status: record.status }
}

// POST /api/marketplace/templates/draft
export async function createDraftTemplate(
  body: Partial<CreateTemplateRequest>
): Promise<{ id: string; status: TemplateStatus }> {
  const timestamp = now()
  const record = collection.create({
    template: body.template ?? ({} as CreateTemplateRequest['template']),
    shortDescription: body.shortDescription ?? '',
    difficulty: body.difficulty ?? 'beginner',
    version: body.version ?? '1.0.0',
    categories: body.categories,
    gallery: body.gallery,
    changelog: body.changelog,
    author: getCurrentAuthor(),
    status: 'draft',
    stats: EMPTY_STATS,
    createdAt: timestamp,
    updatedAt: timestamp
  })
  return { id: record.id, status: record.status }
}

// GET /api/marketplace/templates/:id
export async function getTemplate(
  id: string
): Promise<MarketplaceTemplate | null> {
  return collection.get(id)
}

// PUT /api/marketplace/templates/:id
export async function updateTemplate(
  body: UpdateTemplateRequest
): Promise<MarketplaceTemplate | null> {
  return collection.update(body.id, { ...body, updatedAt: now() })
}

// DELETE /api/marketplace/templates/:id
export async function deleteTemplate(
  id: string
): Promise<{ success: boolean }> {
  return { success: collection.delete(id) }
}

// POST /api/marketplace/templates/:id/submit
export async function submitTemplate(
  id: string
): Promise<{ status: TemplateStatus }> {
  const template = collection.get(id)
  if (!template) throw new Error('Template not found')
  if (template.status !== 'draft' && template.status !== 'rejected')
    throw new Error(`Cannot submit template with status "${template.status}"`)
  collection.update(id, { status: 'pending_review', updatedAt: now() })
  return { status: 'pending_review' }
}
