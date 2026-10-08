import type { Locale } from './locales'

/**
 * Accessible label for the Comfy API product demo video, kept out of
 * `translations.ts` for the same reason as `deploy-prompt.ts`: that module
 * ships on every page, including `/hub/models/` and its script-byte budget.
 */
const PRODUCT_VIDEO_LABEL: Partial<Record<Locale, string>> & { en: string } = {
  en: 'Comfy API product demo',
  'zh-CN': 'Comfy API 产品演示'
}

export function productVideoLabelFor(locale: Locale): string {
  return PRODUCT_VIDEO_LABEL[locale] ?? PRODUCT_VIDEO_LABEL.en
}
