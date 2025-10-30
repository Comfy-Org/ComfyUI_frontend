/**
 * Survey Response Normalization Utilities
 *
 * Smart categorization system to normalize free-text survey responses
 * into standardized categories for better analytics breakdowns.
 * Uses Fuse.js for fuzzy matching against category keywords.
 */

import Fuse from 'fuse.js'

interface CategoryMapping {
  name: string
  keywords: string[]
  userCount?: number // For reference from analysis
}

/**
 * Industry category mappings based on ~9,000 user analysis
 */
const INDUSTRY_CATEGORIES: CategoryMapping[] = [
  {
    name: 'Film / TV / Animation',
    userCount: 2885,
    keywords: [
      'film',
      'tv',
      'television',
      'animation',
      'story',
      'anime',
      'video',
      'cinematography',
      'visual effects',
      'vfx',
      'movie',
      'cinema',
      'documentary',
      'broadcast',
      'streaming',
      'production',
      'director',
      'filmmaker',
      'post-production',
      'editing'
    ]
  },
  {
    name: 'Marketing / Advertising / Social Media',
    userCount: 1340,
    keywords: [
      'marketing',
      'advertising',
      'youtube',
      'tiktok',
      'social media',
      'content creation',
      'influencer',
      'brand',
      'promotion',
      'digital marketing',
      'seo',
      'campaigns',
      'copywriting',
      'growth',
      'engagement'
    ]
  },
  {
    name: 'Software / IT / AI',
    userCount: 1100,
    keywords: [
      'software',
      'it',
      'ai',
      'developer',
      'consulting',
      'engineering',
      'tech',
      'programmer',
      'data science',
      'machine learning',
      'coding',
      'programming',
      'web development',
      'app development',
      'saas',
      'startup'
    ]
  },
  {
    name: 'Product & Industrial Design',
    userCount: 1050,
    keywords: [
      'product design',
      'industrial',
      'manufacturing',
      '3d rendering',
      'product visualization',
      'mechanical',
      'automotive',
      'cad',
      'prototype',
      'design engineering',
      'invention'
    ]
  },
  {
    name: 'Fine Art / Contemporary Art',
    userCount: 780,
    keywords: [
      'fine art',
      'art',
      'illustration',
      'contemporary',
      'artist',
      'painting',
      'drawing',
      'sculpture',
      'gallery',
      'canvas',
      'digital art',
      'mixed media',
      'abstract',
      'portrait'
    ]
  },
  {
    name: 'Education / Research',
    userCount: 640,
    keywords: [
      'education',
      'student',
      'teacher',
      'research',
      'learning',
      'university',
      'school',
      'academic',
      'professor',
      'curriculum',
      'training',
      'instruction',
      'pedagogy'
    ]
  },
  {
    name: 'Architecture / Engineering / Construction',
    userCount: 420,
    keywords: [
      'architecture',
      'construction',
      'engineering',
      'civil',
      'cad',
      'building',
      'structural',
      'landscape',
      'interior design',
      'real estate',
      'planning',
      'blueprints'
    ]
  },
  {
    name: 'Gaming / Interactive Media',
    userCount: 410,
    keywords: [
      'gaming',
      'game dev',
      'game development',
      'roblox',
      'interactive',
      'virtual world',
      'vr',
      'ar',
      'metaverse',
      'simulation',
      'unity',
      'unreal',
      'indie games'
    ]
  },
  {
    name: 'Photography / Videography',
    userCount: 70,
    keywords: [
      'photography',
      'photo',
      'videography',
      'camera',
      'image',
      'portrait',
      'wedding',
      'commercial photo',
      'stock photography',
      'photojournalism',
      'event photography'
    ]
  },
  {
    name: 'Fashion / Beauty / Retail',
    userCount: 25,
    keywords: [
      'fashion',
      'beauty',
      'jewelry',
      'retail',
      'style',
      'clothing',
      'cosmetics',
      'makeup',
      'accessories',
      'boutique',
      'ecommerce'
    ]
  },
  {
    name: 'Music / Performing Arts',
    userCount: 25,
    keywords: [
      'music',
      'vj',
      'dance',
      'projection mapping',
      'audio visual',
      'concert',
      'performance',
      'theater',
      'stage',
      'live events'
    ]
  },
  {
    name: 'Healthcare / Medical / Life Science',
    userCount: 30,
    keywords: [
      'healthcare',
      'medical',
      'doctor',
      'biotech',
      'life science',
      'pharmaceutical',
      'clinical',
      'hospital',
      'medicine',
      'health'
    ]
  },
  {
    name: 'E-commerce / Print-on-Demand / Business',
    userCount: 15,
    keywords: [
      'ecommerce',
      'print on demand',
      'shop',
      'business',
      'commercial',
      'startup',
      'entrepreneur',
      'sales',
      'retail',
      'online store'
    ]
  },
  {
    name: 'Nonprofit / Government / Public Sector',
    userCount: 15,
    keywords: [
      '501c3',
      'ngo',
      'government',
      'public service',
      'policy',
      'nonprofit',
      'charity',
      'civic',
      'community',
      'social impact'
    ]
  },
  {
    name: 'Adult / NSFW',
    userCount: 10,
    keywords: ['nsfw', 'adult', 'erotic', 'explicit', 'xxx', 'porn']
  }
]

