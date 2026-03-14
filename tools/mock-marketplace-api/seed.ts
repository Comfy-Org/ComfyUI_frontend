import type { TemplateStatus } from '../../src/platform/marketplace/apiTypes'

import type { MockDb } from './types'

export const seed: MockDb = {
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
      thumbnail: '/api/marketplace/media/seed/thumbs/portrait.png',
      gallery: [],
      workflowPreview: '/api/marketplace/media/seed/previews/portrait.png',
      license: 'cc-by',
      version: '1.0.0',
      status: 'approved' as TemplateStatus,
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
      thumbnail: '/api/marketplace/media/seed/thumbs/gif.png',
      gallery: [],
      workflowPreview: '/api/marketplace/media/seed/previews/gif.png',
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
    },
    {
      id: 'tpl_seed_3',
      title: 'Landscape Generator',
      description: 'Generate scenic landscape images with SDXL',
      shortDescription: 'Scenic landscape generation',
      author: {
        id: 'author_1',
        name: 'ComfyCreator',
        isVerified: true,
        profileUrl: 'https://example.com/comfycreator'
      },
      categories: ['image-generation'],
      tags: ['landscape', 'sdxl', 'nature'],
      difficulty: 'beginner',
      requiredModels: [],
      requiredNodes: [],
      vramRequirement: 6144,
      thumbnail: '/api/marketplace/media/seed/thumbs/landscape.png',
      gallery: [],
      workflowPreview: '/api/marketplace/media/seed/previews/landscape.png',
      license: 'cc-by',
      version: '1.0.0',
      status: 'pending_review' as TemplateStatus,
      updatedAt: '2025-02-10T14:00:00Z',
      stats: {
        downloads: 0,
        favorites: 0,
        rating: 0,
        reviewCount: 0,
        weeklyTrend: 0
      }
    },
    {
      id: 'tpl_seed_4',
      title: 'Upscale Pro',
      description: 'High-quality image upscaling with ESRGAN',
      shortDescription: 'Professional image upscaling',
      author: {
        id: 'author_1',
        name: 'ComfyCreator',
        isVerified: true,
        profileUrl: 'https://example.com/comfycreator'
      },
      categories: ['upscaling'],
      tags: ['upscale', 'esrgan', 'image-quality'],
      difficulty: 'beginner',
      requiredModels: [],
      requiredNodes: [],
      vramRequirement: 4096,
      thumbnail: '/api/marketplace/media/seed/thumbs/upscale.png',
      gallery: [],
      workflowPreview: '/api/marketplace/media/seed/previews/upscale.png',
      license: 'mit',
      version: '1.0.0',
      status: 'published' as TemplateStatus,
      publishedAt: '2025-01-20T12:00:00Z',
      updatedAt: '2025-01-20T12:00:00Z',
      stats: {
        downloads: 500,
        favorites: 42,
        rating: 4.8,
        reviewCount: 15,
        weeklyTrend: 12.5
      }
    },
    {
      id: 'tpl_seed_5',
      title: 'Style Transfer',
      description: 'Transfer artistic styles between images',
      shortDescription: 'Artistic style transfer workflow',
      author: {
        id: 'author_1',
        name: 'ComfyCreator',
        isVerified: true,
        profileUrl: 'https://example.com/comfycreator'
      },
      categories: ['image-generation'],
      tags: ['style-transfer', 'art', 'img2img'],
      difficulty: 'intermediate',
      requiredModels: [],
      requiredNodes: [],
      vramRequirement: 6144,
      thumbnail: '/api/marketplace/media/seed/thumbs/style-transfer.png',
      gallery: [],
      workflowPreview:
        '/api/marketplace/media/seed/previews/style-transfer.png',
      license: 'cc-by',
      version: '1.0.0',
      status: 'rejected' as TemplateStatus,
      reviewFeedback:
        'Workflow needs clearer documentation and example outputs.',
      updatedAt: '2025-02-12T09:30:00Z',
      stats: {
        downloads: 0,
        favorites: 0,
        rating: 0,
        reviewCount: 0,
        weeklyTrend: 0
      }
    },
    {
      id: 'tpl_seed_6',
      title: 'Previously Live',
      description: 'A workflow that was published and then unpublished',
      shortDescription: 'Previously published, now unpublished',
      author: {
        id: 'author_1',
        name: 'ComfyCreator',
        isVerified: true,
        profileUrl: 'https://example.com/comfycreator'
      },
      categories: ['image-generation'],
      tags: ['unpublished', 'testing'],
      difficulty: 'beginner',
      requiredModels: [],
      requiredNodes: [],
      vramRequirement: 4096,
      thumbnail: '/api/marketplace/media/seed/thumbs/prev-live.png',
      gallery: [],
      workflowPreview: '/api/marketplace/media/seed/previews/prev-live.png',
      license: 'mit',
      version: '1.0.0',
      status: 'unpublished' as TemplateStatus,
      updatedAt: '2025-02-14T16:00:00Z',
      stats: {
        downloads: 120,
        favorites: 8,
        rating: 4.2,
        reviewCount: 5,
        weeklyTrend: -2.1
      }
    }
  ],
  mediaByTemplateId: {
    tpl_seed_1: [
      {
        url: '/api/marketplace/media/seed/thumbs/portrait.png',
        type: 'image/png'
      }
    ]
  },
  authorStats: {
    templatesCount: 6,
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
