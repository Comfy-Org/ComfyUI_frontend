import type { LocalizedText } from '../i18n/translations'

interface AffiliateBrandAsset {
  id: string
  title: LocalizedText
  preview: string
}

export const affiliateBrandAssets: readonly AffiliateBrandAsset[] = [
  {
    id: 'core-logo',
    title: {
      en: 'Core Logo',
      'zh-CN': '核心标志',
      ja: 'コアロゴ' /* machine */
    },
    preview: '/icons/logo.svg'
  },
  {
    id: 'logomark',
    title: {
      en: 'Logomark',
      'zh-CN': '标志符号',
      ja: 'ロゴマーク' /* machine */
    },
    preview: '/icons/logomark.svg'
  },
  {
    id: 'icon',
    title: { en: 'Icon', 'zh-CN': '图标', ja: 'アイコン' /* machine */ },
    preview: '/affiliates/brand/comfy-color-combo-yellow.svg'
  },
  {
    id: 'amplified-logomark',
    title: {
      en: 'Amplified Logomark',
      'zh-CN': '放大版标志符号',
      ja: 'アンプリファイド・ロゴマーク' /* machine */
    },
    preview: '/affiliates/brand/comfy-amplified-logo.png'
  }
] as const
