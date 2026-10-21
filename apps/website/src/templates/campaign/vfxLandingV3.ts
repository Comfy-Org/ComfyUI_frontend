import { getRoutes } from '@/config/routes'
import { vfxRedSkyMedia } from '@/data/vfxMedia'
import { vfxWorkflows } from '@/data/vfxWorkflows'
import type { Locale, t } from '@/i18n/translations'

const pipeline = [
  { id: 1, title: 'vfxV3.workstationTitle' },
  { id: 2, title: 'vfxV2.pipeline.2.title' },
  { id: 3, title: 'vfxV2.pipeline.3.title' },
  { id: 4, title: 'vfxV2.pipeline.4.title' }
] as const

export function vfxLandingV3(locale: Locale, translate: typeof t) {
  const routes = getRoutes(locale)
  const shareImageAlt = translate('vfxV3.shareImageAlt')
  return {
    shareImages: [
      {
        url: vfxRedSkyMedia.share,
        type: 'image/gif',
        width: 1200,
        height: 630,
        alt: shareImageAlt
      },
      {
        url: vfxRedSkyMedia.poster,
        type: 'image/jpeg',
        width: 1200,
        height: 630,
        alt: shareImageAlt
      }
    ] as const,
    contactHref: `${routes.contact}?interest=vfx&landing_version=v3`,
    benefits: pipeline.map(({ id, title }) => ({
      id: `pipeline-${id}`,
      title: translate(title),
      description: translate(`vfxV2.pipeline.${id}.description`)
    })),
    featuredWorkflows: [
      {
        title: translate('vfx.workflows.storyboard'),
        href: 'https://comfy.org/workflows/f4e29143100c-f4e29143100c/',
        media:
          'https://media.comfy.org/hub-media/video/34ea9f1a-1aac-4c6f-af48-b88cf154ec9b.mp4',
        mediaType: 'video' as const,
        poster:
          'https://media.comfy.org/hub-media/posters/34ea9f1a-1aac-4c6f-af48-b88cf154ec9b.jpg',
        tags: ['Seedance 2.0', translate('vfx.workflows.storyboarding')],
        models: ['Seedance']
      },
      ...vfxWorkflows.slice(1, 3).map(({ template, href }) => ({
        title: template.title,
        href,
        media: template.thumbnails[0],
        mediaType: 'image' as const,
        tags: template.tags,
        models: template.models
      }))
    ]
  }
}
