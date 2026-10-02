import type { Locale, LocalizedText } from '../../i18n/translations'

/**
 * Copy for the Apps half only. It ships with that half's lazy chunk rather
 * than the site-wide translations every page loads.
 */
const copy = {
  apps: { en: 'Apps', 'zh-CN': '应用' },
  allApps: { en: 'All apps', 'zh-CN': '全部应用' },
  browseAllApps: { en: 'Browse all apps', 'zh-CN': '浏览全部应用' },
  featured: { en: 'Featured app', 'zh-CN': '精选应用' },
  tryFree: { en: 'Try it free', 'zh-CN': '免费试用' },
  comingSoon: { en: 'Coming soon', 'zh-CN': '即将推出' },
  studioName: { en: 'Cinematic Studio', 'zh-CN': '电影工作室' },
  studioTask: {
    en: 'Direct your shot like a film set',
    'zh-CN': '像在片场一样执导镜头'
  },
  reshootName: { en: 'Re-shoot a video', 'zh-CN': '重拍视频' },
  reshootTask: { en: 'Re-shoot from any angle', 'zh-CN': '从任意角度重拍' }
} as const satisfies Record<string, LocalizedText>

export function ac(key: keyof typeof copy, locale: Locale = 'en'): string {
  return copy[key][locale === 'zh-CN' ? locale : 'en']
}

export interface CatalogueApp {
  readonly key: string
  readonly name: string
  readonly task: string
  readonly href: string
  readonly image?: string
}
