/**
 * Stub service for fetching and mutating developer profile data.
 *
 * Every function is named after the endpoint it will eventually call
 * but currently returns hardcoded fake data. When multiple developers
 * are known, the stub dispatches on the `username` parameter so the UI
 * can be exercised with different profiles.
 */
import type {
  DeveloperProfile,
  DownloadHistoryEntry,
  MarketplaceTemplate,
  TemplateReview,
  TemplateRevenue
} from '@/types/templateMarketplace'

const CURRENT_USERNAME = '@StoneCypher'

/**
 * Returns the hardcoded current user's username for profile ownership checks.
 */
export function getCurrentUsername(): string {
  return CURRENT_USERNAME
}

/** Stub profiles keyed by handle. */
const STUB_PROFILES: Record<string, DeveloperProfile> = {
  '@StoneCypher': {
    username: '@StoneCypher',
    displayName: 'Stone Cypher',
    avatarUrl: undefined,
    bannerUrl: undefined,
    bio: 'Workflow designer and custom node author. Building tools for the ComfyUI community.',
    isVerified: true,
    monetizationEnabled: true,
    joinedAt: new Date('2024-03-15'),
    dependencies: 371,
    totalDownloads: 18_420,
    totalFavorites: 1_273,
    averageRating: 4.3,
    templateCount: 3
  },
  '@PixelWizard': {
    username: '@PixelWizard',
    displayName: 'Pixel Wizard',
    avatarUrl: undefined,
    bannerUrl: undefined,
    bio: 'Generative artist exploring the intersection of AI and traditional media.',
    isVerified: false,
    monetizationEnabled: false,
    joinedAt: new Date('2025-01-10'),
    dependencies: 12,
    totalDownloads: 3_840,
    totalFavorites: 295,
    averageRating: 4.7,
    templateCount: 1
  }
}

function fallbackProfile(username: string): DeveloperProfile {
  return {
    username,
    displayName: username.replace(/^@/, ''),
    avatarUrl: undefined,
    bannerUrl: undefined,
    bio: undefined,
    isVerified: false,
    monetizationEnabled: false,
    joinedAt: new Date(),
    dependencies: 0,
    totalDownloads: 0,
    totalFavorites: 0,
    averageRating: 0,
    templateCount: 0
  }
}

/**
 * Fetches a developer's public profile by username.
 */
export async function fetchDeveloperProfile(
  username: string
): Promise<DeveloperProfile> {
  // comeback todo — replace with GET /api/v1/developers/{username}
  return STUB_PROFILES[username] ?? fallbackProfile(username)
}

/** Stub reviews keyed by developer handle. */
const STUB_REVIEWS: Record<string, TemplateReview[]> = {
  '@StoneCypher': [
    {
      id: 'rev-1',
      authorName: 'PixelWizard',
      authorAvatarUrl: undefined,
      rating: 5,
      text: 'Incredible workflow — saved me hours of manual setup. The ControlNet integration is seamless.',
      createdAt: new Date('2025-11-02'),
      templateId: 'tpl-1'
    },
    {
      id: 'rev-2',
      authorName: 'NeuralNomad',
      authorAvatarUrl: undefined,
      rating: 3.5,
      text: 'Good starting point but the VRAM requirements are higher than listed. Works well on a 4090.',
      createdAt: new Date('2025-10-18'),
      templateId: 'tpl-2'
    },
    {
      id: 'rev-3',
      authorName: 'DiffusionDan',
      authorAvatarUrl: undefined,
      rating: 4,
      text: 'Clean graph layout and well-documented. Would love to see a video tutorial added.',
      createdAt: new Date('2025-09-30'),
      templateId: 'tpl-1'
    },
    {
      id: 'rev-4',
      authorName: 'ArtBotAlice',
      authorAvatarUrl: undefined,
      rating: 2.5,
      text: 'Had trouble with the LoRA loader step — might be a version mismatch. Otherwise decent.',
      createdAt: new Date('2025-08-14'),
      templateId: 'tpl-3'
    }
  ],
  '@PixelWizard': [
    {
      id: 'rev-5',
      authorName: 'Stone Cypher',
      authorAvatarUrl: undefined,
      rating: 4.5,
      text: 'Elegant approach to img2img. The parameter presets are a nice touch.',
      createdAt: new Date('2025-12-01'),
      templateId: 'tpl-pw-1'
    }
  ]
}

