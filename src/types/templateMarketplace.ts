/**
 * A workflow template listed in the marketplace, including its metadata,
 * media assets, technical requirements, and publication status.
 */
export interface MarketplaceTemplate {
  id: string
  title: string
  description: string
  shortDescription: string
  author: AuthorInfo

  categories: string[]
  tags: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'

  requiredModels: ModelRequirement[]
  requiredNodes: string[]
  vramRequirement: number // Minimum VRAM in bytes needed to run this template

  thumbnail: string
  gallery: GalleryItem[]
  videoPreview?: string
  workflowPreview: string // URL to a static image preview of the workflow graph

  license: LicenseType
  tutorialUrl?: string
  version: string

  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'unpublished'
  reviewFeedback?: string
  publishedAt?: Date
  updatedAt: Date

  stats: TemplateStats
}

/**
 * Author profile information displayed alongside a marketplace template.
 */
export interface AuthorInfo {
  id: string
  name: string
  avatarUrl?: string
  isVerified: boolean
  profileUrl: string
}

/**
 * Aggregate engagement and popularity statistics for a marketplace template.
 */
export interface TemplateStats {
  downloads: number
  favorites: number
  rating: number
  reviewCount: number
  weeklyTrend: number // Week-over-week percentage change in downloads
}

/**
 * A single image or video entry in a template's gallery.
 */
export interface GalleryItem {
  type: 'image' | 'video'
  url: string
  caption?: string
  isBefore?: boolean // When true, indicates this item is the "before" half of a before/after pair
}

/**
 * A model dependency required to run a marketplace template.
 */
export interface ModelRequirement {
  name: string
  type: 'checkpoint' | 'lora' | 'controlnet' | 'vae'
  url?: string // Download URL for the model
  size: number // in bytes
}

/**
 * Supported license types for marketplace templates.
 */
export type LicenseType =
  | 'cc-by'
  | 'cc-by-sa'
  | 'cc-by-nc'
  | 'mit'
  | 'apache'
  | 'custom'
