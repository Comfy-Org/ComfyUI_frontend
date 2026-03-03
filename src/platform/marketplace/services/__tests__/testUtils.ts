import { MARKETPLACE_TEMPLATE_KEY } from '../../types/marketplace'
import type {
  AuthorInfo,
  CreateTemplateDraftRequest,
  TemplateStats,
  TemplateStatus
} from '../../types/marketplace'

type Identifiable = { id: string }

type MockOverrides = Partial<
  CreateTemplateDraftRequest & {
    author: AuthorInfo
    status: TemplateStatus
    stats: TemplateStats
  }
>

export function createMockMarketplaceTemplate(overrides: MockOverrides = {}) {
  return {
    [MARKETPLACE_TEMPLATE_KEY]: true as const,
    name: 'test-workflow',
    description: 'A test workflow',
    mediaType: 'image' as const,
    mediaSubtype: 'photo' as const,
    shortDescription: 'Short description',
    author: {
      id: 'author-1',
      name: 'Test Author',
      isVerified: false,
      profileUrl: '/authors/1'
    },
    difficulty: 'beginner' as const,
    categories: ['Image Generation'],
    gallery: [] as string[],
    version: '1.0.0',
    status: 'draft' as const,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    stats: {
      downloads: 0,
      favorites: 0,
      rating: 0,
      reviewCount: 0,
      weeklyTrend: 0
    },
    ...overrides
  }
}

let counter = 0
function nextId() {
  return `mock-${++counter}`
}

export function createMemoryCollection<T extends Identifiable>() {
  const records = new Map<string, T>()
  return {
    create(data: Omit<T, 'id'> & Partial<Pick<T, 'id'>>): T {
      const id = (data as Partial<T>).id ?? nextId()
      const record = { ...data, id } as T
      records.set(id, record)
      return record
    },
    get(id: string): T | null {
      return records.get(id) ?? null
    },
    update(id: string, partial: Partial<T>): T | null {
      const existing = records.get(id)
      if (!existing) return null
      const updated = { ...existing, ...partial, id }
      records.set(id, updated)
      return updated
    },
    delete(id: string): boolean {
      return records.delete(id)
    },
    list(): T[] {
      return [...records.values()]
    },
    find(predicate: (item: T) => boolean): T[] {
      return [...records.values()].filter(predicate)
    },
    clear(): void {
      records.clear()
    }
  }
}
