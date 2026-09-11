import type { LocalizedText } from '../i18n/translations'

interface AffiliateFaq {
  id: string
  question: LocalizedText
  answer: LocalizedText
}

export const affiliateFaqs: readonly AffiliateFaq[] = [
  {
    id: 'how-do-i-track-my-referrals',
    question: {
      en: 'How do I track my referrals?',
      'zh-CN': '我如何追踪我的推荐？',
      ja: '紹介実績はどのように確認できますか？' /* machine */
    },
    answer: {
      en: 'Real-time dashboard via our partner portal.',
      'zh-CN': '通过我们的合作伙伴门户使用实时仪表盘追踪。',
      ja: 'パートナーポータルのリアルタイムダッシュボードで確認できます。' /* machine */
    }
  },
  {
    id: 'what-plans-qualify',
    question: {
      en: 'What plans qualify?',
      'zh-CN': '哪些订阅方案符合条件？',
      ja: '対象となるプランは？' /* machine */
    },
    answer: {
      en: 'All Comfy Cloud paid subscription plans (Standard, Creator, Pro, Teams).',
      'zh-CN':
        '所有 Comfy Cloud 付费订阅方案（Standard、Creator、Pro、Teams）。',
      ja: 'Comfy Cloudのすべての有料サブスクリプションプラン（Standard、Creator、Pro、Teams）。' /* machine */
    }
  },
  {
    id: 'how-long-to-get-approved',
    question: {
      en: 'How long does approval take?',
      'zh-CN': '审核需要多长时间？',
      ja: '承認までどのくらいかかりますか？' /* machine */
    },
    answer: {
      en: 'Most applications approved within 24 hours.',
      'zh-CN': '大多数申请会在 24 小时内获批。',
      ja: 'ほとんどの申請は24時間以内に承認されます。' /* machine */
    }
  },
  {
    id: 'when-do-i-get-paid',
    question: {
      en: 'When do I get paid?',
      'zh-CN': '什么时候结算佣金？',
      ja: '報酬はいつ支払われますか？' /* machine */
    },
    answer: {
      en: 'Monthly, within the first 10 business days. Minimum balance $100. Paid via Stripe Express or PayPal.',
      'zh-CN':
        '每月结算，于每月前 10 个工作日内发放。最低结算余额为 100 美元，通过 Stripe Express 或 PayPal 支付。',
      ja: '毎月、最初の10営業日以内に支払われます。最低支払額は$100です。Stripe ExpressまたはPayPalで支払われます。' /* machine */
    }
  },
  {
    id: 'what-happens-if-referral-upgrades-or-downgrades',
    question: {
      en: 'What happens if my referral upgrades or downgrades?',
      'zh-CN': '如果我推荐的用户升级或降级订阅会怎样？',
      ja: '紹介ユーザーがアップグレードまたはダウングレードした場合はどうなりますか？' /* machine */
    },
    answer: {
      en: 'If they upgrade, your commission increases. If they downgrade, it adjusts accordingly. Commission is based on actual amounts received by Comfy.org, net of refunds.',
      'zh-CN':
        '如果他们升级订阅，您的佣金会相应增加；如果降级，佣金也会同步调整。佣金以 Comfy.org 实际收到的金额为准，并扣除退款部分。',
      ja: '紹介ユーザーがアップグレードすると、コミッションが増加します。ダウングレードした場合は、それに応じて調整されます。コミッションは返金額を差し引いた、Comfy.orgが実際に受領した金額に基づきます。' /* machine */
    }
  },
  {
    id: 'can-i-use-coupon-codes',
    question: {
      en: 'Can I use coupon codes?',
      'zh-CN': '我可以使用优惠码吗？',
      ja: 'クーポンコードは使用できますか？' /* machine */
    },
    answer: {
      en: 'Yes. We support both tracking links and unique coupon codes.',
      'zh-CN': '可以。我们同时支持追踪链接和专属优惠码。',
      ja: 'はい。トラッキングリンクと固有のクーポンコードの両方に対応しています。' /* machine */
    }
  },
  {
    id: 'what-if-my-referral-uses-an-ad-blocker',
    question: {
      en: 'What if my referral uses an ad blocker?',
      'zh-CN': '如果我推荐的用户使用广告拦截器怎么办？',
      ja: '紹介ユーザーが広告ブロッカーを使用している場合はどうなりますか？' /* machine */
    },
    answer: {
      en: 'We use server-side tracking, so conversions are tracked regardless.',
      'zh-CN':
        '我们采用服务端追踪，因此无论用户是否使用广告拦截器，转化都能正常记录。',
      ja: 'サーバーサイドトラッキングを使用しているため、広告ブロッカーの利用にかかわらずコンバージョンを追跡できます。' /* machine */
    }
  },
  {
    id: 'what-assets-do-you-provide',
    question: {
      en: 'What assets do you provide?',
      'zh-CN': '你们提供哪些素材？',
      ja: 'どのような素材が提供されますか？' /* machine */
    },
    answer: {
      en: 'Logos and banners on this page, plus screenshots and talking points in your affiliate dashboard after approval.',
      'zh-CN':
        '本页面提供 Logo 和横幅图，获批后您还可以在联盟仪表盘中获取截图和宣传文案。',
      ja: 'このページのロゴとバナーに加え、承認後はアフィリエイトダッシュボードでスクリーンショットと訴求ポイントをご利用いただけます。' /* machine */
    }
  }
] as const
