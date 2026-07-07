import type { LocalizedText } from '../i18n/translations'

interface AffiliateBrandAsset {
  id: string
  title: LocalizedText
  download: string
  preview: string
}

export const BRAND_ASSETS_ZIP =
  'https://media.comfy.org/website/comfy-org-brand-assets.zip'

// Downloadable brand guidelines PDF served from the media bucket with a
// Content-Disposition: attachment header so the link downloads rather than
// opening inline.
export const BRAND_GUIDELINES_PDF =
  'https://media.comfy.org/website/Comfy_Brand_guideline_2026.pdf'

export const affiliateBrandAssets: readonly AffiliateBrandAsset[] = [
  {
    id: 'core-logo',
    title: { en: 'Core Logo', 'zh-CN': '核心标志' },
    download: BRAND_ASSETS_ZIP,
    preview: '/icons/logo.svg'
  },
  {
    id: 'logomark',
    title: { en: 'Logomark', 'zh-CN': '标志符号' },
    download: BRAND_ASSETS_ZIP,
    preview: '/icons/logomark.svg'
  },
  {
    id: 'icon',
    title: { en: 'Icon', 'zh-CN': '图标' },
    download: BRAND_ASSETS_ZIP,
    preview: '/affiliates/brand/comfy-color-combo-yellow.svg'
  },
  {
    id: 'amplified-logomark',
    title: { en: 'Amplified Logomark', 'zh-CN': '放大版标志符号' },
    download: BRAND_ASSETS_ZIP,
    preview: '/affiliates/brand/comfy-amplified-logo.png'
  }
] as const
