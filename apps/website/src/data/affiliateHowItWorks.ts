import type { Locale } from '../i18n/translations'

export type LocalizedText = Record<Locale, string>

export interface HowItWorksStep {
  id: string
  label: LocalizedText
  description: LocalizedText
}

export const affiliateHowItWorksSteps: readonly HowItWorksStep[] = [
  {
    id: 'apply',
    label: {
      en: 'Apply',
      'zh-CN': '申请'
    },
    description: {
      en: 'Submit a quick form. Most applicants approved same day.',
      'zh-CN': '填写一份简短表单。大多数申请当天获批。'
    }
  },
  {
    id: 'share',
    label: {
      en: 'Share',
      'zh-CN': '分享'
    },
    description: {
      en: 'Get your unique tracking link. Share via content, social, email, however you reach your audience.',
      'zh-CN':
        '获取您的专属追踪链接。通过内容、社交、邮件等任何触达受众的方式分享。'
    }
  },
  {
    id: 'earn',
    label: {
      en: 'Earn',
      'zh-CN': '赚取'
    },
    description: {
      en: '30% recurring commission on month 1, 20% recurring through month 12 on every Comfy Cloud subscriber you refer. Tracked in real-time. Paid monthly.',
      'zh-CN':
        '每位您推荐的 Comfy Cloud 订阅者，首月可获 30% 的经常性佣金，之后至第 12 个月持续获得 20% 的经常性佣金。实时追踪，每月结算。'
    }
  }
] as const
