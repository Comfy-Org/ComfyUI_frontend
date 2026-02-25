/**
 * An in-memory cached file awaiting upload, retaining its original filename
 * and a blob URL for local preview.
 */
export interface CachedAsset {
  /** The raw File object from the user's file picker. */
  file: File
  /** A `blob:` URL created via `URL.createObjectURL` for local display. */
  objectUrl: string
  /** The filename as it appeared on the user's filesystem. */
  originalName: string
}

/**
 * A workflow template listed in the marketplace, including its metadata,
 * media assets, technical requirements, and publication status.
 */
export interface MarketplaceTemplate {
  /** Unique identifier for this template. */
  id: string
  /** Display title shown in the marketplace. */
  title: string
  /** Full description with usage details and context. */
  description: string
  /** One-line summary shown in card views and search results. */
  shortDescription: string
  /** Profile of the template author. */
  author: AuthorInfo

  /** Semantic categories (e.g. 'image-generation', 'audio'). */
  categories: string[]
  /** Freeform tags for search and filtering. */
  tags: string[]
  /** Skill level assumed by the template's instructions and complexity. */
  difficulty: 'beginner' | 'intermediate' | 'advanced'

  /** Model files that must be downloaded before running this template. */
  requiredModels: ModelRequirement[]
  /** Custom node package IDs required by this template. */
  requiredNodes: string[]
  /**
   * Custom node package IDs (folder names from `custom_nodes/`) required by
   * this template. Derived from the `python_module` of each custom node
   * definition found in the workflow graph.
   */
  requiresCustomNodes: string[]
  /** Minimum VRAM in bytes needed to run this template. */
  vramRequirement: number

  /** URL to the primary thumbnail image. */
  thumbnail: string
  /** URL to the "before" image in a before/after comparison. */
  beforeImage?: string
  /** URL to the "after" image in a before/after comparison. */
  afterImage?: string
  /** Ordered collection of images and videos showcasing the template. */
  gallery: GalleryItem[]
  /** URL to an optional video walkthrough or demo. */
  videoPreview?: string
  /** URL to a static image preview of the workflow graph. */
  workflowPreview: string

  /** License governing usage and redistribution. */
  license: LicenseType
  /** URL to an external tutorial or guide for this template. */
  tutorialUrl?: string
  /** Semantic version string (e.g. '1.2.0'). */
  version: string

  /** Current publication lifecycle stage. */
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'unpublished'
  /** Reviewer notes returned when the template is rejected. */
  reviewFeedback?: string
  /** Timestamp when the template was first published. */
  publishedAt?: Date
  /** Timestamp of the most recent content update. */
  updatedAt: Date

  /** Aggregate engagement and popularity metrics. */
  stats: TemplateStats
}

/**
 * Author profile information displayed alongside a marketplace template.
 */
export interface AuthorInfo {
  /** Unique author identifier. */
  id: string
  /** Display name. */
  name: string
  /** URL to the author's avatar image. */
  avatarUrl?: string
  /** Whether the author's identity has been verified by the platform. */
  isVerified: boolean
  /** URL to the author's public profile page. */
  profileUrl: string
}

/**
 * Aggregate engagement and popularity statistics for a marketplace template.
 */
export interface TemplateStats {
  /** Total number of times this template has been downloaded. */
  downloads: number
  /** Number of users who have favorited this template. */
  favorites: number
  /** Average user rating (e.g. 0-5 scale). */
  rating: number
  /** Total number of user reviews submitted. */
  reviewCount: number
  /** Week-over-week percentage change in downloads. */
  weeklyTrend: number
}

/**
 * A single image or video entry in a template's gallery.
 */
export interface GalleryItem {
  /** Media format of this gallery entry. */
  type: 'image' | 'video'
  /** URL to the media asset. */
  url: string
  /** Optional descriptive caption displayed below the media. */
  caption?: string
  /** When true, marks this item as the "before" half of a before/after pair. */
  isBefore?: boolean
}

/**
 * A model dependency required to run a marketplace template.
 */
export interface ModelRequirement {
  /** Human-readable model name. */
  name: string
  /** Architecture category of the model. */
  type: 'checkpoint' | 'lora' | 'controlnet' | 'vae'
  /** Download URL for the model file. */
  url?: string
  /** File size in bytes. */
  size: number
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

/**
 * A developer's public profile containing their identity,
 * published templates, and aggregate statistics.
 */
export interface DeveloperProfile {
  /** Handle shown in URLs and mentions (e.g. '@StoneCypher'). */
  username: string
  /** Human-readable display name. */
  displayName: string
  /** URL to the developer's avatar image. */
  avatarUrl?: string
  /** URL to a wide banner image displayed at the top of the profile. */
  bannerUrl?: string
  /** Short biography or tagline. */
  bio?: string
  /** Whether the developer's identity has been verified by the platform. */
  isVerified: boolean
  /** Whether the developer has opted into revenue sharing. */
  monetizationEnabled: boolean
  /** Date the developer joined the platform. */
  joinedAt: Date
  /** Number of other templates that depend on this developer's work. */
  dependencies: number
  /** Lifetime download count across all published templates. */
  totalDownloads: number
  /** Lifetime favorite count across all published templates. */
  totalFavorites: number
  /** Average star rating across all published templates. */
  averageRating: number
  /** Number of published templates. */
  templateCount: number
}

/**
 * A user review of a marketplace template, including a star rating
 * and optional text commentary.
 */
export interface TemplateReview {
  /** Unique review identifier. */
  id: string
  /** Display name of the reviewer. */
  authorName: string
  /** URL to the reviewer's avatar image. */
  authorAvatarUrl?: string
  /** Star rating from 1 to 5, supporting 0.5 increments. */
  rating: number
  /** Review body text. */
  text: string
  /** When the review was submitted. */
  createdAt: Date
  /** ID of the template being reviewed. */
  templateId: string
}

/**
 * A single day's download count in a developer's download history.
 */
export interface DownloadHistoryEntry {
  /** The calendar date this count represents (midnight UTC). */
  date: Date
  /** Number of downloads recorded on this date. */
  downloads: number
}

/**
 * Time range options for the download history chart.
 */
export type DownloadHistoryRange = 'week' | 'month' | 'year' | 'allTime'

/**
 * Revenue information for a single published template,
 * visible only to the template's author when monetization is enabled.
 */
export interface TemplateRevenue {
  /** ID of the template this revenue data belongs to. */
  templateId: string
  /** Lifetime revenue in cents. */
  totalRevenue: number
  /** Revenue earned in the current calendar month, in cents. */
  monthlyRevenue: number
  /** ISO 4217 currency code (e.g. 'USD'). */
  currency: string
}
