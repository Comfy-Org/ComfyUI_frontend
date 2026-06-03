import type { Locale } from '../i18n/translations'

type LocalizedText = Record<Locale, string>

interface AffiliateFaq {
  id: string
  question: LocalizedText
  answer: LocalizedText
}

export const affiliateFaqs: readonly AffiliateFaq[] = [
  {
    id: 'who-can-apply',
    question: {
      en: 'Who can apply to the affiliate program?',
      'zh-CN': '谁可以申请联盟计划？'
    },
    answer: {
      en: 'Anyone with an audience interested in AI image, video, or 3D — tutorial creators, AI tool reviewers, tech bloggers, and newsletter operators are all welcome.',
      'zh-CN':
        '任何拥有关注 AI 图像、视频或 3D 受众的人都可以申请——教程作者、AI 工具测评、科技博主和简报运营者都欢迎加入。'
    }
  },
  {
    id: 'how-much-can-i-earn',
    question: {
      en: 'How much can I earn?',
      'zh-CN': '我能赚多少？'
    },
    answer: {
      en: 'You earn 30% recurring commission in month 1 and 20% recurring through month 12 on every Comfy Cloud subscriber you refer.',
      'zh-CN':
        '每位您推荐的 Comfy Cloud 订阅者，首月可获 30% 经常性佣金，之后至第 12 个月持续获得 20% 经常性佣金。'
    }
  },
  {
    id: 'when-do-i-get-paid',
    question: {
      en: 'When do I get paid?',
      'zh-CN': '什么时候结算？'
    },
    answer: {
      en: 'Commissions are tracked in real-time and paid out monthly.',
      'zh-CN': '佣金实时追踪，每月结算。'
    }
  },
  {
    id: 'how-are-referrals-tracked',
    question: {
      en: 'How are referrals tracked?',
      'zh-CN': '推荐如何追踪？'
    },
    answer: {
      en: 'Each affiliate gets a unique tracking link. Any sign-up that comes through your link is attributed to you automatically.',
      'zh-CN':
        '每位联盟伙伴会获得专属追踪链接。通过您的链接注册的用户都会自动归属于您。'
    }
  },
  {
    id: 'how-long-to-get-approved',
    question: {
      en: 'How long does approval take?',
      'zh-CN': '审核要多久？'
    },
    answer: {
      en: 'Most applicants are approved the same day they apply.',
      'zh-CN': '大多数申请人当天即可获批。'
    }
  }
] as const
