import type { HubTemplate } from '@/lib/hub/types'

export const vfxWorkflows = [
  {
    template: {
      name: 'be0889296f65-be0889296f65',
      title: 'VFX Utilities',
      mediaType: 'video',
      tags: ['Visual Effects', 'Video'],
      models: [],
      logos: [],
      usage: 20,
      date: '',
      thumbnails: [
        'https://media.comfy.org/hub-media/posters/fd38a7e9-0d2a-4d6a-9d6a-b04bbce294cc.jpg'
      ],
      username: 'doughogan',
      isApp: false
    },
    href: 'https://comfy.org/workflows/be0889296f65-be0889296f65/',
    creatorDisplayName: 'Doug Hogan',
    creatorAvatarUrl:
      'https://comfy-hub-assets.comfy.org/uploads/6c704676-fb65-4828-917b-34b075ec5a74.jpg'
  },
  {
    template: {
      name: '58a3f7167dba-58a3f7167dba',
      title: 'Minimax H3 Video Restyling',
      mediaType: 'video',
      tags: ['Visual Effects'],
      models: ['MiniMax'],
      logos: [],
      usage: 17,
      date: '',
      thumbnails: [
        'https://media.comfy.org/hub-media/posters/93d4af64-c1a4-4a44-8d5a-e1f4d0ea28e3.jpg'
      ],
      username: 'doughogan',
      isApp: false
    },
    href: 'https://comfy.org/workflows/58a3f7167dba-58a3f7167dba/',
    creatorDisplayName: 'Doug Hogan',
    creatorAvatarUrl:
      'https://comfy-hub-assets.comfy.org/uploads/6c704676-fb65-4828-917b-34b075ec5a74.jpg'
  },
  {
    template: {
      name: '8f2cf0df5da6-8f2cf0df5da6',
      title: 'LTX Cleanplate VFX',
      mediaType: 'video',
      tags: ['Visual Effects', 'Video'],
      models: ['LTX'],
      logos: [],
      usage: 16,
      date: '',
      thumbnails: [
        'https://media.comfy.org/hub-media/posters/8a3a846f-5017-428e-b2a2-24025c55e884.jpg'
      ],
      username: 'doughogan',
      isApp: false
    },
    href: 'https://comfy.org/workflows/8f2cf0df5da6-8f2cf0df5da6/',
    creatorDisplayName: 'Doug Hogan',
    creatorAvatarUrl:
      'https://comfy-hub-assets.comfy.org/uploads/6c704676-fb65-4828-917b-34b075ec5a74.jpg'
  },
  {
    template: {
      name: '7a6ab8b6e694-7a6ab8b6e694',
      title: 'VFX - Bullet Time Effect',
      mediaType: 'video',
      tags: ['Visual Effects', 'Image to Video', 'Video'],
      models: ['Seedance', 'Gemini'],
      logos: [],
      usage: 5,
      date: '',
      thumbnails: [
        'https://media.comfy.org/hub-media/posters/0452f2b4-e87c-4230-9b4d-cf017760b99a.jpg'
      ],
      username: 'sirolim',
      isApp: false
    },
    href: 'https://comfy.org/workflows/7a6ab8b6e694-7a6ab8b6e694/',
    creatorDisplayName: 'Sirolim',
    creatorAvatarUrl:
      'https://comfy-hub-assets.comfy.org/templates/profiles/sirolim.png'
  },
  {
    template: {
      name: 'e0df9e9c7683-e0df9e9c7683',
      title: 'Text Match Cut',
      mediaType: 'video',
      tags: ['Batch Generation', 'Visual Effects', 'Video'],
      models: ['OpenAI'],
      logos: [],
      usage: 4,
      date: '',
      thumbnails: [
        'https://media.comfy.org/hub-media/posters/eaec964c-035e-4b91-bd3a-0018ec024d9c.jpg'
      ],
      username: 'jms',
      isApp: false
    },
    href: 'https://comfy.org/workflows/e0df9e9c7683-e0df9e9c7683/',
    creatorDisplayName: 'JMS',
    creatorAvatarUrl:
      'https://comfy-hub-assets.comfy.org/uploads/ed06cc57-ee95-402b-8fbb-873a70d56e69.png'
  },
  {
    template: {
      name: '171dea657096-171dea657096',
      title: 'Utility Video Upscale',
      mediaType: 'video',
      tags: ['Video Upscale', 'Video Edit', 'Visual Effects'],
      models: ['Wan'],
      logos: [],
      usage: 2,
      date: '',
      thumbnails: [
        'https://comfy-hub-assets.comfy.org/uploads/ae14acf1-b89d-4391-8c44-5808d18440dc.webp',
        'https://comfy-hub-assets.comfy.org/uploads/3c4a0b86-c7f6-46bf-ba23-967981641176.webp'
      ],
      username: 'sirolim',
      isApp: false,
      thumbnailVariant: 'compareSlider'
    },
    href: 'https://comfy.org/workflows/171dea657096-171dea657096/',
    creatorDisplayName: 'Sirolim',
    creatorAvatarUrl:
      'https://comfy-hub-assets.comfy.org/templates/profiles/sirolim.png'
  }
] satisfies readonly {
  template: HubTemplate
  href: string
  creatorDisplayName: string
  creatorAvatarUrl: string
}[]
