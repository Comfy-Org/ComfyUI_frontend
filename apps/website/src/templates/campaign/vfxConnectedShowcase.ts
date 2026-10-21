import type { WorkflowGraphNode } from '@/components/agent/workflowGraph'
import type { t } from '@/i18n/translations'

const demos = {
  relight: {
    source: 'diner',
    mediaKind: 'video',
    variantIds: [
      'relight_golden',
      'relight_night',
      'relight_blue',
      'relight_rain',
      'relight_snow',
      'relight_day'
    ],
    workflowHref: 'https://cloud.comfy.org/?share=8b18c850d38a',
    keyframeLabel: 'vfxV3.keyframe'
  },
  swap: {
    source: 'backlot',
    mediaKind: 'video',
    variantIds: ['swap_jp', 'swap_uk', 'swap_it'],
    workflowHref: 'https://cloud.comfy.org/?share=28fa6219c110',
    keyframeLabel: 'vfxV3.keyframe'
  },
  reframe: {
    source: 'forest',
    mediaKind: 'image',
    variantIds: ['reframe_wide', 'reframe_vertical'],
    workflowHref: 'https://cloud.comfy.org/?share=ccfd0e7d75c3',
    keyframeLabel: 'vfxV3.keyframe'
  },
  sequence: {
    source: 'rain',
    mediaKind: 'video',
    variantIds: ['seedance_multishot_rain', 'seedance_push', 'seedance_orbit'],
    workflowHref: 'https://cloud.comfy.org/?share=c2191c018939',
    keyframeLabel: 'vfxV3.referenceFrame'
  }
} as const

export type VfxShowcaseDemo = keyof typeof demos

export function workflowNode(
  mediaKind: 'image' | 'video',
  id: string,
  label: string,
  image?: string
): WorkflowGraphNode {
  return {
    id,
    label,
    kind: 'landscape',
    x: 0,
    y: 0,
    width: 256,
    height: 144,
    ...(image && mediaKind === 'video'
      ? { video: image.replace('.jpg', '.mp4'), poster: image, loopVideo: true }
      : { image }),
    alt: label
  }
}

export function showcaseConfig(demo: VfxShowcaseDemo, translate: typeof t) {
  const { source, mediaKind, variantIds, workflowHref, keyframeLabel } =
    demos[demo]
  const variants = variantIds.map((id) => ({
    id,
    label: translate(`vfxV3.variants.${id}`)
  }))
  const firstVariant = variants[0]
  return {
    source,
    mediaKind,
    workflowHref,
    variants,
    original: workflowNode(
      mediaKind,
      'original',
      translate('vfxV3.originalFootage'),
      `${source}.jpg`
    ),
    keyframe: workflowNode(
      'image',
      'keyframe',
      translate(keyframeLabel),
      `${demo === 'sequence' ? source : firstVariant.id}.jpg`
    ),
    preview: workflowNode(
      mediaKind,
      'preview',
      firstVariant.label,
      `${firstVariant.id}.jpg`
    )
  }
}
