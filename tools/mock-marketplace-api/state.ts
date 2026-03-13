import type {
  AuthorStats,
  Category,
  CreateTemplateRequest,
  MarketplaceTemplate,
  MediaUploadResponse,
  TemplateStatus,
  UpdateTemplateRequest
} from '../../src/platform/marketplace/apiTypes'
import { isValidTransition } from '../../src/platform/marketplace/apiTypes'

interface MockDb {
  templates: MarketplaceTemplate[]
  mediaByTemplateId: Record<string, MediaUploadResponse[]>
  authorStats: AuthorStats
  categories: Category[]
  suggestedTags: string[]
}

let nextId = 100

const seed: MockDb = {
  templates: [
    {
      id: 'tpl_seed_1',
      title: 'Portrait Studio',
      description: 'Professional portrait generation workflow',
      shortDescription: 'Generate studio-quality portraits',
      author: {
        id: 'author_1',
        name: 'ComfyCreator',
        isVerified: true,
        profileUrl: 'https://example.com/comfycreator'
      },
      categories: ['image-generation'],
      tags: ['portrait', 'stable-diffusion', 'face'],
      difficulty: 'intermediate',
      requiredModels: [
        {
          name: 'sd_xl_base_1.0.safetensors',
          type: 'checkpoint',
          size: 6_938_000_000
        }
      ],
      requiredNodes: [],
      vramRequirement: 8192,
      thumbnail: 'https://mock-cdn.example.com/thumbs/portrait.png',
      gallery: [],
      workflowPreview: 'https://mock-cdn.example.com/previews/portrait.png',
      license: 'cc-by',
      version: '1.0.0',
      status: 'published' as TemplateStatus,
      publishedAt: '2025-01-15T10:00:00Z',
      updatedAt: '2025-01-15T10:00:00Z',
      stats: {
        downloads: 1250,
        favorites: 89,
        rating: 4.5,
        reviewCount: 23,
        weeklyTrend: 5.2
      }
    },
    {
      id: 'tpl_seed_2',
      title: 'Video to GIF',
      description: 'Convert short video clips to optimized GIFs',
      shortDescription: 'Video-to-GIF conversion',
      author: {
        id: 'author_1',
        name: 'ComfyCreator',
        isVerified: true,
        profileUrl: 'https://example.com/comfycreator'
      },
      categories: ['video'],
      tags: ['video', 'gif', 'conversion'],
      difficulty: 'beginner',
      requiredModels: [],
      requiredNodes: ['ComfyUI-VideoHelperSuite'],
      vramRequirement: 4096,
      thumbnail: 'https://mock-cdn.example.com/thumbs/gif.png',
      gallery: [],
      workflowPreview: 'https://mock-cdn.example.com/previews/gif.png',
      license: 'mit',
      version: '2.1.0',
      status: 'draft' as TemplateStatus,
      updatedAt: '2025-02-01T08:30:00Z',
      stats: {
        downloads: 0,
        favorites: 0,
        rating: 0,
        reviewCount: 0,
        weeklyTrend: 0
      }
    }
  ],
  mediaByTemplateId: {
    tpl_seed_1: [
      {
        url: 'https://mock-cdn.example.com/thumbs/portrait.png',
        type: 'image/png'
      }
    ]
  },
  authorStats: {
    templatesCount: 2,
    totalDownloads: 1250,
    totalFavorites: 89,
    averageRating: 4.5,
    periodDownloads: 120,
    periodFavorites: 8,
    trend: 5.2
  },
  categories: [
    { id: 'image-generation', name: 'Image Generation' },
    { id: 'video', name: 'Video' },
    { id: 'audio', name: 'Audio' },
    { id: 'upscaling', name: 'Upscaling' },
    { id: 'inpainting', name: 'Inpainting' },
    { id: 'controlnet', name: 'ControlNet' }
  ],
  suggestedTags: [
    'image-generation',
    'stable-diffusion',
    'sdxl',
    'portrait',
    'landscape',
    'video',
    'gif',
    'upscale',
    'inpaint',
    'controlnet',
    'lora',
    'face',
    'style-transfer',
    'img2img',
    'txt2img',
    'animation'
  ]
}

let db: MockDb = structuredClone(seed)

export function resetDb(): void {
  db = structuredClone(seed)
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

  if (to === 'approved') {
    template.publishedAt = template.updatedAt
  }

  return { ok: true }
}

export function addMedia(
  templateId: string,
  mimeType: string,
  filename: string
): MediaUploadResponse | undefined {
  if (!findTemplate(templateId)) return undefined

  const entry: MediaUploadResponse = {
    url: `https://mock-cdn.example.com/uploads/${templateId}/${filename}`,
    type: mimeType
  }

  if (!db.mediaByTemplateId[templateId]) {
    db.mediaByTemplateId[templateId] = []
  }
  db.mediaByTemplateId[templateId].push(entry)

  return entry
}