/**
 * Fetches reviews left on a developer's published templates.
 */
export async function fetchDeveloperReviews(
  username: string
): Promise<TemplateReview[]> {
  // comeback todo — replace with GET /api/v1/developers/{username}/reviews
  return STUB_REVIEWS[username] ?? []
}

function makeAuthor(
  username: string,
  profile: DeveloperProfile
): MarketplaceTemplate['author'] {
  return {
    id: `usr-${username}`,
    name: profile.displayName,
    isVerified: profile.isVerified,
    profileUrl: `/developers/${username}`
  }
}

/** Stub templates keyed by developer handle. */
function stubTemplatesFor(username: string): MarketplaceTemplate[] {
  const profile = STUB_PROFILES[username]
  if (!profile) return []
  const author = makeAuthor(username, profile)
  const now = new Date()

  if (username === '@PixelWizard') {
    return [
      {
        id: 'tpl-pw-1',
        title: 'Dreamy Landscapes img2img',
        description:
          'Transform rough sketches into dreamy landscape paintings with guided diffusion.',
        shortDescription: 'Sketch-to-landscape with img2img',
        author,
        categories: ['image-generation'],
        tags: ['img2img', 'landscape', 'painting'],
        difficulty: 'beginner',
        requiredModels: [
          { name: 'SD 1.5', type: 'checkpoint', size: 4_200_000_000 }
        ],
        requiredNodes: [],
        requiresCustomNodes: [],
        vramRequirement: 6_000_000_000,
        thumbnail: '',
        gallery: [],
        workflowPreview: '',
        license: 'cc-by',
        version: '1.0.0',
        status: 'approved',
        publishedAt: new Date('2025-02-15'),
        updatedAt: now,
        stats: {
          downloads: 3_840,
          favorites: 295,
          rating: 4.7,
          reviewCount: 8,
          weeklyTrend: 3.1
        }
      }
    ]
  }

  // @StoneCypher templates
  return [
    {
      id: 'tpl-1',
      title: 'SDXL Turbo Portrait Studio',
      description:
        'End-to-end portrait generation with face correction and upscaling.',
      shortDescription: 'Fast portrait generation with SDXL Turbo',
      author,
      categories: ['image-generation'],
      tags: ['portrait', 'sdxl', 'turbo'],
      difficulty: 'beginner',
      requiredModels: [
        { name: 'SDXL Turbo', type: 'checkpoint', size: 6_500_000_000 }
      ],
      requiredNodes: [],
      requiresCustomNodes: [],
      vramRequirement: 8_000_000_000,
      thumbnail: '',
      gallery: [],
      workflowPreview: '',
      license: 'cc-by',
      version: '1.2.0',
      status: 'approved',
      publishedAt: new Date('2025-06-01'),
      updatedAt: now,
      stats: {
        downloads: 9_200,
        favorites: 680,
        rating: 4.5,
        reviewCount: 42,
        weeklyTrend: 5.2
      }
    },
    {
      id: 'tpl-2',
      title: 'ControlNet Depth-to-Image',
      description:
        'Depth-guided image generation using MiDaS depth estimation and ControlNet.',
      shortDescription: 'Depth-guided generation with ControlNet',
      author,
      categories: ['image-generation'],
      tags: ['controlnet', 'depth', 'midas'],
      difficulty: 'intermediate',
      requiredModels: [
        { name: 'SD 1.5', type: 'checkpoint', size: 4_200_000_000 },
        { name: 'ControlNet Depth', type: 'controlnet', size: 1_400_000_000 }
      ],
      requiredNodes: [],
      requiresCustomNodes: [],
      vramRequirement: 10_000_000_000,
      thumbnail: '',
      gallery: [],
      workflowPreview: '',
      license: 'mit',
      version: '2.0.1',
      status: 'approved',
      publishedAt: new Date('2025-04-12'),
      updatedAt: now,
      stats: {
        downloads: 6_800,
        favorites: 410,
        rating: 3.8,
        reviewCount: 27,
        weeklyTrend: -1.3
      }
    },
    {
      id: 'tpl-3',
      title: 'LoRA Style Transfer Pipeline',
      description:
        'Apply artistic styles via LoRA fine-tunes with automatic strength scheduling.',
      shortDescription: 'Artistic style transfer with LoRA',
      author,
      categories: ['style-transfer'],
      tags: ['lora', 'style', 'art'],
      difficulty: 'advanced',
      requiredModels: [
        { name: 'SD 1.5', type: 'checkpoint', size: 4_200_000_000 },
        { name: 'Watercolor LoRA', type: 'lora', size: 150_000_000 }
      ],
      requiredNodes: [],
      requiresCustomNodes: [],
      vramRequirement: 6_000_000_000,
      thumbnail: '',
      gallery: [],
      workflowPreview: '',
      license: 'cc-by-sa',
      version: '1.0.0',
      status: 'approved',
      publishedAt: new Date('2025-08-20'),
      updatedAt: now,
      stats: {
        downloads: 2_420,
        favorites: 183,
        rating: 4.1,
        reviewCount: 11,
        weeklyTrend: 12.7
      }
    }
  ]
}

