import type { LocalizedText } from '../i18n/translations'

interface HowItWorksStep {
  id: string
  label: LocalizedText
  description: LocalizedText
}

export const affiliateHowItWorksSteps: readonly HowItWorksStep[] = [
  {
    id: 'apply',
    label: {
      en: 'Apply',
      'zh-CN': '申请',
      ja: '申請' /* machine */
    },
    description: {
      en: 'Submit a quick form. Most applicants approved same day.',
      'zh-CN': '填写一份简短表单。大多数申请当天获批。',
      ja: '簡単なフォームを送信。ほとんどの申請は当日中に承認されます。' /* machine */
    }
  },
  {
    id: 'share',
    label: {
      en: 'Share',
      'zh-CN': '分享',
      ja: '共有' /* machine */
    },
    description: {
      en: 'Get your unique tracking link. Share via content, social, email, however you reach your audience.',
      'zh-CN':
        '获取您的专属追踪链接。通过内容、社交、邮件等任何触达受众的方式分享。',
      ja: '専用のトラッキングリンクを取得。コンテンツ、SNS、メールなど、オーディエンスに届く方法で共有できます。' /* machine */
    }
  },
  {
    id: 'earn',
    label: {
      en: 'Earn',
      'zh-CN': '赚取',
      ja: '報酬を獲得' /* machine */
    },
    description: {
      en: '30% recurring commission for 3 months on every Comfy Cloud subscriber you refer. Tracked in real-time. Paid monthly.',
      'zh-CN':
        '每位您推荐的 Comfy Cloud 订阅者，可获连续 3 个月 30% 的经常性佣金。实时追踪，每月结算。',
      ja: '紹介した各Comfy Cloud契約者について、3か月間、継続報酬30%。リアルタイムで追跡し、毎月支払われます。' /* machine */
    }
  }
] as const
