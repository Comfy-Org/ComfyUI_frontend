import type { Locale } from '../i18n/translations'

type LocalizedText = Record<Locale, string>

interface AffiliateProgramDetail {
  id: string
  label: LocalizedText
  value: LocalizedText
}

export const affiliateProgramDetails: readonly AffiliateProgramDetail[] = [
  {
    id: 'commission-rate',
    label: { en: 'Commission rate', 'zh-CN': '佣金比例' },
    value: { en: '30% recurring', 'zh-CN': '30% 持续佣金' }
  },
  {
    id: 'commission-duration',
    label: { en: 'Commission duration', 'zh-CN': '佣金周期' },
    value: { en: '3 months', 'zh-CN': '3 个月' }
  },
  {
    id: 'cookie-window',
    label: { en: 'Cookie window', 'zh-CN': 'Cookie 有效期' },
    value: { en: '60 days', 'zh-CN': '60 天' }
  },
  {
    id: 'eligible-products',
    label: { en: 'Eligible products', 'zh-CN': '符合条件的产品' },
    value: {
      en: 'Comfy Cloud paid subscription plans',
      'zh-CN': 'Comfy Cloud 付费订阅方案'
    }
  },
  {
    id: 'payouts',
    label: { en: 'Payouts', 'zh-CN': '结算' },
    value: {
      en: 'Monthly, within first 10 business days',
      'zh-CN': '每月结算，于每月前 10 个工作日内发放'
    }
  },
  {
    id: 'minimum-payout',
    label: { en: 'Minimum payout', 'zh-CN': '最低结算金额' },
    value: { en: '$100', 'zh-CN': '100 美元' }
  }
] as const