/**
 * Use case category mappings based on common patterns
 */
const USE_CASE_CATEGORIES: CategoryMapping[] = [
  {
    name: 'Content Creation & Marketing',
    keywords: [
      'content creation',
      'social media',
      'marketing',
      'advertising',
      'youtube',
      'tiktok',
      'instagram',
      'thumbnails',
      'posts',
      'campaigns',
      'brand content'
    ]
  },
  {
    name: 'Art & Illustration',
    keywords: [
      'art',
      'illustration',
      'drawing',
      'painting',
      'concept art',
      'character design',
      'digital art',
      'fantasy art',
      'portraits'
    ]
  },
  {
    name: 'Product Visualization & Design',
    keywords: [
      'product',
      'visualization',
      'design',
      'prototype',
      'mockup',
      '3d rendering',
      'industrial design',
      'product photos'
    ]
  },
  {
    name: 'Film & Video Production',
    keywords: [
      'film',
      'video',
      'movie',
      'animation',
      'vfx',
      'visual effects',
      'storyboard',
      'cinematography',
      'post production'
    ]
  },
  {
    name: 'Gaming & Interactive Media',
    keywords: [
      'game',
      'gaming',
      'interactive',
      'vr',
      'ar',
      'virtual',
      'simulation',
      'metaverse',
      'game assets',
      'textures'
    ]
  },
  {
    name: 'Architecture & Construction',
    keywords: [
      'architecture',
      'building',
      'construction',
      'interior design',
      'landscape',
      'real estate',
      'floor plans',
      'renderings'
    ]
  },
  {
    name: 'Education & Training',
    keywords: [
      'education',
      'training',
      'learning',
      'teaching',
      'tutorial',
      'course',
      'academic',
      'instructional',
      'workshops'
    ]
  },
  {
    name: 'Research & Development',
    keywords: [
      'research',
      'development',
      'experiment',
      'prototype',
      'testing',
      'analysis',
      'study',
      'innovation',
      'r&d'
    ]
  },
  {
    name: 'Personal & Hobby',
    keywords: [
      'personal',
      'hobby',
      'fun',
      'experiment',
      'learning',
      'curiosity',
      'explore',
      'creative',
      'side project'
    ]
  },
  {
    name: 'Photography & Image Processing',
    keywords: [
      'photography',
      'photo',
      'image',
      'portrait',
      'editing',
      'enhancement',
      'restoration',
      'photo manipulation'
    ]
  }
]

/**
 * Fuse.js configuration for category matching
 */
const FUSE_OPTIONS = {
  keys: ['keywords'],
  threshold: 0.7, // Higher = more lenient matching
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  findAllMatches: true
}

/**
 * Create Fuse instances for category matching
 */
const industryFuse = new Fuse(INDUSTRY_CATEGORIES, FUSE_OPTIONS)
const useCaseFuse = new Fuse(USE_CASE_CATEGORIES, FUSE_OPTIONS)

/**
 * Normalize industry responses using Fuse.js fuzzy search
 */
export function normalizeIndustry(rawIndustry: string): string {
  if (!rawIndustry || typeof rawIndustry !== 'string') {
    return 'Other / Undefined'
  }

  const industry = rawIndustry.toLowerCase().trim()

  // Handle common undefined responses
  if (
    industry.match(/^(other|none|undefined|unknown|n\/a|not applicable|-|)$/)
  ) {
    return 'Other / Undefined'
  }

  // Fuse.js fuzzy search for best category match
  const results = industryFuse.search(rawIndustry)

  if (results.length > 0) {
    return results[0].item.name
  }

  // No good match found - preserve original with prefix
  return `Uncategorized: ${rawIndustry}`
}

/**
 * Normalize use case responses using Fuse.js fuzzy search
 */
export function normalizeUseCase(rawUseCase: string): string {
  if (!rawUseCase || typeof rawUseCase !== 'string') {
    return 'Other / Undefined'
  }

  const useCase = rawUseCase.toLowerCase().trim()

  // Handle common undefined responses
  if (
    useCase.match(/^(other|none|undefined|unknown|n\/a|not applicable|-|)$/)
  ) {
    return 'Other / Undefined'
  }

  // Fuse.js fuzzy search for best category match
  const results = useCaseFuse.search(rawUseCase)

  if (results.length > 0) {
    return results[0].item.name
  }

  // No good match found - preserve original with prefix
  return `Uncategorized: ${rawUseCase}`
}

/**
 * Apply normalization to survey responses
 * Creates both normalized and raw versions of responses
 */
export function normalizeSurveyResponses(responses: {
  industry?: string
  useCase?: string
  [key: string]: any
}) {
  const normalized = { ...responses }

  // Normalize industry
  if (responses.industry) {
    normalized.industry_normalized = normalizeIndustry(responses.industry)
    normalized.industry_raw = responses.industry
  }

  // Normalize use case
  if (responses.useCase) {
    normalized.useCase_normalized = normalizeUseCase(responses.useCase)
    normalized.useCase_raw = responses.useCase
  }

  return normalized
}