/**
 * Fetches all templates published by a developer.
 */
export async function fetchPublishedTemplates(
  username: string
): Promise<MarketplaceTemplate[]> {
  // comeback todo — replace with GET /api/v1/developers/{username}/templates
  return stubTemplatesFor(username)
}

/** Stub revenue keyed by developer handle. */
const STUB_REVENUE: Record<string, TemplateRevenue[]> = {
  '@StoneCypher': [
    {
      templateId: 'tpl-1',
      totalRevenue: 45_230,
      monthlyRevenue: 3_800,
      currency: 'USD'
    },
    {
      templateId: 'tpl-2',
      totalRevenue: 22_110,
      monthlyRevenue: 1_450,
      currency: 'USD'
    },
    {
      templateId: 'tpl-3',
      totalRevenue: 8_920,
      monthlyRevenue: 920,
      currency: 'USD'
    }
  ]
}

/**
 * Fetches revenue data for a developer's templates.
 * Only accessible by the template author.
 */
export async function fetchTemplateRevenue(
  username: string
): Promise<TemplateRevenue[]> {
  // comeback todo — replace with GET /api/v1/developers/{username}/revenue
  return STUB_REVENUE[username] ?? []
}

/**
 * Unpublishes a template by its ID.
 */
export async function unpublishTemplate(_templateId: string): Promise<void> {
  // comeback todo — replace with POST /api/v1/templates/{templateId}/unpublish
}

/**
 * Saves changes to a developer's profile.
 */
export async function saveDeveloperProfile(
  profile: Partial<DeveloperProfile>
): Promise<DeveloperProfile> {
  // comeback todo — replace with PUT /api/v1/developers/{username}
  const base =
    STUB_PROFILES[profile.username ?? CURRENT_USERNAME] ??
    fallbackProfile(profile.username ?? CURRENT_USERNAME)
  return { ...base, ...profile } as DeveloperProfile
}

/**
 * Generates a deterministic pseudo-random daily download history starting
 * from 730 days ago (two years). The seed is derived from the username so
 * different profiles produce different but stable curves.
 */
function stubDownloadHistory(username: string): DownloadHistoryEntry[] {
  const days = 730
  const entries: DownloadHistoryEntry[] = []
  const baseDownloads = username === '@StoneCypher' ? 42 : 12

  let seed = 0
  for (const ch of username) seed = (seed * 31 + ch.charCodeAt(0)) | 0

  function nextRand(): number {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed & 0x7fffffff) / 2147483647
  }

  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)

    const dayOfWeek = date.getDay()
    const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 1.4 : 1.0
    const trendMultiplier = 1 + (days - i) / days
    const noise = 0.5 + nextRand()

    entries.push({
      date,
      downloads: Math.round(
        baseDownloads * weekendMultiplier * trendMultiplier * noise
      )
    })
  }

  return entries
}

/**
 * Fetches daily download history for a developer's templates.
 *
 * Returns one entry per day, spanning two years, in chronological order.
 * Each entry records the aggregate download count across all of the
 * developer's published templates for that calendar day.
 *
 * @param username - Developer handle (e.g. '@StoneCypher').
 * @returns Chronologically-ordered daily download entries.
 */
export async function fetchDownloadHistory(
  username: string
): Promise<DownloadHistoryEntry[]> {
  // comeback
  return stubDownloadHistory(username)
}
