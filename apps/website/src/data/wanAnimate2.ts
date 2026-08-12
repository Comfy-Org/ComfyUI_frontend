import type {
  ModelLaunchMedia,
  ModelLaunchPage
} from '../templates/model-launch/types'

import { externalLinks } from '../config/routes'

// Wan Animate 2 ships a single workflow template, so every CTA resolves to it.
const WAN_ANIMATE_2_WORKFLOW =
  'https://cloud.comfy.org/?template=video_wan_animate2'

// The hero clip, encoded to the site's web video profile and served from
// media.comfy.org. Its poster is the clip's own first frame. There is no gallery
// yet: the examples we were sent turned out to be Wan 2.6 output, and the real
// Wan Animate 2 renders are blocked on workflow access.
const media = {
  hero: {
    kind: 'video',
    src: 'https://media.comfy.org/website/wan-animate-2/hero.mp4',
    posterSrc: 'https://media.comfy.org/website/wan-animate-2/hero-poster.webp'
  }
} as const satisfies Record<string, ModelLaunchMedia>

export const wanAnimate2Page: ModelLaunchPage = {
  metaTitleKey: 'wanAnimate2.meta.title',
  metaDescriptionKey: 'wanAnimate2.meta.description',
  breadcrumbLabelKey: 'wanAnimate2.breadcrumb.model',
  breadcrumbUpdatedKey: 'wanAnimate2.breadcrumb.updated',
  hero: {
    layout: 'content-first',
    videoSrc: media.hero.src,
    posterSrc: media.hero.posterSrc,
    logoSrc: '/icons/ai-models/wan.svg',
    badgeKeys: [
      'wanAnimate2.hero.tagOpenSource',
      'wanAnimate2.hero.tagReferenceToVideo'
    ],
    titleKey: 'wanAnimate2.hero.title',
    descriptionKey: 'wanAnimate2.hero.description',
    primaryCta: {
      labelKey: 'wanAnimate2.hero.primaryCta',
      href: WAN_ANIMATE_2_WORKFLOW,
      target: '_blank'
    }
  },
  pricing: {
    defaultBillingCycle: 'monthly',
    banner: {
      titleKey: 'wanAnimate2.pricing.banner.title',
      subtitleKey: 'wanAnimate2.pricing.banner.subtitle',
      cta: {
        labelKey: 'wanAnimate2.pricing.banner.cta',
        href: externalLinks.cloud,
        target: '_blank'
      }
    }
  },
  steps: {
    headingKey: 'wanAnimate2.steps.heading',
    stepLabelKey: 'wanAnimate2.steps.step',
    items: [
      {
        id: 'upload-your-reference',
        title: {
          en: 'Upload your reference',
          'zh-CN': '上传你的参考素材'
        },
        description: {
          en: 'A reference image of your character, plus a driving video of the motion you want to transfer.',
          'zh-CN': '一张角色参考图，加上一段你想要迁移的动作驱动视频。'
        }
      },
      {
        id: 'write-the-shot',
        title: { en: 'Write the shot', 'zh-CN': '写下你的镜头' },
        description: {
          en: 'Add your prompt, zero credits',
          'zh-CN': '添加提示词，零积分消耗'
        }
      },
      {
        id: 'run-wan-animate-2',
        title: { en: 'Run Wan Animate 2', 'zh-CN': '运行 Wan Animate 2' },
        description: { en: 'Final render', 'zh-CN': '最终渲染' }
      }
    ],
    primaryCta: {
      labelKey: 'wanAnimate2.steps.primaryCta',
      href: WAN_ANIMATE_2_WORKFLOW,
      target: '_blank'
    }
  },
  runOptions: {
    headingKey: 'wanAnimate2.runOptions.heading',
    subtitleKey: 'wanAnimate2.runOptions.subtitle',
    ctaKey: 'wanAnimate2.runOptions.cta'
  },
  reviews: {
    headingKey: 'wanAnimate2.reviews.heading',
    highlight: {
      titleKey: 'wanAnimate2.reviews.highlightTitle',
      descriptionKey: 'wanAnimate2.reviews.highlightDescription',
      ctaKey: 'wanAnimate2.reviews.highlightCta'
    }
  }
}
