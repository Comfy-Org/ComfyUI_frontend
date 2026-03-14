export const TEMPLATE_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'published',
  'unpublished'
] as const

export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number]

export const VALID_TRANSITIONS: Record<TemplateStatus, TemplateStatus[]> = {
  draft: ['pending_review'],
  pending_review: ['approved', 'rejected'],
  approved: ['published'],
  rejected: ['pending_review'],
  published: ['unpublished'],
  unpublished: ['published']
}

export function isValidTransition(
  from: TemplateStatus,
  to: TemplateStatus
): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

export function getNextStatuses(status: TemplateStatus): TemplateStatus[] {
  return VALID_TRANSITIONS[status]
}

export const DIFFICULTY_LEVELS = [
  'beginner',
  'intermediate',
  'advanced'
] as const

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number]

export const LICENSE_TYPES = [
  'cc-by',
  'cc-by-sa',
  'cc-by-nc',
  'mit',
  'apache',
  'custom'
] as const

export type LicenseType = (typeof LICENSE_TYPES)[number]

export interface AuthorInfo {
  id: string
  name: string
  avatarUrl?: string
  isVerified: boolean
  profileUrl: string
}

export interface TemplateStats {
  downloads: number
  favorites: number
  rating: number
  reviewCount: number
  weeklyTrend: number
}

export interface GalleryItem {
  type: 'image' | 'video'
  url: string
  caption?: string
  isBefore?: boolean
}

export interface ModelRequirement {
  name: string
  type: 'checkpoint' | 'lora' | 'controlnet' | 'vae'
  url?: string
  size: number
}

export interface MarketplaceTemplate {
  id: string
  title: string
  description: string
  shortDescription: string
  author: AuthorInfo

  categories: string[]
  tags: string[]
  difficulty: DifficultyLevel

  requiredModels: ModelRequirement[]
  requiredNodes: string[]
  vramRequirement: number

  thumbnail: string
  gallery: GalleryItem[]
  videoPreview?: string
  workflowPreview: string

  license: LicenseType
  tutorialUrl?: string
  version: string

  status: TemplateStatus
  reviewFeedback?: string
  publishedAt?: string
  updatedAt: string

  stats: TemplateStats
}

export interface CreateTemplateRequest {
  title: string
  description: string
  shortDescription: string
  categories?: string[]
  tags?: string[]
  difficulty?: DifficultyLevel
  license?: LicenseType
  tutorialUrl?: string
  requiredModels?: ModelRequirement[]
  requiredNodes?: string[]
  vramRequirement?: number
}

export interface UpdateTemplateRequest {
  title?: string
  description?: string
  shortDescription?: string
  categories?: string[]
  tags?: string[]
  difficulty?: DifficultyLevel
  license?: LicenseType
  tutorialUrl?: string
  thumbnail?: string
  videoPreview?: string
  workflowPreview?: string
  requiredModels?: ModelRequirement[]
  requiredNodes?: string[]
  vramRequirement?: number
  version?: string
}

export interface AuthorStats {
  templatesCount: number
  totalDownloads: number
  totalFavorites: number
  averageRating: number
  periodDownloads: number
  periodFavorites: number
  trend: number
}

export interface Category {
  id: string
  name: string
  description?: string
  icon?: string
}

export interface CreateTemplateResponse {
  id: string
  status: 'draft'
}

export interface SubmitTemplateResponse {
  status: 'pending_review'
}

export interface PublishTemplateResponse {
  status: 'published'
}

export interface UnpublishTemplateResponse {
  status: 'unpublished'
}

export interface MediaUploadResponse {
  url: string
  type: string
}

export interface AuthorTemplatesResponse {
  templates: MarketplaceTemplate[]
}

export interface CategoriesResponse {
  categories: Category[]
}

export interface TagSuggestResponse {
  tags: string[]
}
