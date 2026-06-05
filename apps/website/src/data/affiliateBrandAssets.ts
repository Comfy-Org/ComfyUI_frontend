import type { Locale } from '../i18n/translations'

type LocalizedText = Record<Locale, string>

interface AffiliateBrandAsset {
  id: string
  title: LocalizedText
  download: string
  preview: string
}

export const affiliateBrandAssets: readonly AffiliateBrandAsset[] = [
  {
    id: 'logo-horizontal',
    title: {
      en: 'Comfy logo (horizontal)',
      'zh-CN': 'Comfy 标志（横版）'
    },
    download: '/icons/logo.svg',
    preview: '/icons/logo.svg'
  },
  {
    id: 'logomark',
    title: { en: 'Comfy logomark', 'zh-CN': 'Comfy 标志符号' },
    download: '/icons/logomark.svg',
    preview: '/icons/logomark.svg'
  },
  {
    id: 'comfy-full-logo-yellow',
    title: {
      en: 'Comfy full logo (yellow)',
      'zh-CN': 'Comfy 完整标志（黄色）'
    },
    download: '/affiliates/brand/comfy-full-logo-yellow.svg',
    preview: '/affiliates/brand/comfy-full-logo-yellow.svg'
  },
  {
    id: 'comfy-full-logo-ink',
    title: {
      en: 'Comfy full logo (ink)',
      'zh-CN': 'Comfy 完整标志（深色）'
    },
    download: '/affiliates/brand/comfy-full-logo-ink.svg',
    preview: '/affiliates/brand/comfy-full-logo-ink.svg'
  },
  {
    id: 'amplified-logo-mark',
    title: { en: 'Amplified logo mark', 'zh-CN': '放大版标志符号' },
    download: '/affiliates/brand/comfy-amplified-logo-mark.svg',
    preview: '/affiliates/brand/comfy-amplified-logo-mark.svg'
  },
  {
    id: 'dimensional-logo-mark',
    title: { en: 'Dimensional logo mark', 'zh-CN': '立体版标志符号' },
    download: '/affiliates/brand/comfy-dimensional-logo-mark.svg',
    preview: '/affiliates/brand/comfy-dimensional-logo-mark.svg'
  },
  {
    id: 'color-combo-yellow',
    title: { en: 'Color combo (yellow)', 'zh-CN': '配色组合（黄色）' },
    download: '/affiliates/brand/comfy-color-combo-yellow.svg',
    preview: '/affiliates/brand/comfy-color-combo-yellow.svg'
  },
  {
    id: 'color-combo-ink',
    title: { en: 'Color combo (ink)', 'zh-CN': '配色组合（深色）' },
    download: '/affiliates/brand/comfy-color-combo-ink.svg',
    preview: '/affiliates/brand/comfy-color-combo-ink.svg'
  }
] as const
