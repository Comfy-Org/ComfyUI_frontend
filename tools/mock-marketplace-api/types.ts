import type {
  AuthorStats,
  Category,
  MarketplaceTemplate,
  MediaUploadResponse
} from '../../src/platform/marketplace/apiTypes'

export interface MockDb {
  templates: MarketplaceTemplate[]
  mediaByTemplateId: Record<string, MediaUploadResponse[]>
  authorStats: AuthorStats
  categories: Category[]
  suggestedTags: string[]
}
