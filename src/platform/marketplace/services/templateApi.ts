import { useMockKVStore } from '@/utils/mockKVStore'

import { MARKETPLACE_TEMPLATE_KEY } from '../types/marketplace'
import type {
  AuthorInfo,
  CreateTemplateDraftRequest,
  MarketplaceTemplate,
  TemplateStatus,
  UpdateTemplateRequest,
  SubmitTemplateRequest
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
export async function createTemplateDraft(
  body: CreateTemplateDraftRequest
): Promise<{ id: string; status: TemplateStatus }> {
  const timestamp = now()
  const record = collection.create({
    [MARKETPLACE_TEMPLATE_KEY]: true,
    categories: [],
    gallery: [],
    ...body,
    author: getCurrentAuthor(),
    status: 'draft',
    stats: EMPTY_STATS,
    createdAt: timestamp
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
  body: CreateTemplateDraftRequest
): Promise<MarketplaceTemplate | null>
export async function submitTemplate(
  body: SubmitTemplateRequest
): Promise<MarketplaceTemplate | null>
export async function submitTemplate(
  body: CreateTemplateDraftRequest | SubmitTemplateRequest
): Promise<MarketplaceTemplate | null> {
  const id = 'id' in body ? body.id : undefined

  if (!id) {
    const draft = await createTemplateDraft(body)

    return submitTemplate({
      ...body,
      ...draft
    })
  }

  const template = collection.get(id)

  if (!template) {
    throw new Error('Template not found')
  }

  if (template.status !== 'draft' && template.status !== 'rejected') {
    throw new Error(`Cannot submit template with status "${template.status}"`)
  }

  return collection.update(template.id, {
    status: 'pending_review',
    updatedAt: now()
  })
}
